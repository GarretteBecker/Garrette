/**
 * Events B&M HomeKeeper sends to GoHighLevel.
 *
 * GHL owns all member messaging — texts, emails, drip sequences. HomeKeeper
 * does not send messages itself; it tells GHL that something happened and
 * lets a GHL workflow decide what to say and how.
 *
 * Every payload carries enough contact detail for GHL to match or create the
 * contact, plus a flat `data` object because GHL workflow merge fields are
 * easier to wire up against flat keys than nested ones.
 */

export type GhlEventType =
  | 'report.released'
  | 'service_request.stage_changed'
  | 'visit.scheduled'
  // Compliance. The renewal reminder is a disclosure with a deadline on it,
  // so it is sent from a workflow rather than left to someone remembering.
  | 'membership.renewal_notice'
  | 'membership.rescinded';

export interface GhlContact {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface GhlEvent {
  /** Which workflow trigger this is for. */
  event: GhlEventType;
  /** ISO timestamp of the event. */
  occurred_at: string;
  /** So a workflow can be built per environment if wanted. */
  source: 'bm-homekeeper';
  contact: GhlContact;
  property: {
    id: string;
    name: string;
    address: string;
  };
  /** Flat, merge-field friendly. */
  data: Record<string, string | number | null>;
}

/**
 * CLAUDE.md rule 3 in an outbound direction: nothing sensitive leaves the
 * building. These payloads carry names, addresses, equipment and stages —
 * never codes, passwords or payment details, because nothing of that kind
 * is stored in the first place.
 */
export function buildEvent(
  event: GhlEventType,
  contact: GhlContact,
  property: { id: string; name: string; address: string },
  data: Record<string, string | number | null>,
): GhlEvent {
  return {
    event,
    occurred_at: new Date().toISOString(),
    source: 'bm-homekeeper',
    contact,
    property,
    data,
  };
}
