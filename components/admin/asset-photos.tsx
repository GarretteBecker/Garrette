'use client';

import { useRouter } from 'next/navigation';
import PhotoCapture from '@/components/capture/photo-capture';

export interface AssetPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  note: string | null;
  kind: string;
  scan_status: string;
  /** Signed URL, minted on the server. */
  url: string | null;
}

/**
 * Photos on one item in the Home Record.
 *
 * The list is fetched on the server (signed URLs and all) and handed down;
 * capture, compression, upload and data-plate scanning all live in the
 * shared PhotoCapture component so the office and the field behave
 * identically.
 */
export default function AssetPhotos({
  propertyId,
  assetId,
  photos,
}: {
  propertyId: string;
  assetId: string;
  photos: AssetPhoto[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-3">
      <PhotoCapture
        target={{ propertyId, assetId }}
        mode="plate"
        label="Scan data plate"
        onChanged={refresh}
      />
      <PhotoCapture
        target={{ propertyId, assetId }}
        mode="general"
        label="Add photo"
        onChanged={refresh}
      />

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) =>
            p.url ? (
              <li key={p.id}>
                {/* Signed Supabase URLs expire, so next/image optimization is
                    not worth the cache churn here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.note ?? p.caption ?? 'Item photo'}
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                  loading="lazy"
                />
                {p.kind === 'DATA_PLATE' ? (
                  <p className="mt-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    {p.scan_status === 'DONE' ? 'Plate · scanned' : 'Plate'}
                  </p>
                ) : null}
                {p.note ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                    {p.note}
                  </p>
                ) : null}
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">No photos on this item yet.</p>
      )}
    </div>
  );
}
