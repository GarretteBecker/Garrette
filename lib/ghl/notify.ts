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

export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_WEBHOOK_URL);
}

async function post(payload: GhlEvent): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL;
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
  if (!ghlConfigured()) return;
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
  if (!ghlConfigured()) return;
  try {
    const ctx = await loadEventContext(propertyId);
    if (!ctx) return;
    sendGhlEvent(buildEvent(event, ctx.contact, ctx.property, data));
  } catch (error) {
    console.error('[ghl] could not build event:', error);
  }
}
