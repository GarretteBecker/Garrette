'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveCoverage, removeCoverage } from '@/lib/actions/dispatch';
import { RANKS, RANK_LABEL, performanceSummary, type DispatchRank, type TradeCoverage, type TradePerformance } from '@/lib/dispatch';
import { inputClass } from '@/components/ui';
import type { TradePartner } from '@/lib/types/database';

const RANK_STYLE: Record<DispatchRank, string> = {
  PRIMARY: 'bg-brandgreen-600 text-white',
  SECONDARY: 'bg-navy-600 text-white',
  BACKUP: 'bg-slate-200 text-slate-700',
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 shrink-0 rounded-lg bg-navy-700 px-4 text-[14px] font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * Who you call first, by category.
 *
 * The point is that nobody is choosing from memory at eight on a Friday.
 * A category with no primary is called out, because that is the one that
 * will cost a member half a day when something breaks.
 */
export default function CoverageBoard({
  categories,
  partners,
  coverage,
  performance,
}: {
  categories: string[];
  partners: TradePartner[];
  coverage: TradeCoverage[];
  performance: TradePerformance[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  const perf = new Map(performance.map((p) => [p.trade_partner_id, p]));
  const partner = new Map(partners.map((p) => [p.id, p]));
  const order: Record<DispatchRank, number> = { PRIMARY: 1, SECONDARY: 2, BACKUP: 3 };

  const forCategory = (c: string) =>
    coverage
      .filter((r) => r.category === c)
      .sort((a, b) => order[a.rank] - order[b.rank]);

  const uncovered = categories.filter(
    (c) => !coverage.some((r) => r.category === c && r.rank === 'PRIMARY'),
  );

  return (
    <div className="space-y-5">
      {uncovered.length > 0 ? (
        <div className="rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-600/25">
          <p className="text-[13px] font-semibold text-amber-900">
            No primary set for: {uncovered.join(', ')}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-900/80">
            A job in one of those categories has nobody to go to automatically,
            so it waits for somebody to think of a name.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-brandgreen-50 px-3.5 py-2.5 text-[13px] font-medium text-brandgreen-800 ring-1 ring-brandgreen-600/20">
          Every category has a primary.
        </p>
      )}

      {categories.map((c) => {
        const rows = forCategory(c);
        return (
          <section key={c}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-navy-800">{c}</h3>
              <button
                type="button"
                onClick={() => setOpen(open === c ? null : c)}
                className="text-[13px] font-semibold text-brandgreen-600"
              >
                {open === c ? 'Close' : 'Add a partner'}
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg bg-white px-3.5 py-2.5 text-[13px] text-slate-500 ring-1 ring-slate-200">
                Nobody covers this yet.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {rows.map((r) => {
                  const tp = partner.get(r.trade_partner_id);
                  const p = perf.get(r.trade_partner_id);
                  return (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-white px-3.5 py-3 ring-1 ring-slate-200"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-navy-800">
                          <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${RANK_STYLE[r.rank]}`}>
                            {RANK_LABEL[r.rank]}
                          </span>
                          {tp?.company_name ?? 'Partner'}
                          {tp && !tp.is_active ? (
                            <span className="ml-2 text-[12px] font-normal text-amber-700">inactive</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-[12px] text-slate-500">
                          {p ? performanceSummary(p) : 'No jobs offered yet.'}
                        </p>
                      </div>
                      <form action={removeCoverage} className="shrink-0">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="rounded px-2 py-1 text-[13px] text-slate-400">
                          Remove
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ol>
            )}

            {open === c ? (
              <form action={saveCoverage} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="category" value={c} />
                <select name="trade_partner_id" required className={inputClass} aria-label="Partner">
                  <option value="">Choose a partner…</option>
                  {partners.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name} — {p.trade}</option>
                  ))}
                </select>
                <select name="rank" defaultValue="BACKUP" className={inputClass} aria-label="Rank">
                  {RANKS.map((r) => (
                    <option key={r} value={r}>{RANK_LABEL[r]}</option>
                  ))}
                </select>
                <Submit label="Add" />
              </form>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
