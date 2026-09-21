'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/ghl/notify';
import type { DispatchRank } from '@/lib/dispatch';

export interface DispatchActionState {
  error?: string;
  ok?: boolean;
  /** Set when the bench ran out rather than something going wrong. */
  noneLeft?: boolean;
}

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// -------------------------------------------------------------- staff

/**
 * Offer the job to the next partner in line.
 *
 * The ranking decides who, unless the office names somebody. Expiring
 * whatever is outstanding happens inside the database function, so the
 * chain reads honestly afterwards: a primary who never answered shows as
 * "no answer in time", not as though they were skipped.
 */
export async function offerToNext(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const requestId = text(formData, 'request_id');
  if (!requestId) return { error: 'Missing the job.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dispatch_next', {
    target_request_id: requestId,
    p_partner_id: text(formData, 'trade_partner_id'),
  });

  if (error) return { error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; trade_partner_id: string; respond_by: string }
    | null;

  if (!row) {
    // Nobody left on the bench. Said plainly rather than failing silently —
    // this is the moment the office needs to pick up the phone.
    return { noneLeft: true };
  }

  const { data: ctx } = await supabase
    .from('service_requests')
    .select('property_id, title')
    .eq('id', requestId)
    .maybeSingle();

  const { data: partner } = await supabase
    .from('trade_partners')
    .select('company_name')
    .eq('id', row.trade_partner_id)
    .maybeSingle();

  if (ctx) {
    const c = ctx as { property_id: string; title: string };
    await notify('dispatch.offered', c.property_id, {
      request_id: requestId,
      request_title: c.title,
      trade_partner: (partner as { company_name?: string } | null)?.company_name ?? null,
      respond_by: row.respond_by,
      member_message: 'We have sent this to one of our trade partners.',
    });
  }

  revalidatePath(`/team/requests/${requestId}`);
  revalidatePath('/team/requests');
  revalidatePath('/trade');
  return { ok: true };
}

/** Add or change a partner's coverage of a category. */
export async function saveCoverage(formData: FormData): Promise<void> {
  const partnerId = text(formData, 'trade_partner_id');
  const category = text(formData, 'category');
  if (!partnerId || !category) return;

  const supabase = await createClient();
  await supabase.from('trade_coverage').upsert(
    {
      trade_partner_id: partnerId,
      category,
      rank: (text(formData, 'rank') ?? 'BACKUP') as DispatchRank,
      notes: text(formData, 'notes'),
    },
    { onConflict: 'trade_partner_id,category' },
  );

  revalidatePath('/team/trade-partners');
}

export async function removeCoverage(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('trade_coverage').delete().eq('id', id);
  revalidatePath('/team/trade-partners');
}

// -------------------------------------------------------------- trade

/**
 * The trade partner answers, from their own phone.
 *
 * This is what makes dispatch real rather than a phone call somebody has to
 * remember to log. The database re-checks that it is their offer, that it
 * is still open, and that the clock has not run out.
 */
export async function respondToOffer(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const offerId = text(formData, 'offer_id');
  if (!offerId) return { error: 'Missing the job.' };

  const accept = formData.get('accept') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('trade_respond_to_offer', {
    target_offer_id: offerId,
    p_accept: accept,
    p_reason: text(formData, 'reason'),
  });

  if (error) return { error: error.message };

  revalidatePath('/trade');
  revalidatePath('/team/requests');
  return { ok: true };
}
