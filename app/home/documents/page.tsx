import { requireRole } from '@/lib/auth';
import { loadPortalData } from '@/lib/member/load';
import PortalShell from '@/components/member/shell';
import DocumentsList from '@/components/member/documents-list';
import NoHomeLinked from '@/components/member/no-home-linked';

export default async function MemberDocumentsPage() {
  const profile = await requireRole('member');
  const data = await loadPortalData(profile.full_name);

  if (!data) return <NoHomeLinked active="documents" />;

  return (
    <PortalShell active="documents" title="Documents" subtitle="Manuals, warranties, permits">
      <DocumentsList documents={data.documents} />
    </PortalShell>
  );
}
