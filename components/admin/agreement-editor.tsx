'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { saveAgreement } from '@/lib/actions/agreements';
import { Field, inputClass } from '@/components/ui';
import { TIERS, type MembershipTier } from '@/lib/membership';
import {
  formatDay, rescissionWindow, noticeState, AGREEMENT_STATUS_LABEL,
  type Agreement,
} from '@/lib/agreements';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/** YYYY-MM-DD for a date input, from a timestamp or a date. */
function dateValue(v: string | null): string {
  return v ? v.slice(0, 10) : '';
}

/**
 * Recording what a member actually signed.
 *
 * Prices are typed in rather than read from the tier: what they agreed to
 * is a fact about that day, and putting the price up next year must not
 * rewrite it. The cancellation deadline is not a field at all — the
 * database works it out from the signing date, because a statutory
 * three-business-day right should not depend on someone's mental
 * arithmetic on a Friday afternoon.
 */
export default function AgreementEditor({
  propertyId,
  agreement,
  documents,
  defaultTier,
}: {
  propertyId: string;
  agreement: Agreement | null;
  /** CONTRACT documents on this property, to attach the signed copy. */
  documents: { id: string; title: string }[];
  defaultTier: MembershipTier;
}) {
  const [open, setOpen] = useState(!agreement);

  const win = agreement ? rescissionWindow(agreement) : null;
  const notice = agreement ? noticeState(agreement) : null;

  return (
    <div className="space-y-3">
      {agreement ? (
        <div className="rounded-xl bg-slate-50 p-3.5 text-[13px] ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-navy-800">
              {AGREEMENT_STATUS_LABEL[agreement.status]}
            </p>
            <p className="text-slate-500">
              {formatDay(agreement.term_start)} – {formatDay(agreement.term_end)}
            </p>
          </div>
          <p className="mt-1 text-slate-600">
            Signed {formatDay(agreement.signed_at)}
            {agreement.signed_by_name ? ` by ${agreement.signed_by_name}` : ''}
            {agreement.auto_renew ? ' · renews automatically' : ' · does not renew'}
          </p>
          {win?.open ? (
            <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">
              They can still cancel without penalty until {formatDay(win.deadline)}.
            </p>
          ) : null}
          {notice === 'OVERDUE' ? (
            <p className="mt-1.5 rounded bg-red-100 px-2 py-1 font-medium text-red-900">
              Renewal reminder is late.{' '}
              <Link href="/team/compliance" className="underline">Send it</Link>
            </p>
          ) : notice === 'DUE' ? (
            <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">
              Renewal reminder is due.{' '}
              <Link href="/team/compliance" className="underline">Send it</Link>
            </p>
          ) : null}
          {!agreement.document_id ? (
            <p className="mt-1.5 text-amber-800">
              No signed copy attached. Upload it on the Documents tab as a
              Contract, then attach it here.
            </p>
          ) : null}
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 w-full rounded-lg bg-white text-[14px] font-semibold text-navy-700 ring-1 ring-slate-300 active:bg-slate-50"
        >
          {agreement ? 'Edit this agreement' : 'Record an agreement'}
        </button>
      ) : (
        <form action={saveAgreement} className="space-y-3">
          <input type="hidden" name="property_id" value={propertyId} />
          {agreement ? <input type="hidden" name="agreement_id" value={agreement.id} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tier" htmlFor="ag_tier">
              <select id="ag_tier" name="tier" defaultValue={agreement?.tier ?? defaultTier} className={inputClass}>
                {(['CORE', 'RESPONSE'] as MembershipTier[]).map((t) => (
                  <option key={t} value={t}>{TIERS[t].name}</option>
                ))}
              </select>
            </Field>
            <Field label="Billing" htmlFor="ag_cycle">
              <select id="ag_cycle" name="billing_cycle" defaultValue={agreement?.billing_cycle ?? 'MONTHLY'} className={inputClass}>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL_PREPAID">Annual, prepaid</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per month" htmlFor="ag_pm" hint="As signed, not today's rate.">
              <input id="ag_pm" name="price_monthly" type="number" step="0.01" inputMode="decimal"
                     defaultValue={agreement?.price_monthly ?? ''} className={inputClass} />
            </Field>
            <Field label="Price per year" htmlFor="ag_pa">
              <input id="ag_pa" name="price_annual" type="number" step="0.01" inputMode="decimal"
                     defaultValue={agreement?.price_annual ?? ''} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Signed on" htmlFor="ag_signed" hint="Sets the three-day cancellation deadline.">
              <input id="ag_signed" name="signed_at" type="date"
                     defaultValue={dateValue(agreement?.signed_at ?? null)} className={inputClass} />
            </Field>
            <Field label="Signed by" htmlFor="ag_by">
              <input id="ag_by" name="signed_by_name" defaultValue={agreement?.signed_by_name ?? ''}
                     placeholder="Sarah Miller" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Term starts" htmlFor="ag_start">
              <input id="ag_start" name="term_start" type="date" required
                     defaultValue={dateValue(agreement?.term_start ?? null)} className={inputClass} />
            </Field>
            <Field label="Term ends" htmlFor="ag_end">
              <input id="ag_end" name="term_end" type="date" required
                     defaultValue={dateValue(agreement?.term_end ?? null)} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Commitment (months)" htmlFor="ag_months">
              <input id="ag_months" name="commitment_months" type="number" inputMode="numeric"
                     defaultValue={agreement?.commitment_months ?? 12} className={inputClass} />
            </Field>
            <Field label="Status" htmlFor="ag_status">
              <select id="ag_status" name="status" defaultValue={agreement?.status ?? 'ACTIVE'} className={inputClass}>
                <option value="PENDING_SIGNATURE">Waiting for signature</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
                <option value="SUPERSEDED">Replaced</option>
              </select>
            </Field>
          </div>

          <Field label="Signed copy" htmlFor="ag_doc" hint="Upload it on the Documents tab first, as a Contract.">
            <select id="ag_doc" name="document_id" defaultValue={agreement?.document_id ?? ''} className={inputClass}>
              <option value="">Not attached yet</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[14px] text-slate-700">
            <input type="checkbox" name="auto_renew" defaultChecked={agreement?.auto_renew ?? true}
                   className="h-4 w-4 rounded border-slate-300" />
            Renews automatically at the end of the term
          </label>

          <Submit label={agreement ? 'Save agreement' : 'Record agreement'} />
          {agreement ? (
            <button type="button" onClick={() => setOpen(false)}
                    className="h-11 w-full rounded-lg text-[14px] font-medium text-slate-600">
              Cancel
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
