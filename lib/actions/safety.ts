'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Record a shutoff or access point.
 *
 * Staff only, by RLS. The database also refuses a room, asset or photo from
 * another property — the emergency screen shows this straight to a member,
 * so a row captioned with somebody else's basement is not a cosmetic bug.
 */
export async function saveSafetyPoint(formData: FormData): Promise<void> {
  const propertyId = text(formData, 'property_id');
  const kind = text(formData, 'kind');
  if (!propertyId || !kind) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    property_id: propertyId,
    kind,
    label: text(formData, 'label'),
    room_id: text(formData, 'room_id'),
    location_note: text(formData, 'location_note'),
    how_to_note: text(formData, 'how_to_note'),
    photo_id: text(formData, 'photo_id'),
    created_by: user?.id ?? null,
  };

  const id = text(formData, 'id');
  if (id) {
    await supabase.from('safety_points').update(row).eq('id', id);
  } else {
    await supabase.from('safety_points').insert(row);
  }

  revalidatePath(`/team/properties/${propertyId}`);
  revalidatePath('/home/help');
}

export async function deleteSafetyPoint(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  const propertyId = text(formData, 'property_id');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('safety_points').delete().eq('id', id);

  if (propertyId) revalidatePath(`/team/properties/${propertyId}`);
  revalidatePath('/home/help');
}

/** The facts about the house itself, as opposed to the things inside it. */
export async function saveHomeFacts(formData: FormData): Promise<void> {
  const propertyId = text(formData, 'property_id');
  if (!propertyId) return;

  const num = (key: string) => {
    const v = text(formData, key);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const supabase = await createClient();
  await supabase
    .from('properties')
    .update({
      construction_type: text(formData, 'construction_type'),
      exterior_material: text(formData, 'exterior_material'),
      roof_material: text(formData, 'roof_material'),
      roof_installed_year: num('roof_installed_year'),
      water_source: text(formData, 'water_source'),
      sewer_type: text(formData, 'sewer_type'),
      heating_fuel: text(formData, 'heating_fuel'),
      electrical_service_amps: num('electrical_service_amps'),
      stories: num('stories'),
      basement_type: text(formData, 'basement_type'),
    })
    .eq('id', propertyId);

  revalidatePath(`/team/properties/${propertyId}`);
  revalidatePath('/home/record');
}
