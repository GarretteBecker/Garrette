import PortalShell from '@/components/member/shell';
import DemoBanner from '@/components/member/demo-banner';
import EmergencyPicker from '@/components/member/emergency-picker';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

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
      <EmergencyPicker
        hrefPrefix="/demo"
        hasPriority
        fuel={DEMO_PORTAL_DATA.property.heating_fuel ?? null}
      />
    </PortalShell>
  );
}
