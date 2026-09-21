'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/ghl/notify';
import { autoRenewalDisclosure, type NoticeMethod } from '@/lib/agreements';

export interface AgreementActionState {
  error?: string;
  ok?: boolean;
}

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ------------------------------------------------------------- member

/**
 * The homeowner exercises the three-business-day right to cancel.
 *
 * Runs as them, through one narrow SECURITY DEFINER function that re-checks
 * the caller, the property and the deadline. The app does not decide whether
 * the window is open — the database does, from the date it stamped itself.
 */
export async function rescindAgreement(
  _prev: AgreementActionState,
  formData: FormData,
): Promise<AgreementActionState> {
  const agreementId = text(formData, 'agreement_id');
  if (!agreementId) return { error: 'Missing the agreement.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('member_rescind_agreement', {
    target_agreement_id: agreementId,
    p_reason: text(formData, 'reason'),
  });

  if (error) return { error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as { property_id?: string } | null;
  if (row?.property_id) {
    // The office needs to know today, not at the next invoice run.
    await notify('membership.rescinded', row.property_id, {
      agreement_id: agreementId,
      member_message: 'Cancelled within the three-business-day window.',
    });
    revalidatePath('/team/compliance');
  }

  revalidatePath('/home/membership');
  return { ok: true };
}

// -------------------------------------------------------------- staff

/** Record a signed agreement. The database works out the cancellation date. */
export async function saveAgreement(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const propertyId = text(formData, 'property_id');
  if (!propertyId) return;

  const id = text(formData, 'agreement_id');
  const row = {
    property_id: propertyId,
    tier: text(formData, 'tier') ?? 'CORE',
    billing_cycle: text(formData, 'billing_cycle') ?? 'MONTHLY',
    price_monthly: Number(text(formData, 'price_monthly') ?? 0) || null,
    price_annual: Number(text(formData, 'price_annual') ?? 0) || null,
    commitment_months: Number(text(formData, 'commitment_months') ?? 12) || 12,
    signed_at: text(formData, 'signed_at'),
    signed_by_name: text(formData, 'signed_by_name'),
    term_start: text(formData, 'term_start'),
    term_end: text(formData, 'term_end'),
    auto_renew: formData.get('auto_renew') === 'on',
    document_id: text(formData, 'document_id'),
    status: text(formData, 'status') ?? 'ACTIVE',
    created_by: user?.id ?? null,
  };

  if (id) {
    await supabase.from('membership_agreements').update(row).eq('id', id);
  } else {
    await supabase.from('membership_agreements').insert(row);
  }

  revalidatePath(`/team/properties/${propertyId}`);
  revalidatePath('/team/compliance');
  revalidatePath('/home/membership');
}

/**
 * Send the renewal reminder, and record that it went.
 *
 * Both halves matter. The sending happens in GoHighLevel — that is where the
 * email and text templates live — and the recording is what turns "did we
 * tell them?" into a question with a date on it rather than a memory.
 *
 * With no GHL webhook configured the send is simply off and only the record
 * is written, which is the honest outcome: someone still has to send it, and
 * the screen will keep saying so until they mark it here.
 */
export async function logRenewalNotice(formData: FormData): Promise<void> {
  const agreementId = text(formData, 'agreement_id');
  if (!agreementId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agreement } = await supabase
    .from('membership_agreements')
    .select('property_id, term_end, tier, billing_cycle, price_monthly, price_annual, auto_renew')
    .eq('id', agreementId)
    .maybeSingle();

  const { error } = await supabase
    .from('membership_agreements')
    .update({
      renewal_notice_sent_at: new Date().toISOString(),
      renewal_notice_method: (text(formData, 'method') ?? 'EMAIL') as NoticeMethod,
      renewal_notice_by: user?.id ?? null,
    })
    .eq('id', agreementId);

  // Only tell GoHighLevel to write to the member once the record actually
  // saved. A notice the member gets but we have no record of is the worst of
  // both worlds.
  if (!error && agreement) {
    const a = agreement as {
      property_id: string; term_end: string; tier: string; billing_cycle: string;
      price_monthly: number | null; price_annual: number | null;
    };
    await notify('membership.renewal_notice', a.property_id, {
      agreement_id: agreementId,
      renews_on: a.term_end,
      tier: a.tier,
      billing_cycle: a.billing_cycle,
      renewal_price: a.billing_cycle === 'ANNUAL_PREPAID' ? a.price_annual : a.price_monthly,
      member_message: autoRenewalDisclosure({
        auto_renew: true,
        term_end: a.term_end,
        billing_cycle: a.billing_cycle as 'MONTHLY' | 'ANNUAL_PREPAID',
        price_monthly: a.price_monthly,
        price_annual: a.price_annual,
        renewal_notice_days_before_max: 20,
        renewal_notice_days_before_min: 10,
      }),
    });
  }

  revalidatePath('/team/compliance');
  revalidatePath('/home/membership');
}
