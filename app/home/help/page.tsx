import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import EmergencyPicker from '@/components/member/emergency-picker';
import { tierIncludes, type MembershipTier } from '@/lib/membership';
import type { HeatingFuel } from '@/lib/emergency';

export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  await requireRole('member');
  const supabase = await createClient();

  // RLS scopes this to their own home.
  const { data: properties } = await supabase
    .from('properties')
    .select('tier, heating_fuel')
    .limit(1);
  const property = (properties ?? [])[0] as
    { tier?: MembershipTier; heating_fuel?: HeatingFuel } | undefined;
  const tier = property?.tier ?? null;

  return (
    <PortalShell active="dashboard" title="I need help now" subtitle="What is happening?">
      <EmergencyPicker
        hasPriority={tierIncludes(tier, 'priority_routing')}
        fuel={property?.heating_fuel ?? null}
      />
    </PortalShell>
  );
}
