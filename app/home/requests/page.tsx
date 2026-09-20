import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import SyncBanner from '@/components/field/sync-banner';
import { StageChip } from '@/components/member/request-status';
import { urgencyLabel } from '@/lib/service-requests';
import { formatDate } from '@/components/ui';
import type { ServiceRequest } from '@/lib/types/database';

export default async function MemberRequestsPage() {
  await requireRole('member');
  const supabase = await createClient();

  const { data } = await supabase
    .from('service_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const requests = (data ?? []) as ServiceRequest[];
  const open = requests.filter((r) => r.stage !== 'CLOSED');
  const closed = requests.filter((r) => r.stage === 'CLOSED');

  return (
    <PortalShell active="dashboard" title="Service requests" subtitle="What you have asked us to look at">
      <div className="-mx-5 -mt-5 mb-5">
        <SyncBanner />
      </div>
      <Link
        href="/home/requests/new"
        className="mb-6 flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-brandgreen-600 text-base font-bold text-white active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
             className="h-5 w-5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Request service
      </Link>

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-[15px] leading-relaxed text-slate-500">
          Nothing open right now. If something in the house needs looking at,
          tell us here and we will pick it up.
        </p>
      ) : null}

      {open.length > 0 ? (
        <>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            Open ({open.length})
          </h2>
          <ul className="mb-7 space-y-2.5">
            {open.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        </>
      ) : null}

      {closed.length > 0 ? (
        <>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            Finished ({closed.length})
          </h2>
          <ul className="space-y-2.5">
            {closed.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </ul>
        </>
      ) : null}
    </PortalShell>
  );
}

function RequestRow({ request }: { request: ServiceRequest }) {
  return (
    <li>
      <Link
        href={`/home/requests/${request.id}`}
        className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold leading-snug text-navy-800">{request.title}</p>
          <StageChip stage={request.stage} member />
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Raised {formatDate(request.created_at)} · {urgencyLabel(request.priority)}
        </p>
      </Link>
    </li>
  );
}
