import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import RequestStatus, { type StatusEvent } from '@/components/member/request-status';
import EstimateResponse from '@/components/member/estimate-response';
import { formatDate } from '@/components/ui';
import type { ServiceRequest, Asset, Room } from '@/lib/types/database';
import type { MembershipTier } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export default async function MemberRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('member');
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!request) notFound();
  const r = request as ServiceRequest & {
    category: string | null;
    room_id: string | null;
    asset_id: string | null;
    work_performed: string | null;
    parts_used: string | null;
  };

  const [{ data: events }, { data: asset }, { data: room }, { data: media }, { data: prop }] = await Promise.all([
    supabase
      .from('service_request_events')
      .select('id, from_stage, to_stage, note, created_at')
      .eq('service_request_id', id)
      .order('created_at'),
    r.asset_id
      ? supabase.from('assets').select('id, name, manufacturer, model').eq('id', r.asset_id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.room_id
      ? supabase.from('rooms').select('name').eq('id', r.room_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('photos')
      .select('id, storage_path, mime_type')
      .eq('service_request_id', id)
      .order('created_at'),
    supabase
      .from('properties')
      .select('tier, member_discount_used_ytd')
      .eq('id', r.property_id)
      .maybeSingle(),
  ]);

  // Private bucket — sign each attachment on the server.
  const attachments: { id: string; url: string; isVideo: boolean }[] = [];
  for (const m of (media ?? []) as { id: string; storage_path: string; mime_type: string | null }[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(m.storage_path, 3600);
    if (signed?.signedUrl) {
      attachments.push({
        id: m.id,
        url: signed.signedUrl,
        isVideo: (m.mime_type ?? '').startsWith('video/'),
      });
    }
  }

  const linkedAsset = asset as Pick<Asset, 'id' | 'name' | 'manufacturer' | 'model'> | null;
  const linkedRoom = room as Pick<Room, 'name'> | null;

  return (
    <PortalShell active="dashboard" title={r.title} subtitle="Service request">
      <Link href="/home/requests" className="mb-4 inline-block text-[13px] font-semibold text-brandgreen-600">
        ← All requests
      </Link>

      <RequestStatus
        stage={r.stage}
        priority={r.priority}
        events={(events ?? []) as StatusEvent[]}
      />

      {r.stage === 'AWAITING_APPROVAL' ? (
        <EstimateResponse
          requestId={r.id}
          amount={r.estimate_amount}
          tier={(prop as { tier?: MembershipTier } | null)?.tier ?? null}
          discountUsed={Number(
            (prop as { member_discount_used_ytd?: number } | null)?.member_discount_used_ytd ?? 0,
          )}
        />
      ) : null}

      {r.scheduled_for ? (
        <div className="mb-5 rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/20">
          <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
            Booked in
          </p>
          <p className="mt-1 font-semibold text-navy-800">
            {new Date(r.scheduled_for).toLocaleString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </p>
        </div>
      ) : null}

      {r.work_performed ? (
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            What we did
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{r.work_performed}</p>
          {r.parts_used ? (
            <p className="mt-2 text-[13px] text-slate-600">
              <span className="font-semibold">Parts:</span> {r.parts_used}
            </p>
          ) : null}
          {linkedAsset ? (
            <p className="mt-3 rounded-lg bg-brandgreen-50 px-3 py-2 text-[13px] text-brandgreen-800">
              Saved to <span className="font-semibold">{linkedAsset.name}</span> in
              your Home Record.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          What you told us
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{r.description}</p>
        <dl className="mt-3 space-y-1 text-[13px]">
          {r.category ? <Row label="Type" value={r.category} /> : null}
          {linkedRoom ? <Row label="Where" value={linkedRoom.name} /> : null}
          {linkedAsset ? (
            <Row
              label="Item"
              value={`${linkedAsset.name}${linkedAsset.model ? ` (${linkedAsset.model})` : ''}`}
            />
          ) : null}
          <Row label="Raised" value={formatDate(r.created_at)} />
        </dl>

        {attachments.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {attachments.map((a) =>
              a.isVideo ? (
                <video
                  key={a.id}
                  src={a.url}
                  controls
                  playsInline
                  className="aspect-square w-full rounded-lg bg-black object-cover ring-1 ring-slate-200"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.url}
                  alt="Attached"
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                />
              ),
            )}
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-navy-800">{value}</dd>
    </div>
  );
}
