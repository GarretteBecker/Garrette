'use client';

import { useMemo, useRef, useState } from 'react';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import { compressImage, formatBytes } from '@/lib/media/compress';
import { FINDING_STATUSES, FINDING_STATUS_STYLES } from '@/lib/types/finding-status';
import { inputClass, textareaClass } from '@/components/ui';
import VoiceNoteButton from './voice-note-button';
import type { Property, Visit, Room, Asset, Finding, FindingStatus } from '@/lib/types/database';

/**
 * The 30-second finding (CLAUDE.md rule 1).
 *
 * Everything is on one screen, in the order a tech actually works:
 * photo → where → what → how bad → say it. No page transitions, no
 * required fields beyond a status and a title, and the save writes to the
 * offline outbox so it never waits on a basement signal.
 */
export default function QuickFinding({
  property,
  visit,
  rooms,
  assets,
  techId,
  onClose,
  onSaved,
}: {
  property: Property;
  visit: Visit;
  rooms: Room[];
  assets: Asset[];
  techId: string;
  onClose: () => void;
  onSaved: (finding: Finding) => void;
}) {
  const [status, setStatus] = useState<FindingStatus | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; width: number; height: number } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Components in the chosen room float to the top; everything stays reachable.
  const relevantAssets = useMemo(() => {
    if (!roomId) return assets.slice(0, 12);
    const inRoom = assets.filter((a) => a.room_id === roomId);
    const rest = assets.filter((a) => a.room_id !== roomId);
    return [...inRoom, ...rest].slice(0, 20);
  }, [assets, roomId]);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const result = await compressImage(file);
      setPhoto({ blob: result.blob, width: result.width, height: result.height });
      setPhotoPreview(URL.createObjectURL(result.blob));
      setPhotoNote(
        `${formatBytes(result.blob.size)} (was ${formatBytes(result.originalBytes)})`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo.');
    }
  }

  function pickAsset(asset: Asset) {
    setAssetId(asset.id === assetId ? null : asset.id);
    if (asset.id !== assetId) {
      if (!roomId && asset.room_id) setRoomId(asset.room_id);
      // Seed the title so the common case needs zero typing.
      if (!title.trim()) setTitle(asset.name);
    }
  }

  async function save() {
    if (!status) {
      setError('Pick a status.');
      return;
    }
    const finalTitle = title.trim() || (status === 'GOOD' ? 'Checked, no issues' : 'Finding');

    setSaving(true);
    setError(null);

    const localId = crypto.randomUUID();
    const payload = {
      property_id: property.id,
      visit_id: visit.id,
      room_id: roomId,
      asset_id: assetId,
      status,
      title: finalTitle,
      description: description.trim() || null,
      created_by: techId,
    };

    try {
      await enqueue({
        localId,
        kind: 'finding.create',
        propertyId: property.id,
        payload,
        photo: photo ?? undefined,
      });

      // Fire and forget — if there is no signal, the outbox holds it.
      void syncNow();

      onSaved({
        id: localId,
        ...payload,
        priority: 'MEDIUM',
        estimated_cost_low: null,
        estimated_cost_high: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
      } as Finding);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <header className="safe-top flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-medium text-slate-600">
          Cancel
        </button>
        <h2 className="text-base font-semibold text-navy-800">New finding</h2>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !status}
          className="rounded-lg bg-brandgreen-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* 1 — photo */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-4 flex h-28 w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 active:bg-slate-100"
        >
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="Finding"
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                   className="h-8 w-8 text-slate-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span className="text-base font-semibold text-slate-600">Take photo</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void handlePhoto(e.target.files?.[0])}
        />
        {photoNote ? (
          <p className="-mt-2 mb-3 text-center text-xs text-slate-500">
            Compressed to {photoNote}
          </p>
        ) : null}

        {/* 2 — status, biggest target on the screen */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Status
        </p>
        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {FINDING_STATUSES.map((s) => {
            const style = FINDING_STATUS_STYLES[s];
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex h-16 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-tight transition ${
                  active
                    ? `${style.solid} ring-2 ring-navy-800 ring-offset-2`
                    : style.soft
                }`}
              >
                {style.label}
              </button>
            );
          })}
        </div>
        {status ? (
          <p className="-mt-2 mb-4 text-xs text-slate-500">
            {FINDING_STATUS_STYLES[status].meaning}
          </p>
        ) : null}

        {/* 3 — room */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Room
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoomId(roomId === r.id ? null : r.id)}
              className={`h-10 rounded-full px-3 text-sm font-medium ${
                roomId === r.id
                  ? 'bg-navy-700 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* 4 — component */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Component
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {relevantAssets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pickAsset(a)}
              className={`h-10 rounded-full px-3 text-sm font-medium ${
                assetId === a.id
                  ? 'bg-brandgreen-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {a.name}
            </button>
          ))}
          {relevantAssets.length === 0 ? (
            <p className="text-sm text-slate-500">No items in the Home Record yet.</p>
          ) : null}
        </div>

        {/* 5 — words */}
        <label htmlFor="finding-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Headline
        </label>
        <input
          id="finding-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Water heater corrosion at top fittings"
          className={`${inputClass} mb-3`}
        />

        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="finding-note" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Note
          </label>
          <VoiceNoteButton
            onText={(text) =>
              setDescription((prev) => (prev ? `${prev} ${text}` : text))
            }
          />
        </div>
        <textarea
          id="finding-note"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tap the mic and just talk."
          className={textareaClass}
        />

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <p className="mt-4 pb-6 text-center text-xs text-slate-400">
          Saves to this phone instantly. Uploads when you have signal.
        </p>
      </div>
    </div>
  );
}
