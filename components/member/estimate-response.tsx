'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { respondToEstimate, type RequestActionState } from '@/lib/actions/service-requests';
import { textareaClass } from '@/components/ui';
import { memberPrice, money, TIERS, type MembershipTier } from '@/lib/membership';

function Button({ approve, label }: { approve: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="approve"
      value={approve ? 'true' : 'false'}
      disabled={pending}
      className={`h-14 w-full rounded-xl text-base font-bold active:scale-[0.99] disabled:opacity-60 ${
        approve
          ? 'bg-brandgreen-600 text-white'
          : 'bg-white text-navy-700 ring-1 ring-slate-300'
      }`}
    >
      {pending ? 'Sending…' : label}
    </button>
  );
}

/** Approve or decline an estimate, from the member's own phone. */
export default function EstimateResponse({
  requestId,
  amount,
  tier,
  discountUsed = 0,
}: {
  requestId: string;
  amount: number | null;
  tier: MembershipTier | null;
  /** Member benefit already used this membership year, for the cap. */
  discountUsed?: number;
}) {
  const [showDecline, setShowDecline] = useState(false);
  const [state, formAction] = useActionState<RequestActionState, FormData>(respondToEstimate, {});

  // The member benefit is a headline reason to be a member, so it is shown
  // on the quote rather than quietly applied.
  const priced = amount != null ? memberPrice(amount, tier, discountUsed) : null;

  return (
    <div className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">
        Your approval needed
      </p>
      {priced ? (
        priced.saving > 0 ? (
          <>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-navy-800">
                {money(priced.memberPrice)}
              </span>
              <span className="text-[15px] text-slate-400 line-through">
                {money(priced.standard)}
              </span>
            </p>
            <p className="mt-1 inline-block rounded bg-brandgreen-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {tier ? TIERS[tier].name : 'Member'} price · you save {money(priced.saving)}
            </p>
            {priced.capped ? (
              <p className="mt-1.5 text-[12px] text-amber-900/70">
                Your annual member benefit is fully used after this job.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-3xl font-semibold text-navy-800">
            {money(priced.standard)}
          </p>
        )
      ) : null}
      <p className="mt-1.5 text-[13px] leading-relaxed text-amber-900/80">
        Nothing is booked and nothing is charged until you say go.
      </p>

      <form action={formAction} className="mt-4 space-y-2">
        <input type="hidden" name="request_id" value={requestId} />

        {showDecline ? (
          <>
            <textarea
              name="note"
              rows={3}
              placeholder="Anything you'd like us to know? (optional)"
              className={textareaClass}
            />
            <Button approve={false} label="Send it back to B&M" />
            <button
              type="button"
              onClick={() => setShowDecline(false)}
              className="h-11 w-full rounded-lg font-medium text-slate-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Button approve label="Approve this work" />
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              className="h-12 w-full rounded-lg font-medium text-slate-600"
            >
              Not right now
            </button>
          </>
        )}

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
