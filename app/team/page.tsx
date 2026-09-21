import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, formatDate } from '@/components/ui';
import { loadDashboard } from '@/lib/team/dashboard';
import { STAGE_META } from '@/lib/service-requests';
import { TIERS } from '@/lib/membership';

export const dynamic = 'force-dynamic';

function money(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}

function timeOf(iso: string | null) {
  if (!iso) return 'No time set';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * The morning screen.
 *
 * Ordered by who is waiting: visits happening today, then work where the
 * ball is with B&M, then what is coming. Money is last on purpose — it is
 * the thing you look at once a week, not the thing you act on at 7am.
 */
export default async function TeamDashboardPage() {
  const profile = await requireStaff();
  const d = await loadDashboard();
  const isOwner = profile.role === 'admin';

  const openStages = d.stageCounts.filter((s) => s.count > 0 && s.stage !== 'CLOSED');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader profile={profile} title="Team console" subtitle={profile.full_name} />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        {/* ------------------------------------------------ what needs you */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Visits today" value={d.today.length}
                href="/team/visits" tone={d.today.length ? 'go' : 'calm'} />
          <Stat label="Waiting on us" value={d.waitingOnUs}
                href="/team/requests" tone={d.waitingOnUs ? 'warn' : 'calm'}
                note="New, triage or approved" />
          <Stat label="ACTION findings" value={d.actionFindings.length}
                tone={d.actionFindings.length ? 'warn' : 'calm'}
                note="Open, not followed up" />
          <Stat label="Reports to review" value={d.reportsAwaitingReview.length}
                href="/team/reports" tone={d.reportsAwaitingReview.length ? 'warn' : 'calm'}
                note="Not yet released" />
        </section>

        {/* ------------------------------------------------ today */}
        <Card className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-navy-800">Today</h2>
            <Link href="/team/visits" className="text-[13px] font-semibold text-brandgreen-600">
              Whole calendar
            </Link>
          </div>
          {d.today.length === 0 ? (
            <p className="text-[14px] text-slate-500">Nothing booked for today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.today.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/team/properties/${v.property_id}`}
                          className="font-medium text-navy-800 hover:underline">
                      {v.property_name}
                    </Link>
                    <p className="text-[13px] text-slate-500">
                      {v.title ?? 'Visit'} · {timeOf(v.scheduled_for)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    v.status === 'IN_PROGRESS'
                      ? 'bg-brandgreen-100 text-brandgreen-800'
                      : v.tech_name ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {v.status === 'IN_PROGRESS' ? 'In progress' : v.tech_name ?? 'Unassigned'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {d.thisWeek.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Rest of the week — {d.thisWeek.length}
              </p>
              <ul className="space-y-1.5">
                {d.thisWeek.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <Link href={`/team/properties/${v.property_id}`} className="truncate text-slate-700 hover:underline">
                      {v.property_name}
                    </Link>
                    <span className="shrink-0 text-slate-500">
                      {formatDate(v.scheduled_for)} · {v.tech_name ?? 'Unassigned'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {/* ------------------------------------------------ the board */}
        <Card className="p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-navy-800">
              Service requests — {d.openRequests} open
            </h2>
            <Link href="/team/requests" className="text-[13px] font-semibold text-brandgreen-600">
              The board
            </Link>
          </div>
          {openStages.length === 0 ? (
            <p className="text-[14px] text-slate-500">Nothing open. Everything is closed out.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {openStages.map((s) => (
                <li key={s.stage}>
                  <Link
                    href={`/team/requests?stage=${s.stage}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-200"
                  >
                    {STAGE_META[s.stage]?.label ?? s.stage}
                    <span className="rounded bg-white px-1.5 py-0.5 text-[12px] font-bold text-navy-800">
                      {s.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          {/* -------------------------------------------- action findings */}
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-navy-800">
              ACTION findings not followed up
            </h2>
            {d.actionFindings.length === 0 ? (
              <p className="text-[14px] text-slate-500">
                Nothing outstanding. Every ACTION finding has been resolved.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.actionFindings.slice(0, 8).map((f) => (
                  <li key={f.id} className="py-2.5">
                    <Link href={`/team/properties/${f.property_id}?tab=findings`}
                          className="font-medium text-navy-800 hover:underline">
                      {f.title}
                    </Link>
                    <p className="text-[13px] text-slate-500">
                      {f.property_name} · raised {formatDate(f.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* -------------------------------------------- renewals */}
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-navy-800">Renewing in the next 30 days</h2>
            {d.renewals.length === 0 ? (
              <p className="text-[14px] text-slate-500">Nobody is up for renewal this month.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.renewals.map((r) => (
                  <li key={r.property_id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/team/properties/${r.property_id}`}
                          className="min-w-0 truncate font-medium text-navy-800 hover:underline">
                      {r.name}
                    </Link>
                    <span className="shrink-0 text-[13px] text-slate-500">
                      {TIERS[r.tier]?.name ?? r.tier} · {formatDate(r.renews_on)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
              Pennsylvania renewal notice timing is in{' '}
              <Link href="/team/compliance" className="font-medium text-brandgreen-700 underline">
                Compliance
              </Link>
              .
            </p>
          </Card>
        </div>

        {/* ------------------------------------------------ money, last */}
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Membership</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Members" value={d.members.total} tone="calm" />
            <Stat label={TIERS.CORE.name} value={d.members.byTier.CORE} tone="calm" />
            <Stat label={TIERS.RESPONSE.name} value={d.members.byTier.RESPONSE} tone="calm" />
            {isOwner ? (
              <Stat label="Monthly recurring" value={money(d.members.mrr)} tone="go"
                    note={`${money(d.members.annualised)} a year`} />
            ) : (
              <div className="rounded-xl bg-slate-100 p-3.5 text-[13px] leading-relaxed text-slate-500">
                Revenue is owner-only.
              </div>
            )}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
            Annual prepayments are spread across twelve months, so the monthly
            figure means the same thing whichever way a member pays.
          </p>
        </Card>

        <div className="pb-4">
          <Link href="/team/members"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-navy-700 font-semibold text-white md:w-auto md:px-6">
            All members
          </Link>
        </div>
      </main>
      <BrandFooter />
    </div>
  );
}

function Stat({
  label, value, note, href, tone,
}: {
  label: string;
  value: number | string;
  note?: string;
  href?: string;
  tone: 'calm' | 'warn' | 'go';
}) {
  const style =
    tone === 'warn' ? 'bg-amber-50 ring-amber-600/25'
    : tone === 'go' ? 'bg-brandgreen-50 ring-brandgreen-600/25'
    : 'bg-white ring-slate-200';

  const body = (
    <div className={`rounded-xl p-3.5 ring-1 ${style} ${href ? 'hover:brightness-[0.98]' : ''}`}>
      <p className="text-[24px] font-semibold leading-none text-navy-800">{value}</p>
      <p className="mt-1.5 text-[13px] font-medium text-slate-700">{label}</p>
      {note ? <p className="text-[12px] text-slate-500">{note}</p> : null}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
