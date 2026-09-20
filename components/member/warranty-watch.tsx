'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  warrantyPitch, warrantyCountdown, type ExpiringWarranty,
} from '@/lib/warranty';
import { requestWarrantyCheck, declineWarranty, type WarrantyActionState } from '@/lib/actions/warranty';

function Ask() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-brandgreen-600 text-[15px] font-bold text-white active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Have a look while it is covered'}
    </button>
  );
}

/**
 * "Your water heater comes out of warranty in about two months."
 *
 * The expiry date has been sitting in the Home Record doing nothing since
 * day one. Used, it is the clearest answer this product has to "what am I
 * paying you for?" — it costs nothing to send and can save a member a
 * couple of thousand dollars.
 *
 * "No thanks" genuinely stops it for that warranty period. A reminder
 * somebody has already declined is a nag, and a nag is worse than silence.
 */
export default function WarrantyWatch({
  items,
  hrefPrefix = '/home',
  demo = false,
}: {
  items: ExpiringWarranty[];
  hrefPrefix?: string;
  demo?: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const live = items.filter((w) => !dismissed.includes(w.asset.id));

  if (live.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
        {live.length === 1 ? 'A warranty is running out' : `${live.length} warranties are running out`}
      </h2>
      <ul className="space-y-2.5">
        {live.map((w) => (
          <WarrantyCard
            key={w.asset.id}
            w={w}
            hrefPrefix={hrefPrefix}
            demo={demo}
            onDismiss={() => setDismissed((d) => [...d, w.asset.id])}
          />
        ))}
      </ul>
    </section>
  );
}

function WarrantyCard({
  w, hrefPrefix, demo, onDismiss,
}: {
  w: ExpiringWarranty;
  hrefPrefix: string;
  demo: boolean;
  onDismiss: () => void;
}) {
  const [asked, setAsked] = useState(false);
  const [state, formAction] = useActionState<WarrantyActionState, FormData>(requestWarrantyCheck, {});
  const done = asked || state.ok;

  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-600/25">
      <div className="h-1 w-full bg-amber-500" />
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">
          Ends {warrantyCountdown(w.info.daysLeft)}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-navy-800">
          {w.asset.name}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-600">
          {warrantyPitch(w)}
        </p>

        {done ? (
          <p className="mt-3 rounded-xl bg-brandgreen-50 px-3.5 py-3 text-[14px] font-medium text-brandgreen-800 ring-1 ring-brandgreen-600/20">
            {demo
              ? 'Asked for. On a real membership this opens a job and we come and look at it before the cover runs out.'
              : 'Asked for. We will be in touch to book it in before the cover runs out.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <form
              action={demo ? undefined : formAction}
              onSubmit={demo ? (e) => { e.preventDefault(); setAsked(true); } : undefined}
            >
              <input type="hidden" name="asset_id" value={w.asset.id} />
              <Ask />
            </form>

            <form
              action={demo ? undefined : declineWarranty}
              onSubmit={demo ? (e) => { e.preventDefault(); onDismiss(); } : undefined}
            >
              <input type="hidden" name="asset_id" value={w.asset.id} />
              <button
                type="submit"
                className="h-10 w-full rounded-lg text-[14px] font-medium text-slate-600"
              >
                No thanks
              </button>
            </form>
          </div>
        )}

        {state.error ? (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        ) : null}

        <Link
          href={`${hrefPrefix}/record`}
          className="mt-2 inline-block text-[12px] font-medium text-slate-400"
        >
          See it in your Home Record
        </Link>
      </div>
    </li>
  );
}
