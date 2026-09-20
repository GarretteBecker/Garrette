import { notFound } from 'next/navigation';
import PortalShell from '@/components/member/shell';
import DemoBanner from '@/components/member/demo-banner';
import EmergencyGuide from '@/components/member/emergency-guide';
import { emergencyByKind, EMERGENCIES } from '@/lib/emergency';
import { DEMO_SAFETY_POINTS, DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export function generateStaticParams() {
  return EMERGENCIES.map((e) => ({ kind: e.kind.toLowerCase() }));
}

export default async function DemoHelpKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const def = emergencyByKind(kind.toUpperCase());
  if (!def) notFound();

  const assets = def.assetCategories?.length
    ? DEMO_PORTAL_DATA.assets.filter((a) => def.assetCategories!.includes(a.category))
    : [];

  return (
    <PortalShell
      active="dashboard"
      title="I need help now"
      subtitle={def.label}
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <EmergencyGuide
        def={def}
        points={DEMO_SAFETY_POINTS}
        assets={assets}
        hrefPrefix="/demo"
        hasPriority
        demo
      />
    </PortalShell>
  );
}
