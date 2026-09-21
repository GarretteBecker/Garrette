'use client';

import { useMemo, useState } from 'react';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import { completeVisit } from '@/lib/actions/visits';
import { CHECKLIST_RESULT_STYLES } from '@/lib/types/finding-status';
import { Card, StatusPill, textareaClass } from '@/components/ui';
import QuickFinding from './quick-finding';
import AssetQuickEdit from './asset-quick-edit';
import PhotoCapture from '@/components/capture/photo-capture';
import type {
  Visit, Property, Room, Asset, ChecklistItem, Finding, ChecklistResult,
} from '@/lib/types/database';

/** Tapping a checklist row cycles through the results a tech actually uses. */
const CYCLE: ChecklistResult[] = ['NOT_CHECKED', 'PASS', 'ATTENTION', 'FAIL', 'NOT_APPLICABLE'];

function nextResult(current: ChecklistResult): ChecklistResult {
  const i = CYCLE.indexOf(current);
  return CYCLE[(i + 1) % CYCLE.length];
}

export interface VisitPhoto {
  id: string;
  storage_path: string;
  note: string | null;
  kind: string;
  scan_status: string;
  url: string | null;
}

type Tab = 'checklist' | 'findings' | 'photos' | 'record';

export default function VisitWorkspace({
  visit,
  property,
  rooms,
  assets: initialAssets,
  checklist: initialChecklist,
  findings: initialFindings,
  photos,
  techId,
}: {
  visit: Visit;
  property: Property;
  rooms: Room[];
  assets: Asset[];
  checklist: ChecklistItem[];
  findings: Finding[];
  photos: VisitPhoto[];
  techId: string;
}) {
  const [tab, setTab] = useState<Tab>('checklist');
  const [items, setItems] = useState(initialChecklist);
  const [findings, setFindings] = useState(initialFindings);
  const [assets, setAssets] = useState(initialAssets);
  const [showFinding, setShowFinding] = useState(false);
  const [showAsset, setShowAsset] = useState<Asset | 'new' | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const done = items.filter((i) => i.result !== 'NOT_CHECKED').length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [items]);

  /** Optimistic local update + queued write. Never blocks on the network. */
  async function updateItem(item: ChecklistItem, patch: Partial<ChecklistItem>) {
    const updated = { ...item, ...patch };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));

    await enqueue({
      localId: `checklist:${item.id}`,
      kind: 'checklist.update',
      propertyId: property.id,
      payload: {
        itemId: item.id,
        result: updated.result,
        notes: updated.notes,
      },
    });
    void syncNow();
  }

  return (
    <>
      <div className="sticky top-[60px] z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 pt-2">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {done} of {items.length} checked
            </span>
            <span>{findings.length} findings</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brandgreen-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-1 py-2">
            {(['checklist', 'findings', 'photos', 'record'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-9 flex-1 rounded-lg text-[13px] font-medium capitalize ${
                  tab === t ? 'bg-navy-700 text-white' : 'text-slate-600'
                }`}
              >
                {t === 'record' ? 'Record' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-40 pt-4">
        {tab === 'checklist' ? (
          <div className="space-y-5">
            {grouped.map(([category, list]) => (
              <section key={category}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {category}
                </h2>
                <ul className="space-y-2">
                  {list.map((item) => {
                    const style = CHECKLIST_RESULT_STYLES[item.result];
                    return (
                      <li key={item.id}>
                        <Card className="overflow-hidden">
                          {/* Whole row is the tap target — one thumb, no aiming. */}
                          <button
                            type="button"
                            onClick={() => void updateItem(item, { result: nextResult(item.result) })}
                            className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50"
                          >
                            <span
                              className={`flex h-10 w-16 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase ${style.chip}`}
                            >
                              {style.label}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-navy-800">
                                {item.label}
                              </span>
                              {/* What good looks like, from the template.
                                  Techs only — this never reaches a member. */}
                              {item.help_note ? (
                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                                  {item.help_note}
                                </span>
                              ) : null}
                            </span>
                          </button>

                          {item.notes ? (
                            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                              {item.notes}
                            </p>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setNoteFor(noteFor === item.id ? null : item.id)}
                            className="w-full border-t border-slate-100 px-4 py-2 text-left text-xs font-medium text-navy-600"
                          >
                            {noteFor === item.id ? 'Close note' : item.notes ? 'Edit note' : '+ Add note'}
                          </button>

                          {noteFor === item.id ? (
                            <div className="border-t border-slate-100 p-3">
                              <textarea
                                defaultValue={item.notes ?? ''}
                                placeholder="What did you see?"
                                className={textareaClass}
                                onBlur={(e) => void updateItem(item, { notes: e.target.value || null })}
                              />
                            </div>
                          ) : null}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {tab === 'findings' ? (
          findings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No findings logged on this visit yet. Use the green button below.
            </p>
          ) : (
            <ul className="space-y-2">
              {findings.map((f) => (
                <li key={f.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-navy-800">{f.title}</p>
                      <StatusPill status={f.status} />
                    </div>
                    {f.description ? (
                      <p className="mt-1 text-sm text-slate-600">{f.description}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === 'photos' ? (
          <div className="space-y-3">
            <PhotoCapture
              target={{ propertyId: property.id, visitId: visit.id }}
              mode="general"
              label="Add a photo to this visit"
            />
            <p className="text-center text-[12px] leading-relaxed text-slate-500">
              General shots for the visit — conditions, access, anything worth
              a record. Photos of a specific item go on that item instead.
            </p>

            {photos.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 pt-1">
                {photos.map((p) =>
                  p.url ? (
                    <li key={p.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.note ?? 'Visit photo'}
                        className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                        loading="lazy"
                      />
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
              <p className="pt-1 text-center text-[12px] text-slate-400">
                No photos on this visit yet.
              </p>
            )}
          </div>
        ) : null}

        {tab === 'record' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAsset('new')}
              className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white"
            >
              + Add item to Home Record
            </button>
            {assets.map((a) => (
              <Card key={a.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">{a.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[a.manufacturer, a.model].filter(Boolean).join(' ') || a.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAsset(a)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                >
                  Update
                </button>
              </Card>
            ))}
          </div>
        ) : null}
      </main>

      {/* Fixed action bar — reachable with a thumb, never scrolls away. */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            onClick={() => setShowFinding(true)}
            className="h-14 flex-1 rounded-xl bg-brandgreen-600 text-base font-bold text-white shadow-lg active:scale-[0.99]"
          >
            + Finding
          </button>
          <button
            type="button"
            onClick={() => setShowComplete(true)}
            className="h-14 rounded-xl bg-navy-700 px-5 text-base font-semibold text-white active:scale-[0.99]"
          >
            Complete
          </button>
        </div>
      </div>

      {showFinding ? (
        <QuickFinding
          property={property}
          visit={visit}
          rooms={rooms}
          assets={assets}
          techId={techId}
          onClose={() => setShowFinding(false)}
          onSaved={(finding) => {
            setFindings((prev) => [finding, ...prev]);
            setShowFinding(false);
            setTab('findings');
          }}
        />
      ) : null}

      {showAsset ? (
        <AssetQuickEdit
          propertyId={property.id}
          rooms={rooms}
          asset={showAsset === 'new' ? null : showAsset}
          onClose={() => setShowAsset(null)}
          onSaved={(asset) => {
            setAssets((prev) => {
              const without = prev.filter((a) => a.id !== asset.id);
              return [...without, asset].sort((a, b) => a.name.localeCompare(b.name));
            });
            setShowAsset(null);
          }}
        />
      ) : null}

      {showComplete ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40">
          <div className="safe-bottom w-full rounded-t-2xl bg-white p-4">
            <h2 className="text-lg font-semibold text-navy-800">Complete this visit</h2>
            <p className="mt-1 text-sm text-slate-600">
              {done} of {items.length} items checked · {findings.length} findings logged.
            </p>
            {done < items.length ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {items.length - done} checklist items are still unchecked.
              </p>
            ) : null}

            <form action={completeVisit} className="mt-3 space-y-3">
              <input type="hidden" name="visit_id" value={visit.id} />
              <textarea
                name="summary"
                placeholder="Summary for the homeowner — what you did and what matters."
                className={textareaClass}
                defaultValue={visit.summary ?? ''}
              />
              <button
                type="submit"
                className="h-14 w-full rounded-xl bg-brandgreen-600 text-base font-bold text-white"
              >
                Complete visit
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowComplete(false)}
              className="mt-2 h-12 w-full rounded-lg font-medium text-slate-600"
            >
              Not yet
            </button>
            <p className="mt-1 text-center text-xs text-slate-500">
              Completing needs signal. Anything queued uploads first.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
