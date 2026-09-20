'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { requestPlanWork, type RequestActionState } from '@/lib/actions/service-requests';
import { textareaClass } from '@/components/ui';
import { STAGE_META } from '@/lib/service-requests';
import type { ServiceRequestStage } from '@/lib/types/database';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-brandgreen-600 text-[15px] font-bold text-white active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send it'}
    </button>
  );
}

/**
 * Saying yes to something on the Home Plan.
 *
 * Deliberately NOT an approve button. The plan quotes a range, and nobody
 * can meaningfully approve a range — so this asks us for a firm price, and
 * the firm price comes back to the same approval screen they already know.
 *
 * Once a job exists for this item the button is replaced by where that job
 * has got to, so the plan and the request never tell them different things.
 */
export default function PlanItemAction({
  findingId,
  existingRequest,
  hrefPrefix = '/home',
  demo = false,
}: {
  findingId: string;
  existingRequest?: { id: string; stage: ServiceRequestStage } | null;
  hrefPrefix?: string;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [demoSent, setDemoSent] = useState(false);
  const [state, formAction] = useActionState<RequestActionState, FormData>(requestPlanWork, {});

  if (existingRequest) {
    const meta = STAGE_META[existingRequest.stage];
    return (
      <Link
        href={`${hrefPrefix}/requests/${existingRequest.id}`}
        className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-navy-50 px-3.5 py-3 ring-1 ring-navy-100 active:bg-navy-100"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-navy-800">
            {meta.owner === 'You' ? 'Waiting on you' : meta.memberLabel}
          </span>
          <span className="block text-[12px] leading-snug text-slate-600">
            {meta.memberHint}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-brandgreen-600">Open</span>
      </Link>
    );
  }

  if (demoSent || state.ok) {
    return (
      <p className="mt-3 rounded-xl bg-brandgreen-50 px-3.5 py-3 text-[13px] font-medium text-brandgreen-800 ring-1 ring-brandgreen-600/20">
        {demo
          ? 'Asked for. On a real membership we would come back with a firm price, and you would approve that price here before anything is booked.'
          : 'Asked for. We will come back with a firm price before anything is booked.'}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 h-12 w-full rounded-xl bg-navy-700 text-[15px] font-bold text-white active:scale-[0.99]"
      >
        Get me a price
      </button>
    );
  }

  return (
    <form
      action={demo ? undefined : formAction}
      onSubmit={
        demo
          ? (e) => {
              e.preventDefault();
              setDemoSent(true);
            }
          : undefined
      }
      className="mt-3 space-y-2"
    >
      <input type="hidden" name="finding_id" value={findingId} />
      <p className="text-[13px] leading-relaxed text-slate-600">
        We will price this properly and send it back for you to approve. The
        figure above is an estimate — nothing is booked and nothing is charged.
      </p>
      <textarea
        name="note"
        rows={2}
        placeholder="Anything we should know? (optional)"
        className={textareaClass}
      />
      <Submit />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 w-full rounded-lg text-[14px] font-medium text-slate-600"
      >
        Cancel
      </button>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
