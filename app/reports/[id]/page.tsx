import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FINDING_STATUSES, FINDING_STATUS_STYLES } from '@/lib/types/finding-status';
import { formatDate, formatMoneyRange } from '@/components/ui';
import PrintButton from '@/components/reports/print-button';
import type {
  Report, Property, Finding, PlanItem, Visit, ChecklistItem, Asset, Member,
} from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface ReportRow extends Report {
  status: 'DRAFT' | 'IN_REVIEW' | 'RELEASED';
  released_at: string | null;
  headline_finding_id: string | null;
  admin_notes: string | null;
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
  if (!report) notFound();
  const r = report as ReportRow;

  const isStaff = profile.role === 'admin' || profile.role === 'tech';

  const [{ data: property }, { data: members }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', r.property_id).maybeSingle(),
    supabase.from('members').select('*').eq('property_id', r.property_id),
  ]);
  if (!property) notFound();
  const p = property as Property;

  const isAnnual = r.report_type === 'ANNUAL_REVIEW';

  // Findings in scope: this visit for a quarterly report, the whole period
  // for an annual one.
  const findingsQuery = supabase.from('findings').select('*').eq('property_id', r.property_id);
  const { data: allFindings } = isAnnual
    ? await findingsQuery
        .gte('created_at', r.period_start ?? '1900-01-01')
        .lte('created_at', `${r.period_end ?? '2999-12-31'}T23:59:59`)
        .order('created_at', { ascending: false })
    : await findingsQuery.eq('visit_id', r.visit_id ?? '').order('created_at', { ascending: false });

  const findings = (allFindings ?? []) as Finding[];

  const [{ data: planItems }, { data: visit }, { data: checklist }, { data: assets }] =
    await Promise.all([
      supabase
        .from('plan_items')
        .select('*')
        .eq('property_id', r.property_id)
        .in('status', ['PROPOSED', 'APPROVED', 'SCHEDULED', 'DEFERRED'])
        .order('target_year')
        .order('sort_order'),
      r.visit_id
        ? supabase.from('visits').select('*').eq('id', r.visit_id).maybeSingle()
        : Promise.resolve({ data: null }),
      r.visit_id
        ? supabase.from('checklist_items').select('*').eq('visit_id', r.visit_id).order('sort_order')
        : Promise.resolve({ data: [] }),
      supabase
        .from('assets')
        .select('*')
        .eq('property_id', r.property_id)
        .gte('updated_at', r.period_start ?? '1900-01-01')
        .order('updated_at', { ascending: false }),
    ]);

  const plan = (planItems ?? []) as PlanItem[];
  const v = (visit ?? null) as Visit | null;
  const items = (checklist ?? []) as ChecklistItem[];
  const recordUpdates = (assets ?? []) as Asset[];
  const memberRows = (members ?? []) as Member[];

  // Photos for the findings in this report, as signed URLs.
  const findingIds = findings.map((f) => f.id);
  const photoUrls = new Map<string, string[]>();
  if (findingIds.length > 0) {
    const { data: photos } = await supabase
      .from('photos')
      .select('finding_id, storage_path')
      .in('finding_id', findingIds);

    for (const row of (photos ?? []) as { finding_id: string; storage_path: string }[]) {
      const { data: signed } = await supabase.storage
        .from('property-photos')
        .createSignedUrl(row.storage_path, 3600);
      if (signed?.signedUrl) {
        const list = photoUrls.get(row.finding_id) ?? [];
        list.push(signed.signedUrl);
        photoUrls.set(row.finding_id, list);
      }
    }
  }

  const counts = FINDING_STATUSES.map((s) => ({
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
          {headline ? (
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
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {completed.map((item) => (
                  <li key={item.id} className="flex gap-2 text-[13px] text-slate-700">
                    <span className="mt-[3px] text-brandgreen-600">✓</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No checklist recorded for this period.</p>
            )}
          </Section>

          {/* ------------------------------------ 5. findings */}
          {bodyFindings.length > 0 ? (
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
          ) : null}

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
