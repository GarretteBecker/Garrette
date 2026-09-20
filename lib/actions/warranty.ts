'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/ghl/notify';
import { warrantyInfo } from '@/lib/member/portal';
import type { NoticeMethod } from '@/lib/agreements';

export interface WarrantyActionState {
  error?: string;
  ok?: boolean;
  requestId?: string;
}

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ------------------------------------------------------------- member

/**
 * "Have a look while it is covered."
 *
 * Opens an ordinary service request against the item, carrying the warranty
 * date across so whoever prices it knows the clock is running. Raised as the
 * member through the same RLS door as any other request.
 */
export async function requestWarrantyCheck(
  _prev: WarrantyActionState,
  formData: FormData,
): Promise<WarrantyActionState> {
  const assetId = text(formData, 'asset_id');
  if (!assetId) return { error: 'Missing the item.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  // Read the item rather than trusting the form — the name, the dates and
  // the property all come from the record, not the browser.
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, property_id, room_id, name, manufacturer, model, serial_number, warranty_expires')
    .eq('id', assetId)
    .maybeSingle();

  if (assetError) return { error: assetError.message };
  if (!asset) return { error: 'We could not find that item on your record.' };

  const a = asset as {
    id: string; property_id: string; room_id: string | null; name: string;
    manufacturer: string | null; model: string | null; serial_number: string | null;
    warranty_expires: string | null;
  };

  // One open job per item. Tapping twice should not raise two.
  const { data: existing } = await supabase
    .from('service_requests')
    .select('id')
    .eq('asset_id', a.id)
    .neq('stage', 'CLOSED')
    .maybeSingle();
  if (existing) return { ok: true, requestId: (existing as { id: string }).id };

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('property_id', a.property_id)
    .eq('profile_id', user.id)
    .maybeSingle();

  const what = [a.manufacturer, a.model].filter(Boolean).join(' ');
  const description = [
    'Asked for from a warranty reminder in the portal.',
    `${a.name}${what ? ` — ${what}` : ''}${a.serial_number ? ` (serial ${a.serial_number})` : ''}.`,
    a.warranty_expires ? `Warranty ends ${a.warranty_expires}.` : null,
    'Worth checking while it is still covered.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      property_id: a.property_id,
      member_id: member?.id ?? null,
      created_by: user.id,
      asset_id: a.id,
      room_id: a.room_id,
      title: `Warranty check — ${a.name}`,
      description,
      category: 'Something else',
      priority: 'MEDIUM',
      stage: 'NEW',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  // Record that they said yes, so the office worklist stops chasing it.
  if (a.warranty_expires) {
    await supabase.from('warranty_notices').upsert(
      {
        property_id: a.property_id,
        asset_id: a.id,
        warranty_expires: a.warranty_expires,
        response: 'WANTS',
        responded_at: new Date().toISOString(),
        service_request_id: data.id,
      },
      { onConflict: 'asset_id,warranty_expires' },
    );
  }

  revalidatePath('/home');
  revalidatePath('/home/requests');
  revalidatePath('/admin/warranties');

  return { ok: true, requestId: data.id };
}

/** "No thanks." Stops that item being raised again for this warranty period. */
export async function declineWarranty(formData: FormData): Promise<void> {
  const assetId = text(formData, 'asset_id');
  if (!assetId) return;

  const supabase = await createClient();
  await supabase.rpc('member_decline_warranty', { target_asset_id: assetId });

  revalidatePath('/home');
  revalidatePath('/admin/warranties');
}

// -------------------------------------------------------------- staff

/**
 * Tell a member their warranty is running out, and record that we did.
 *
 * The message itself goes out of GoHighLevel — that is where the templates
 * live. What matters here is that "did we tell them?" stops being a memory.
 * With no GHL webhook configured the send is simply off and the record is
 * still written, which is honest: somebody still has to send it, and the
 * worklist keeps saying so until it is marked.
 */
export async function sendWarrantyNotice(formData: FormData): Promise<void> {
  const assetId = text(formData, 'asset_id');
  if (!assetId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: asset } = await supabase
    .from('assets')
    .select('id, property_id, name, manufacturer, model, serial_number, warranty_expires')
    .eq('id', assetId)
    .maybeSingle();
  if (!asset) return;

  const a = asset as {
    id: string; property_id: string; name: string;
    manufacturer: string | null; model: string | null;
    serial_number: string | null; warranty_expires: string | null;
  };
  if (!a.warranty_expires) return;

  const { error } = await supabase.from('warranty_notices').upsert(
    {
      property_id: a.property_id,
      asset_id: a.id,
      warranty_expires: a.warranty_expires,
      notified_at: new Date().toISOString(),
      notified_method: (text(formData, 'method') ?? 'EMAIL') as NoticeMethod,
      notified_by: user?.id ?? null,
    },
    { onConflict: 'asset_id,warranty_expires' },
  );

  // Only ask GHL to write to the member once the record actually saved. A
  // notice they receive that we have no record of is the worst of both.
  if (!error) {
    const info = warrantyInfo(a.warranty_expires);
    await notify('warranty.expiring', a.property_id, {
      asset_id: a.id,
      asset_name: a.name,
      make_model: [a.manufacturer, a.model].filter(Boolean).join(' ') || null,
      serial: a.serial_number,
      warranty_expires: a.warranty_expires,
      days_left: info.daysLeft,
      member_message:
        `Your ${a.name.toLowerCase()} comes out of warranty on ${a.warranty_expires}. ` +
        'If anything is wrong with it, it is far cheaper to find out now than after.',
    });
  }

  revalidatePath('/admin/warranties');
  revalidatePath('/home');
}
