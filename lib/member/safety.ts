import { createClient } from '@/lib/supabase/server';
import type { SafetyPoint } from '@/lib/emergency';

/**
 * A member's safety points, with their photographs signed for viewing.
 *
 * RLS scopes this to the caller's own property, so there is no property id
 * parameter — the same shape as loadPortalData, and for the same reason:
 * a function that cannot name another property cannot leak one.
 *
 * Note this is NOT tier-gated. Withholding "here is where your water
 * shutoff is" from a member on the cheaper plan is not a business model.
 * See docs/emergency-help.md.
 */
export async function loadSafetyPoints(): Promise<SafetyPoint[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('safety_points')
    .select('id, kind, label, location_note, how_to_note, photo_id, room_id')
    .order('sort_order');

  const rows = (data ?? []) as {
    id: string; kind: SafetyPoint['kind']; label: string | null;
    location_note: string | null; how_to_note: string | null;
    photo_id: string | null; room_id: string | null;
  }[];
  if (rows.length === 0) return [];

  const roomIds = [...new Set(rows.map((r) => r.room_id).filter(Boolean) as string[])];
  const photoIds = [...new Set(rows.map((r) => r.photo_id).filter(Boolean) as string[])];

  const [{ data: rooms }, { data: photos }] = await Promise.all([
    roomIds.length
      ? supabase.from('rooms').select('id, name').in('id', roomIds)
      : Promise.resolve({ data: [] }),
    photoIds.length
      ? supabase.from('photos').select('id, storage_path').in('id', photoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const roomName = new Map(
    ((rooms ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
  );
  const photoPath = new Map(
    ((photos ?? []) as { id: string; storage_path: string }[]).map((p) => [p.id, p.storage_path]),
  );

  const out: SafetyPoint[] = [];
  for (const r of rows) {
    let photo_url: string | null = null;
    const path = r.photo_id ? photoPath.get(r.photo_id) : undefined;
    if (path) {
      // Private bucket. An hour is long enough to read a screen in a panic
      // and short enough that a shared link goes stale.
      const { data: signed } = await supabase.storage
        .from('property-photos')
        .createSignedUrl(path, 3600);
      photo_url = signed?.signedUrl ?? null;
    }
    out.push({
      id: r.id,
      kind: r.kind,
      label: r.label,
      location_note: r.location_note,
      how_to_note: r.how_to_note,
      photo_id: r.photo_id,
      room_name: r.room_id ? roomName.get(r.room_id) ?? null : null,
      photo_url,
    });
  }
  return out;
}
