import type { UserRole } from '@/lib/types/database';

/**
 * Role helpers with no server imports, so client components can use them.
 *
 * lib/auth.ts pulls in next/navigation's redirect and the server Supabase
 * client; importing it from a 'use client' file drags both into the
 * browser bundle and fails the build.
 */

/** Anyone who works here — owner or office. */
export function isStaff(role: UserRole): boolean {
  return role === 'admin' || role === 'ops';
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Owner / Admin',
  ops: 'Office',
  tech: 'Field technician',
  member: 'Homeowner',
  trade: 'Trade partner',
};

/** What each role is for, in one line — shown on the invite screen. */
export const ROLE_BLURB: Record<UserRole, string> = {
  admin: 'Everything, including pricing, membership terms and staff accounts.',
  ops: 'Members, scheduling, requests, reports and trades. No pricing, no accounts.',
  tech: 'Only their assigned visits and properties, through the field app.',
  member: 'Only their own home.',
  trade: 'Only the jobs dispatched to them.',
};
