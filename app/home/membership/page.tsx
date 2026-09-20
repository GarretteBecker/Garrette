import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import MembershipPanel from '@/components/member/membership-panel';
import NoHomeLinked from '@/components/member/no-home-linked';
import type { MembershipTier } from '@/lib/membership';

export default async function MembershipPage() {
  await requireRole('member');
  const supabase = await createClient();

  // RLS scopes this to the member's own home.
  const { data: properties } = await supabase
    .from('properties')
    .select('name, tier, billing_cycle, commitment_start, member_discount_used_ytd')
    .limit(1);

  const p = (properties ?? [])[0] as
    | {
        name: string;
        tier: MembershipTier;
        billing_cycle: 'MONTHLY' | 'ANNUAL_PREPAID';
        commitment_start: string | null;
        member_discount_used_ytd: number;
      }
    | undefined;

  if (!p) return <NoHomeLinked active="dashboard" />;

  return (
    <PortalShell active="dashboard" title="My membership" subtitle={p.name}>
      <MembershipPanel
        tier={p.tier}
        billingCycle={p.billing_cycle}
        commitmentStart={p.commitment_start}
        discountUsed={Number(p.member_discount_used_ytd ?? 0)}
      />
    </PortalShell>
  );
}
