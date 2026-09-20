import 'server-only';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEvent, type GhlContact, type GhlEvent, type GhlEventType } from './events';

/**
 * Posts an event to the GoHighLevel inbound webhook.
 *
 * Three properties this must hold:
 *
 *  1. **It never breaks the app.** A member submitting a request, or the
 *     office moving a stage, must not fail because GHL is down or a URL is
 *     wrong. Every failure is swallowed and logged.
 *  2. **It never blocks the user.** The send runs in `after()`, so the
 *     response goes back immediately and the POST happens afterwards.
 *  3. **It no-ops when unconfigured.** No GHL_WEBHOOK_URL means the whole
 *     integration is simply off — nothing to configure, nothing to break.
 */

const TIMEOUT_MS = 8000;

/**
 * Which URL each event goes to.
 *
 * Set a per-event URL and that event gets its own GHL workflow — usually
 * cleaner, because each workflow then has one trigger and one message rather
 * than a branch at the top. Set only GHL_WEBHOOK_URL and everything goes to
 * one workflow that branches on the `event` field. Mixing the two is fine:
 * per-event wins, the generic one is the fallback.
 *
 * Read statically rather than by computed key so the values are inlined at
 * build time.
 */
function urlFor(event: GhlEventType): string | undefined {
  const specific =
    event === 'report.released'
      ? process.env.GHL_WEBHOOK_URL_REPORT_RELEASED
      : event === 'service_request.stage_changed'
        ? process.env.GHL_WEBHOOK_URL_REQUEST_STAGE
        : event === 'visit.scheduled'
          ? process.env.GHL_WEBHOOK_URL_VISIT_SCHEDULED
          : event === 'membership.renewal_notice'
            ? process.env.GHL_WEBHOOK_URL_RENEWAL_NOTICE
            : event === 'membership.rescinded'
              ? process.env.GHL_WEBHOOK_URL_MEMBERSHIP_RESCINDED
              : undefined;

  return specific || process.env.GHL_WEBHOOK_URL;
}

/** True when at least one webhook URL is configured. */
export function ghlConfigured(event?: GhlEventType): boolean {
  if (event) return Boolean(urlFor(event));
  return Boolean(
    process.env.GHL_WEBHOOK_URL ||
      process.env.GHL_WEBHOOK_URL_REPORT_RELEASED ||
      process.env.GHL_WEBHOOK_URL_REQUEST_STAGE ||
      process.env.GHL_WEBHOOK_URL_VISIT_SCHEDULED ||
      process.env.GHL_WEBHOOK_URL_RENEWAL_NOTICE ||
      process.env.GHL_WEBHOOK_URL_MEMBERSHIP_RESCINDED,
  );
}

async function post(payload: GhlEvent): Promise<void> {
  const url = urlFor(payload.event);
  if (!url) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Optional shared secret so the receiving workflow can confirm the post
    // really came from HomeKeeper.
    if (process.env.GHL_WEBHOOK_SECRET) {
      headers['X-HomeKeeper-Secret'] = process.env.GHL_WEBHOOK_SECRET;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[ghl] ${payload.event} rejected: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error(`[ghl] ${payload.event} failed to send:`, error);
  } finally {
    clearTimeout(timer);
  }
}

/** Queue an event to send once the current response has gone out. */
export function sendGhlEvent(payload: GhlEvent): void {
  if (!ghlConfigured(payload.event)) return;
  after(() => post(payload));
}

/**
 * Look up the property and its primary homeowner so GHL can match a contact.
 * Runs as the caller, so RLS applies — nothing here can read across
 * properties.
 */
export async function loadEventContext(propertyId: string): Promise<{
  contact: GhlContact;
  property: { id: string; name: string; address: string };
} | null> {
  const supabase = await createClient();

  const [{ data: property }, { data: members }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, address_line1, city, state, postal_code')
      .eq('id', propertyId)
      .maybeSingle(),
    supabase
      .from('members')
      .select('first_name, last_name, email, phone, is_primary')
      .eq('property_id', propertyId),
  ]);

  if (!property) return null;

  const rows = (members ?? []) as (GhlContact & { is_primary: boolean })[];
  const primary = rows.find((m) => m.is_primary) ?? rows[0] ?? null;

  return {
    contact: {
      first_name: primary?.first_name ?? null,
      last_name: primary?.last_name ?? null,
      email: primary?.email ?? null,
      phone: primary?.phone ?? null,
    },
    property: {
      id: property.id,
      name: property.name,
      address: `${property.address_line1}, ${property.city}, ${property.state} ${property.postal_code}`,
    },
  };
}

/** Build and queue in one call. Safe to invoke from any server action. */
export async function notify(
  event: GhlEventType,
  propertyId: string,
  data: Record<string, string | number | null>,
): Promise<void> {
  if (!ghlConfigured(event)) return;
  try {
    const ctx = await loadEventContext(propertyId);
    if (!ctx) return;
    sendGhlEvent(buildEvent(event, ctx.contact, ctx.property, data));
  } catch (error) {
    console.error('[ghl] could not build event:', error);
  }
}
