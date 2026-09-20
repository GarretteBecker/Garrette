'use client';

import { useState } from 'react';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import { inputClass, textareaClass, Field } from '@/components/ui';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, conditionLabel } from '@/lib/types/finding-status';
import type { Asset, Room, AssetCondition } from '@/lib/types/database';

/**
 * Add or update a Home Record item without leaving the visit.
 *
 * Offline-safe: the row is written to the outbox with a client-generated id
 * and upserted on sync, so a tech standing at the water heater with no bars
 * can still capture the serial number off the label.
 */
export default function AssetQuickEdit({
  propertyId,
  rooms,
  asset,
  onClose,
  onSaved,
}: {
  propertyId: string;
  rooms: Room[];
  asset: Asset | null;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}) {
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState(asset?.category ?? '');
  const [roomId, setRoomId] = useState(asset?.room_id ?? '');
  const [manufacturer, setManufacturer] = useState(asset?.manufacturer ?? '');
  const [model, setModel] = useState(asset?.model ?? '');
  const [serial, setSerial] = useState(asset?.serial_number ?? '');
  const [installDate, setInstallDate] = useState(asset?.install_date ?? '');
  const [warranty, setWarranty] = useState(asset?.warranty_expires ?? '');
  const [condition, setCondition] = useState<AssetCondition>(asset?.condition ?? 'GOOD');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError('What is it?');
      return;
    }
    if (!category) {
      setError('Pick a category.');
      return;
    }

    setSaving(true);
    setError(null);

    const id = asset?.id ?? crypto.randomUUID();
    const payload = {
      property_id: propertyId,
      room_id: roomId || null,
      category,
      name: name.trim(),
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      serial_number: serial.trim() || null,
      install_date: installDate || null,
      warranty_expires: warranty || null,
      condition,
      notes: notes.trim() || null,
    };

    await enqueue({
      localId: id,
      kind: 'asset.upsert',
      propertyId,
      payload,
    });
    void syncNow();

    onSaved({
      ...(asset ?? {}),
      id,
      ...payload,
      finish: asset?.finish ?? null,
      expected_life_years: asset?.expected_life_years ?? null,
      last_serviced_at: asset?.last_serviced_at ?? null,
      location_notes: asset?.location_notes ?? null,
      created_at: asset?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Asset);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <header className="safe-top flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm font-medium text-slate-600">
          Cancel
        </button>
        <h2 className="text-base font-semibold text-navy-800">
          {asset ? 'Update item' : 'Add item'}
        </h2>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-brandgreen-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Field label="What is it?" htmlFor="qa-name">
          <input
            id="qa-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Gas Water Heater — 50 gal"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="qa-category">
            <select
              id="qa-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Room" htmlFor="qa-room">
            <select
              id="qa-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={inputClass}
            >
              <option value="">Whole house</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand" htmlFor="qa-mfr">
            <input id="qa-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Model" htmlFor="qa-model">
            <input id="qa-model" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Serial number" htmlFor="qa-serial" hint="Off the data plate.">
          <input
            id="qa-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className={inputClass}
            autoCapitalize="characters"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Installed" htmlFor="qa-install">
            <input id="qa-install" type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Warranty ends" htmlFor="qa-warranty">
            <input id="qa-warranty" type="date" value={warranty} onChange={(e) => setWarranty(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Condition" htmlFor="qa-condition">
          <select
            id="qa-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AssetCondition)}
            className={inputClass}
          >
            {ASSET_CONDITIONS.map((c) => (
              <option key={c} value={c}>{conditionLabel(c)}</option>
            ))}
          </select>
        </Field>

        <Field label="Notes" htmlFor="qa-notes">
          <textarea id="qa-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClass} />
        </Field>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <p className="pb-6 text-center text-xs text-slate-400">
          Saves to this phone instantly. Uploads when you have signal.
        </p>
      </div>
    </div>
  );
}
