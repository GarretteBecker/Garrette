import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, formatDate } from '@/components/ui';
import { TIERS, type MembershipTier } from '@/lib/membership';
import type { Member, Property } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface Row {
  property: Property;
  primary: Member | null;
  renewsOn: string | null;
  daysToRenewal: number | null;
}

/** commitment_start rolled forward by whole terms until it is in the future. */
function nextRenewal(start: string | null, months: number): string | null {
  if (!start || !months) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(start);
  let guard = 0;
  while (d < today && guard++ < 200) d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Built outside the component on purpose.
 *
 * Reading the clock inside a render is impure — React may re-render and
 * get different answers. One read, here, and every row is measured from
 * the same instant.
 */
function buildRows(properties: Property[], members: Member[]): Row[] {
  const now = Date.now();
  return properties.map((property) => {
    const mine = members.filter((m) => m.property_id === property.id);
    const renewsOn = nextRenewal(property.commitment_start, property.commitment_months);
    return {
      property,
      primary: mine.find((m) => m.is_primary) ?? mine[0] ?? null,
      renewsOn,
      daysToRenewal: renewsOn
        ? Math.round((new Date(renewsOn).getTime() - now) / 86_400_000)
        : null,
    };
  });
}

/**
 * The membership book.
 *
 * One row per home rather than per person, because the membership belongs
 * to the property — two spouses on one plan is one membership, and billing
 * a house twice because it has two adults in it would be a real problem.
 */
export default async function MembersPage() {
  const profile = await requireStaff();
  const isOwner = profile.role === 'admin';
  const supabase = await createClient();

  const [{ data: properties }, { data: members }] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('members').select('*'),
  ]);

  const rows = buildRows(
    (properties ?? []) as Property[],
    (members ?? []) as Member[],
  );

  // A demo home is not a member. It stays in the list so it can be opened
  // for a sales demo, and it is left out of every count.
  const real = rows.filter((r) => !r.property.is_demo);
  const total = real.length;
  const byTier = (t: MembershipTier) => real.filter((r) => r.property.tier === t).length;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader profile={profile} title="Members" subtitle={`${total} homes`} backHref="/team" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-5">
        <p className="text-[13px] leading-relaxed text-slate-600">
          One row per home. A membership belongs to the property, not to a
          person — two people on one plan is one membership. Homes marked{' '}
          <span className="font-semibold text-purple-800">Sales demo</span> are
          left out of every count.
          {' '}
          <span className="font-medium text-navy-800">
            {byTier('CORE')} {TIERS.CORE.name} · {byTier('RESPONSE')} {TIERS.RESPONSE.name}
          </span>
        </p>

        {rows.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-semibold text-navy-800">No members yet.</p>
            <p className="mt-1 text-[14px] text-slate-600">
              {isOwner
                ? 'Add the first home from Properties, then invite the homeowner from Team.'
                : 'Ask Garrette to add the first home.'}
            </p>
          </Card>
        ) : (
          <>
            {/* Desktop: a real table. Phone: cards. Same data, no second copy. */}
            <div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 md:block">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-slate-50 text-[12px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Home</th>
                    <th className="px-4 py-2.5 font-semibold">Homeowner</th>
                    <th className="px-4 py-2.5 font-semibold">Plan</th>
                    <th className="px-4 py-2.5 font-semibold">Paying</th>
                    <th className="px-4 py-2.5 font-semibold">Started</th>
                    <th className="px-4 py-2.5 font-semibold">Renews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.property.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/team/properties/${r.property.id}`}
                              className="font-medium text-navy-800 hover:underline">
                          {r.property.name}
                        </Link>
                        {r.property.is_demo ? <DemoChip /> : null}
                        <span className="block text-[13px] text-slate-500">
                          {r.property.address_line1}, {r.property.city}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.primary ? `${r.primary.first_name} ${r.primary.last_name}` : (
                          <span className="text-amber-700">Nobody linked</span>
                        )}
                        {r.primary?.email ? (
                          <span className="block text-[13px] text-slate-500">{r.primary.email}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <TierChip tier={r.property.tier} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{payingLabel(r.property)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(r.property.member_since ?? r.property.commitment_start)}
                      </td>
                      <td className="px-4 py-3">
                        <RenewalCell renewsOn={r.renewsOn} days={r.daysToRenewal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2.5 md:hidden">
              {rows.map((r) => (
                <li key={r.property.id}>
                  <Card className="p-4">
                    <Link href={`/team/properties/${r.property.id}`}
                          className="font-semibold text-navy-800">
                      {r.property.name}
                    </Link>
                    {r.property.is_demo ? <DemoChip /> : null}
                    <p className="text-[13px] text-slate-500">
                      {r.property.address_line1}, {r.property.city}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TierChip tier={r.property.tier} />
                      <span className="text-[13px] text-slate-600">{payingLabel(r.property)}</span>
                    </div>
                    <p className="mt-2 text-[13px] text-slate-600">
                      {r.primary
                        ? `${r.primary.first_name} ${r.primary.last_name}`
                        : 'Nobody linked yet'}
                    </p>
                    <div className="mt-1.5">
                      <RenewalCell renewsOn={r.renewsOn} days={r.daysToRenewal} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <BrandFooter />
    </div>
  );
}

/** Says it out loud, everywhere the demo home appears. */
function DemoChip() {
  return (
    <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-purple-800">
      Sales demo
    </span>
  );
}

function payingLabel(p: Property): string {
  if (p.is_demo) return 'Demo — not billed';
  const tier = TIERS[p.tier];
  if (!tier) return '—';
  return p.billing_cycle === 'ANNUAL_PREPAID'
    ? `Annual prepay · $${tier.annualPrepaid.toLocaleString('en-US')}`
    : `Monthly · $${tier.monthly}`;
}

function TierChip({ tier }: { tier: MembershipTier }) {
  const t = TIERS[tier];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[12px] font-semibold ${
      tier === 'RESPONSE' ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-800'
    }`}>
      {t?.name ?? tier}
    </span>
  );
}

/**
 * Renewal, with the thing that actually matters: how long you have.
 *
 * Amber inside 30 days because that is when a notice has to go out, and
 * red once it is behind you because a lapsed membership that nobody
 * noticed is the worst version of this.
 */
function RenewalCell({ renewsOn, days }: { renewsOn: string | null; days: number | null }) {
  if (!renewsOn) return <span className="text-[13px] text-slate-400">No term recorded</span>;
  const soon = days != null && days <= 30;
  return (
    <span className={`text-[13px] ${soon ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>
      {formatDate(renewsOn)}
      {days != null ? (
        <span className="block text-[12px]">
          {days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`}
        </span>
      ) : null}
    </span>
  );
}
