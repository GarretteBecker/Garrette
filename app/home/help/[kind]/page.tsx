import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import EmergencyGuide from '@/components/member/emergency-guide';
import { loadSafetyPoints } from '@/lib/member/safety';
import { emergencyByKind, EMERGENCIES } from '@/lib/emergency';
import { tierIncludes, type MembershipTier } from '@/lib/membership';
import type { Asset } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return EMERGENCIES.map((e) => ({ kind: e.kind.toLowerCase() }));
}

export default async function HelpKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  await requireRole('member');
  const { kind } = await params;
  const def = emergencyByKind(kind.toUpperCase());
  if (!def) notFound();

  const supabase = await createClient();

  const [points, { data: properties }, { data: assets }] = await Promise.all([
    loadSafetyPoints(),
    supabase.from('properties').select('tier').limit(1),
    def.assetCategories?.length
      ? supabase
          .from('assets')
          .select('id, name, manufacturer, model, serial_number, location_notes')
          .in('category', def.assetCategories)
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  const tier = ((properties ?? [])[0] as { tier?: MembershipTier } | undefined)?.tier ?? null;

  return (
    <PortalShell active="dashboard" title="I need help now" subtitle={def.label}>
      <EmergencyGuide
        def={def}
        points={points}
        assets={(assets ?? []) as Pick<Asset,
          'id' | 'name' | 'manufacturer' | 'model' | 'serial_number' | 'location_notes'>[]}
        hasPriority={tierIncludes(tier, 'priority_routing')}
      />
    </PortalShell>
  );
}
