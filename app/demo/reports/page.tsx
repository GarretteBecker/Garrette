import PortalShell from '@/components/member/shell';
import ReportsList from '@/components/member/reports-list';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoReportsPage() {
  return (
    <PortalShell
      active="reports"
      title="Reports"
      subtitle="A record of every visit"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <ReportsList
        reports={DEMO_PORTAL_DATA.reports}
        tier={DEMO_PORTAL_DATA.property.tier}
        hrefPrefix="/demo"
        reportBase="/demo"
      />
    </PortalShell>
  );
}
