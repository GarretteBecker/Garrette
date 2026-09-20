import Link from 'next/link';
import RequestStatus, { type StatusEvent } from '@/components/member/request-status';
import EstimateResponse from '@/components/member/estimate-response';
import { formatDate } from '@/components/ui';
import type { ServiceRequestStage, PriorityLevel } from '@/lib/types/database';
import type { MembershipTier } from '@/lib/membership';

export interface RequestAttachment {
  id: string;
  url: string;
  isVideo: boolean;
  /** BEFORE/AFTER are B&M's photographs of the job, not the member's own. */
  kind?: string | null;
}

export interface RequestDetailProps {
  id: string;
  stage: ServiceRequestStage;
  priority: PriorityLevel;
  events: StatusEvent[];
  description: string | null;
  category: string | null;
  roomName: string | null;
  assetName: string | null;
  assetModel: string | null;
  createdAt: string;
  estimateAmount: number | null;
  approvedAt: string | null;
  scheduledFor: string | null;
  workPerformed: string | null;
  partsUsed: string | null;
  tier: MembershipTier | null;
  discountUsed: number;
  attachments: RequestAttachment[];
  hrefPrefix?: string;
  /** Sales demo: the buttons work, but nothing is written anywhere. */
  demo?: boolean;
}

/**
 * One request, as the homeowner sees it.
 *
 * Shared by the live portal and the /demo walkthrough so a prospect is shown
 * the real screen, approval button and all — the demo was previously a dead
 * end, which is exactly where a sales conversation needs the Approve button
 * to be.
 */
export default function RequestDetail({
  id,
  stage,
  priority,
  events,
  description,
  category,
  roomName,
  assetName,
  assetModel,
  createdAt,
  estimateAmount,
  approvedAt,
  scheduledFor,
  workPerformed,
  partsUsed,
  tier,
  discountUsed,
  attachments,
  hrefPrefix = '/home',
  demo = false,
}: RequestDetailProps) {
  // Their photos and ours are the same table; on their screen they are two
  // different things — what they reported, and what we did about it.
  const isJob = (a: RequestAttachment) => a.kind === 'BEFORE' || a.kind === 'AFTER';
  const jobPhotos = attachments.filter(isJob);
  const theirPhotos = attachments.filter((a) => !isJob(a));

  return (
    <>
      <Link
        href={`${hrefPrefix}/requests`}
        className="mb-4 inline-block text-[13px] font-semibold text-brandgreen-600"
      >
        ← All requests
      </Link>

      <RequestStatus stage={stage} priority={priority} events={events}>
        {stage === 'AWAITING_APPROVAL' ? (
          <EstimateResponse
            requestId={id}
            amount={estimateAmount}
            tier={tier}
            discountUsed={discountUsed}
            demo={demo}
          />
        ) : null}

        {/* Their own record that they said go, and when. The office sees the
            same fact on its side of the job. */}
        {approvedAt && stage !== 'AWAITING_APPROVAL' ? (
          <div className="mb-5 rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/20">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
              You approved this
            </p>
            <p className="mt-1 text-[14px] text-navy-800">
              {new Date(approvedAt).toLocaleString('en-US', {
                month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
              {scheduledFor ? '' : ' — we are getting it on the calendar.'}
            </p>
          </div>
        ) : null}

        {scheduledFor ? (
          <div className="mb-5 rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/20">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
              Booked in
            </p>
            <p className="mt-1 font-semibold text-navy-800">
              {new Date(scheduledFor).toLocaleString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </p>
          </div>
        ) : null}
      </RequestStatus>

      {workPerformed || jobPhotos.length > 0 ? (
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            What we did
          </h2>
          {workPerformed ? (
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{workPerformed}</p>
          ) : null}
          {jobPhotos.length > 0 ? <Media items={jobPhotos} /> : null}
          {partsUsed ? (
            <p className="mt-2 text-[13px] text-slate-600">
              <span className="font-semibold">Parts:</span> {partsUsed}
            </p>
          ) : null}
          {assetName ? (
            <p className="mt-3 rounded-lg bg-brandgreen-50 px-3 py-2 text-[13px] text-brandgreen-800">
              Saved to <span className="font-semibold">{assetName}</span> in your Home Record.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          What you told us
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{description}</p>
        <dl className="mt-3 space-y-1 text-[13px]">
          {category ? <Row label="Type" value={category} /> : null}
          {roomName ? <Row label="Where" value={roomName} /> : null}
          {assetName ? (
            <Row label="Item" value={`${assetName}${assetModel ? ` (${assetModel})` : ''}`} />
          ) : null}
          <Row label="Raised" value={formatDate(createdAt)} />
        </dl>

        {theirPhotos.length > 0 ? <Media items={theirPhotos} /> : null}
      </div>
    </>
  );
}

function Media({ items }: { items: RequestAttachment[] }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {items.map((a) =>
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
