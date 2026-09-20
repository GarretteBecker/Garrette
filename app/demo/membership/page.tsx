import PortalShell from '@/components/member/shell';
import MembershipPanel from '@/components/member/membership-panel';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoMembershipPage() {
  return (
    <PortalShell
      active="dashboard"
      title="My membership"
      subtitle={DEMO_PORTAL_DATA.property.name}
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      {/* Read from the fixture rather than hard-coded, so flipping `tier` in
          lib/member/demo-data.ts switches the whole demo — this screen and
          the Reports screen together — between Core and Response. */}
      <MembershipPanel
        tier={DEMO_PORTAL_DATA.property.tier}
        billingCycle={DEMO_PORTAL_DATA.property.billing_cycle}
        commitmentStart={DEMO_PORTAL_DATA.property.commitment_start}
        discountUsed={DEMO_PORTAL_DATA.property.member_discount_used_ytd}
      />
    </PortalShell>
  );
}
