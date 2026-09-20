import PortalShell from '@/components/member/shell';
import MemberDashboard from '@/components/member/dashboard';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export const metadata = { title: 'HomeKeeper — sample home' };

export default function DemoDashboardPage() {
  const data = DEMO_PORTAL_DATA;
  return (
    <PortalShell
      active="dashboard"
      title={data.property.name}
      subtitle={`${data.property.address_line1}, ${data.property.city}`}
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <MemberDashboard data={data} hrefPrefix="/demo" />
    </PortalShell>
  );
}
