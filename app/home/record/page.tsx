import { requireRole } from '@/lib/auth';
import { loadPortalData } from '@/lib/member/load';
import PortalShell from '@/components/member/shell';
import HomeRecord from '@/components/member/home-record';
import NoHomeLinked from '@/components/member/no-home-linked';

export default async function HomeRecordPage() {
  const profile = await requireRole('member');
  const data = await loadPortalData(profile.full_name);

  if (!data) return <NoHomeLinked active="record" />;

  return (
    <PortalShell
      active="record"
      title="My Home Record"
      subtitle="Everything we track in your home"
    >
      <HomeRecord assets={data.assets} rooms={data.rooms} photos={data.photos} />
    </PortalShell>
  );
}
