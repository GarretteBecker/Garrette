/**
 * Dispatch — offering a job to a trade partner, with a clock on it.
 *
 * "Dispatch" used to mean picking one partner from a flat list and moving a
 * stage. Whether anyone actually turned up depended on who you happened to
 * pick, and nothing recorded whether they answered or how long they took.
 *
 * A job is now OFFERED, not assigned: an offer has a deadline, an answer
 * and a next step. What a member experiences from that is the thing worth
 * selling — somebody always comes, and fast.
 */

export type DispatchRank = 'PRIMARY' | 'SECONDARY' | 'BACKUP';

export type DispatchResponse =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export const RANK_LABEL: Record<DispatchRank, string> = {
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
  BACKUP: 'Backup',
};

export const RANKS: DispatchRank[] = ['PRIMARY', 'SECONDARY', 'BACKUP'];

export const RESPONSE_LABEL: Record<DispatchResponse, string> = {
  PENDING: 'Waiting on them',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'No answer in time',
  WITHDRAWN: 'Pulled back',
};

export interface DispatchOffer {
  id: string;
  service_request_id: string;
  trade_partner_id: string;
  rank: DispatchRank | null;
  offered_at: string;
  respond_by: string;
  response: DispatchResponse;
  responded_at: string | null;
  decline_reason: string | null;
  /** Joined for display. */
  company_name?: string | null;
  phone?: string | null;
}

export interface TradeCoverage {
  id: string;
  trade_partner_id: string;
  category: string;
  rank: DispatchRank;
  notes: string | null;
}

export interface TradePerformance {
  trade_partner_id: string;
  company_name: string;
  trade: string;
  is_active: boolean;
  response_sla_hours: number;
  offers: number;
  accepted: number;
  declined: number;
  expired: number;
  pending: number;
  accept_rate: number | null;
  avg_response_minutes: number | null;
  jobs_completed: number;
}

/** Minutes left to answer. Negative once the clock has run out. */
export function minutesLeft(respondBy: string, now: Date = new Date()): number {
  return Math.round((new Date(respondBy).getTime() - now.getTime()) / 60_000);
}

export function isOverdue(offer: DispatchOffer, now: Date = new Date()): boolean {
  return offer.response === 'PENDING' && minutesLeft(offer.respond_by, now) < 0;
}

/**
 * "2h 40m left" / "40 minutes overdue".
 *
 * Overdue is stated as overdue rather than as a negative number, because
 * the office needs to see at a glance which job nobody has picked up.
 */
export function respondCountdown(respondBy: string, now: Date = new Date()): string {
  const m = minutesLeft(respondBy, now);
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const rem = abs % 60;
  const span = h > 0 ? `${h}h ${rem}m` : `${rem}m`;
  if (m < 0) return `${span} overdue`;
  return `${span} left`;
}

/** How a response should read to the office, in one word of colour. */
export function responseTone(
  offer: DispatchOffer,
  now: Date = new Date(),
): 'waiting' | 'late' | 'good' | 'bad' {
  if (offer.response === 'ACCEPTED') return 'good';
  if (offer.response === 'PENDING') return isOverdue(offer, now) ? 'late' : 'waiting';
  if (offer.response === 'DECLINED' || offer.response === 'EXPIRED') return 'bad';
  return 'waiting';
}

/**
 * The one-line verdict on a partner.
 *
 * Deliberately refuses to grade anyone on a handful of jobs — three offers
 * is not a track record, and a number presented as one would get somebody
 * dropped from the bench for no reason.
 */
export function performanceSummary(p: TradePerformance): string {
  if (p.offers === 0) return 'No jobs offered yet.';

  const settled = p.accepted + p.declined + p.expired;
  if (settled < 3) {
    return `${settled} answered so far — too early to judge.`;
  }

  const parts: string[] = [`${p.accept_rate ?? 0}% accepted`];
  if (p.avg_response_minutes != null) {
    const m = p.avg_response_minutes;
    parts.push(m < 60 ? `answers in ~${m} min` : `answers in ~${Math.round(m / 60)}h`);
  }
  if (p.expired > 0) {
    parts.push(`${p.expired} never answered`);
  }
  return parts.join(' · ');
}
