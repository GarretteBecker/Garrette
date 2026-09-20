import PortalShell from '@/components/member/shell';
import DemoBanner from '@/components/member/demo-banner';
import EmergencyPicker from '@/components/member/emergency-picker';

export default function DemoHelpPage() {
  return (
    <PortalShell
      active="dashboard"
      title="I need help now"
      subtitle="What is happening?"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      {/* The sample home is a Response member, so the demo shows priority. */}
      <EmergencyPicker hrefPrefix="/demo" hasPriority />
    </PortalShell>
  );
}
