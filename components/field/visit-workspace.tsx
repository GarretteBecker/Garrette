'use client';

import { useMemo, useState } from 'react';
import { enqueue } from '@/lib/offline/outbox';
import { syncNow } from '@/lib/offline/sync';
import { completeVisit } from '@/lib/actions/visits';
import { CHECKLIST_RESULT_STYLES, CHECKLIST_RESULT_CHOICES, needsAttention } from '@/lib/types/finding-status';
import { Card, StatusPill, textareaClass } from '@/components/ui';
import QuickFinding from './quick-finding';
import AssetQuickEdit from './asset-quick-edit';
import PhotoCapture from '@/components/capture/photo-capture';
import type {
  Visit, Property, Room, Asset, ChecklistItem, Finding,
} from '@/lib/types/database';

// Six results is too many to tap through, so a row opens a picker instead
// of cycling. The common case — everything fine — is handled in one tap at
// the section level. See markRestGood.

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
  // One section open at a time. Three hundred items in one scroll is not a
  // list anybody reads — it is a wall.
  const [openSection, setOpenSection] = useState<string | null>(null);

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

  /**
   * The speed valve.
   *
   * A visit is 250–320 items. A technician walks a section, marks the two
   * things that are wrong, and taps this — everything still untouched in
   * that section becomes Good. Without it the program is unusable on a
   * phone, and CLAUDE.md rule 1 is field speed above everything.
   *
   * It only ever touches NOT_CHECKED items, so it can never overwrite a
   * judgement somebody already made.
   */
  async function markRestGood(section: ChecklistItem[]) {
    const untouched = section.filter((i) => i.result === 'NOT_CHECKED');
    if (untouched.length === 0) return;
    for (const item of untouched) await updateItem(item, { result: 'PASS' });
  }

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
        measurement_value: updated.measurement_value ?? null,
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
          <div className="space-y-3">
            <p className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-navy-800 ring-1 ring-navy-600/15">
              Work a section, mark what is wrong, then tap{' '}
              <span className="font-semibold">Rest all good</span>. Core
              sections are on every visit; the rest are this season&rsquo;s.
            </p>
            {grouped.map(([category, list]) => (
              <ChecklistSection
                key={category}
                category={category}
                items={list}
                open={openSection === category}
                onToggle={() =>
                  setOpenSection(openSection === category ? null : category)
                }
                onUpdate={updateItem}
                onMarkRestGood={() => void markRestGood(list)}
                noteFor={noteFor}
                setNoteFor={setNoteFor}
              />
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

/**
 * One collapsible section of the checklist.
 *
 * The header carries the whole story so a technician can scan the list
 * closed: how many items, how many still untouched, and whether anything
 * in there needs to reach the member. Only the open section renders its
 * rows, which is what keeps a 320-item visit usable on a phone.
 */
function ChecklistSection({
  category, items, open, onToggle, onUpdate, onMarkRestGood, noteFor, setNoteFor,
}: {
  category: string;
  items: ChecklistItem[];
  open: boolean;
  onToggle: () => void;
  onUpdate: (item: ChecklistItem, patch: Partial<ChecklistItem>) => void | Promise<void>;
  onMarkRestGood: () => void;
  noteFor: string | null;
  setNoteFor: (id: string | null) => void;
}) {
  const untouched = items.filter((i) => i.result === 'NOT_CHECKED').length;
  const flagged = items.filter((i) => needsAttention(i.result)).length;

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
      >
        <span
          aria-hidden="true"
          className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${
            flagged > 0 ? 'bg-amber-500' : untouched === 0 ? 'bg-brandgreen-600' : 'bg-slate-300'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-navy-800">{category}</span>
          <span className="block text-[12px] text-slate-500">
            {items.length} items
            {untouched > 0 ? ` · ${untouched} to go` : ' · done'}
            {flagged > 0 ? ` · ${flagged} flagged` : ''}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate-300">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="border-t border-slate-100">
          {untouched > 0 ? (
            <button
              type="button"
              onClick={onMarkRestGood}
              className="w-full bg-brandgreen-50 px-4 py-3 text-[14px] font-semibold text-brandgreen-800 active:bg-brandgreen-100"
            >
              Rest all good — {untouched} {untouched === 1 ? 'item' : 'items'}
            </button>
          ) : null}

          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onUpdate={onUpdate}
                noteOpen={noteFor === item.id}
                onToggleNote={() => setNoteFor(noteFor === item.id ? null : item.id)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ChecklistRow({
  item, onUpdate, noteOpen, onToggleNote,
}: {
  item: ChecklistItem;
  onUpdate: (item: ChecklistItem, patch: Partial<ChecklistItem>) => void | Promise<void>;
  noteOpen: boolean;
  onToggleNote: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const style = CHECKLIST_RESULT_STYLES[item.result];
  const unit = item.measurement_unit;

  // Out of band is a prompt to look harder, never an automatic failure.
  const value = item.measurement_value;
  const outOfBand =
    value != null &&
    ((item.measurement_low != null && value < item.measurement_low) ||
      (item.measurement_high != null && value > item.measurement_high));

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          aria-label={`Result for ${item.label}: ${style.label}`}
          className={`flex h-9 w-[4.5rem] shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase ${style.chip}`}
        >
          {style.label}
        </button>
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-[14px] font-medium leading-snug text-navy-800">
            {item.label}
          </span>
          {item.help_note ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
              {item.help_note}
            </span>
          ) : null}
        </button>
      </div>

      {picking ? (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {CHECKLIST_RESULT_CHOICES.map((r) => {
            const st = CHECKLIST_RESULT_STYLES[r];
            const active = item.result === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => { void onUpdate(item, { result: r }); setPicking(false); }}
                className={`rounded-lg px-2.5 py-2.5 text-left text-[13px] font-semibold ring-1 ${
                  active ? `${st.chip} ring-transparent` : 'bg-white text-navy-800 ring-slate-200'
                }`}
              >
                {st.label}
                {st.blurb ? (
                  <span className={`mt-0.5 block text-[11px] font-normal ${active ? 'opacity-80' : 'text-slate-500'}`}>
                    {st.blurb}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {unit ? (
        <div className="mt-2.5 flex items-center gap-2">
          <label className="text-[12px] font-medium text-slate-600" htmlFor={`m_${item.id}`}>
            {item.measurement_label ?? 'Reading'}
          </label>
          <input
            id={`m_${item.id}`}
            type="number"
            inputMode="decimal"
            step="any"
            defaultValue={value ?? ''}
            onBlur={(e) =>
              void onUpdate(item, {
                measurement_value: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className={`h-11 w-24 rounded-lg border px-3 text-[16px] font-semibold ${
              outOfBand ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-navy-800'
            }`}
          />
          <span className="text-[13px] text-slate-500">{unit}</span>
          {item.measurement_low != null || item.measurement_high != null ? (
            <span className="text-[11px] text-slate-400">
              healthy {item.measurement_low ?? ''}
              {item.measurement_low != null && item.measurement_high != null ? '–' : ''}
              {item.measurement_high != null ? item.measurement_high : item.measurement_low != null ? '+' : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      {item.notes ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
          {item.notes}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onToggleNote}
        className="mt-1.5 text-[12px] font-semibold text-navy-600"
      >
        {noteOpen ? 'Close note' : item.notes ? 'Edit note' : '+ Add note'}
      </button>

      {noteOpen ? (
        <textarea
          defaultValue={item.notes ?? ''}
          placeholder="What did you see?"
          className={`${textareaClass} mt-1.5`}
          onBlur={(e) => void onUpdate(item, { notes: e.target.value || null })}
        />
      ) : null}
    </li>
  );
}
