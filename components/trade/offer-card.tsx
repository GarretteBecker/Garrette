'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { respondToOffer, type DispatchActionState } from '@/lib/actions/dispatch';
import { respondCountdown, isOverdue, type DispatchOffer } from '@/lib/dispatch';
import { textareaClass } from '@/components/ui';

function Button({ accept, label }: { accept: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="accept"
      value={accept ? 'true' : 'false'}
      disabled={pending}
      className={`h-14 w-full rounded-xl text-base font-bold active:scale-[0.99] disabled:opacity-60 ${
        accept ? 'bg-brandgreen-600 text-white' : 'bg-white text-navy-700 ring-1 ring-slate-300'
      }`}
    >
      {pending ? 'Sending…' : label}
    </button>
  );
}

/**
 * A job offered to this partner, with the clock on it.
 *
 * The countdown is the point. A trade who can see they have two hours left
 * answers; a trade who was silently assigned a job finds out when somebody
 * rings them, which is how a member ends up waiting three days.
 */
export default function OfferCard({
  offer,
  title,
  property,
  description,
}: {
  offer: DispatchOffer;
  title: string;
  property: string;
  description: string | null;
}) {
  const [declining, setDeclining] = useState(false);
  const [state, formAction] = useActionState<DispatchActionState, FormData>(respondToOffer, {});
  const late = isOverdue(offer);

  if (state.ok) {
    return (
      <li className="rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/25">
        <p className="font-semibold text-brandgreen-800">Thanks — {title} is updated.</p>
      </li>
    );
  }

  return (
    <li className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${late ? 'ring-red-500/40' : 'ring-amber-600/30'}`}>
      <div className={`px-4 py-2 text-[13px] font-bold ${late ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
        {respondCountdown(offer.respond_by)}
        {offer.rank ? ` · you are the ${offer.rank.toLowerCase()}` : ''}
      </div>
      <div className="p-4">
        <p className="text-[17px] font-semibold leading-snug text-navy-800">{title}</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{property}</p>
        {description ? (
          <p className="mt-2 text-[14px] leading-relaxed text-slate-700">{description}</p>
        ) : null}

        <form action={formAction} className="mt-4 space-y-2">
          <input type="hidden" name="offer_id" value={offer.id} />
          {declining ? (
            <>
              <textarea
                name="reason"
                rows={2}
                placeholder="Why not? (helps us route the next one better)"
                className={textareaClass}
              />
              <Button accept={false} label="Send it back" />
              <button
                type="button"
                onClick={() => setDeclining(false)}
                className="h-11 w-full rounded-lg font-medium text-slate-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <Button accept label="Accept this job" />
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className="h-12 w-full rounded-lg font-medium text-slate-600"
              >
                Can&rsquo;t take it
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
    </li>
  );
}
