import PortalShell from '@/components/member/shell';
import HomeRecord from '@/components/member/home-record';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoRecordPage() {
  const data = DEMO_PORTAL_DATA;
  return (
    <PortalShell
      active="record"
      title="My Home Record"
      subtitle="Everything we track in your home"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <HomeRecord assets={data.assets} rooms={data.rooms} photos={data.photos} />
    </PortalShell>
  );
}
