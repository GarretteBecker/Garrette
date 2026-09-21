import { requireStaff } from '@/lib/auth';
import TeamNav from '@/components/team/nav';

/**
 * The staff console.
 *
 * One guard for the whole area, so no individual page can be reached by
 * guessing a URL. The pages check again for the owner-only ones, and RLS
 * checks underneath both — three layers, and only the bottom one matters.
 */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  return (
    <>
      <TeamNav role={profile.role} />
      {children}
    </>
  );
}
