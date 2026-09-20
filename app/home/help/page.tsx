import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import EmergencyPicker from '@/components/member/emergency-picker';
import { tierIncludes, type MembershipTier } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  await requireRole('member');
  const supabase = await createClient();

  // RLS scopes this to their own home.
  const { data: properties } = await supabase.from('properties').select('tier').limit(1);
  const tier = ((properties ?? [])[0] as { tier?: MembershipTier } | undefined)?.tier ?? null;

  return (
    <PortalShell active="dashboard" title="I need help now" subtitle="What is happening?">
      <EmergencyPicker hasPriority={tierIncludes(tier, 'priority_routing')} />
    </PortalShell>
  );
}
