import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import RequestDetail, { type RequestAttachment } from '@/components/member/request-detail';
import type { StatusEvent } from '@/components/member/request-status';
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
      .select('id, storage_path, mime_type, kind')
      .eq('service_request_id', id)
      .order('created_at'),
    supabase
      .from('properties')
      .select('tier, member_discount_used_ytd')
      .eq('id', r.property_id)
      .maybeSingle(),
  ]);

  // Private bucket — sign each attachment on the server.
  const attachments: RequestAttachment[] = [];
  type MediaRow = {
    id: string; storage_path: string; mime_type: string | null; kind: string | null;
  };
  for (const m of (media ?? []) as MediaRow[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(m.storage_path, 3600);
    if (signed?.signedUrl) {
      attachments.push({
        id: m.id,
        url: signed.signedUrl,
        isVideo: (m.mime_type ?? '').startsWith('video/'),
        kind: m.kind,
      });
    }
  }

  const linkedAsset = asset as Pick<Asset, 'id' | 'name' | 'manufacturer' | 'model'> | null;
  const linkedRoom = room as Pick<Room, 'name'> | null;
  const property = prop as { tier?: MembershipTier; member_discount_used_ytd?: number } | null;

  return (
    <PortalShell active="dashboard" title={r.title} subtitle="Service request">
      <RequestDetail
        id={r.id}
        stage={r.stage}
        priority={r.priority}
        events={(events ?? []) as StatusEvent[]}
        description={r.description}
        category={r.category}
        roomName={linkedRoom?.name ?? null}
        assetName={linkedAsset?.name ?? null}
        assetModel={linkedAsset?.model ?? null}
        createdAt={r.created_at}
        estimateAmount={r.estimate_amount}
        approvedAt={r.approved_at}
        scheduledFor={r.scheduled_for}
        workPerformed={r.work_performed}
        partsUsed={r.parts_used}
        tier={property?.tier ?? null}
        discountUsed={Number(property?.member_discount_used_ytd ?? 0)}
        attachments={attachments}
      />
    </PortalShell>
  );
}
