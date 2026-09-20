import { notFound } from 'next/navigation';
import PortalShell from '@/components/member/shell';
import DemoBanner from '@/components/member/demo-banner';
import RequestDetail from '@/components/member/request-detail';
import { DEMO_REQUESTS, DEMO_PORTAL_DATA } from '@/lib/member/demo-data';

export function generateStaticParams() {
  return DEMO_REQUESTS.map((r) => ({ id: r.id }));
}

/**
 * The sales demo's request detail — the same component the live portal uses.
 *
 * One of the fixture requests sits at AWAITING_APPROVAL, so the Approve
 * button is on screen during a demo rather than described.
 */
export default async function DemoRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = DEMO_REQUESTS.find((x) => x.id === id);
  if (!r) notFound();

  return (
    <PortalShell
      active="dashboard"
      title={r.title}
      subtitle="Service request"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />
      <RequestDetail
        id={r.id}
        stage={r.stage}
        priority={r.priority}
        events={r.events}
        description={r.description}
        category={r.category}
        roomName={r.roomName}
        assetName={r.assetName}
        assetModel={r.assetModel}
        createdAt={r.created_at}
        estimateAmount={r.estimate_amount}
        approvedAt={r.approved_at}
        scheduledFor={r.scheduled_for}
        workPerformed={r.work_performed}
        partsUsed={r.parts_used}
        tier={DEMO_PORTAL_DATA.property.tier}
        discountUsed={DEMO_PORTAL_DATA.property.member_discount_used_ytd}
        attachments={[]}
        hrefPrefix="/demo"
        demo
      />
    </PortalShell>
  );
}
