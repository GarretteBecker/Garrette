'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/database';

/**
 * Inviting people.
 *
 * ⚠ There is no service-role client here, on purpose (CLAUDE.md: anon key
 * only). So this does NOT create an auth account — it writes a row giving
 * that email permission to create one. The person then signs themselves
 * up, and the database trigger handle_new_user reads the invite, refuses
 * anyone without one, and takes their role from it rather than from the
 * sign-up form.
 *
 * That is why invite-only holds even though the anon key is public: the
 * enforcement is a trigger, not a setting.
 *
 * RLS restricts every write here to admin. The role check below is so the
 * screen behaves, not so the data is safe.
 */

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

const INVITABLE: UserRole[] = ['admin', 'ops', 'tech', 'member', 'trade'];

export async function createInvite(formData: FormData): Promise<void> {
  const email = text(formData, 'email')?.toLowerCase();
  const role = text(formData, 'role') as UserRole | null;
  if (!email || !role || !INVITABLE.includes(role)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // A member invite without a home would land them in an empty portal, so
  // the form requires one and this refuses it if the form is bypassed.
  const propertyId = text(formData, 'property_id');
  if (role === 'member' && !propertyId) return;

  const days = Number(text(formData, 'expires_days') ?? '14');
  const expires = new Date();
  expires.setDate(expires.getDate() + (Number.isFinite(days) && days > 0 ? days : 14));

  await supabase.from('invites').insert({
    email,
    role,
    full_name: text(formData, 'full_name'),
    property_id: role === 'member' ? propertyId : null,
    note: text(formData, 'note'),
    invited_by: user?.id ?? null,
    expires_at: expires.toISOString(),
  });

  revalidatePath('/team/people');
}

/** Withdraw an invite that has not been used. */
export async function revokeInvite(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('invites').delete().eq('id', id).is('accepted_at', null);
  revalidatePath('/team/people');
}

/**
 * Turn someone off without deleting them.
 *
 * is_active false makes current_user_role() return null, which fails every
 * policy — so a deactivated person keeps their history and loses their
 * access in the same move. Deleting the profile would orphan everything
 * they ever recorded.
 */
export async function setStaffActive(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  const active = formData.get('is_active') != null;
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('profiles').update({ is_active: active }).eq('id', id);
  revalidatePath('/team/people');
}

/** Change what somebody is. Admin only, and the database says so too. */
export async function setStaffRole(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  const role = text(formData, 'role') as UserRole | null;
  if (!id || !role || !INVITABLE.includes(role)) return;
  const supabase = await createClient();
  await supabase.from('profiles').update({ role }).eq('id', id);
  revalidatePath('/team/people');
}
