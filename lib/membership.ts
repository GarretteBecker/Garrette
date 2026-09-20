/**
 * HomeKeeper memberships.
 *
 * Single source of truth for the two tiers: what they cost, what they
 * include, what they explicitly do NOT include, and the member-pricing
 * benefit. Every screen that gates a feature or quotes a price reads from
 * here, so the commercial rules cannot drift apart across the app.
 *
 * Figures are from the Master Program Specification v1.0, §4–§6 and §50.
 */

export type MembershipTier = 'CORE' | 'RESPONSE';
export type BillingCycle = 'MONTHLY' | 'ANNUAL_PREPAID';

/** Things a tier can switch on or off. Used by the gating helper. */
export type TierFeature =
  | 'home_record'
  | 'property_passport'
  | 'portal'
  | 'request_service'
  | 'trade_network'
  | 'home_plan'
  | 'annual_report'
  | 'member_pricing'
  | 'document_storage'
  | 'remodel_planning'
  // Response only
  | 'hub'
  | 'urgent_help'
  | 'quarterly_visits'
  | 'quarterly_reports'
  | 'managed_services'
  | 'priority_routing'
  | 'expanded_baseline';

export interface TierDefinition {
  tier: MembershipTier;
  name: string;
  tagline: string;
  monthly: number;
  annualPrepaid: number;
  /** Months of initial commitment (§4). */
  commitmentMonths: number;
  /** Member pricing on qualifying B&M service work (§50). */
  memberDiscountPercent: number;
  /**
   * Annual dollar cap on that discount.
   *
   * ⚠ ASSUMPTION — the spec says "both should have dollar caps" but does not
   * give the numbers. These are placeholders. Change them here and every
   * quote in the app follows.
   */
  memberDiscountAnnualCap: number;
  features: TierFeature[];
}

export const TIERS: Record<MembershipTier, TierDefinition> = {
  CORE: {
    tier: 'CORE',
    name: 'HomeKeeper',
    tagline: 'Your home, on the record.',
    monthly: 69,
    annualPrepaid: 759,
    commitmentMonths: 12,
    memberDiscountPercent: 5,
    memberDiscountAnnualCap: 500,
    features: [
      'home_record', 'property_passport', 'portal', 'request_service',
      'trade_network', 'home_plan', 'annual_report', 'member_pricing',
      'document_storage', 'remodel_planning',
    ],
  },
  RESPONSE: {
    tier: 'RESPONSE',
    name: 'HomeKeeper Response',
    tagline: 'Help for your home is always within reach.',
    monthly: 299,
    annualPrepaid: 3289,
    commitmentMonths: 12,
    memberDiscountPercent: 10,
    memberDiscountAnnualCap: 1500,
    features: [
      'home_record', 'property_passport', 'portal', 'request_service',
      'trade_network', 'home_plan', 'annual_report', 'member_pricing',
      'document_storage', 'remodel_planning',
      'hub', 'urgent_help', 'quarterly_visits', 'quarterly_reports',
      'managed_services', 'priority_routing', 'expanded_baseline',
    ],
  },
};

/**
 * The gate. A Core member must never see quarterly visits, Hub features or
 * quarterly reports, so every such screen asks this first.
 */
export function tierIncludes(
  tier: MembershipTier | null | undefined,
  feature: TierFeature,
): boolean {
  if (!tier) return false;
  return TIERS[tier].features.includes(feature);
}

/** Human-readable inclusions, for the membership screen. */
export const FEATURE_LABELS: Record<TierFeature, string> = {
  home_record: 'Your Home Record',
  property_passport: 'Property Passport',
  portal: 'HomeKeeper portal on phone and web',
  request_service: 'Request Service any time',
  trade_network: 'B&M Trade Network',
  home_plan: 'Your Home Plan',
  annual_report: 'Annual Property Report',
  member_pricing: 'Member pricing on qualifying work',
  document_storage: 'Manuals, warranties, permits and plans kept for you',
  remodel_planning: 'Remodel planning record',
  hub: 'Wall-mounted HomeKeeper Hub, installed',
  urgent_help: '“I Need Help Now” with guidance for your own home',
  quarterly_visits: 'Four HomeKeeper visits a year',
  quarterly_reports: 'Quarterly HomeKeeper Report',
  managed_services: 'Managed seasonal maintenance',
  priority_routing: 'Priority service routing',
  expanded_baseline: 'Expanded professional baseline reviews',
};

/**
 * What a membership does NOT cover (§13).
 *
 * This has to live in the app, not only in the signed agreement. A member
 * who believes repairs are included will argue the first invoice, and the
 * contract they signed once will not settle it as well as a screen they can
 * look at whenever they like.
 */
export const EXCLUSIONS: { title: string; detail: string }[] = [
  {
    title: 'Unlimited repairs',
    detail: 'Membership covers knowing your home and coordinating the work — not the work itself.',
  },
  {
    title: 'Plumbing, electrical and roofing work',
    detail: 'We identify it, coordinate a trusted trade and get you a price. The work is quoted separately.',
  },
  {
    title: 'Carpentry and remodeling',
    detail: 'Planned and priced as its own project, with your member credit applied.',
  },
  {
    title: 'Replacement parts and materials',
    detail: 'Filters and consumables on Response are included where stated; replacement parts are not.',
  },
  {
    title: 'Emergency call-outs',
    detail: 'We help you act and get the right trade moving. The call-out itself is billed.',
  },
  {
    title: 'Major appliance repair',
    detail: 'Recorded in your Home Record and coordinated, but repaired under separate quote.',
  },
  {
    title: 'Storm and disaster damage',
    detail: 'An insurance matter. We document it and coordinate, we do not carry the cost.',
  },
  {
    title: 'Hazardous material work',
    detail: 'Asbestos, lead, mould remediation and similar are specialist licensed work, always separate.',
  },
];

// ------------------------------------------------------------ pricing

export interface MemberPrice {
  standard: number;
  discountPercent: number;
  /** What the member actually saves, after the annual cap is applied. */
  saving: number;
  memberPrice: number;
  /** True when the cap limited the saving. */
  capped: boolean;
  capRemainingAfter: number;
}

/**
 * Apply the member benefit to a quote.
 *
 * `usedThisYear` is how much discount this member has already received in
 * the current membership year, so the cap is honoured across jobs rather
 * than per job.
 */
export function memberPrice(
  standard: number,
  tier: MembershipTier | null | undefined,
  usedThisYear = 0,
): MemberPrice {
  if (!tier || standard <= 0) {
    return {
      standard, discountPercent: 0, saving: 0,
      memberPrice: standard, capped: false, capRemainingAfter: 0,
    };
  }

  const def = TIERS[tier];
  const capRemaining = Math.max(0, def.memberDiscountAnnualCap - usedThisYear);
  const uncapped = standard * (def.memberDiscountPercent / 100);
  const saving = Math.min(uncapped, capRemaining);

  return {
    standard,
    discountPercent: def.memberDiscountPercent,
    saving: Math.round(saving * 100) / 100,
    memberPrice: Math.round((standard - saving) * 100) / 100,
    capped: saving < uncapped,
    capRemainingAfter: Math.round((capRemaining - saving) * 100) / 100,
  };
}

/** What the member saves by prepaying the year (§4: one month free). */
export function annualSaving(tier: MembershipTier): number {
  const def = TIERS[tier];
  return def.monthly * 12 - def.annualPrepaid;
}

export function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
