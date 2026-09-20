'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { compressImage, formatBytes } from '@/lib/media/compress';
import { createServiceRequest, type RequestActionState } from '@/lib/actions/service-requests';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import { REQUEST_CATEGORIES, URGENCY_OPTIONS } from '@/lib/service-requests';
import { Field, inputClass, textareaClass } from '@/components/ui';
import type { Asset, Room, PriorityLevel } from '@/lib/types/database';

interface Picked {
  file: File;
  isVideo: boolean;
  preview: string;
}

function SubmitButton({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  const working = pending || busy;
  return (
    <button
      type="submit"
      disabled={working}
      className="h-14 w-full rounded-xl bg-brandgreen-600 text-base font-bold text-white active:scale-[0.99] disabled:opacity-60"
    >
      {working ? 'Sending…' : 'Send to B&M'}
    </button>
  );
}

export default function RequestForm({
  propertyId,
  rooms,
  assets,
}: {
  propertyId: string;
  rooms: Room[];
  assets: Asset[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [urgency, setUrgency] = useState<PriorityLevel>('MEDIUM');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Items in the chosen room first — that is how a homeowner thinks.
  const relevantAssets = roomId
    ? [...assets.filter((a) => a.room_id === roomId), ...assets.filter((a) => a.room_id !== roomId)]
    : assets;

  const [state, formAction] = useActionState<RequestActionState, FormData>(
    async (prev, fd) => {
      // No signal: queue the whole submission — the request row first, then
      // its media — and let the outbox drain it in order when signal returns.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const requestId = crypto.randomUUID();
        await enqueue({
          localId: requestId,
          kind: 'request.create',
          propertyId,
          payload: {
            title: String(fd.get('title') ?? '').trim(),
            description: String(fd.get('description') ?? '').trim(),
            category: String(fd.get('category') ?? '') || null,
            room_id: String(fd.get('room_id') ?? '') || null,
            asset_id: String(fd.get('asset_id') ?? '') || null,
            priority: String(fd.get('priority') ?? 'MEDIUM'),
          },
        });

        for (const item of picked) {
          const compressed = item.isVideo ? null : await compressImage(item.file);
          await enqueue({
            localId: crypto.randomUUID(),
            kind: 'photo.upload',
            propertyId,
            pathPrefix: `requests/${requestId}`,
            payload: {
              service_request_id: requestId,
              kind: 'GENERAL',
              mime_type: item.isVideo ? item.file.type : 'image/jpeg',
            },
            photo: {
              blob: compressed?.blob ?? item.file,
              width: compressed?.width ?? 0,
              height: compressed?.height ?? 0,
            },
          });
        }

        void syncNow();
        setQueued(true);
        return { ok: true };
      }

      const result = await createServiceRequest(prev, fd);
      if (!result.requestId) return result;

      // Media can only be attached once the request row exists — the photos
      // table has a foreign key to it, and the RLS policy checks it too.
      if (picked.length > 0) {
        setBusy(true);
        try {
          await uploadMedia(result.requestId);
        } finally {
          setBusy(false);
        }
      }

      router.push(`/home/requests/${result.requestId}`);
      return result;
    },
    {},
  );

  async function uploadMedia(requestId: string) {
    const supabase = createClient();

    for (const item of picked) {
      let body: Blob = item.file;
      let width: number | null = null;
      let height: number | null = null;
      const ext = item.isVideo ? (item.file.name.split('.').pop() ?? 'mp4') : 'jpg';

      if (!item.isVideo) {
        const c = await compressImage(item.file);
        body = c.blob;
        width = c.width;
        height = c.height;
      }

      const path = `${propertyId}/requests/${requestId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('property-photos')
        .upload(path, body, { contentType: item.isVideo ? item.file.type : 'image/jpeg' });
      if (upErr) {
        setUploadNote(`One file did not upload: ${upErr.message}`);
        continue;
      }

      await supabase.from('photos').insert({
        property_id: propertyId,
        service_request_id: requestId,
        storage_path: path,
        mime_type: item.isVideo ? item.file.type : 'image/jpeg',
        width,
        height,
        size_bytes: body.size,
        kind: 'GENERAL',
      });
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Picked[] = [];
    for (const file of Array.from(list)) {
      next.push({
        file,
        isVideo: file.type.startsWith('video/'),
        preview: URL.createObjectURL(file),
      });
    }
    setPicked((prev) => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = '';
  }

  if (queued) {
    return (
      <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-600/20">
        <p className="text-lg font-semibold text-amber-900">Saved on your phone</p>
        <p className="mt-2 text-[14px] leading-relaxed text-amber-900/80">
          You are offline right now. This will send itself to B&amp;M as soon
          as you have a signal — you do not need to do anything.
        </p>
        <p className="mt-3 text-[13px] font-medium text-amber-900">
          If it is an emergency, call us instead of waiting.
        </p>
        <button
          type="button"
          onClick={() => router.push('/home/requests')}
          className="mt-4 h-12 w-full rounded-lg bg-white font-semibold text-navy-700 ring-1 ring-slate-300"
        >
          Back to my requests
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="priority" value={urgency} />

      <Field label="What kind of problem is it?" htmlFor="category">
        <select id="category" name="category" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose one…</option>
          {REQUEST_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field label="Where in the house?" htmlFor="room_id">
        <select
          id="room_id"
          name="room_id"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className={inputClass}
        >
          <option value="">Not sure / whole house</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Is it one of these?"
        htmlFor="asset_id"
        hint="Optional. Picking the item means we turn up knowing the make, model and age."
      >
        <select id="asset_id" name="asset_id" defaultValue="" className={inputClass}>
          <option value="">Not sure</option>
          {relevantAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.manufacturer ? ` — ${a.manufacturer}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Short title" htmlFor="title">
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Kitchen disposal humming but not spinning"
          className={inputClass}
        />
      </Field>

      <Field
        label="What is happening?"
        htmlFor="description"
        hint="When did it start, what have you noticed, anything you have already tried."
      >
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          placeholder="It makes a humming noise when I flip the switch but nothing turns. It has not worked since Thursday."
          className={textareaClass}
        />
      </Field>

      {/* ---------------------------------------------- media */}
      <div>
        <p className="mb-1 block text-sm font-medium text-navy-800">Photos or a video</p>
        <p className="mb-2 text-xs text-slate-500">
          A ten-second clip of the noise it makes is worth a paragraph of
          description.
        </p>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-white text-base font-semibold text-navy-700 ring-1 ring-slate-300 active:scale-[0.99]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {picked.length > 0 ? 'Add another' : 'Add a photo or video'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />

        {picked.length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {picked.map((p, i) => (
              <li key={p.preview} className="relative">
                {p.isVideo ? (
                  <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg bg-navy-700 text-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="mt-1 text-[10px]">{formatBytes(p.file.size)}</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.preview}
                    alt="Attached"
                    className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                  />
                )}
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                       className="h-3.5 w-3.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* ---------------------------------------------- urgency */}
      <div>
        <p className="mb-2 block text-sm font-medium text-navy-800">How urgent is it?</p>
        <div className="space-y-2">
          {URGENCY_OPTIONS.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => setUrgency(u.value)}
              aria-pressed={urgency === u.value}
              className={`w-full rounded-xl p-3 text-left ring-1 transition ${
                urgency === u.value
                  ? 'bg-navy-700 text-white ring-navy-700'
                  : 'bg-white text-navy-800 ring-slate-300'
              }`}
            >
              <span className="block font-semibold">{u.label}</span>
              <span className={`block text-[12px] leading-snug ${urgency === u.value ? 'text-navy-200' : 'text-slate-500'}`}>
                {u.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-700/20">
          {state.error}
        </p>
      ) : null}
      {uploadNote ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{uploadNote}</p>
      ) : null}

      <SubmitButton busy={busy} />

      <p className="pb-4 text-center text-[12px] leading-relaxed text-slate-500">
        Urgent and after hours? Call us rather than waiting on this.
      </p>
    </form>
  );
}
