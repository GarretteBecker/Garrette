import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState } from '@/components/ui';
import NoticeButton from '@/components/admin/notice-button';
import {
  noticeState, rescissionWindow, formatDay, daysUntil,
  AGREEMENT_STATUS_LABEL, NOTICE_METHOD_LABEL, type Agreement,
} from '@/lib/agreements';
import type { Property } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

/**
 * The compliance desk.
 *
 * One screen answering the questions that get expensive if nobody asks
 * them: whose renewal reminder is due, whose is late, who is still inside
 * their three-day cancellation window, and whose signed agreement we have
 * never actually filed.
 *
 * ⚠ See docs/pa-compliance.md. The renewal-notice window comes from the
 * Master Program Specification, not from a statute I could confirm.
 */
export default async function CompliancePage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const [{ data: agreements }, { data: properties }] = await Promise.all([
    supabase.from('membership_agreements').select('*').order('term_end'),
    supabase.from('properties').select('id, name'),
  ]);

  const rows = (agreements ?? []) as Agreement[];
  const propertyName = new Map(
    ((properties ?? []) as Pick<Property, 'id' | 'name'>[]).map((p) => [p.id, p.name]),
  );

  const live = rows.filter((a) => a.status === 'ACTIVE' || a.status === 'PENDING_SIGNATURE');

  const overdue = live.filter((a) => noticeState(a) === 'OVERDUE');
  const due = live.filter((a) => noticeState(a) === 'DUE');
  const inWindow = live.filter((a) => rescissionWindow(a).open);
  const noDocument = live.filter((a) => !a.document_id);
  const propertiesWithoutAgreement = ((properties ?? []) as Pick<Property, 'id' | 'name'>[])
    .filter((p) => !live.some((a) => a.property_id === p.id));

  const name = (a: Agreement) => propertyName.get(a.property_id) ?? 'Property';

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title="Compliance" subtitle="Agreements, notices and cancellations" backHref="/team" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-5">
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
          <span className="font-semibold">This is a checklist, not legal advice.</span>{' '}
          It tracks what the app can see. Have a Pennsylvania attorney confirm
          the wording of your agreement and what the law actually requires —
          see <code className="font-mono">docs/pa-compliance.md</code>.
        </p>

        {/* ------------------------------------------- renewal notices late */}
        <Section
          title="Renewal reminders — late"
          hint="Past the window your agreement promises. Send these today."
          tone="red"
          count={overdue.length}
          empty="Nothing late."
        >
          {overdue.map((a) => (
            <AgreementRow key={a.id} agreement={a} propertyName={name(a)} late />
          ))}
        </Section>

        {/* ------------------------------------------- renewal notices due */}
        <Section
          title="Renewal reminders — due now"
          hint="Inside the notice window. Sending one records the date against the agreement."
          tone="amber"
          count={due.length}
          empty="None due."
        >
          {due.map((a) => (
            <AgreementRow key={a.id} agreement={a} propertyName={name(a)} />
          ))}
        </Section>

        {/* ------------------------------------------- cancellation window */}
        <Section
          title="Inside the three-day cancellation window"
          hint="These members can still cancel without penalty. Nothing to do — it is here so nobody is surprised."
          tone="navy"
          count={inWindow.length}
          empty="Nobody is inside their window."
        >
          {inWindow.map((a) => {
            const w = rescissionWindow(a);
            return (
              <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-[14px]">
                <Link href={`/team/properties/${a.property_id}`} className="font-semibold text-navy-800 hover:underline">
                  {name(a)}
                </Link>
                <span className="shrink-0 text-[13px] text-slate-500">
                  ends {formatDay(w.deadline)}
                  {w.daysLeft === 0 ? ' (today)' : ` (${w.daysLeft}d)`}
                </span>
              </li>
            );
          })}
        </Section>

        {/* ------------------------------------------- missing paperwork */}
        <Section
          title="Signed agreement not filed"
          hint="The member cannot read an agreement that is not here, and neither can you."
          tone="amber"
          count={noDocument.length}
          empty="Every live agreement has its document."
        >
          {noDocument.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-[14px]">
              <Link href={`/team/properties/${a.property_id}`} className="font-semibold text-navy-800 hover:underline">
                {name(a)}
              </Link>
              <span className="shrink-0 text-[13px] text-slate-500">
                signed {formatDay(a.signed_at)}
              </span>
            </li>
          ))}
        </Section>

        <Section
          title="No agreement on file at all"
          hint="A member with no recorded agreement has no recorded term, price or cancellation date."
          tone="red"
          count={propertiesWithoutAgreement.length}
          empty="Every property has a live agreement."
        >
          {propertiesWithoutAgreement.map((p) => (
            <li key={p.id} className="py-2 text-[14px]">
              <Link href={`/team/properties/${p.id}`} className="font-semibold text-navy-800 hover:underline">
                {p.name}
              </Link>
            </li>
          ))}
        </Section>

        {/* ------------------------------------------- everything, for the record */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            All agreements ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="No agreements yet" hint="Record one from a property's Overview tab." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {rows.map((a) => (
                <div key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/team/properties/${a.property_id}`} className="font-semibold text-navy-800 hover:underline">
                      {name(a)}
                    </Link>
                    <p className="text-[12px] text-slate-500">
                      {a.tier} · {formatDay(a.term_start)} – {formatDay(a.term_end)}
                      {a.renewal_notice_sent_at
                        ? ` · reminder sent ${formatDay(a.renewal_notice_sent_at)}${
                            a.renewal_notice_method ? ` (${NOTICE_METHOD_LABEL[a.renewal_notice_method]})` : ''
                          }`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-slate-500">
                    {AGREEMENT_STATUS_LABEL[a.status]}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>
      </main>

      <BrandFooter />
    </div>
  );
}

const TONE = {
  red: 'bg-red-50 ring-red-600/25 text-red-900',
  amber: 'bg-amber-50 ring-amber-600/25 text-amber-900',
  navy: 'bg-navy-50 ring-navy-100 text-navy-800',
} as const;

function Section({
  title, hint, tone, count, empty, children,
}: {
  title: string;
  hint: string;
  tone: keyof typeof TONE;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {count > 0 ? (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ring-1 ${TONE[tone]}`}>{count}</span>
        ) : null}
      </div>
      <p className="mb-2 text-[12px] leading-relaxed text-slate-500">{hint}</p>
      {count === 0 ? (
        <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500 ring-1 ring-slate-200">
          {empty}
        </p>
      ) : (
        <Card className="divide-y divide-slate-100 px-4">
          <ul className="divide-y divide-slate-100">{children}</ul>
        </Card>
      )}
    </section>
  );
}

function AgreementRow({
  agreement, propertyName, late = false,
}: {
  agreement: Agreement;
  propertyName: string;
  late?: boolean;
}) {
  const out = daysUntil(agreement.term_end);
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={`/team/properties/${agreement.property_id}`} className="font-semibold text-navy-800 hover:underline">
          {propertyName}
        </Link>
        <span className={`shrink-0 text-[13px] ${late ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
          renews {formatDay(agreement.term_end)}
          {out >= 0 ? ` (${out}d)` : ' (passed)'}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-slate-500">
        Promised between {agreement.renewal_notice_days_before_max} and{' '}
        {agreement.renewal_notice_days_before_min} days before.
      </p>
      <NoticeButton agreementId={agreement.id} />
    </li>
  );
}
