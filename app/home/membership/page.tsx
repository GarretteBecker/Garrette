import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import MembershipPanel from '@/components/member/membership-panel';
import NoHomeLinked from '@/components/member/no-home-linked';
import AgreementPanel from '@/components/member/agreement-panel';
import type { MembershipTier } from '@/lib/membership';
import type { Agreement } from '@/lib/agreements';

export default async function MembershipPage() {
  await requireRole('member');
  const supabase = await createClient();

  // RLS scopes this to the member's own home.
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, tier, billing_cycle, commitment_start, member_discount_used_ytd')
    .limit(1);

  const p = (properties ?? [])[0] as
    | {
        id: string;
        name: string;
        tier: MembershipTier;
        billing_cycle: 'MONTHLY' | 'ANNUAL_PREPAID';
        commitment_start: string | null;
        member_discount_used_ytd: number;
      }
    | undefined;

  if (!p) return <NoHomeLinked active="dashboard" />;

  // The agreement that is actually in force. A rescinded or superseded one
  // still exists in the table; it is not what this screen is about.
  const { data: agreements } = await supabase
    .from('membership_agreements')
    .select('*')
    .eq('property_id', p.id)
    .in('status', ['PENDING_SIGNATURE', 'ACTIVE', 'RESCINDED'])
    .order('term_start', { ascending: false })
    .limit(1);

  const agreement = ((agreements ?? [])[0] as Agreement | undefined) ?? null;

  // Private bucket — the signed agreement is signed for on the server.
  let documentUrl: string | null = null;
  if (agreement?.document_id) {
    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', agreement.document_id)
      .maybeSingle();
    const path = (doc as { storage_path?: string } | null)?.storage_path;
    if (path) {
      const { data: signed } = await supabase.storage
        .from('property-docs')
        .createSignedUrl(path, 300);
      documentUrl = signed?.signedUrl ?? null;
    }
  }

  return (
    <PortalShell active="dashboard" title="My membership" subtitle={p.name}>
      <AgreementPanel agreement={agreement} documentUrl={documentUrl} />
      <MembershipPanel
        tier={p.tier}
        billingCycle={p.billing_cycle}
        commitmentStart={p.commitment_start}
        discountUsed={Number(p.member_discount_used_ytd ?? 0)}
      />
    </PortalShell>
  );
}
