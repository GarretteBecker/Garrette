import { redirect } from 'next/navigation';
import { requireProfile, homeForRole } from '@/lib/auth';

/** Front door: send each role to the right part of the app. */
export default async function RootPage() {
  const profile = await requireProfile();
  redirect(homeForRole(profile.role));
}
