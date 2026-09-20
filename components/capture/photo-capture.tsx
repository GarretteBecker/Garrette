'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImage, formatBytes } from '@/lib/media/compress';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import type { StoredScan } from '@/lib/scan/schema';
import ScanReview from './scan-review';

/**
 * Attach a photo to anything.
 *
 * One component covers every case in the app — an item in the Home Record,
 * a finding, a visit, a room, or the property itself — because the photos
 * table carries a nullable FK for each. Pass whichever ids apply.
 *
 * Two behaviours matter:
 *
 *  - It never blocks on the network. With no signal the photo goes into the
 *    offline outbox and the tech carries on; it uploads, and scans, when
 *    signal returns (CLAUDE.md rule 1).
 *  - The bytes are compressed on the phone before anything is sent
 *    (CLAUDE.md rule 4).
 */

export interface CaptureTarget {
  propertyId: string;
  assetId?: string | null;
  findingId?: string | null;
  visitId?: string | null;
  roomId?: string | null;
  serviceRequestId?: string | null;
}

type Phase =
  | { t: 'idle' }
  | { t: 'working'; label: string }
  | { t: 'queued'; note: string }
  | { t: 'saved'; photoId: string; preview: string; sizeNote: string }
  | { t: 'review'; photoId: string; preview: string; scan: StoredScan }
  | { t: 'error'; message: string; preview?: string };

export default function PhotoCapture({
  target,
  mode = 'general',
  photoKind = 'GENERAL',
  label,
  onChanged,
  onCaptured,
  onUseValues,
}: {
  target: CaptureTarget;
  /** 'plate' adds the data-plate scan after upload. */
  mode?: 'general' | 'plate';
  /** How the photo is filed. BEFORE/AFTER separate our job shots from the
      member's own. Ignored when mode is 'plate'. */
  photoKind?: 'GENERAL' | 'BEFORE' | 'AFTER' | 'DOCUMENT';
  label?: string;
  /** Fired after something lands, so the parent can refresh. */
  onChanged?: () => void;
  /** Every photo id this component creates, so a parent can link them later. */
  onCaptured?: (photoId: string) => void;
  /** Present when the parent is a form that wants the reading, not a row write. */
  onUseValues?: (scan: StoredScan) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isPlate = mode === 'plate';

  async function capture(file: File | undefined) {
    if (!file) return;

    setPhase({ t: 'working', label: 'Compressing…' });

    let compressed;
    try {
      compressed = await compressImage(file);
    } catch (e) {
      setPhase({ t: 'error', message: e instanceof Error ? e.message : 'Could not read that photo.' });
      return;
    }

    const { blob, width, height, originalBytes } = compressed;
    const preview = URL.createObjectURL(blob);
    const photoId = crypto.randomUUID();
    const sizeNote = `${formatBytes(blob.size)} (was ${formatBytes(originalBytes)})`;

    const row = {
      asset_id: target.assetId ?? null,
      finding_id: target.findingId ?? null,
      visit_id: target.visitId ?? null,
      room_id: target.roomId ?? null,
      service_request_id: target.serviceRequestId ?? null,
      kind: isPlate ? ('DATA_PLATE' as const) : photoKind,
      note: note.trim() || null,
      scan_status: isPlate ? ('PENDING' as const) : ('NOT_REQUESTED' as const),
      taken_at: new Date(file.lastModified).toISOString(),
    };

    // No signal: queue it and get out of the tech's way.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueue({
        localId: photoId,
        kind: 'photo.upload',
        propertyId: target.propertyId,
        payload: row,
        photo: { blob, width, height },
        wantScan: isPlate,
      });
      onCaptured?.(photoId);
      setPhase({
        t: 'queued',
        note: isPlate
          ? 'Saved on this phone. It will upload and scan when you get signal.'
          : 'Saved on this phone. It will upload when you get signal.',
      });
      onChanged?.();
      return;
    }

    try {
      const supabase = createClient();
      setPhase({ t: 'working', label: 'Uploading…' });

      const path = `${target.propertyId}/captures/${photoId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from('photos').upsert({
        id: photoId,
        property_id: target.propertyId,
        ...row,
        storage_path: path,
        width,
        height,
        size_bytes: blob.size,
      });
      if (insertError) throw new Error(insertError.message);

      onCaptured?.(photoId);
      onChanged?.();

      if (!isPlate) {
        setPhase({ t: 'saved', photoId, preview, sizeNote });
        return;
      }

      setPhase({ t: 'working', label: 'Reading the plate…' });

      const res = await fetch('/api/scan-plate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });
      const body = (await res.json()) as { scan?: StoredScan; error?: string };

      if (!res.ok || !body.scan) {
        // The photo is already safe — only the reading failed.
        setPhase({
          t: 'error',
          message: body.error ?? 'Could not read that plate.',
          preview,
        });
        return;
      }

      setPhase({ t: 'review', photoId, preview, scan: body.scan });
    } catch (e) {
      setPhase({
        t: 'error',
        message: e instanceof Error ? e.message : 'Upload failed.',
        preview,
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      void syncNow();
    }
  }

  function reset() {
    setNote('');
    setPhase({ t: 'idle' });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void capture(e.target.files?.[0])}
      />

      {phase.t === 'idle' ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-base font-semibold active:scale-[0.99] ${
            isPlate
              ? 'bg-navy-700 text-white'
              : 'bg-white text-navy-700 ring-1 ring-slate-300'
          }`}
        >
          {isPlate ? <ScanIcon /> : <CameraIcon />}
          {label ?? (isPlate ? 'Scan data plate' : 'Add photo')}
        </button>
      ) : null}

      {phase.t === 'working' ? (
        <div className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-slate-100 text-[15px] font-medium text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          {phase.label}
        </div>
      ) : null}

      {phase.t === 'queued' ? (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
          <p className="font-semibold text-amber-900">Saved on this phone</p>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">{phase.note}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 h-11 w-full rounded-lg bg-white font-semibold text-navy-700 ring-1 ring-slate-300"
          >
            Take another
          </button>
        </div>
      ) : null}

      {phase.t === 'saved' ? (
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={phase.preview}
              alt="Just captured"
              className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brandgreen-700">Photo saved</p>
              <p className="text-[12px] text-slate-500">Compressed to {phase.sizeNote}</p>
            </div>
          </div>
          <NoteField photoId={phase.photoId} note={note} setNote={setNote} onSaved={onChanged} />
          <button
            type="button"
            onClick={reset}
            className="mt-2 h-11 w-full rounded-lg bg-white font-semibold text-navy-700 ring-1 ring-slate-300"
          >
            Take another
          </button>
        </div>
      ) : null}

      {phase.t === 'review' ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={phase.preview}
            alt="Data plate"
            className="h-40 w-full rounded-xl object-cover ring-1 ring-slate-200"
          />
          <ScanReview
            scan={phase.scan}
            photoId={phase.photoId}
            assetId={target.assetId ?? null}
            onApplied={() => {
              onChanged?.();
              reset();
            }}
            onDismiss={reset}
            onUseValues={
              onUseValues
                ? (scan) => {
                    onUseValues(scan);
                    reset();
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {phase.t === 'error' ? (
        <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-700/20">
          <p className="font-semibold text-red-900">
            {phase.preview ? 'Photo saved, but the scan failed' : 'That did not work'}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-red-900/80">{phase.message}</p>
          <p className="mt-2 text-[12px] text-red-900/60">
            You can always type the numbers in by hand.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 h-11 w-full rounded-lg bg-white font-semibold text-navy-700 ring-1 ring-slate-300"
          >
            OK
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NoteField({
  photoId,
  note,
  setNote,
  onSaved,
}: {
  photoId: string;
  note: string;
  setNote: (v: string) => void;
  onSaved?: () => void;
}) {
  const [saved, setSaved] = useState(false);

  async function save() {
    const supabase = createClient();
    await supabase.from('photos').update({ note: note.trim() || null }).eq('id', photoId);
    setSaved(true);
    onSaved?.();
  }

  return (
    <div className="mt-3">
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (note.trim()) void save();
        }}
        placeholder="Add a note to this photo (optional)"
        className="min-h-16 w-full rounded-lg border border-slate-300 p-3 text-[15px] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
      />
      {saved ? <p className="mt-1 text-[12px] text-brandgreen-700">Note saved.</p> : null}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M3 12h18" />
    </svg>
  );
}
