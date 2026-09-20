'use client';

import { useMemo, useState } from 'react';
import {
  groupByRoom, groupBySystem, warrantyInfo, lifeUsedPercent,
  type PortalPhoto,
} from '@/lib/member/portal';
import type { Asset, Room } from '@/lib/types/database';

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const WARRANTY_CHIP: Record<string, string> = {
  LIFETIME: 'bg-brandgreen-100 text-brandgreen-800',
  ACTIVE: 'bg-brandgreen-100 text-brandgreen-800',
  ENDING_SOON: 'bg-amber-100 text-amber-900',
  ENDED: 'bg-slate-100 text-slate-500',
  UNKNOWN: 'bg-slate-100 text-slate-400',
};

const CONDITION_CHIP: Record<string, string> = {
  NEW: 'bg-brandgreen-100 text-brandgreen-800',
  GOOD: 'bg-brandgreen-100 text-brandgreen-800',
  FAIR: 'bg-amber-100 text-amber-900',
  POOR: 'bg-red-100 text-red-900',
  END_OF_LIFE: 'bg-red-100 text-red-900',
  UNKNOWN: 'bg-slate-100 text-slate-500',
};

export default function HomeRecord({
  assets,
  rooms,
  photos,
}: {
  assets: Asset[];
  rooms: Room[];
  photos: PortalPhoto[];
}) {
  const [mode, setMode] = useState<'room' | 'system'>('room');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Asset | null>(null);

  const roomName = useMemo(() => {
    const map = new Map(rooms.map((r) => [r.id, r.name]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.name, a.manufacturer, a.model, a.category, a.serial_number, roomName(a.room_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [assets, query, roomName]);

  const groups = useMemo(
    () => (mode === 'room' ? groupByRoom(filtered, rooms) : groupBySystem(filtered)),
    [filtered, rooms, mode],
  );

  const photosFor = (assetId: string) => photos.filter((p) => p.asset_id === assetId && p.url);

  return (
    <>
      <div className="mb-4">
        <div className="mb-3 flex rounded-xl bg-slate-200/70 p-1">
          {(['room', 'system'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${
                mode === m ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              By {m}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your home record…"
          aria-label="Search your home record"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
        />

        <p className="mt-2 text-[12px] text-slate-500">
          {assets.length} items tracked in your home
          {query ? ` · ${filtered.length} matching` : ''}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nothing matched that search.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-navy-800">{g.label}</h2>
                <span className="shrink-0 text-[11px] font-medium text-slate-400">
                  {g.assets.length} item{g.assets.length === 1 ? '' : 's'}
                </span>
              </div>

              <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {g.assets.map((a, i) => {
                  const w = warrantyInfo(a.warranty_expires);
                  const count = photosFor(a.id).length;
                  return (
                    <li key={a.id} className={i > 0 ? 'border-t border-slate-100' : ''}>
                      <button
                        type="button"
                        onClick={() => setOpen(a)}
                        className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-snug text-navy-800">{a.name}</p>
                          <p className="mt-0.5 truncate text-[13px] text-slate-500">
                            {[a.manufacturer, a.model].filter(Boolean).join(' ') ||
                              (mode === 'room' ? a.category : (roomName(a.room_id) ?? 'Whole house'))}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${CONDITION_CHIP[a.condition]}`}>
                              {a.condition.replace(/_/g, ' ')}
                            </span>
                            {w.state !== 'UNKNOWN' ? (
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${WARRANTY_CHIP[w.state]}`}>
                                {w.label}
                              </span>
                            ) : null}
                            {count > 0 ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                {count} photo{count === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                             className="h-4 w-4 shrink-0 text-slate-300" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {open ? (
        <AssetSheet
          asset={open}
          roomName={roomName(open.room_id)}
          photos={photosFor(open.id)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function AssetSheet({
  asset,
  roomName,
  photos,
  onClose,
}: {
  asset: Asset;
  roomName: string | null;
  photos: PortalPhoto[];
  onClose: () => void;
}) {
  const w = warrantyInfo(asset.warranty_expires);
  const life = lifeUsedPercent(asset);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="safe-bottom max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grab handle */}
        <div className="sticky top-0 z-10 bg-white/95 pt-2 backdrop-blur">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-navy-800">
                {asset.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {roomName ?? 'Whole house'} · {asset.category}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 shrink-0 rounded-full p-2 text-slate-400 active:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   className="h-5 w-5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 pb-8">
          {photos.length > 0 ? (
            <div className="-mx-5 mb-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
              {photos.map((p) =>
                p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt={p.caption ?? asset.name}
                    className="h-44 w-64 shrink-0 snap-start rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : null,
              )}
            </div>
          ) : null}

          {/* Warranty — the thing a homeowner actually opens this for. */}
          <div
            className={`mb-5 rounded-2xl p-4 ${
              w.state === 'ENDED' || w.state === 'UNKNOWN'
                ? 'bg-slate-50 ring-1 ring-slate-200'
                : w.state === 'ENDING_SOON'
                  ? 'bg-amber-50 ring-1 ring-amber-600/20'
                  : 'bg-brandgreen-50 ring-1 ring-brandgreen-600/20'
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Warranty
            </p>
            <p className="mt-1 text-lg font-semibold text-navy-800">{w.label}</p>
            {asset.warranty_expires && w.state !== 'LIFETIME' && w.state !== 'UNKNOWN' ? (
              <p className="mt-0.5 text-[13px] text-slate-600">
                {w.state === 'ENDED' ? 'Ended' : 'Runs through'} {fmtDate(asset.warranty_expires)}
              </p>
            ) : null}
          </div>

          <dl className="mb-5 divide-y divide-slate-100 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <Row label="Brand" value={asset.manufacturer} />
            <Row label="Model" value={asset.model} />
            <Row label="Serial number" value={asset.serial_number} mono />
            <Row label="Finish" value={asset.finish} />
            <Row label="Installed" value={asset.install_date ? fmtDate(asset.install_date) : null} />
            <Row label="Last serviced" value={asset.last_serviced_at ? fmtDate(asset.last_serviced_at) : null} />
            <Row label="Condition" value={asset.condition.replace(/_/g, ' ')} />
            <Row label="Where it is" value={asset.location_notes} />
          </dl>

          {/* Meter: one ratio against a limit, track is a lighter step of the
              same ramp so the state reads across the whole bar. */}
          {life !== null && asset.expected_life_years ? (
            <div className="mb-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Expected service life
                </p>
                <p className="text-[13px] font-semibold text-navy-800">{life}% used</p>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-navy-100"
                role="img"
                aria-label={`${life} percent of expected service life used`}
              >
                <div
                  className={`h-full rounded-full ${
                    life >= 85 ? 'bg-[#b91c1c]' : life >= 65 ? 'bg-[#b45309]' : 'bg-[#2E5E3A]'
                  }`}
                  style={{ width: `${Math.max(life, 2)}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                Typically lasts about {asset.expected_life_years} years. This is a
                planning estimate, not a prediction.
              </p>
            </div>
          ) : null}

          {asset.notes ? (
            <div className="rounded-2xl bg-navy-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-navy-600">
                Good to know
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-navy-900/80">
                {asset.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 bg-white px-4 py-3">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd className={`text-right text-[14px] font-medium text-navy-800 ${mono ? 'font-mono text-[12px]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
