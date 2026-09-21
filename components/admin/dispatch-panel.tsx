'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { offerToNext, type DispatchActionState } from '@/lib/actions/dispatch';
import {
  respondCountdown, responseTone, RESPONSE_LABEL, RANK_LABEL,
  type DispatchOffer,
} from '@/lib/dispatch';
import { inputClass, formatDate } from '@/components/ui';

const TONE: Record<string, string> = {
  good: 'bg-brandgreen-50 text-brandgreen-800 ring-brandgreen-600/25',
  waiting: 'bg-amber-50 text-amber-900 ring-amber-600/25',
  late: 'bg-red-50 text-red-900 ring-red-600/25',
  bad: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Sending…' : label}
    </button>
  );
}

/**
 * Dispatch, as a chain rather than a dropdown.
 *
 * The office should be able to see at a glance who has the job, whether
 * they are late, and who is next — without remembering which plumber owes
 * them a call back. Every offer stays on the record, including the ones
 * nobody answered, because that is what makes the ranking mean something
 * six months from now.
 */
export default function DispatchPanel({
  requestId,
  category,
  offers,
  bench,
}: {
  requestId: string;
  category: string | null;
  offers: DispatchOffer[];
  /** Who covers this category, in rank order, and whether already offered. */
  bench: { id: string; company_name: string; rank: string | null; offered: boolean }[];
}) {
  const [state, formAction] = useActionState<DispatchActionState, FormData>(offerToNext, {});

  const live = offers.find((o) => o.response === 'PENDING' || o.response === 'ACCEPTED') ?? null;
  const next = bench.find((b) => !b.offered) ?? null;

  return (
    <div className="space-y-3">
      {!category ? (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 ring-1 ring-amber-600/20">
          Set a category in Triage first — dispatch follows the category.
        </p>
      ) : null}

      {offers.length > 0 ? (
        <ol className="space-y-2">
          {offers.map((o) => {
            const tone = responseTone(o);
            return (
              <li key={o.id} className={`rounded-xl px-3.5 py-3 text-[13px] ring-1 ${TONE[tone]}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    {o.company_name ?? 'Trade partner'}
                    {o.rank ? (
                      <span className="ml-1.5 font-normal opacity-70">
                        {RANK_LABEL[o.rank]}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium">
                    {o.response === 'PENDING'
                      ? respondCountdown(o.respond_by)
                      : RESPONSE_LABEL[o.response]}
                  </span>
                </div>
                <p className="mt-0.5 opacity-80">
                  Offered {formatDate(o.offered_at)}
                  {o.decline_reason ? ` · “${o.decline_reason}”` : ''}
                  {o.phone ? ` · ${o.phone}` : ''}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600">
          Not offered to anyone yet.
        </p>
      )}

      {/* The bench, so the office can see who is left without guessing. */}
      {category && bench.length > 0 ? (
        <p className="text-[12px] leading-relaxed text-slate-500">
          {category}:{' '}
          {bench
            .map((b) => `${b.company_name}${b.offered ? ' (already asked)' : ''}`)
            .join(' → ')}
        </p>
      ) : category ? (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 ring-1 ring-amber-600/20">
          Nobody covers <span className="font-semibold">{category}</span> yet. Set a
          primary on the Trades page and dispatch becomes one tap.
        </p>
      ) : null}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="request_id" value={requestId} />

        {bench.length > 0 ? (
          <select name="trade_partner_id" defaultValue="" className={inputClass} aria-label="Who to offer it to">
            <option value="">
              {next ? `Next in line — ${next.company_name}` : 'Everyone has been asked'}
            </option>
            {bench.map((b) => (
              <option key={b.id} value={b.id}>
                {b.company_name}
                {b.rank ? ` (${RANK_LABEL[b.rank as 'PRIMARY']})` : ''}
                {b.offered ? ' — already asked' : ''}
              </option>
            ))}
          </select>
        ) : null}

        <Submit
          label={
            live?.response === 'ACCEPTED'
              ? 'Offer it to somebody else'
              : offers.length === 0
                ? 'Offer it'
                : 'Roll it to the next one'
          }
        />

        {state.noneLeft ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-600/20">
            Nobody left on the bench for this category. Pick somebody by hand
            above, or add another partner on the Trades page — this is the
            moment to pick up the phone rather than let it sit.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
