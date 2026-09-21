'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveChecklistItem, deleteChecklistItem, moveChecklistItem, saveTemplateMeta,
  seedQuarterFromBuiltIn,
} from '@/lib/actions/checklists';
import { Field, inputClass, textareaClass } from '@/components/ui';
import type { TemplateItemRow } from '@/lib/checklists';
import type { Quarter } from '@/lib/checklist-templates';

const WATER = [
  { v: 'PUBLIC', l: 'Public water' },
  { v: 'WELL', l: 'Well' },
  { v: 'SHARED_WELL', l: 'Shared well' },
] as const;
const SEWER = [
  { v: 'PUBLIC', l: 'Public sewer' },
  { v: 'SEPTIC', l: 'Septic' },
  { v: 'MOUND', l: 'Mound' },
] as const;
const FUEL = [
  { v: 'NATURAL_GAS', l: 'Natural gas' },
  { v: 'PROPANE', l: 'Propane' },
  { v: 'OIL', l: 'Oil' },
  { v: 'ELECTRIC', l: 'Electric' },
  { v: 'HEAT_PUMP', l: 'Heat pump' },
] as const;

function Submit({ label, subtle = false }: { label: string; subtle?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        subtle
          ? 'h-11 rounded-lg bg-white px-4 text-[14px] font-semibold text-navy-700 ring-1 ring-slate-300 disabled:opacity-60'
          : 'h-12 w-full rounded-lg bg-navy-700 text-[15px] font-semibold text-white disabled:opacity-60'
      }
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/** "Only on these homes" — the short version, for the list. */
function onlySummary(it: TemplateItemRow): string | null {
  const parts: string[] = [];
  const say = (vals: readonly { v: string; l: string }[], got: string[] | null) => {
    if (got?.length) parts.push(got.map((g) => vals.find((v) => v.v === g)?.l ?? g).join(' or '));
  };
  say(WATER, it.only_water_source);
  say(SEWER, it.only_sewer_type);
  say(FUEL, it.only_heating_fuel);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Writing the seasonal lists.
 *
 * Grouped by category because that is how a technician walks a house, and
 * because a flat list of twenty items is unreadable on a phone. Reordering
 * is two buttons rather than drag-and-drop for the same reason — dragging a
 * row on a phone in a basement does not work.
 */
export default function ChecklistEditor({
  quarter,
  template,
  items,
}: {
  quarter: Quarter;
  template: { id: string; name: string; season: string; months: string; focus: string | null } | null;
  items: TemplateItemRow[];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  if (!template) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-600/25">
        <p className="text-[15px] font-semibold text-amber-900">
          {quarter} is still using the built-in draft.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">
          That draft was written from standard Lancaster County practice, not
          from how B&amp;M works. Copy it in and mark it up — change the
          wording, drop what you do not do, add what you do. Nothing is
          locked, and visits already done are never rewritten.
        </p>
        <form action={seedQuarterFromBuiltIn} className="mt-3">
          <input type="hidden" name="quarter" value={quarter} />
          <Submit label="Start from the built-in list" />
        </form>
      </div>
    );
  }

  // Category order follows sort_order, so moving items moves their group.
  const categories: string[] = [];
  for (const i of items) if (!categories.includes(i.category)) categories.push(i.category);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-navy-800">{template.name}</p>
            <p className="text-[13px] text-slate-500">
              {template.season} · {template.months} · {items.length} items
            </p>
            {template.focus ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{template.focus}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowMeta(!showMeta)}
            className="shrink-0 text-[13px] font-semibold text-brandgreen-600"
          >
            {showMeta ? 'Close' : 'Edit'}
          </button>
        </div>

        {showMeta ? (
          <form action={saveTemplateMeta} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <input type="hidden" name="id" value={template.id} />
            <Field label="What the visit is called" htmlFor={`n_${quarter}`}>
              <input id={`n_${quarter}`} name="name" defaultValue={template.name} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Season" htmlFor={`s_${quarter}`}>
                <input id={`s_${quarter}`} name="season" defaultValue={template.season} className={inputClass} />
              </Field>
              <Field label="Months" htmlFor={`m_${quarter}`}>
                <input id={`m_${quarter}`} name="months" defaultValue={template.months} className={inputClass} />
              </Field>
            </div>
            <Field
              label="Why this quarter looks like this"
              htmlFor={`f_${quarter}`}
              hint="One line. It prints on the member's report, so they can see the visit had a point."
            >
              <textarea id={`f_${quarter}`} name="focus" rows={2}
                        defaultValue={template.focus ?? ''} className={textareaClass} />
            </Field>
            <Submit label="Save" />
          </form>
        ) : null}
      </div>

      {categories.map((c) => (
        <section key={c}>
          <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            {c}
          </h3>
          <ul className="space-y-1.5">
            {items.filter((i) => i.category === c).map((it) => {
              const only = onlySummary(it);
              return (
                <li key={it.id} className="rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium leading-snug text-navy-800">{it.label}</p>
                      {it.help_note ? (
                        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{it.help_note}</p>
                      ) : null}
                      {only ? (
                        <p className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          Only on: {only}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {(['up', 'down'] as const).map((d) => (
                        <form action={moveChecklistItem} key={d}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="direction" value={d} />
                          <button type="submit" aria-label={`Move ${d}`}
                                  className="flex h-9 w-8 items-center justify-center rounded text-slate-400 active:bg-slate-100">
                            {d === 'up' ? '▲' : '▼'}
                          </button>
                        </form>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditing(editing === it.id ? null : it.id)}
                        className="rounded px-2 py-1 text-[13px] font-semibold text-navy-700"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {editing === it.id ? (
                    <ItemForm templateId={template.id} item={it} onDone={() => setEditing(null)} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {editing === 'new' ? (
        <div className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200">
          <ItemForm
            templateId={template.id}
            item={null}
            categories={categories}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="h-12 w-full rounded-xl bg-white text-[15px] font-semibold text-navy-700 shadow-sm ring-1 ring-slate-300 active:bg-slate-50"
        >
          Add an item to {quarter}
        </button>
      )}
    </div>
  );
}

function ItemForm({
  templateId, item, categories = [], onDone,
}: {
  templateId: string;
  item: TemplateItemRow | null;
  categories?: string[];
  onDone: () => void;
}) {
  const id = item?.id ?? 'new';

  return (
    <form
      action={(fd) => { saveChecklistItem(fd); onDone(); }}
      className="mt-3 space-y-3 border-t border-slate-100 pt-3"
    >
      <input type="hidden" name="template_id" value={templateId} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <Field label="What to check" htmlFor={`l_${id}`}>
        <textarea id={`l_${id}`} name="label" rows={2} required
                  defaultValue={item?.label ?? ''}
                  placeholder="Sump pump test, and the outside discharge is not iced shut"
                  className={textareaClass} />
      </Field>

      <Field label="Category" htmlFor={`c_${id}`} hint="Groups it on the tech's screen and on the report.">
        <input id={`c_${id}`} name="category" required list={`cats_${id}`}
               defaultValue={item?.category ?? ''} placeholder="Plumbing" className={inputClass} />
        <datalist id={`cats_${id}`}>
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <Field
        label="Note for the tech"
        htmlFor={`h_${id}`}
        hint="What good looks like. Only your techs see this — it never goes on the member's report."
      >
        <textarea id={`h_${id}`} name="help_note" rows={2}
                  defaultValue={item?.help_note ?? ''}
                  placeholder="A frozen discharge is a working pump with nowhere to go. Walk outside and look."
                  className={textareaClass} />
      </Field>

      <fieldset className="rounded-lg bg-slate-50 p-3">
        <legend className="px-1 text-[12px] font-semibold text-slate-600">
          Only on certain homes
        </legend>
        <p className="mb-2 text-[12px] leading-relaxed text-slate-500">
          Leave everything unticked for &ldquo;every home&rdquo;. Tick something and the item
          only appears on houses that match — so a septic check stays off a
          public-sewer list.
        </p>
        <FactGroup name="only_water_source" options={WATER} selected={item?.only_water_source} />
        <FactGroup name="only_sewer_type" options={SEWER} selected={item?.only_sewer_type} />
        <FactGroup name="only_heating_fuel" options={FUEL} selected={item?.only_heating_fuel} />
      </fieldset>

      <div className="flex gap-2">
        <Submit label={item ? 'Save' : 'Add it'} />
        {item ? (
          <button
            type="submit"
            formAction={deleteChecklistItem}
            className="h-12 shrink-0 rounded-lg px-4 text-[14px] font-semibold text-red-600"
          >
            Remove
          </button>
        ) : null}
      </div>
    </form>
  );
}

function FactGroup({
  name, options, selected,
}: {
  name: string;
  options: readonly { v: string; l: string }[];
  selected?: string[] | null;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.v}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[13px] ring-1 ring-slate-200 has-[:checked]:bg-navy-700 has-[:checked]:text-white"
        >
          <input
            type="checkbox"
            name={name}
            value={o.v}
            defaultChecked={selected?.includes(o.v) ?? false}
            className="h-3.5 w-3.5"
          />
          {o.l}
        </label>
      ))}
    </div>
  );
}
