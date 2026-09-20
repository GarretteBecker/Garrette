import Link from 'next/link';
import PortalShell from '@/components/member/shell';
import DemoBanner from '@/components/member/demo-banner';
import { StageChip } from '@/components/member/request-status';
import { DEMO_PORTAL_DATA } from '@/lib/member/demo-data';
import { formatDate } from '@/components/ui';
import type { ServiceRequestStage } from '@/lib/types/database';

export default function DemoRequestsPage() {
  const requests = DEMO_PORTAL_DATA.openRequests;

  return (
    <PortalShell
      active="dashboard"
      title="Service requests"
      subtitle="What you have asked us to look at"
      hrefPrefix="/demo"
      showSignOut={false}
    >
      <DemoBanner />

      <Link
        href="/demo/requests/new"
        className="mb-6 flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-brandgreen-600 text-base font-bold text-white active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
             className="h-5 w-5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Request service
      </Link>

      <ul className="space-y-2.5">
        {requests.map((r) => (
          <li key={r.id}>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold leading-snug text-navy-800">{r.title}</p>
                <StageChip stage={r.stage as ServiceRequestStage} member />
              </div>
              <p className="mt-1 text-[12px] text-slate-500">
                Raised {formatDate(r.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
