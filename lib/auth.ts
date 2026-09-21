import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Profile, UserRole } from '@/lib/types/database';
import { isStaff } from '@/lib/auth-roles';

export { isStaff };

/**
 * The signed-in user's profile, or null.
 *
 * Note this reads public.profiles through RLS, where profiles_select_self
 * guarantees a user can always see their own row.
 */
export async function getProfile(): Promise<Profile | null> {
  // No keys yet: behave like a signed-out visitor so the caller redirects to
  // /login, which explains what is missing.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

/** Require a signed-in user, or bounce to /login. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Require one of the given roles.
 *
 * This is a UX guard so people land somewhere sensible — it is not what
 * keeps data safe. Even if this check were removed entirely, RLS would
 * still refuse to return another property's rows.
 */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(homeForRole(profile.role));
  return profile;
}

/**
 * Require an owner or an office user.
 *
 * The mirror of is_staff() in the database. Same caveat as requireRole:
 * this is where somebody lands, not what keeps data safe. Delete it and
 * RLS still refuses an ops user the pricing columns.
 */
export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect(homeForRole(profile.role));
  return profile;
}

/** Where each role belongs after signing in. */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'ops':
      return '/team';
    case 'tech':
      return '/field';
    case 'member':
      return '/home';
    case 'trade':
      return '/trade';
    default:
      return '/login';
  }
}
