import { FINDING_STATUS_STYLES } from '@/lib/types/finding-status';
import { formatMoneyRange } from '@/components/ui';
import { groupPlan, investmentRange } from '@/lib/member/portal';
import type { Finding, PlanItem } from '@/lib/types/database';

/**
 * The Home Plan, grouped exactly as the brief names it: Action, Plan,
 * Monitor, Improvement. Each finding shows the linked plan item's timing and
 * cost where there is one, so a homeowner sees "what" and "when" together.
 */
export default function HomePlan({
  findings,
  planItems,
}: {
  findings: Finding[];
  planItems: PlanItem[];
}) {
  const groups = groupPlan(findings);
  const actionable = findings.filter(
    (f) => !f.resolved_at && (f.status === 'ACTION' || f.status === 'PLAN'),
  );
  const investment = investmentRange(actionable);

  const planByFinding = new Map(
    planItems.filter((p) => p.finding_id).map((p) => [p.finding_id!, p]),
  );

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-[15px] text-slate-500">
        Nothing on your plan right now. We will add items here as we find them.
      </p>
    );
  }

  return (
    <>
      <div className="mb-6 rounded-2xl bg-navy-700 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest text-navy-300">
          Planned investment
        </p>
        <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">
          {investment ? formatMoneyRange(investment.low, investment.high) : 'Nothing planned'}
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-navy-200">
          Across the {actionable.length} item{actionable.length === 1 ? '' : 's'} that
          need doing or budgeting. Estimates only — nothing is committed until you
          approve it.
        </p>
      </div>

      <div className="space-y-8">
        {groups.map((group) => {
          const style = FINDING_STATUS_STYLES[group.status];
          return (
            <section key={group.status} id={group.status}>
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.solid}`}>
                  {style.label}
                </span>
                <span className="text-[12px] font-medium text-slate-400">
                  {group.findings.length} item{group.findings.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mb-3 text-[13px] text-slate-500">{style.meaning}</p>

              <ul className="space-y-2.5">
                {group.findings.map((f) => {
                  const plan = planByFinding.get(f.id);
                  return (
                    <li key={f.id} id={f.id}>
                      <article
                        className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                      >
                        <div className={`h-1 w-full ${style.solid}`} />
                        <div className="p-4">
                          <h3 className="font-semibold leading-snug text-navy-800">
                            {f.title}
                          </h3>

                          {f.description ? (
                            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">
                              {f.description}
                            </p>
                          ) : null}

                          {f.recommendation ? (
                            <div className="mt-3 rounded-xl bg-slate-50 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                What we recommend
                              </p>
                              <p className="mt-1 text-[14px] leading-relaxed text-slate-700">
                                {f.recommendation}
                              </p>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                              <p className="text-[15px] font-semibold text-navy-800">
                                {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                              </p>
                            ) : null}
                            {plan ? (
                              <p className="text-[12px] font-medium text-slate-500">
                                Planned for{' '}
                                <span className="text-navy-700">
                                  {[plan.target_season, plan.target_year].filter(Boolean).join(' ')}
                                </span>
                                {plan.status !== 'PROPOSED' ? ` · ${plan.status.toLowerCase()}` : ''}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
