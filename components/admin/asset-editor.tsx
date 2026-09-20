'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAsset, deleteAsset, type ActionState } from '@/lib/actions/properties';
import {
  Card,
  Field,
  inputClass,
  textareaClass,
  EmptyState,
  ConditionPill,
  formatDate,
} from '@/components/ui';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, conditionLabel } from '@/lib/types/finding-status';
import type { Asset, Room } from '@/lib/types/database';
import AssetPhotos, { type AssetPhoto } from './asset-photos';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-lg bg-brandgreen-600 px-5 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save item'}
    </button>
  );
}

/** Warning badge when a warranty is expired or close to it. */
function WarrantyFlag({ expires }: { expires: string | null }) {
  if (!expires) return null;
  const d = new Date(expires);
  if (Number.isNaN(d.getTime())) return null;

  // Treat the far-future sentinel used for lifetime warranties as "lifetime".
  if (d.getFullYear() >= 2090) {
    return (
      <span className="rounded bg-brandgreen-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brandgreen-800">
        Lifetime
      </span>
    );
  }

  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);

  if (days < 0) {
    return (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
        Warranty ended
      </span>
    );
  }
  if (days < 120) {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
        Warranty ends soon
      </span>
    );
  }
  return (
    <span className="rounded bg-brandgreen-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brandgreen-800">
      Under warranty
    </span>
  );
}

export default function AssetEditor({
  propertyId,
  assets,
  rooms,
  photosByAsset,
}: {
  propertyId: string;
  assets: Asset[];
  rooms: Room[];
  photosByAsset: Record<string, AssetPhoto[]>;
}) {
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [openPhotos, setOpenPhotos] = useState<string | null>(null);

  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const result = await saveAsset(prev, fd);
      if (result.ok) setEditing(null);
      return result;
    },
    {},
  );

  const roomName = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.name, a.manufacturer, a.model, a.serial_number, a.category, roomName(a.room_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [assets, query, roomName]);

  if (editing) {
    const asset = editing === 'new' ? null : editing;
    return (
      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-navy-800">
          {asset ? 'Edit item' : 'Add to the Home Record'}
        </h3>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />
          {asset ? <input type="hidden" name="id" value={asset.id} /> : null}

          <Field label="What is it?" htmlFor="name">
            <input
              id="name"
              name="name"
              required
              defaultValue={asset?.name ?? ''}
              className={inputClass}
              placeholder="Kitchen Faucet"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                defaultValue={asset?.category ?? ''}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Room" htmlFor="room_id">
              <select
                id="room_id"
                name="room_id"
                defaultValue={asset?.room_id ?? ''}
                className={inputClass}
              >
                <option value="">Not room-specific</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand" htmlFor="manufacturer">
              <input
                id="manufacturer"
                name="manufacturer"
                defaultValue={asset?.manufacturer ?? ''}
                className={inputClass}
                placeholder="Delta"
              />
            </Field>
            <Field label="Finish / color" htmlFor="finish">
              <input
                id="finish"
                name="finish"
                defaultValue={asset?.finish ?? ''}
                className={inputClass}
                placeholder="Arctic Stainless"
              />
            </Field>
          </div>

          <Field label="Model number" htmlFor="model">
            <input
              id="model"
              name="model"
              defaultValue={asset?.model ?? ''}
              className={inputClass}
              placeholder="Trinsic 9159-AR-DST"
            />
          </Field>

          <Field
            label="Serial number"
            htmlFor="serial_number"
            hint="This is what saves a warranty claim two years from now."
          >
            <input
              id="serial_number"
              name="serial_number"
              defaultValue={asset?.serial_number ?? ''}
              className={inputClass}
              autoCapitalize="characters"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Installed" htmlFor="install_date">
              <input
                id="install_date"
                name="install_date"
                type="date"
                defaultValue={asset?.install_date ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Warranty ends" htmlFor="warranty_expires">
              <input
                id="warranty_expires"
                name="warranty_expires"
                type="date"
                defaultValue={asset?.warranty_expires ?? ''}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Condition" htmlFor="condition">
              <select
                id="condition"
                name="condition"
                defaultValue={asset?.condition ?? 'UNKNOWN'}
                className={inputClass}
              >
                {ASSET_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {conditionLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected life (yrs)" htmlFor="expected_life_years">
              <input
                id="expected_life_years"
                name="expected_life_years"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={asset?.expected_life_years ?? ''}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Last serviced" htmlFor="last_serviced_at">
            <input
              id="last_serviced_at"
              name="last_serviced_at"
              type="date"
              defaultValue={asset?.last_serviced_at ?? ''}
              className={inputClass}
            />
          </Field>

          <Field label="Where is it?" htmlFor="location_notes">
            <input
              id="location_notes"
              name="location_notes"
              defaultValue={asset?.location_notes ?? ''}
              className={inputClass}
              placeholder="Basement, northeast corner"
            />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              defaultValue={asset?.notes ?? ''}
              className={textareaClass}
              placeholder="Filter size, service quirks, anything the next tech should know."
            />
          </Field>

          {state.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-12 rounded-lg px-4 font-medium text-slate-600 ring-1 ring-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="h-12 w-full rounded-lg bg-brandgreen-600 font-semibold text-white active:scale-[0.99]"
      >
        + Add item to Home Record
      </button>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, brand, model, serial…"
        className={inputClass}
        aria-label="Search the Home Record"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={assets.length === 0 ? 'Home Record is empty' : 'Nothing matched that search'}
          hint={assets.length === 0 ? 'Add the equipment and fixtures you maintain.' : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => (
            <li key={a.id}>
              <Card className="p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium text-navy-800">{a.name}</p>
                      <ConditionPill condition={a.condition} />
                      <WarrantyFlag expires={a.warranty_expires} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {[a.manufacturer, a.model].filter(Boolean).join(' ') || a.category}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {roomName(a.room_id) ?? 'Whole house'}
                      {a.serial_number ? ` • S/N ${a.serial_number}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Installed {formatDate(a.install_date)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPhotos(openPhotos === a.id ? null : a.id)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                  >
                    {openPhotos === a.id ? 'Hide photos' : 'Photos'}
                  </button>
                  <form action={deleteAsset}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="property_id" value={propertyId} />
                    <button
                      type="submit"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                    >
                      Delete
                    </button>
                  </form>
                </div>

                {openPhotos === a.id ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <AssetPhotos
                      propertyId={propertyId}
                      assetId={a.id}
                      photos={photosByAsset[a.id] ?? []}
                    />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
