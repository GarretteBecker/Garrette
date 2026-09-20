'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  rescissionWindow, countdownWords, autoRenewalDisclosure, formatDay,
  OPT_OUT_INSTRUCTIONS, RESCISSION_RIGHT_TEXT, AGREEMENT_STATUS_LABEL,
  type Agreement,
} from '@/lib/agreements';
import { rescindAgreement, type AgreementActionState } from '@/lib/actions/agreements';
import { textareaClass } from '@/components/ui';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-white text-[15px] font-bold text-red-800 ring-1 ring-red-300 active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Cancelling…' : 'Yes, cancel my membership'}
    </button>
  );
}

/**
 * The member's own agreement, and the disclosures Pennsylvania expects
 * around it.
 *
 * ⚠ The wording comes from lib/agreements.ts and has NOT been reviewed by
 * a Pennsylvania attorney. See docs/pa-compliance.md.
 *
 * The three-business-day cancellation is a real button, not a paragraph
 * telling them to ring the office. A statutory right that depends on
 * catching someone at a desk is a right with a handbrake on it.
 */
export default function AgreementPanel({
  agreement,
  documentUrl,
  demo = false,
}: {
  agreement: Agreement | null;
  /** Short-lived signed URL for the signed document, when there is one. */
  documentUrl?: string | null;
  demo?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [demoDone, setDemoDone] = useState(false);
  const [state, formAction] = useActionState<AgreementActionState, FormData>(rescindAgreement, {});

  if (!agreement) {
    return (
      <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Your agreement
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
          We have not put your signed agreement in here yet. Ask us and we will
          add it — it belongs with the rest of your home&rsquo;s paperwork.
        </p>
      </section>
    );
  }

  const win = rescissionWindow(agreement);
  const done = demoDone || state.ok;
  // `done` counts as ended immediately. The row says RESCINDED a moment
  // later, but a screen that says "cancelled" and "renews next year" at the
  // same time is a screen nobody should trust.
  const ended =
    done || agreement.status === 'RESCINDED' || agreement.status === 'CANCELLED';

  return (
    <section className="mb-6 space-y-3">
      {/* ------------------------------------------- the cancellation right */}
      {win.open && !done ? (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-600/25">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">
            You can still change your mind
          </p>
          <p className="mt-1 text-[15px] font-semibold text-navy-800">
            Your right to cancel ends {countdownWords(win.daysLeft)}
            {win.deadline ? ` — ${formatDay(win.deadline)}` : ''}.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-amber-900/80">
            {RESCISSION_RIGHT_TEXT}
          </p>

          {confirming ? (
            <form
              action={demo ? undefined : formAction}
              onSubmit={demo ? (e) => { e.preventDefault(); setDemoDone(true); } : undefined}
              className="mt-3 space-y-2"
            >
              <input type="hidden" name="agreement_id" value={agreement.id} />
              <textarea
                name="reason"
                rows={2}
                placeholder="Anything you would like us to know? (optional)"
                className={textareaClass}
              />
              <Submit />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 w-full rounded-lg text-[14px] font-medium text-slate-600"
              >
                No, keep my membership
              </button>
              {state.error ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  {state.error}
                </p>
              ) : null}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 h-11 w-full rounded-lg bg-white text-[14px] font-semibold text-navy-700 ring-1 ring-slate-300 active:bg-slate-50"
            >
              Cancel my membership
            </button>
          )}
        </div>
      ) : null}

      {done ? (
        <div className="rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/25">
          <p className="text-[15px] font-semibold text-brandgreen-800">
            {demo ? 'Cancelled — in the real app, that is it.' : 'Your membership is cancelled.'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-brandgreen-900/80">
            You cancelled within three business days of signing, so there is
            nothing to pay. We will confirm it in writing.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------- the agreement itself */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Your agreement
        </h2>

        <dl className="mt-2.5 space-y-1.5 text-[13px]">
          <Row label="Signed" value={formatDay(agreement.signed_at)} />
          {agreement.signed_by_name ? (
            <Row label="Signed by" value={agreement.signed_by_name} />
          ) : null}
          <Row label="Term" value={`${formatDay(agreement.term_start)} – ${formatDay(agreement.term_end)}`} />
          <Row label="Commitment" value={`${agreement.commitment_months} months`} />
          {ended || agreement.status !== 'ACTIVE' ? (
            <Row label="Status" value={AGREEMENT_STATUS_LABEL[agreement.status]} />
          ) : null}
        </dl>

        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-navy-50 text-[14px] font-semibold text-navy-700 ring-1 ring-navy-100 active:bg-navy-100"
          >
            Read your signed agreement
          </a>
        ) : null}
      </div>

      {/* ------------------------------------------- renewal disclosure */}
      {!ended ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {agreement.auto_renew ? 'What happens at renewal' : 'When this ends'}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
            {autoRenewalDisclosure(agreement)}
          </p>
          {agreement.auto_renew ? (
            <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
              {OPT_OUT_INSTRUCTIONS}
            </p>
          ) : null}
          {agreement.renewal_notice_sent_at ? (
            <p className="mt-2 text-[12px] text-slate-500">
              We sent your renewal reminder on {formatDay(agreement.renewal_notice_sent_at)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The cancellation right is stated whether or not it is still open —
          HICPA requires the contract to say so, and a member reading this
          screen later should find the same sentence they signed. */}
      {!win.open && !ended ? (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
          <span className="font-semibold">Your right to cancel.</span>{' '}
          {RESCISSION_RIGHT_TEXT}
          {agreement.rescission_deadline
            ? ` For this agreement that window ended on ${formatDay(agreement.rescission_deadline)}.`
            : ''}
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy-800">{value}</dd>
    </div>
  );
}
