import PortalShell from '@/components/member/shell';
import DocumentsList from '@/components/member/documents-list';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoDocumentsPage() {
  return (
    <PortalShell
      active="documents"
      title="Documents"
      subtitle="Manuals, warranties, permits"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <DocumentsList documents={DEMO_PORTAL_DATA.documents} demo />
    </PortalShell>
  );
}
