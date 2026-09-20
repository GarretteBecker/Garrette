'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Every action here relies on RLS to decide whether the write is allowed.
 * The role checks in the UI are for navigation only; if a tech posted this
 * form for a property they are not assigned to, Postgres would reject it.
 */

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface ActionState {
  error?: string;
  ok?: boolean;
}

// --------------------------------------------------------------- rooms

export async function saveRoom(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, 'id');
  const propertyId = str(formData, 'property_id');
  const name = str(formData, 'name');

  if (!propertyId) return { error: 'Missing property.' };
  if (!name) return { error: 'Give the room a name.' };

  const payload = {
    property_id: propertyId,
    name,
    room_type: str(formData, 'room_type'),
    floor: str(formData, 'floor'),
    notes: str(formData, 'notes'),
    sort_order: num(formData, 'sort_order') ?? 0,
  };

  const { error } = id
    ? await supabase.from('rooms').update(payload).eq('id', id)
    : await supabase.from('rooms').insert(payload);

  if (error) return { error: error.message };

  revalidatePath(`/admin/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteRoom(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const propertyId = String(formData.get('property_id'));
  await supabase.from('rooms').delete().eq('id', id);
  revalidatePath(`/admin/properties/${propertyId}`);
}

// -------------------------------------------------------------- assets

export async function saveAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, 'id');
  const propertyId = str(formData, 'property_id');
  const name = str(formData, 'name');
  const category = str(formData, 'category');

  if (!propertyId) return { error: 'Missing property.' };
  if (!name) return { error: 'Give the item a name.' };
  if (!category) return { error: 'Pick a category.' };

  const payload = {
    property_id: propertyId,
    room_id: str(formData, 'room_id'),
    category,
    name,
    manufacturer: str(formData, 'manufacturer'),
    model: str(formData, 'model'),
    serial_number: str(formData, 'serial_number'),
    finish: str(formData, 'finish'),
    install_date: str(formData, 'install_date'),
    warranty_expires: str(formData, 'warranty_expires'),
    expected_life_years: num(formData, 'expected_life_years'),
    condition: (str(formData, 'condition') ?? 'UNKNOWN') as
      'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'END_OF_LIFE' | 'UNKNOWN',
    last_serviced_at: str(formData, 'last_serviced_at'),
    location_notes: str(formData, 'location_notes'),
    notes: str(formData, 'notes'),
  };

  const { error } = id
    ? await supabase.from('assets').update(payload).eq('id', id)
    : await supabase.from('assets').insert(payload);

  if (error) return { error: error.message };

  revalidatePath(`/admin/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteAsset(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const propertyId = String(formData.get('property_id'));
  await supabase.from('assets').delete().eq('id', id);
  revalidatePath(`/admin/properties/${propertyId}`);
}

// ----------------------------------------------------------- documents

export async function saveDocumentRecord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const propertyId = str(formData, 'property_id');
  const title = str(formData, 'title');
  const storagePath = str(formData, 'storage_path');

  if (!propertyId || !title || !storagePath) {
    return { error: 'Upload a file and give it a title.' };
  }

  const { error } = await supabase.from('documents').insert({
    property_id: propertyId,
    asset_id: str(formData, 'asset_id'),
    title,
    doc_type: (str(formData, 'doc_type') ?? 'OTHER') as 'OTHER',
    storage_path: storagePath,
    mime_type: str(formData, 'mime_type'),
    size_bytes: num(formData, 'size_bytes'),
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get('id'));
  const propertyId = String(formData.get('property_id'));
  const path = String(formData.get('storage_path') ?? '');

  await supabase.from('documents').delete().eq('id', id);
  if (path) await supabase.storage.from('property-docs').remove([path]);

  revalidatePath(`/admin/properties/${propertyId}`);
}

// ------------------------------------------------------- trade partners

export async function saveTradePartner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, 'id');
  const companyName = str(formData, 'company_name');
  const trade = str(formData, 'trade');

  if (!companyName) return { error: 'Company name is required.' };
  if (!trade) return { error: 'What trade do they do?' };

  const payload = {
    company_name: companyName,
    trade,
    contact_name: str(formData, 'contact_name'),
    email: str(formData, 'email'),
    phone: str(formData, 'phone'),
    license_number: str(formData, 'license_number'),
    notes: str(formData, 'notes'),
    is_active: formData.get('is_active') === 'on',
  };

  const { error } = id
    ? await supabase.from('trade_partners').update(payload).eq('id', id)
    : await supabase.from('trade_partners').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/admin/trade-partners');
  return { ok: true };
}

/** Set a property's membership tier and billing. Admin only, via RLS. */
export async function saveMembership(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const propertyId = String(formData.get('property_id'));

  await supabase
    .from('properties')
    .update({
      tier: str(formData, 'tier') ?? 'CORE',
      billing_cycle: str(formData, 'billing_cycle') ?? 'MONTHLY',
      commitment_start: str(formData, 'commitment_start'),
    })
    .eq('id', propertyId);

  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath('/home');
}
