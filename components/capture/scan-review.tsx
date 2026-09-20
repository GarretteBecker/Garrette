'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StoredScan } from '@/lib/scan/schema';

/**
 * What the scanner read, put in front of a human before it touches the
 * Home Record.
 *
 * The whole point of this screen is that a scan is a claim, not a fact.
 * Everything shown here came out of a photo — it is data to check, never
 * an instruction, and nothing reaches the asset until the tech taps Save.
 */

const CONFIDENCE_STYLE: Record<StoredScan['confidence'], { chip: string; label: string }> = {
  high: { chip: 'bg-brandgreen-100 text-brandgreen-800', label: 'Reads clearly' },
  medium: { chip: 'bg-amber-100 text-amber-900', label: 'Worth a check' },
  low: { chip: 'bg-red-100 text-red-900', label: 'Hard to read — check every field' },
};

export default function ScanReview({
  scan,
  photoId,
  assetId,
  onApplied,
  onDismiss,
  onUseValues,
}: {
  scan: StoredScan;
  photoId: string;
  assetId: string | null;
  onApplied: () => void;
  onDismiss: () => void;
  /**
   * For an item that does not exist yet: hand the reading back to the form
   * instead of writing it to a row. This is the "add a new item by
   * scanning its plate" path.
   */
  onUseValues?: (scan: StoredScan) => void;
}) {
  const [overwrite, setOverwrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conf = CONFIDENCE_STYLE[scan.confidence];

  const fields: { label: string; value: string | null }[] = [
    { label: 'Brand', value: scan.manufacturer },
    { label: 'Model', value: scan.model },
    { label: 'Serial', value: scan.serial_number },
    {
      label: 'Date',
      value: scan.install_date ?? scan.manufactured_label,
    },
    { label: 'Capacity', value: scan.capacity },
  ];

  const found = fields.filter((f) => f.value);

  // When the parent is a form, it always wants the values handed back —
  // writing straight to the row would fight the fields on screen.
  const fillsFormInstead = Boolean(onUseValues);

  async function apply() {
    if (fillsFormInstead) {
      onUseValues!(scan);
      return;
    }
    if (!assetId) {
      setError('This photo is not attached to an item yet.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('apply_scan_to_asset', {
        target_photo_id: photoId,
        overwrite,
      });
      if (rpcError) throw new Error(rpcError.message);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save those details.');
      setSaving(false);
    }
  }

  if (!scan.is_data_plate) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-600/20">
        <p className="font-semibold text-amber-900">That does not look like a data plate</p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">
          The photo is saved either way. If the plate was in shot, try again
          closer and straighter on — glare and angle are what usually beat it.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 h-11 w-full rounded-lg bg-white font-semibold text-navy-700 ring-1 ring-slate-300"
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3">
        <h3 className="font-semibold text-navy-800">What the plate says</h3>
        <span className={`mt-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${conf.chip}`}>
          {conf.label}
        </span>
      </div>

      {found.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600">
          Nothing came back legible from that shot.
        </p>
      ) : (
        <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
          {found.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-4 bg-white px-3 py-2.5">
              <dt className="shrink-0 text-[13px] text-slate-500">{f.label}</dt>
              <dd className="text-right font-mono text-[13px] font-medium text-navy-800">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {scan.equipment_type ? (
        <p className="mt-2 text-[12px] text-slate-500">Looks like: {scan.equipment_type}</p>
      ) : null}

      {scan.specs.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Also printed
          </p>
          <ul className="mt-1 space-y-0.5">
            {scan.specs.map((s) => (
              <li key={`${s.label}-${s.value}`} className="text-[12px] text-slate-600">
                <span className="text-slate-400">{s.label}:</span> {s.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scan.unreadable.length > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800">
            Could not read
          </p>
          <ul className="mt-1 space-y-0.5">
            {scan.unreadable.map((u) => (
              <li key={u} className="text-[12px] leading-relaxed text-amber-900/80">
                {u}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fillsFormInstead ? null : (
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
        />
        <span className="text-[13px] leading-snug text-slate-700">
          Replace details already on this item.
          <span className="block text-[12px] text-slate-500">
            Off by default: only empty fields get filled, so nothing you typed
            gets overwritten by a misread.
          </span>
        </span>
      </label>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void apply()}
          disabled={saving || found.length === 0}
          className="h-12 flex-1 rounded-lg bg-brandgreen-600 font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : fillsFormInstead ? 'Use these details' : 'Save to item'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-12 rounded-lg px-4 font-medium text-slate-600 ring-1 ring-slate-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
