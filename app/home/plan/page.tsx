import { requireRole } from '@/lib/auth';
import { loadPortalData } from '@/lib/member/load';
import PortalShell from '@/components/member/shell';
import HomePlan from '@/components/member/home-plan';
import NoHomeLinked from '@/components/member/no-home-linked';

export default async function HomePlanPage() {
  const profile = await requireRole('member');
  const data = await loadPortalData(profile.full_name);

  if (!data) return <NoHomeLinked active="plan" />;

  return (
    <PortalShell
      active="plan"
      title="Your Home Plan"
      subtitle="What is coming, and roughly when"
    >
      <HomePlan findings={data.findings} planItems={data.planItems} />
    </PortalShell>
  );
}
