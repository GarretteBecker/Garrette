'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import PhotoCapture from '@/components/capture/photo-capture';
import { Field, inputClass, textareaClass } from '@/components/ui';
import { saveSafetyPoint, deleteSafetyPoint } from '@/lib/actions/safety';
import { SAFETY_POINT_LABEL, type SafetyPoint, type SafetyPointKind } from '@/lib/emergency';

/** The order a tech walks a basement, roughly. */
const KINDS: SafetyPointKind[] = [
  'WATER_MAIN', 'GAS_MAIN', 'ELECTRICAL_PANEL', 'WATER_HEATER_SHUTOFF',
  'SUMP_PUMP', 'MAIN_CLEANOUT', 'WELL_PUMP', 'SEPTIC_ACCESS',
  'OIL_TANK_SHUTOFF', 'SUB_PANEL', 'FLOOR_DRAIN', 'OUTSIDE_SPIGOT_SHUTOFF',
  'SMOKE_CO_ALARM', 'FIRE_EXTINGUISHER', 'OTHER',
];

/** The handful that earn their own prompt — these are what emergencies ask for. */
const CORE_KINDS: SafetyPointKind[] = [
  'WATER_MAIN', 'ELECTRICAL_PANEL', 'GAS_MAIN', 'WATER_HEATER_SHUTOFF',
  'SUMP_PUMP', 'MAIN_CLEANOUT',
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * Recording where the shutoffs are.
 *
 * This is the data behind "I need help now". The location note is written
 * for somebody frightened and holding a torch, so the placeholder shows
 * that voice rather than asking for a tidy label.
 *
 * The photograph matters more than the words. A member who has never
 * looked at their own water main will recognise it from a picture far
 * faster than from a sentence.
 */
export default function SafetyPoints({
  propertyId,
  points,
  rooms,
}: {
  propertyId: string;
  points: (SafetyPoint & { room_id?: string | null })[];
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);

  const have = new Set(points.map((p) => p.kind));
  const missing = CORE_KINDS.filter((k) => !have.has(k));

  return (
    <div className="space-y-3">
      {missing.length > 0 ? (
        <div className="rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-600/20">
          <p className="text-[13px] font-semibold text-amber-900">
            Not recorded yet: {missing.map((k) => SAFETY_POINT_LABEL[k]).join(', ')}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-900/80">
            Their emergency screen will say so honestly, which is the right
            behaviour — but a photographed shutoff is the whole point of it.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-brandgreen-50 px-3.5 py-2.5 text-[13px] font-medium text-brandgreen-800 ring-1 ring-brandgreen-600/20">
          Every shutoff an emergency asks for is recorded.
        </p>
      )}

      {points.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
          {points.map((p) => (
            <li key={p.id} className="bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-800">
                    {p.label?.trim() || SAFETY_POINT_LABEL[p.kind]}
                    {p.room_name ? (
                      <span className="font-normal text-slate-500"> · {p.room_name}</span>
                    ) : null}
                  </p>
                  {p.location_note ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600">
                      {p.location_note}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[13px] text-amber-800">No location written yet.</p>
                  )}
                  <p className="mt-1 text-[12px] text-slate-400">
                    {p.photo_id ? 'Photographed' : 'No photo — worth taking one'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditing(p.id); setPhotoId(p.photo_id); }}
                    className="rounded px-2 py-1 text-[13px] font-semibold text-navy-700"
                  >
                    Edit
                  </button>
                  <form action={deleteSafetyPoint}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="property_id" value={propertyId} />
                    <button type="submit" className="rounded px-2 py-1 text-[13px] text-slate-400">
                      Remove
                    </button>
                  </form>
                </div>
              </div>

              {editing === p.id ? (
                <PointForm
                  propertyId={propertyId}
                  point={p}
                  rooms={rooms}
                  photoId={photoId}
                  setPhotoId={setPhotoId}
                  onDone={() => { setEditing(null); router.refresh(); }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editing === 'new' ? (
        <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200">
          <PointForm
            propertyId={propertyId}
            point={null}
            rooms={rooms}
            photoId={photoId}
            setPhotoId={setPhotoId}
            onDone={() => { setEditing(null); setPhotoId(null); router.refresh(); }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setEditing('new'); setPhotoId(null); }}
          className="h-11 w-full rounded-lg bg-white text-[14px] font-semibold text-navy-700 ring-1 ring-slate-300 active:bg-slate-50"
        >
          Add a shutoff or access point
        </button>
      )}
    </div>
  );
}

function PointForm({
  propertyId, point, rooms, photoId, setPhotoId, onDone,
}: {
  propertyId: string;
  point: (SafetyPoint & { room_id?: string | null }) | null;
  rooms: { id: string; name: string }[];
  photoId: string | null;
  setPhotoId: (id: string | null) => void;
  onDone: () => void;
}) {
  return (
    <form action={(fd) => { saveSafetyPoint(fd); onDone(); }} className="mt-3 space-y-3">
      <input type="hidden" name="property_id" value={propertyId} />
      {point ? <input type="hidden" name="id" value={point.id} /> : null}
      <input type="hidden" name="photo_id" value={photoId ?? point?.photo_id ?? ''} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="What is it" htmlFor={`sp_kind_${point?.id ?? 'new'}`}>
          <select
            id={`sp_kind_${point?.id ?? 'new'}`}
            name="kind"
            defaultValue={point?.kind ?? 'WATER_MAIN'}
            className={inputClass}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{SAFETY_POINT_LABEL[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Room" htmlFor={`sp_room_${point?.id ?? 'new'}`}>
          <select
            id={`sp_room_${point?.id ?? 'new'}`}
            name="room_id"
            defaultValue={point?.room_id ?? ''}
            className={inputClass}
          >
            <option value="">Not in a listed room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Where exactly"
        htmlFor={`sp_loc_${point?.id ?? 'new'}`}
        hint="Written for someone frightened, in the dark, who has never looked for it before."
      >
        <textarea
          id={`sp_loc_${point?.id ?? 'new'}`}
          name="location_note"
          rows={2}
          defaultValue={point?.location_note ?? ''}
          placeholder="Basement, northwest corner, on the wall just past the stairs where the line comes in."
          className={textareaClass}
        />
      </Field>

      <Field
        label="How to work it"
        htmlFor={`sp_how_${point?.id ?? 'new'}`}
        hint="Which way, how far, what it looks like when it is closed."
      >
        <textarea
          id={`sp_how_${point?.id ?? 'new'}`}
          name="how_to_note"
          rows={2}
          defaultValue={point?.how_to_note ?? ''}
          placeholder="Red lever. Quarter turn so it sits across the pipe rather than along it."
          className={textareaClass}
        />
      </Field>

      <Field label="Custom label" htmlFor={`sp_label_${point?.id ?? 'new'}`} hint="Optional.">
        <input
          id={`sp_label_${point?.id ?? 'new'}`}
          name="label"
          defaultValue={point?.label ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-2 text-[13px] font-semibold text-navy-800">
          Photograph it {photoId || point?.photo_id ? '— done' : ''}
        </p>
        <p className="mb-2.5 text-[12px] leading-relaxed text-slate-500">
          This is the part that matters. A member who has never looked at
          their own water main will know it from a picture long before they
          work it out from a sentence.
        </p>
        <PhotoCapture
          target={{ propertyId }}
          label={photoId || point?.photo_id ? 'Replace the photo' : 'Take the photo'}
          onCaptured={(id) => setPhotoId(id)}
        />
      </div>

      <Submit label={point ? 'Save' : 'Add it'} />
    </form>
  );
}
