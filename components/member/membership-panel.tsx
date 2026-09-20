import { TIERS, FEATURE_LABELS, EXCLUSIONS, annualSaving, money, type MembershipTier, type TierFeature } from '@/lib/membership';

/**
 * What the member is paying for, what they are not, and what the member
 * benefit is worth.
 *
 * The exclusions are here deliberately. A member who believes repairs are
 * included will argue the first invoice, and a contract they signed once
 * settles that far less well than a screen they can look at any time.
 */
export default function MembershipPanel({
  tier,
  billingCycle,
  commitmentStart,
  discountUsed,
}: {
  tier: MembershipTier;
  billingCycle: 'MONTHLY' | 'ANNUAL_PREPAID';
  commitmentStart: string | null;
  discountUsed: number;
}) {
  const def = TIERS[tier];
  const other = TIERS[tier === 'CORE' ? 'RESPONSE' : 'CORE'];
  const capLeft = Math.max(0, def.memberDiscountAnnualCap - discountUsed);

  // Everything Response has that this tier does not — shown to Core as an
  // honest upgrade path rather than hidden.
  const missing = other.features.filter((f) => !def.features.includes(f));

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-700 to-navy-800 text-white shadow-sm">
        <div className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-navy-300">
            Your membership
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{def.name}</h2>
          <p className="mt-1 text-[14px] text-navy-200">{def.tagline}</p>

          <div className="mt-4 flex items-baseline gap-2 border-t border-white/15 pt-4">
            <span className="text-3xl font-semibold">
              {billingCycle === 'ANNUAL_PREPAID'
                ? money(def.annualPrepaid)
                : money(def.monthly)}
            </span>
            <span className="text-[13px] text-navy-200">
              {billingCycle === 'ANNUAL_PREPAID' ? 'a year, prepaid' : 'a month'}
            </span>
          </div>

          {billingCycle === 'ANNUAL_PREPAID' ? (
            <p className="mt-1 text-[12px] text-brandgreen-200">
              One month free — you save {money(annualSaving(tier))} a year.
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-navy-300">
              Prepay the year and save {money(annualSaving(tier))}.
            </p>
          )}

          {commitmentStart ? (
            <p className="mt-3 text-[12px] text-navy-300">
              {def.commitmentMonths}-month initial agreement, started{' '}
              {new Date(commitmentStart).toLocaleDateString('en-US', {
                month: 'long', year: 'numeric',
              })}
              .
            </p>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------- member pricing */}
      <div className="mb-6 rounded-2xl bg-brandgreen-50 p-5 ring-1 ring-brandgreen-600/20">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
          Your member benefit
        </p>
        <p className="mt-1 text-2xl font-semibold text-navy-800">
          {def.memberDiscountPercent}% off qualifying work
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-brandgreen-900/80">
          Applied automatically to every quote we send you, up to{' '}
          {money(def.memberDiscountAnnualCap)} a year.
        </p>
        <div className="mt-3 border-t border-brandgreen-600/20 pt-3">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-brandgreen-900/70">Used this year</span>
            <span className="font-semibold text-navy-800">{money(discountUsed)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[13px]">
            <span className="text-brandgreen-900/70">Still available</span>
            <span className="font-semibold text-navy-800">{money(capLeft)}</span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------- what's included */}
      <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
        What your membership includes
      </h2>
      <ul className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {def.features.map((f: TierFeature, i) => (
          <li
            key={f}
            className={`flex items-start gap-3 p-3.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 className="mt-0.5 h-4 w-4 shrink-0 text-brandgreen-600" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 4 4L19 7" />
            </svg>
            <span className="text-[14px] leading-snug text-navy-800">{FEATURE_LABELS[f]}</span>
          </li>
        ))}
      </ul>

      {/* ------------------------------------- upgrade path, if any */}
      {missing.length > 0 ? (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Also available
          </p>
          <p className="mt-1 font-semibold text-navy-800">{other.name}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {money(other.monthly)} a month · {other.tagline}
          </p>
          <ul className="mt-3 space-y-1.5">
            {missing.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13px] leading-snug text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {FEATURE_LABELS[f]}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-slate-500">
            Give us a call if you would like to talk it through.
          </p>
        </div>
      ) : null}

      {/* --------------------------------------------- exclusions */}
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
        What it does not include
      </h2>
      <p className="mb-2.5 text-[13px] leading-relaxed text-slate-600">
        We find these, coordinate the right trade and get you a price — but
        the work itself is quoted separately, with your member benefit
        applied.
      </p>
      <ul className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {EXCLUSIONS.map((e, i) => (
          <li key={e.title} className={`p-3.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
            <p className="text-[14px] font-medium text-navy-800">{e.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{e.detail}</p>
          </li>
        ))}
      </ul>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-slate-400">
        B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
      </p>
    </>
  );
}
