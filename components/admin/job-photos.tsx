'use client';

import { useRouter } from 'next/navigation';
import PhotoCapture from '@/components/capture/photo-capture';

export interface JobPhoto {
  id: string;
  url: string;
  isVideo: boolean;
  kind: 'BEFORE' | 'AFTER';
  note: string | null;
}

/**
 * B&M's own photographs of a job.
 *
 * Kept apart from the member's submission photos on purpose: theirs is what
 * they reported, ours is what we found and what we left behind. Both end up
 * on the Home Record item when the job is closed out, which is what makes a
 * repair auditable a year later.
 */
export default function JobPhotos({
  propertyId,
  requestId,
  photos,
}: {
  propertyId: string;
  requestId: string;
  photos: JobPhoto[];
}) {
  const router = useRouter();
  const target = { propertyId, serviceRequestId: requestId };

  const before = photos.filter((p) => p.kind === 'BEFORE');
  const after = photos.filter((p) => p.kind === 'AFTER');

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-navy-800">Job photos</h2>
      <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
        What it looked like, and what it looks like now. These move onto the
        Home Record item when you close the job out.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Before ({before.length})
          </p>
          <PhotoCapture
            target={target}
            photoKind="BEFORE"
            label="Photo before"
            onChanged={() => router.refresh()}
          />
          <Grid photos={before} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            After ({after.length})
          </p>
          <PhotoCapture
            target={target}
            photoKind="AFTER"
            label="Photo after"
            onChanged={() => router.refresh()}
          />
          <Grid photos={after} />
        </div>
      </div>
    </div>
  );
}

function Grid({ photos }: { photos: JobPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2">
      {photos.map((p) => (
        <li key={p.id}>
          {p.isVideo ? (
            <video
              src={p.url}
              controls
              playsInline
              className="aspect-square w-full rounded-lg bg-black object-cover ring-1 ring-slate-200"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.url}
              alt={p.note ?? 'Job photo'}
              className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
            />
          )}
          {p.note ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">{p.note}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
