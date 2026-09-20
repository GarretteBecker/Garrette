import { createClient } from '@/lib/supabase/server';
import type { PortalData, PortalDocument, PortalPhoto, PortalReport } from './portal';
import type {
  Asset, Finding, Member, PlanItem, Property, Room, Visit,
} from '@/lib/types/database';

/**
 * Load everything the homeowner portal needs, for the signed-in member.
 *
 * There is no property id parameter here on purpose. RLS scopes every one of
 * these queries to the caller's own property, so this function physically
 * cannot return someone else's home — CLAUDE.md rule 2, enforced in Postgres
 * rather than by a filter we might forget to write.
 */
export async function loadPortalData(
  fallbackName: string,
): Promise<PortalData | null> {
  const supabase = await createClient();

  const { data: properties } = await supabase.from('properties').select('*').limit(1);
  const property = (properties ?? [])[0] as Property | undefined;
  if (!property) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: members },
    { data: rooms },
    { data: assets },
    { data: findings },
    { data: planItems },
    { data: visits },
    { data: reports },
    { data: documents },
    { data: requests },
    { data: photoRows },
  ] = await Promise.all([
    supabase.from('members').select('*').eq('property_id', property.id),
    supabase.from('rooms').select('*').eq('property_id', property.id).order('sort_order'),
    supabase.from('assets').select('*').eq('property_id', property.id).order('name'),
    supabase
      .from('findings')
      .select('*')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false }),
    supabase.from('plan_items').select('*').eq('property_id', property.id).order('sort_order'),
    supabase
      .from('visits')
      .select('*')
      .eq('property_id', property.id)
      .order('scheduled_for', { ascending: false }),
    // Only released reports come back — the RLS policy in 0004 hides drafts
    // from members, so no status filter is needed here.
    supabase
      .from('reports')
      .select('id, title, report_type, period_start, period_end, generated_at')
      .eq('property_id', property.id)
      .order('generated_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, doc_type, storage_path, size_bytes, created_at')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_requests')
      .select('id, title, stage, created_at, finding_id')
      .eq('property_id', property.id)
      .not('stage', 'eq', 'CLOSED')
      .order('created_at', { ascending: false }),
    supabase
      .from('photos')
      .select('id, asset_id, finding_id, storage_path, caption')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false }),
  ]);

  const memberRows = (members ?? []) as Member[];
  const me =
    memberRows.find((m) => m.profile_id === user?.id) ??
    memberRows.find((m) => m.is_primary) ??
    memberRows[0];

  // Private bucket: each photo needs a signed URL, minted server-side.
  const photos: PortalPhoto[] = [];
  for (const row of (photoRows ?? []) as {
    id: string;
    asset_id: string | null;
    finding_id: string | null;
    storage_path: string;
    caption: string | null;
  }[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(row.storage_path, 3600);
    photos.push({
      id: row.id,
      asset_id: row.asset_id,
      finding_id: row.finding_id,
      caption: row.caption,
      url: signed?.signedUrl ?? null,
    });
  }

  return {
    property,
    memberFirstName: me?.first_name ?? fallbackName.split(' ')[0] ?? 'there',
    rooms: (rooms ?? []) as Room[],
    assets: (assets ?? []) as Asset[],
    findings: (findings ?? []) as Finding[],
    planItems: (planItems ?? []) as PlanItem[],
    visits: (visits ?? []) as Visit[],
    reports: (reports ?? []) as PortalReport[],
    documents: (documents ?? []) as PortalDocument[],
    photos,
    openRequests: (requests ?? []) as PortalData['openRequests'],
  };
}
