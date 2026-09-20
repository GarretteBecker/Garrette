import { requireRole } from '@/lib/auth';
import { loadPortalData } from '@/lib/member/load';
import PortalShell from '@/components/member/shell';
import ReportsList from '@/components/member/reports-list';
import NoHomeLinked from '@/components/member/no-home-linked';

export default async function MemberReportsPage() {
  const profile = await requireRole('member');
  const data = await loadPortalData(profile.full_name);

  if (!data) return <NoHomeLinked active="reports" />;

  return (
    <PortalShell active="reports" title="Reports" subtitle="A record of every visit">
      <ReportsList reports={data.reports} />
    </PortalShell>
  );
}
