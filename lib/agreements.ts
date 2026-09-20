/**
 * Membership agreements and the disclosures around them.
 *
 * ⚠ NOT LEGAL ADVICE. This file holds the plain-English wording the member
 * sees and the arithmetic behind the dates. Every sentence here should be
 * read by a Pennsylvania attorney before it goes in front of a customer —
 * see docs/pa-compliance.md for what was verified and what was not.
 */

export type AgreementStatus =
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'RESCINDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type NoticeMethod = 'EMAIL' | 'MAIL' | 'SMS' | 'IN_PERSON';

export interface Agreement {
  id: string;
  property_id: string;
  tier: 'CORE' | 'RESPONSE';
  billing_cycle: 'MONTHLY' | 'ANNUAL_PREPAID';
  price_monthly: number | null;
  price_annual: number | null;
  commitment_months: number;
  signed_at: string | null;
  signed_by_name: string | null;
  term_start: string;
  term_end: string;
  auto_renew: boolean;
  renewal_notice_days_before_max: number;
  renewal_notice_days_before_min: number;
  renewal_notice_sent_at: string | null;
  renewal_notice_method: NoticeMethod | null;
  rescission_deadline: string | null;
  rescinded_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  document_id: string | null;
  status: AgreementStatus;
  notes: string | null;
}

export const AGREEMENT_STATUS_LABEL: Record<AgreementStatus, string> = {
  PENDING_SIGNATURE: 'Waiting for signature',
  ACTIVE: 'Active',
  RESCINDED: 'Cancelled within the three-day window',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  SUPERSEDED: 'Replaced by a newer agreement',
};

export const NOTICE_METHOD_LABEL: Record<NoticeMethod, string> = {
  EMAIL: 'Email',
  MAIL: 'Posted letter',
  SMS: 'Text message',
  IN_PERSON: 'In person',
};

/** Today in Lancaster County, not in UTC — a deadline is a local fact. */
export function today(): Date {
  const now = new Date();
  const local = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return new Date(`${local}T00:00:00`);
}

function asDate(value: string): Date {
  // Dates come back as YYYY-MM-DD; parse as local midnight, not UTC.
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

export function daysUntil(dateString: string): number {
  const ms = asDate(dateString).getTime() - today().getTime();
  return Math.round(ms / 86_400_000);
}

export interface RescissionWindow {
  /** The right exists and has not run out. */
  open: boolean;
  deadline: string | null;
  /** 0 means it ends today — still open. */
  daysLeft: number;
}

/**
 * Where the three-business-day right stands.
 *
 * Inclusive of the deadline day: the right runs to the END of the third
 * business day, so a member cancelling on that day is in time.
 */
export function rescissionWindow(agreement: Pick<Agreement,
  'rescission_deadline' | 'status'>): RescissionWindow {
  const deadline = agreement.rescission_deadline;
  if (!deadline || (agreement.status !== 'ACTIVE' && agreement.status !== 'PENDING_SIGNATURE')) {
    return { open: false, deadline, daysLeft: 0 };
  }
  const daysLeft = daysUntil(deadline);
  return { open: daysLeft >= 0, deadline, daysLeft };
}

/** "today", "tomorrow", "in 3 days" — a countdown a person can act on. */
export function countdownWords(daysLeft: number): string {
  if (daysLeft <= 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  return `in ${daysLeft} days`;
}

export type NoticeState = 'SENT' | 'DUE' | 'OVERDUE' | 'NOT_YET' | 'NOT_APPLICABLE';

/**
 * Whether the renewal notice is sent, due, or late.
 *
 * ⚠ The 10–20 day window comes from the Master Program Specification, NOT
 * from a Pennsylvania statute I was able to confirm. It is stored per
 * agreement so counsel can change it without a code change.
 */
export function noticeState(agreement: Pick<Agreement,
  'auto_renew' | 'status' | 'term_end' | 'renewal_notice_sent_at'
  | 'renewal_notice_days_before_max' | 'renewal_notice_days_before_min'>): NoticeState {
  if (!agreement.auto_renew || agreement.status !== 'ACTIVE') return 'NOT_APPLICABLE';
  if (agreement.renewal_notice_sent_at) return 'SENT';

  const out = daysUntil(agreement.term_end);
  if (out > agreement.renewal_notice_days_before_max) return 'NOT_YET';
  if (out < agreement.renewal_notice_days_before_min) return 'OVERDUE';
  return 'DUE';
}

export function formatDay(value: string | null): string {
  if (!value) return '—';
  const d = asDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * What the member is told about auto-renewal, in their own language.
 *
 * ⚠ Wording to be confirmed by counsel. It states the four things a person
 * actually needs: that it renews, when, at what price, and how to stop it.
 */
export function autoRenewalDisclosure(agreement: Pick<Agreement,
  'auto_renew' | 'term_end' | 'billing_cycle' | 'price_monthly' | 'price_annual'
  | 'renewal_notice_days_before_max' | 'renewal_notice_days_before_min'>): string {
  if (!agreement.auto_renew) {
    return `This membership ends on ${formatDay(agreement.term_end)} and will not renew by itself. We will be in touch before then if you would like to carry on.`;
  }
  const price = agreement.billing_cycle === 'ANNUAL_PREPAID'
    ? agreement.price_annual
    : agreement.price_monthly;
  const per = agreement.billing_cycle === 'ANNUAL_PREPAID' ? 'for the year' : 'a month';
  const amount = price != null
    ? `$${price.toLocaleString('en-US')} ${per}`
    : 'the same rate';

  return `Unless you tell us otherwise, this membership renews on ${formatDay(agreement.term_end)} at ${amount}, and carries on until you cancel it. We will write to you between ${agreement.renewal_notice_days_before_max} and ${agreement.renewal_notice_days_before_min} days beforehand to remind you.`;
}

/** How to stop it renewing. One sentence, no hoops. */
export const OPT_OUT_INSTRUCTIONS =
  'To stop it renewing, tell us any time up to the renewal date — a service request through this app, an email or a phone call all count. We will confirm it in writing.';

/**
 * The cancellation right, stated.
 *
 * ⚠ Verified as Pennsylvania law for home improvement contracts (HICPA,
 * 73 P.S. § 517.1 et seq.). Whether a maintenance membership IS such a
 * contract is a question for counsel — so the app gives the right either
 * way, which is the safe direction to be wrong in.
 */
export const RESCISSION_RIGHT_TEXT =
  'You may cancel this agreement without penalty or obligation within three business days of signing it. You do not have to give a reason.';
