'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/ghl/notify';
import { STAGE_META } from '@/lib/service-requests';
import type { PriorityLevel, ServiceRequestStage, AssetCondition } from '@/lib/types/database';

/**
 * Every action runs as the signed-in user, so RLS decides what is allowed:
 * a member may raise a request on their own property and nothing else; only
 * staff may move a stage or close one out.
 */

export interface RequestActionState {
  error?: string;
  requestId?: string;
  ok?: boolean;
}

/**
 * Tell GoHighLevel a request moved, so it can text or email the member.
 * Never throws and never blocks — see lib/ghl/notify.ts.
 */
async function notifyStage(
  propertyId: string,
  requestId: string,
  title: string,
  from: ServiceRequestStage | null,
  to: ServiceRequestStage,
  extra: Record<string, string | number | null> = {},
): Promise<void> {
  await notify('service_request.stage_changed', propertyId, {
    request_id: requestId,
    request_title: title,
    from_stage: from ? STAGE_META[from].label : null,
    to_stage: STAGE_META[to].label,
    // What the member should be told, ready to drop into a GHL template.
    member_status: STAGE_META[to].memberLabel,
    member_message: STAGE_META[to].memberHint,
    waiting_on: STAGE_META[to].owner,
    ...extra,
  });
}

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ------------------------------------------------------------- member

export async function createServiceRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const propertyId = text(formData, 'property_id');
  const title = text(formData, 'title');
  const description = text(formData, 'description');

  if (!propertyId) return { error: 'Missing property.' };
  if (!title) return { error: 'Give it a short title so we know what to look at.' };
  if (!description) return { error: 'Tell us what is happening — the detail really helps.' };

  // Link the member record so the office knows who raised it.
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('property_id', propertyId)
    .eq('profile_id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      property_id: propertyId,
      member_id: member?.id ?? null,
      created_by: user.id,
      title,
      description,
      category: text(formData, 'category'),
      room_id: text(formData, 'room_id'),
      asset_id: text(formData, 'asset_id'),
      priority: (text(formData, 'priority') ?? 'MEDIUM') as PriorityLevel,
      stage: 'NEW',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // The opening event is written by a database trigger
  // (service_requests_log_created). A member must not be able to write their
  // own stage history, so the app deliberately does not insert it here.

  await notifyStage(propertyId, data.id, title, null, 'NEW', {
    category: text(formData, 'category'),
    urgency: text(formData, 'priority') ?? 'MEDIUM',
  });

  revalidatePath('/home/requests');
  revalidatePath('/admin/requests');

  return { ok: true, requestId: data.id };
}

// -------------------------------------------------------------- staff

/** Move a request one step along (or back), logging who and why. */
export async function moveStage(formData: FormData): Promise<void> {
  const requestId = String(formData.get('request_id'));
  const toStage = String(formData.get('to_stage')) as ServiceRequestStage;
  const note = String(formData.get('note') ?? '').trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current } = await supabase
    .from('service_requests')
    .select('stage, property_id, title')
    .eq('id', requestId)
    .maybeSingle();
  if (!current) return;

  const patch: Record<string, unknown> = { stage: toStage };
  if (toStage === 'APPROVED') patch.approved_at = new Date().toISOString();
  if (toStage === 'CLOSED') patch.closed_at = new Date().toISOString();

  const { error } = await supabase.from('service_requests').update(patch).eq('id', requestId);
  if (error) return;

  await supabase.from('service_request_events').insert({
    service_request_id: requestId,
    from_stage: current.stage,
    to_stage: toStage,
    note,
    actor_id: user?.id ?? null,
  });

  await notifyStage(current.property_id, requestId, current.title, current.stage, toStage);

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/home/requests');
}

/** Triage: set category, urgency and the item it concerns. */
export async function triageRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get('request_id'));
  const supabase = await createClient();

  await supabase
    .from('service_requests')
    .update({
      category: text(formData, 'category'),
      priority: (text(formData, 'priority') ?? 'MEDIUM') as PriorityLevel,
      asset_id: text(formData, 'asset_id'),
      room_id: text(formData, 'room_id'),
      assigned_tech_id: text(formData, 'assigned_tech_id'),
    })
    .eq('id', requestId);

  revalidatePath(`/admin/requests/${requestId}`);
}

/** Dispatch to a trade partner, which also advances the stage. */
export async function assignTradePartner(formData: FormData): Promise<void> {
  const requestId = String(formData.get('request_id'));
  const tradePartnerId = text(formData, 'trade_partner_id');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: current } = await supabase
    .from('service_requests')
    .select('stage, property_id, title')
    .eq('id', requestId)
    .maybeSingle();

  await supabase
    .from('service_requests')
    .update({ trade_partner_id: tradePartnerId, stage: 'DISPATCHED' })
    .eq('id', requestId);

  await supabase.from('service_request_events').insert({
    service_request_id: requestId,
    from_stage: current?.stage ?? null,
    to_stage: 'DISPATCHED',
    note: 'Dispatched to a trade partner.',
    actor_id: user?.id ?? null,
  });

  if (current) {
    await notifyStage(current.property_id, requestId, current.title, current.stage, 'DISPATCHED');
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/admin/requests');
  revalidatePath('/home/requests');
}

/** Price it and put the ball in the member's court. */
export async function setEstimate(formData: FormData): Promise<void> {
  const requestId = String(formData.get('request_id'));
  const amountRaw = text(formData, 'estimate_amount');
  const amount = amountRaw ? Number(amountRaw) : null;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: current } = await supabase
    .from('service_requests')
    .select('stage, property_id, title')
    .eq('id', requestId)
    .maybeSingle();

  await supabase
    .from('service_requests')
    .update({
      estimate_amount: Number.isFinite(amount) ? amount : null,
      stage: 'AWAITING_APPROVAL',
    })
    .eq('id', requestId);

  await supabase.from('service_request_events').insert({
    service_request_id: requestId,
    from_stage: current?.stage ?? null,
    to_stage: 'AWAITING_APPROVAL',
    note: amount ? `Estimate of $${amount.toLocaleString()} sent to the member.` : 'Estimate sent.',
    actor_id: user?.id ?? null,
  });

  if (current) {
    await notifyStage(current.property_id, requestId, current.title, current.stage, 'AWAITING_APPROVAL', {
      estimate_amount: amount ?? null,
    });
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/home/requests');
}

/** Book it in. */
export async function scheduleRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get('request_id'));
  const when = text(formData, 'scheduled_for');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: current } = await supabase
    .from('service_requests')
    .select('stage, property_id, title')
    .eq('id', requestId)
    .maybeSingle();

  await supabase
    .from('service_requests')
    .update({ scheduled_for: when, stage: 'SCHEDULED' })
    .eq('id', requestId);

  await supabase.from('service_request_events').insert({
    service_request_id: requestId,
    from_stage: current?.stage ?? null,
    to_stage: 'SCHEDULED',
    note: when ? `Scheduled for ${new Date(when).toLocaleString()}.` : 'Scheduled.',
    actor_id: user?.id ?? null,
  });

  if (current) {
    await notifyStage(current.property_id, requestId, current.title, current.stage, 'SCHEDULED', {
      scheduled_for: when,
    });
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/home/requests');
}

/**
 * Close out the work.
 *
 * This is the only route to COMPLETED, on purpose: the database function
 * writes the work back to the linked Home Record item, carries the job
 * photos across to it, and advances the stage — so a job can never be
 * marked done without the record being updated.
 */
export async function completeRequest(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const requestId = String(formData.get('request_id'));
  const work = text(formData, 'work_performed');

  if (!work) return { error: 'Say what work was done — this goes in their Home Record.' };

  const supabase = await createClient();
  const condition = text(formData, 'completion_condition');

  const { error } = await supabase.rpc('complete_service_request', {
    target_request_id: requestId,
    p_work_performed: work,
    p_parts_used: text(formData, 'parts_used'),
    p_model: text(formData, 'completion_model'),
    p_serial: text(formData, 'completion_serial'),
    p_condition: (condition as AssetCondition) ?? null,
  });

  if (error) return { error: error.message };

  const { data: done } = await supabase
    .from('service_requests')
    .select('property_id, title, stage')
    .eq('id', requestId)
    .maybeSingle();

  if (done) {
    await notifyStage(done.property_id, requestId, done.title, 'IN_PROGRESS', done.stage, {
      work_performed: work,
    });
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath('/admin/requests');
  revalidatePath('/home/requests');
  return { ok: true };
}
