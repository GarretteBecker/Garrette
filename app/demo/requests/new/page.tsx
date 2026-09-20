import { Suspense } from 'react';
import PortalShell from '@/components/member/shell';
import RequestForm from '@/components/member/request-form';
import DemoBanner from '@/components/member/demo-banner';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export default function DemoNewRequestPage() {
  const data = DEMO_PORTAL_DATA;
  return (
    <PortalShell
      active="dashboard"
      title="Request service"
      subtitle={data.property.name}
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <p className="mb-5 text-[14px] leading-relaxed text-slate-600">
        Tell us what is going on and we will take it from there. You will be
        able to follow it here the whole way through.
      </p>
      <Suspense fallback={null}>
        <RequestForm
          propertyId={data.property.id}
          rooms={data.rooms}
          assets={data.assets}
          demo
        />
      </Suspense>
    </PortalShell>
  );
}
