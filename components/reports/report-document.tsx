import {
  FINDING_STATUSES, FINDING_STATUS_STYLES,
  CHECKLIST_RESULT_STYLES, needsAttention,
} from '@/lib/types/finding-status';
import { formatDate, formatMoneyRange } from '@/components/ui';
import {
  visitOutcome, cleanQuarterDetail, nothingFoundLine, CLEAN_HEADLINE,
  type VisitOutcome,
} from '@/lib/visit-outcome';
import PrintButton from '@/components/reports/print-button';
import ReportAttachments, { type ReportFile } from '@/components/admin/report-attachments';
import type {
  Property, Finding, PlanItem, Visit, ChecklistItem, Member, FindingStatus, Asset,
} from '@/lib/types/database';

export interface ReportRow {
  id: string;
  property_id: string;
  visit_id: string | null;
  title: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
  status: string;
  released_at: string | null;
  headline_finding_id: string | null;
}

export interface ReportDocumentProps {
  report: ReportRow;
  property: Property;
  visit: Visit | null;
  members: Member[];
  findings: Finding[];
  checklist: ChecklistItem[];
  plan: PlanItem[];
  recordUpdates: Asset[];
  /** Signed URLs keyed by finding id. */
  photoUrls: Map<string, string[]>;
  attachments: (ReportFile & { url: string | null })[];
  isStaff: boolean;
  /** Sales demo: no upload control, no draft banner. */
  demo?: boolean;
}

/**
 * The report itself, as a document.
 *
 * Split out from the page so the sales demo can render a real one from
 * fixture data — the same component, so what a prospect is shown is exactly
 * what a member gets. The page stays responsible for loading and for RLS.
 */
export default function ReportDocument({
  report: r,
  property: p,
  visit: v,
  members: memberRows,
  findings,
  checklist: items,
  plan,
  recordUpdates,
  photoUrls,
  attachments,
  isStaff,
  demo = false,
}: ReportDocumentProps) {
  const isAnnual = r.report_type === 'ANNUAL_REVIEW';

  const counts = FINDING_STATUSES.map((s: FindingStatus) => ({
    status: s,
    n: findings.filter((f) => f.status === s).length,
  }));

  const headline =
    findings.find((f) => f.id === r.headline_finding_id) ??
    findings.find((f) => f.status === 'ACTION') ??
    findings.find((f) => f.status === 'PLAN') ??
    findings[0] ??
    null;

  const improvements = findings.filter((f) => f.status === 'IMPROVEMENT');
  const bodyFindings = findings.filter((f) => f.status !== 'IMPROVEMENT');

  // A quarter where nothing is wrong is the product working. It used to be
  // the outcome this report handled worst — the findings section simply
  // vanished, so a perfect visit read as though the page had failed to load.
  const outcome: VisitOutcome = visitOutcome(findings, items);
  // An admin who explicitly chose a headline finding gets it either way.
  const showClean = outcome.noRepairs && !r.headline_finding_id;
  const completed = items.filter((i) => i.result === 'PASS' || i.result === 'ATTENTION');

  const planTotalLow = plan.reduce((sum, i) => sum + Number(i.estimated_cost_low ?? 0), 0);
  const planTotalHigh = plan.reduce((sum, i) => sum + Number(i.estimated_cost_high ?? 0), 0);

  return (
    <div className="min-h-dvh bg-slate-200 py-0 print:bg-white print:py-0">
      {/* Screen-only action bar */}
      <div className="no-print sticky top-0 z-10 bg-navy-700 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{r.title}</p>
            <p className="text-xs text-navy-200">
              {r.status === 'RELEASED'
                ? `Released ${formatDate(r.released_at)}`
                : 'Draft — not yet visible to the homeowner'}
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      {isStaff && r.status !== 'RELEASED' ? (
        <div className="no-print bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
          DRAFT — review this before releasing it to {memberRows[0]?.first_name ?? 'the member'}.
        </div>
      ) : null}

      {/* The page itself — sized to US Letter so print matches screen. */}
      <article className="mx-auto max-w-[8.5in] bg-white shadow-xl print:max-w-none print:shadow-none">
        {/* ---------------------------------------------- cover */}
        <header className="bg-navy-700 px-10 py-12 text-white print:px-8 print:py-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy-200">
                {isAnnual ? 'Annual Property Report' : 'Quarterly HomeKeeper Report'}
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
                {p.name}
              </h1>
              <p className="mt-2 text-navy-100">
                {p.address_line1}, {p.city}, {p.state} {p.postal_code}
              </p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 className="h-12 w-12 shrink-0 text-white/70" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-300">Period</p>
              <p className="mt-1 font-medium">
                {formatDate(r.period_start)} – {formatDate(r.period_end)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-300">
                {isAnnual ? 'Prepared' : 'Visit'}
              </p>
              <p className="mt-1 font-medium">
                {formatDate(v?.completed_at ?? r.generated_at)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-navy-300">Prepared for</p>
              <p className="mt-1 font-medium">
                {memberRows.find((m) => m.is_primary)
                  ? `${memberRows.find((m) => m.is_primary)!.first_name} ${memberRows.find((m) => m.is_primary)!.last_name}`
                  : '—'}
              </p>
            </div>
          </div>
        </header>

        <div className="px-10 py-10 print:px-8">
          {/* ------------------------------------ 1. property overview */}
          <Section n="01" title="Your home at a glance">
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Built" value={p.year_built?.toString() ?? '—'} />
              <Stat label="Size" value={p.square_feet ? `${p.square_feet.toLocaleString()} sq ft` : '—'} />
              <Stat label="Bedrooms" value={p.bedrooms?.toString() ?? '—'} />
              <Stat label="Bathrooms" value={p.bathrooms?.toString() ?? '—'} />
            </div>
            {p.notes ? (
              <p className="mt-5 border-l-2 border-brandgreen-600 pl-4 text-[15px] leading-relaxed text-slate-700">
                {p.notes}
              </p>
            ) : null}
          </Section>

          {/* ------------------------------------ 2. status summary */}
          <Section n="02" title="Where things stand">
            {/* A row of zeros reads flat. On a clean quarter, say what the
                zeros mean before showing them. */}
            {outcome.noRepairs ? (
              <p className="mb-4 text-[15px] font-medium leading-relaxed text-brandgreen-700">
                {outcome.allClear
                  ? 'Everything we looked at is in good order.'
                  : 'Nothing needs repairing. What is listed below is for your information.'}
                {outcome.allClear && plan.length > 0
                  ? ' Your Home Plan below is unchanged.'
                  : ''}
              </p>
            ) : null}
            <div className="grid grid-cols-5 gap-3">
              {counts.map(({ status, n }) => {
                const style = FINDING_STATUS_STYLES[status];
                return (
                  <div
                    key={status}
                    className="rounded-lg border border-slate-200 px-3 py-4 text-center"
                  >
                    <p className="text-3xl font-semibold text-navy-800">{n}</p>
                    <p className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${style.solid}`}>
                      {style.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <dl className="mt-5 space-y-1.5 text-[13px] text-slate-600">
              {FINDING_STATUSES.map((s) => (
                <div key={s} className="flex gap-3">
                  <dt className="w-28 shrink-0 font-semibold" style={{ color: solidHex(s) }}>
                    {s}
                  </dt>
                  <dd>{FINDING_STATUS_STYLES[s].meaning}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* ------------------------------------ 3. headline finding */}
          {showClean ? (
            <Section n="03" title="The one thing to know">
              <div className="rounded-xl bg-brandgreen-50 p-6 ring-1 ring-brandgreen-600/25">
                <div className="flex items-start gap-4">
                  <span
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brandgreen-600 text-[17px] font-bold text-white"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold leading-snug text-navy-800">
                      {CLEAN_HEADLINE}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
                      {cleanQuarterDetail(outcome, plan.length)}
                    </p>
                  </div>
                </div>
              </div>
            </Section>
          ) : headline ? (
            <Section n="03" title="The one thing to know">
              <div className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold leading-snug text-navy-800">
                    {headline.title}
                  </h3>
                  <span className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-bold ${FINDING_STATUS_STYLES[headline.status].solid}`}>
                    {headline.status}
                  </span>
                </div>
                {headline.description ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
                    {headline.description}
                  </p>
                ) : null}
                {headline.recommendation ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      What we recommend
                    </p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">
                      {headline.recommendation}
                    </p>
                  </div>
                ) : null}
                {formatMoneyRange(headline.estimated_cost_low, headline.estimated_cost_high) ? (
                  <p className="mt-4 text-lg font-semibold text-navy-800">
                    {formatMoneyRange(headline.estimated_cost_low, headline.estimated_cost_high)}
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* ------------------------------------ 4. work completed */}
          <Section n="04" title="What we did">
            {v?.summary ? (
              <p className="mb-5 text-[15px] leading-relaxed text-slate-700">{v.summary}</p>
            ) : null}
            {completed.length > 0 ? (
              <ChecklistSummary items={completed} />
            ) : (
              <p className="text-sm text-slate-500">No checklist recorded for this period.</p>
            )}
            <Readings items={items} />
          </Section>

          {/* ------------------------------------ 5. findings */}
          {bodyFindings.length === 0 ? (
            <Section n="05" title="What we found">
              <p className="rounded-xl bg-brandgreen-50 px-5 py-4 text-[15px] font-medium leading-relaxed text-brandgreen-800 ring-1 ring-brandgreen-600/25">
                {nothingFoundLine(outcome)}
              </p>
            </Section>
          ) : (
            <Section n="05" title="What we found">
              <div className="space-y-6">
                {bodyFindings.map((f) => {
                  const photos = photoUrls.get(f.id) ?? [];
                  const style = FINDING_STATUS_STYLES[f.status];
                  return (
                    <div
                      key={f.id}
                      className="break-inside-avoid border-l-4 pl-5"
                      style={{ borderColor: solidHex(f.status) }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-semibold text-navy-800">{f.title}</h3>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${style.solid}`}>
                          {f.status}
                        </span>
                      </div>
                      {f.description ? (
                        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
                          {f.description}
                        </p>
                      ) : null}
                      {f.recommendation ? (
                        <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                          <span className="font-semibold text-navy-700">Recommendation: </span>
                          {f.recommendation}
                        </p>
                      ) : null}
                      {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                        <p className="mt-2 text-sm font-semibold text-navy-800">
                          Estimated {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                        </p>
                      ) : null}
                      {photos.length > 0 ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {photos.slice(0, 3).map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={url}
                              alt={f.title}
                              className="aspect-[4/3] w-full rounded object-cover ring-1 ring-slate-200"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ------------------------------------ 6. home record updates */}
          {recordUpdates.length > 0 ? (
            <Section n="06" title="Home Record updates">
              <p className="mb-3 text-[14px] text-slate-600">
                These items were added or updated in your Home Record this period.
              </p>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="py-2 font-semibold">Item</th>
                    <th className="py-2 font-semibold">Make / model</th>
                    <th className="py-2 font-semibold">Installed</th>
                    <th className="py-2 font-semibold">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {recordUpdates.slice(0, 14).map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-navy-800">{a.name}</td>
                      <td className="py-2 text-slate-600">
                        {[a.manufacturer, a.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2 text-slate-600">{formatDate(a.install_date)}</td>
                      <td className="py-2 text-slate-600">{a.condition.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* ------------------------------------ 7. home plan */}
          {plan.length > 0 ? (
            <Section n="07" title="Your Home Plan">
              <p className="mb-4 text-[14px] text-slate-600">
                What we are planning for, and roughly when. Nothing here is committed
                until you approve it.
              </p>
              <div className="space-y-3">
                {plan.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 break-inside-avoid border-b border-slate-100 pb-3"
                  >
                    <div>
                      <p className="font-medium text-navy-800">{item.title}</p>
                      {item.description ? (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                        {[item.target_season, item.target_year].filter(Boolean).join(' ')} ·{' '}
                        {item.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-navy-800">
                      {formatMoneyRange(item.estimated_cost_low, item.estimated_cost_high) ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
              {planTotalHigh > 0 ? (
                <div className="mt-4 flex justify-between border-t-2 border-navy-700 pt-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Planned range
                  </p>
                  <p className="font-semibold text-navy-800">
                    {formatMoneyRange(planTotalLow, planTotalHigh)}
                  </p>
                </div>
              ) : null}
            </Section>
          ) : null}

          {/* ------------------------------------ 8. improvements */}
          {improvements.length > 0 ? (
            <Section n="08" title="Worth considering">
              <p className="mb-4 text-[14px] text-slate-600">
                Optional upgrades — not problems, just opportunities we noticed
                while we were in the house.
              </p>
              <div className="space-y-4">
                {improvements.map((f) => (
                  <div key={f.id} className="break-inside-avoid rounded-lg bg-violet-50 p-4">
                    <h3 className="font-semibold text-violet-900">{f.title}</h3>
                    {f.description ? (
                      <p className="mt-1.5 text-[14px] leading-relaxed text-violet-900/80">
                        {f.description}
                      </p>
                    ) : null}
                    {f.recommendation ? (
                      <p className="mt-2 text-[14px] leading-relaxed text-violet-900/80">
                        {f.recommendation}
                      </p>
                    ) : null}
                    {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                      <p className="mt-2 text-sm font-semibold text-violet-900">
                        {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
          {/* The demo has no database behind it, so the upload control would
              be a button that silently does nothing. */}
          {demo ? null : (
            <ReportAttachments
              propertyId={r.property_id}
              reportId={r.id}
              files={attachments}
              canEdit={isStaff}
              released={r.status === 'RELEASED'}
            />
          )}
        </div>

        {/* ---------------------------------------------- footer */}
        <footer className="border-t-4 border-brandgreen-600 bg-navy-700 px-10 py-8 text-center text-white print:px-8">
          <p className="text-lg font-semibold tracking-tight">One number for your home.</p>
          <p className="mt-3 text-sm text-navy-200">
            B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
          </p>
        </footer>
      </article>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 break-inside-avoid">
      <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
        <span className="text-[11px] font-bold tracking-widest text-brandgreen-600">{n}</span>
        <h2 className="text-lg font-semibold tracking-tight text-navy-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-navy-800">{value}</p>
    </div>
  );
}

/** Inline hex, because print stylesheets drop Tailwind ring/border utilities. */
function solidHex(status: Finding['status']): string {
  const map: Record<Finding['status'], string> = {
    GOOD: '#2E5E3A',
    MONITOR: '#1d4ed8',
    PLAN: '#b45309',
    ACTION: '#b91c1c',
    IMPROVEMENT: '#6d28d9',
  };
  return map[status];
}

/**
 * Three hundred ticks is not a report, it is a wall.
 *
 * A member wants to know it was thorough and then wants to know what was
 * wrong. So the sections carry the count — the proof of thoroughness —
 * and only the items that need something are written out in full.
 */
function ChecklistSummary({ items }: { items: ChecklistItem[] }) {
  const byCategory = new Map<string, ChecklistItem[]>();
  for (const i of items) {
    const list = byCategory.get(i.category) ?? [];
    list.push(i);
    byCategory.set(i.category, list);
  }

  const flagged = items.filter((i) => needsAttention(i.result));

  return (
    <>
      <p className="mb-3 text-[15px] leading-relaxed text-slate-700">
        We worked through{' '}
        <span className="font-semibold text-navy-800">{items.length} checks</span>{' '}
        across {byCategory.size} areas of the home.
      </p>

      <ul className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1.5">
        {[...byCategory.entries()].map(([category, list]) => {
          const bad = list.filter((i) => needsAttention(i.result)).length;
          return (
            <li key={category} className="flex gap-2 text-[13px] text-slate-700">
              <span className={`mt-[3px] ${bad ? 'text-amber-600' : 'text-brandgreen-600'}`}>
                {bad ? '!' : '✓'}
              </span>
              <span>
                {category}
                <span className="text-slate-500">
                  {' '}— {list.length} checked{bad ? `, ${bad} flagged` : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {flagged.length > 0 ? (
        <div className="break-inside-avoid rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">
            What needed something
          </p>
          <ul className="mt-2 space-y-2">
            {flagged.map((i) => (
              <li key={i.id} className="text-[13px] leading-relaxed text-amber-900">
                <span className="font-semibold">
                  {CHECKLIST_RESULT_STYLES[i.result].label}
                </span>{' '}
                · {i.category} — {i.label}
                {i.notes ? <span className="block text-amber-900/80">{i.notes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * The readings.
 *
 * This is the part of the report a home inspector cannot produce, because
 * they see a house once. Next year the same table sits beside this one and
 * the member can see which direction their house is going.
 */
function Readings({ items }: { items: ChecklistItem[] }) {
  const taken = items.filter((i) => i.measurement_unit && i.measurement_value != null);
  if (taken.length === 0) return null;

  const inBand = (i: ChecklistItem) => {
    const v = i.measurement_value as number;
    if (i.measurement_low != null && v < i.measurement_low) return false;
    if (i.measurement_high != null && v > i.measurement_high) return false;
    return true;
  };

  return (
    <div className="mt-6 break-inside-avoid">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        What we measured
      </p>
      <p className="mb-3 mt-1 text-[13px] leading-relaxed text-slate-600">
        We record these every visit so you can see which way your home is
        moving, rather than only whether something is broken today.
      </p>
      <table className="w-full text-[13px]">
        <tbody>
          {taken.map((i) => {
            const good = inBand(i);
            return (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-slate-700">
                  {i.measurement_label ?? i.label}
                  <span className="block text-[12px] text-slate-500">{i.category}</span>
                </td>
                <td className="py-1.5 pr-3 text-right font-semibold text-navy-800 whitespace-nowrap">
                  {i.measurement_value} {i.measurement_unit}
                </td>
                <td className="py-1.5 text-right text-[12px] whitespace-nowrap">
                  {i.measurement_low != null || i.measurement_high != null ? (
                    <span className={good ? 'text-brandgreen-700' : 'text-amber-700'}>
                      {good ? 'in range' : 'outside range'}
                      <span className="block text-slate-500">
                        {i.measurement_low ?? ''}
                        {i.measurement_low != null && i.measurement_high != null ? '–' : ''}
                        {i.measurement_high ?? ''} {i.measurement_unit}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">recorded</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
