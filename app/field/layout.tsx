import { requireRole } from '@/lib/auth';

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admins can use the field app too — the owner runs visits himself.
  await requireRole('tech', 'admin');
  return <>{children}</>;
}
