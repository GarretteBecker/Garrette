import Link from 'next/link';
import { FINDING_STATUS_STYLES, FINDING_STATUS_HEX } from '@/lib/types/finding-status';
import { formatMoneyRange } from '@/components/ui';
import { PortalSection } from './shell';
import QuickActions from './quick-actions';
import WarrantyWatch from './warranty-watch';
import { expiringWarranties } from '@/lib/warranty';
import {
  computeHomeStatus, buildActivity, nextVisit, investmentRange,
  type PortalData,
} from '@/lib/member/portal';
import { STAGE_META } from '@/lib/service-requests';
import type { FindingStatus, ServiceRequestStage } from '@/lib/types/database';

const STATUS_ORDER: FindingStatus[] = ['ACTION', 'PLAN', 'MONITOR', 'IMPROVEMENT', 'GOOD'];

function shortDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function longDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function timeOf(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function MemberDashboard({
  data,
  hrefPrefix = '/home',
  demo = false,
}: {
  data: PortalData;
  hrefPrefix?: string;
  demo?: boolean;
}) {
  // Money on the table. Sits under the hero rather than above it: the
  // headline is still "is my home alright?", and a warranty reminder that
  // pushed that answer off the screen would be selling, not serving.
  const expiring = expiringWarranties(data.assets, data.warrantyNotices ?? []);
  const status = computeHomeStatus(data.findings);
  const activity = buildActivity(data);
  const visit = nextVisit(data.visits);
  const attention = data.findings
    .filter((f) => !f.resolved_at && (f.status === 'ACTION' || f.status === 'PLAN'))
    .sort((a) => (a.status === 'ACTION' ? -1 : 1))
    .slice(0, 3);
  const investment = investmentRange(
    data.findings.filter((f) => f.status === 'ACTION' || f.status === 'PLAN'),
  );

  // The status accent is a reserved status color, and it never carries meaning
  // on its own — the headline text says the same thing in words.
  const accent =
    status.overall === 'URGENT'
      ? { bar: 'bg-[#b91c1c]', ring: 'ring-[#b91c1c]/20' }
      : status.overall === 'ATTENTION'
        ? { bar: 'bg-[#b45309]', ring: 'ring-[#b45309]/20' }
        : { bar: 'bg-[#2E5E3A]', ring: 'ring-[#2E5E3A]/20' };

  return (
    <>
      {/* ---------------------------------------- hero: the one statement */}
      <div className={`mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${accent.ring}`}>
        <div className={`h-1.5 w-full ${accent.bar}`} />
        <div className="p-5">
          <p className="text-[13px] font-medium text-slate-500">
            Good to see you, {data.memberFirstName}.
          </p>
          {/* Hero figure: exactly one per view, and it is a sentence, not a
              number — this is the thing a homeowner wants to know. */}
          <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-navy-800">
            {status.headline}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            {status.detail}
          </p>

          {/* KPI row. Count + word, never color alone. The label is colored
              text rather than a filled chip: at five across on a phone a
              chip's padding pushes "IMPROVEMENT" into its neighbour. */}
          <div className="mt-5 grid grid-cols-5 gap-1 border-t border-slate-100 pt-4">
            {STATUS_ORDER.map((s) => {
              const n = status.counts[s];
              const dim = n === 0;
              return (
                <Link
                  key={s}
                  href={s === 'GOOD' ? `${hrefPrefix}/plan` : `${hrefPrefix}/plan#${s}`}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg py-1 active:bg-slate-50"
                >
                  <span
                    className={`text-[21px] font-semibold leading-none ${
                      dim ? 'text-slate-300' : 'text-navy-800'
                    }`}
                  >
                    {n}
                  </span>
                  <span
                    className="text-center text-[8px] font-bold uppercase leading-[1.1] tracking-tight"
                    style={{ color: dim ? '#94a3b8' : FINDING_STATUS_HEX[s] }}
                  >
                    {FINDING_STATUS_STYLES[s].label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* The two everyday actions, under the home's status — they read
          better below "here is how your home is" than stacked against the
          red of the emergency button. */}
      <QuickActions hrefPrefix={hrefPrefix} />

      {/* ---------------------------------------------- warranty watch */}
      <WarrantyWatch items={expiring} hrefPrefix={hrefPrefix} demo={demo} />

      {/* ---------------------------------------------- open requests */}
      {data.openRequests.length > 0 ? (
        <PortalSection
          title="Your open requests"
          action={
            <Link href={`${hrefPrefix}/requests`} className="text-[13px] font-semibold text-brandgreen-600">
              See all
            </Link>
          }
        >
          <ul className="space-y-2">
            {data.openRequests.slice(0, 3).map((req) => {
              const body = (
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-navy-800">{req.title}</span>
                  <span className="block text-[12px] text-slate-500">
                    {STAGE_META[req.stage as ServiceRequestStage]?.memberLabel ?? req.stage}
                  </span>
                </span>
              );
              const shell = 'flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200';
              return (
                <li key={req.id}>
                  {/* The demo has no per-request page, so these are not links there. */}
                  {hrefPrefix === '/home' ? (
                    <Link href={`${hrefPrefix}/requests/${req.id}`} className={`${shell} active:bg-slate-50`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={shell}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </PortalSection>
      ) : null}

      {/* ---------------------------------------------- next visit */}
      {visit ? (
        <PortalSection title="Your next visit">
          <div className="rounded-2xl bg-gradient-to-br from-brandgreen-600 to-brandgreen-700 p-5 text-white shadow-sm">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-center ring-1 ring-white/20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                  {new Date(visit.scheduled_for!).toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <p className="text-2xl font-semibold leading-tight">
                  {new Date(visit.scheduled_for!).getDate()}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">
                  {visit.title ?? 'Seasonal visit'}
                </p>
                <p className="mt-0.5 text-sm text-brandgreen-100">
                  {longDate(visit.scheduled_for)}
                  {timeOf(visit.scheduled_for) ? ` · ${timeOf(visit.scheduled_for)}` : ''}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-brandgreen-100/90">
                  We will walk the whole house, service what needs it, and leave
                  you a written report.
                </p>
              </div>
            </div>
          </div>
        </PortalSection>
      ) : null}

      {/* ------------------------------------- open recommendations */}
      {attention.length > 0 ? (
        <PortalSection
          title="Open recommendations"
          action={
            <Link href={`${hrefPrefix}/plan`} className="text-[13px] font-semibold text-brandgreen-600">
              See all
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {attention.map((f) => {
              const style = FINDING_STATUS_STYLES[f.status];
              return (
                <li key={f.id}>
                  <Link
                    href={`${hrefPrefix}/plan#${f.id}`}
                    className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold leading-snug text-navy-800">{f.title}</p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.soft}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    {f.recommendation ? (
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                        {f.recommendation}
                      </p>
                    ) : null}
                    {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                      <p className="mt-2 text-[13px] font-semibold text-navy-700">
                        {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          {investment ? (
            <p className="mt-3 rounded-xl bg-navy-50 px-4 py-3 text-[13px] text-navy-800">
              <span className="font-semibold">
                {formatMoneyRange(investment.low, investment.high)}
              </span>{' '}
              estimated across everything currently open. Nothing is committed
              until you approve it.
            </p>
          ) : null}
        </PortalSection>
      ) : null}

      {/* ------------------------------------------ recent activity */}
      {activity.length > 0 ? (
        <PortalSection title="Recent activity">
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {activity.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className={`absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-slate-50 ${
                    entry.kind === 'report'
                      ? 'bg-brandgreen-600'
                      : entry.kind === 'visit'
                        ? 'bg-navy-600'
                        : 'bg-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex items-baseline justify-between gap-3">
                  {entry.href ? (
                    <Link href={entry.href} className="font-medium text-navy-800 underline-offset-2 hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-navy-800">{entry.title}</p>
                  )}
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {shortDate(entry.at)}
                  </span>
                </div>
                {entry.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                    {entry.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </PortalSection>
      ) : null}

      <Link
        href={`${hrefPrefix}/membership`}
        className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-navy-800">Your membership</span>
          <span className="block text-[13px] leading-snug text-slate-500">
            What is included, what is not, and your member pricing.
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             className="h-4 w-4 shrink-0 text-slate-300" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

      <p className="mt-8 text-center text-[11px] text-slate-400">
        B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
      </p>
    </>
  );
}
