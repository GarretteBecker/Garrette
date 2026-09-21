import {
  FINDING_STATUSES, FINDING_STATUS_STYLES, FINDING_STATUS_HEX,
} from '@/lib/types/finding-status';
import { formatDate, formatMoneyRange } from '@/components/ui';
import { warrantyInfo } from '@/lib/member/portal';
import { pointLabel, type SafetyPoint } from '@/lib/emergency';
import PrintButton from '@/components/reports/print-button';
import type { ReportRow } from '@/components/reports/report-document';
import type {
  Property, Finding, PlanItem, Visit, ChecklistItem, Member, Asset, FindingStatus,
} from '@/lib/types/database';

export interface BaselineDocumentProps {
  report: ReportRow;
  property: Property;
  visit: Visit | null;
  members: Member[];
  assets: Asset[];
  rooms: { id: string; name: string }[];
  findings: Finding[];
  checklist: ChecklistItem[];
  plan: PlanItem[];
  safetyPoints: SafetyPoint[];
  isStaff: boolean;
  demo?: boolean;
}

/** Plain-English labels for the house facts captured at baseline. */
const WATER: Record<string, string> = {
  PUBLIC: 'Public water', WELL: 'Private well', SHARED_WELL: 'Shared well', OTHER: 'Other',
};
const SEWER: Record<string, string> = {
  PUBLIC: 'Public sewer', SEPTIC: 'Septic system', MOUND: 'Mound system', OTHER: 'Other',
};
const FUEL: Record<string, string> = {
  NATURAL_GAS: 'Natural gas', PROPANE: 'Propane', OIL: 'Oil',
  ELECTRIC: 'Electric', HEAT_PUMP: 'Heat pump', OTHER: 'Other',
};

/**
 * The Home Baseline Report.
 *
 * The first document a new member ever receives, and a different thing from
 * the quarterly: not "here is what we did in April" but "here is your
 * entire house, written down". Every system, every serial, every warranty,
 * where the shutoffs are with photographs of them, the condition of the
 * place on the day we took it on, and the plan for the next few years.
 *
 * It exists to be shown to somebody else — a spouse deciding whether the
 * membership is worth it, or a buyer's agent years later. So it leads with
 * the count of what was documented rather than with a problem, and it is
 * built to print.
 */
export default function BaselineDocument({
  report: r,
  property: p,
  visit: v,
  members: memberRows,
  assets,
  rooms,
  findings,
  checklist,
  plan,
  safetyPoints,
  isStaff,
  demo = false,
}: BaselineDocumentProps) {
  const primary = memberRows.find((m) => m.is_primary) ?? memberRows[0] ?? null;

  const roomName = new Map(rooms.map((x) => [x.id, x.name]));
  const byRoom = new Map<string, Asset[]>();
  for (const a of assets) {
    const key = a.room_id ? roomName.get(a.room_id) ?? 'Elsewhere' : 'Whole home';
    const list = byRoom.get(key) ?? [];
    list.push(a);
    byRoom.set(key, list);
  }
  const roomGroups = [...byRoom.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Live warranties, soonest to expire. Lifetime cover is worth stating but
  // belongs at the bottom of the list, not the top.
  const warranties = assets
    .map((a) => ({ asset: a, info: warrantyInfo(a.warranty_expires) }))
    .filter((w) => w.info.state !== 'UNKNOWN' && w.info.state !== 'ENDED')
    .sort((a, b) => {
      if (a.info.state === 'LIFETIME' && b.info.state !== 'LIFETIME') return 1;
      if (b.info.state === 'LIFETIME' && a.info.state !== 'LIFETIME') return -1;
      return (a.info.daysLeft ?? 0) - (b.info.daysLeft ?? 0);
    });

  const counts = FINDING_STATUSES.map((s: FindingStatus) => ({
    status: s,
    n: findings.filter((f) => f.status === s).length,
  }));

  const checked = checklist.filter((i) => i.result !== 'NOT_CHECKED').length;
  const planLow = plan.reduce((sum, i) => sum + Number(i.estimated_cost_low ?? 0), 0);
  const planHigh = plan.reduce((sum, i) => sum + Number(i.estimated_cost_high ?? 0), 0);

  const documentedOn = v?.completed_at ?? r.generated_at;

  const facts: [string, string | null][] = [
    ['Built', p.year_built?.toString() ?? null],
    ['Size', p.square_feet ? `${p.square_feet.toLocaleString()} sq ft` : null],
    ['Bedrooms', p.bedrooms?.toString() ?? null],
    ['Bathrooms', p.bathrooms?.toString() ?? null],
    ['Stories', (p as unknown as { stories?: number }).stories?.toString() ?? null],
    ['Construction', (p as unknown as { construction_type?: string }).construction_type ?? null],
    ['Exterior', (p as unknown as { exterior_material?: string }).exterior_material ?? null],
    ['Roof', [
      (p as unknown as { roof_material?: string }).roof_material,
      (p as unknown as { roof_installed_year?: number }).roof_installed_year
        ? `(${(p as unknown as { roof_installed_year: number }).roof_installed_year})`
        : null,
    ].filter(Boolean).join(' ') || null],
    ['Basement', (p as unknown as { basement_type?: string }).basement_type ?? null],
    ['Water', WATER[(p as unknown as { water_source?: string }).water_source ?? ''] ?? null],
    ['Sewer', SEWER[(p as unknown as { sewer_type?: string }).sewer_type ?? ''] ?? null],
    ['Heating fuel', FUEL[(p as unknown as { heating_fuel?: string }).heating_fuel ?? ''] ?? null],
    ['Electrical service', (p as unknown as { electrical_service_amps?: number }).electrical_service_amps
      ? `${(p as unknown as { electrical_service_amps: number }).electrical_service_amps} amp`
      : null],
    ['Lot', p.lot_size_acres ? `${p.lot_size_acres} acres` : null],
  ];
  const knownFacts = facts.filter(([, value]) => value);

  return (
    <div className="min-h-dvh bg-slate-200 py-0 print:bg-white print:py-0">
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

      {isStaff && r.status !== 'RELEASED' && !demo ? (
        <div className="no-print bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
          DRAFT — review this before releasing it to {primary?.first_name ?? 'the member'}.
        </div>
      ) : null}

      <article className="mx-auto max-w-[8.5in] bg-white shadow-xl print:max-w-none print:shadow-none">
        {/* ---------------------------------------------- cover */}
        <header className="bg-navy-700 px-10 py-12 text-white print:px-8 print:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy-200">
            Home Baseline Report
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">{p.name}</h1>
          <p className="mt-2 text-navy-100">
            {p.address_line1}, {p.city}, {p.state} {p.postal_code}
          </p>

          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-navy-100">
            This is your home, written down. Every system we found, what it is,
            how old it is, what it is still covered for, and where to turn it
            off. Keep it — it is yours, and it is worth having the day you sell.
          </p>

          <div className="mt-10 grid grid-cols-4 gap-6 border-t border-white/15 pt-6 text-sm">
            <CoverStat label="Documented" value={formatDate(documentedOn)} />
            <CoverStat label="Items recorded" value={assets.length.toString()} />
            <CoverStat label="Rooms" value={rooms.length.toString()} />
            <CoverStat
              label="Prepared for"
              value={primary ? `${primary.first_name} ${primary.last_name}` : '—'}
            />
          </div>
        </header>

        <div className="px-10 py-10 print:px-8">
          {/* -------------------------------------- 1. what a baseline is */}
          <Section n="01" title="What we did">
            <p className="text-[15px] leading-relaxed text-slate-700">
              We walked your whole home and wrote down what is in it: the
              equipment, the makes and model numbers, install dates, what is
              under warranty, and where the shutoffs are. From here on, every
              visit adds to this record rather than starting again — and when
              something goes wrong, we already know what you have.
            </p>
            {v?.summary ? (
              <p className="mt-4 border-l-2 border-brandgreen-600 pl-4 text-[15px] leading-relaxed text-slate-700">
                {v.summary}
              </p>
            ) : null}
            {checked > 0 ? (
              <p className="mt-4 text-[14px] text-slate-500">
                {checked} {checked === 1 ? 'check' : 'checks'} completed on the
                baseline visit.
              </p>
            ) : null}
          </Section>

          {/* -------------------------------------- 2. the house itself */}
          {knownFacts.length > 0 ? (
            <Section n="02" title="The house itself">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                {knownFacts.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-medium text-navy-800">{value}</dd>
                  </div>
                ))}
              </dl>
              {p.notes ? (
                <p className="mt-5 border-l-2 border-brandgreen-600 pl-4 text-[15px] leading-relaxed text-slate-700">
                  {p.notes}
                </p>
              ) : null}
            </Section>
          ) : null}

          {/* -------------------------------------- 3. shutoffs */}
          <Section n="03" title="Where your shutoffs are">
            <p className="mb-5 text-[15px] leading-relaxed text-slate-700">
              The part of this report to read before you need it. These are in
              the app too, under <span className="font-semibold">Emergency</span>,
              with the photographs.
            </p>
            {safetyPoints.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-amber-900 ring-1 ring-amber-600/20">
                We have not recorded your shutoffs yet — we will photograph them
                on the next visit.
              </p>
            ) : (
              <div className="space-y-4">
                {safetyPoints.map((sp) => (
                  <div key={sp.id} className="break-inside-avoid rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold text-navy-800">{pointLabel(sp)}</h3>
                      {sp.room_name ? (
                        <span className="shrink-0 text-[13px] text-slate-500">{sp.room_name}</span>
                      ) : null}
                    </div>
                    {sp.location_note ? (
                      <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">
                        {sp.location_note}
                      </p>
                    ) : null}
                    {sp.how_to_note ? (
                      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[14px] leading-relaxed text-slate-700">
                        {sp.how_to_note}
                      </p>
                    ) : null}
                    {sp.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sp.photo_url}
                        alt={pointLabel(sp)}
                        className="mt-3 max-h-64 w-full rounded-lg object-cover ring-1 ring-slate-200"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* -------------------------------------- 4. the home record */}
          <Section n="04" title={`Your Home Record — ${assets.length} items`}>
            <p className="mb-5 text-[15px] leading-relaxed text-slate-700">
              Everything we found, room by room. Model and serial numbers matter
              more than people expect: they are what turns a warranty claim or a
              part order from an afternoon into a phone call.
            </p>
            <div className="space-y-6">
              {roomGroups.map(([room, items]) => (
                <div key={room} className="break-inside-avoid">
                  <h3 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-bold uppercase tracking-wider text-navy-700">
                    {room} <span className="font-medium text-slate-400">({items.length})</span>
                  </h3>
                  <table className="w-full text-[13px]">
                    <tbody>
                      {items.map((a) => (
                        <tr key={a.id} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-3 font-medium text-navy-800">{a.name}</td>
                          <td className="py-1.5 pr-3 text-slate-600">
                            {[a.manufacturer, a.model].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-500">
                            {a.serial_number ?? '—'}
                          </td>
                          <td className="py-1.5 text-right text-slate-500">
                            {a.install_date ? formatDate(a.install_date) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </Section>

          {/* -------------------------------------- 5. warranties */}
          {warranties.length > 0 ? (
            <Section n="05" title="What is still under warranty">
              <p className="mb-4 text-[15px] leading-relaxed text-slate-700">
                We watch these dates for you and will tell you before one runs
                out, so anything wrong is found while it is still somebody
                else&rsquo;s bill.
              </p>
              <table className="w-full text-[13px]">
                <tbody>
                  {warranties.map(({ asset: a, info }) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 font-medium text-navy-800">{a.name}</td>
                      <td className="py-1.5 pr-3 text-slate-600">
                        {[a.manufacturer, a.model].filter(Boolean).join(' ')}
                      </td>
                      <td className="py-1.5 text-right text-slate-600">
                        {info.state === 'LIFETIME'
                          ? 'Lifetime'
                          : `to ${formatDate(a.warranty_expires)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* -------------------------------------- 6. condition */}
          <Section n="06" title="The condition we found it in">
            <div className="grid grid-cols-5 gap-3">
              {counts.map(({ status, n }) => {
                const style = FINDING_STATUS_STYLES[status];
                return (
                  <div key={status} className="rounded-lg border border-slate-200 px-3 py-4 text-center">
                    <p className="text-3xl font-semibold text-navy-800">{n}</p>
                    <p className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${style.solid}`}>
                      {style.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {findings.length === 0 ? (
              <p className="mt-5 rounded-lg bg-brandgreen-50 px-4 py-3 text-[15px] font-medium text-brandgreen-800 ring-1 ring-brandgreen-600/25">
                Nothing needing attention on the baseline. That is a good place
                to start from.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {findings.map((f) => (
                  <div
                    key={f.id}
                    className="break-inside-avoid border-l-4 pl-5"
                    style={{ borderColor: FINDING_STATUS_HEX[f.status] }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold text-navy-800">{f.title}</h3>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${FINDING_STATUS_STYLES[f.status].solid}`}>
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
                        <span className="font-semibold">What we recommend:</span>{' '}
                        {f.recommendation}
                      </p>
                    ) : null}
                    {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                      <p className="mt-1.5 font-semibold text-navy-800">
                        {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* -------------------------------------- 7. the plan */}
          {plan.length > 0 ? (
            <Section n="07" title="The next few years">
              <p className="mb-4 text-[15px] leading-relaxed text-slate-700">
                What we expect your home to need, and roughly when. Nothing here
                is committed — it is a budget, not a bill, and you approve each
                piece of work before it happens.
              </p>
              <div className="space-y-2.5">
                {plan.map((i) => (
                  <div key={i.id} className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-800">{i.title}</p>
                      <p className="text-[12px] uppercase tracking-wide text-slate-400">
                        {[i.target_season, i.target_year].filter(Boolean).join(' ')}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-navy-800">
                      {formatMoneyRange(i.estimated_cost_low, i.estimated_cost_high) ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
              {planHigh > 0 ? (
                <div className="mt-4 flex items-baseline justify-between border-t-2 border-navy-700 pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Planned range
                  </p>
                  <p className="text-lg font-semibold text-navy-800">
                    {formatMoneyRange(planLow, planHigh)}
                  </p>
                </div>
              ) : null}
            </Section>
          ) : null}

          {/* -------------------------------------- 8. what happens next */}
          <Section n="08" title="What happens from here">
            <ol className="space-y-3 text-[15px] leading-relaxed text-slate-700">
              <li className="flex gap-3">
                <span className="font-bold text-brandgreen-600">1.</span>
                <span>
                  We visit on your schedule and check the things that matter for
                  the season. Everything we find is added to this record.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brandgreen-600">2.</span>
                <span>
                  You get a written report after each visit — including the ones
                  where nothing is wrong, which is most of them.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brandgreen-600">3.</span>
                <span>
                  When something breaks, tap <span className="font-semibold">Emergency</span>{' '}
                  in the app. We will show you which shutoff is yours and where
                  it is, then get somebody out.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brandgreen-600">4.</span>
                <span>
                  Nothing gets done without a price you have approved first.
                </span>
              </li>
            </ol>
          </Section>
        </div>

        <footer className="border-t-4 border-brandgreen-600 bg-navy-700 px-10 py-8 text-center text-white print:px-8">
          <p className="text-lg font-semibold tracking-tight">One number for your home.</p>
          <p className="mt-2 text-[13px] text-navy-200">
            B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
          </p>
        </footer>
      </article>
    </div>
  );
}

function CoverStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-navy-300">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 break-inside-avoid">
      <div className="mb-4 flex items-baseline gap-3 border-b-2 border-navy-700 pb-2">
        <span className="text-[11px] font-bold tracking-widest text-brandgreen-600">{n}</span>
        <h2 className="text-xl font-semibold tracking-tight text-navy-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}
