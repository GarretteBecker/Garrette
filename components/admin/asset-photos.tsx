'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { compressImage, formatBytes } from '@/lib/media/compress';

export interface AssetPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  /** Signed URL, minted on the server. */
  url: string | null;
}

/**
 * Photos attached to one asset.
 *
 * The list is fetched on the server (signed URLs and all) and handed down as
 * a prop; this component only handles capture, compression and upload, then
 * refreshes the route. CLAUDE.md rule 4: compress before the bytes leave the
 * phone.
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
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setNote(null);

    try {
      for (const file of Array.from(files)) {
        const { blob, width, height, originalBytes } = await compressImage(file);

        const path = `${propertyId}/assets/${assetId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new Error(uploadError.message);

        const { error: insertError } = await supabase.from('photos').insert({
          property_id: propertyId,
          asset_id: assetId,
          storage_path: path,
          width,
          height,
          size_bytes: blob.size,
          taken_at: new Date(file.lastModified).toISOString(),
        });
        if (insertError) throw new Error(insertError.message);

        setNote(`Uploaded ${formatBytes(blob.size)} (was ${formatBytes(originalBytes)}).`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-navy-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Uploading…' : 'Add photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
        {note ? <span className="text-xs text-slate-500">{note}</span> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) =>
            p.url ? (
              // Signed Supabase URLs expire, so next/image optimization is
              // not worth the cache churn here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt={p.caption ?? 'Asset photo'}
                className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                loading="lazy"
              />
            ) : null,
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No photos on this item yet.</p>
      )}
    </div>
  );
}
