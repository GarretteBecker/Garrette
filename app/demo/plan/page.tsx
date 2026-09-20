import PortalShell from '@/components/member/shell';
import HomePlan from '@/components/member/home-plan';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoPlanPage() {
  const data = DEMO_PORTAL_DATA;
  return (
    <PortalShell
      active="plan"
      title="Your Home Plan"
      subtitle="What is coming, and roughly when"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <HomePlan findings={data.findings} planItems={data.planItems} />
    </PortalShell>
  );
}
