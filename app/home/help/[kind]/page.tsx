import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import EmergencyGuide from '@/components/member/emergency-guide';
import { loadSafetyPoints } from '@/lib/member/safety';
import { emergencyByKind, adaptForFuel, EMERGENCIES, type HeatingFuel } from '@/lib/emergency';
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
  const base = emergencyByKind(kind.toUpperCase());
  if (!base) notFound();

  const supabase = await createClient();

  const [points, { data: properties }, { data: assets }] = await Promise.all([
    loadSafetyPoints(),
    supabase.from('properties').select('tier, heating_fuel').limit(1),
    base.assetCategories?.length
      ? supabase
          .from('assets')
          .select('id, name, manufacturer, model, serial_number, location_notes')
          .in('category', base.assetCategories)
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  const property = (properties ?? [])[0] as
    { tier?: MembershipTier; heating_fuel?: HeatingFuel } | undefined;
  const tier = property?.tier ?? null;

  // Propane is not natural gas. Their fuel changes what this screen says —
  // see the block at the foot of lib/emergency.ts for why.
  const def = adaptForFuel(base, property?.heating_fuel ?? null);

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
