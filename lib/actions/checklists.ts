'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CHECKLIST_TEMPLATES, CORE_ITEMS, QUARTERS, type Quarter } from '@/lib/checklist-templates';
import { coreItemsExist } from '@/lib/checklists';
import type { HeatingFuel, SewerType, WaterSource } from '@/lib/types/database';

/**
 * Editing the seasonal lists.
 *
 * Admin only, by RLS — these policies are the enforcement, not the fact
 * that the screen lives under /admin.
 *
 * Nothing here ever touches checklist_items on a visit that has already
 * happened. A list is stamped onto a visit when it starts, and from that
 * moment the visit owns its copy: editing Q3 in March must not rewrite what
 * a technician recorded last August, because that record is what the
 * member was shown and what a report was built from.
 */

function text(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** A multi-select of house facts. Empty means "every house". */
function facts<T extends string>(fd: FormData, key: string): T[] | null {
  const all = fd.getAll(key).map((v) => String(v)).filter(Boolean) as T[];
  return all.length ? all : null;
}

const ADMIN_PATH = '/admin/checklists';

function done() {
  revalidatePath(ADMIN_PATH);
  revalidatePath('/field');
}

/**
 * Copy the built-in draft into the database so it can be marked up.
 *
 * Refuses if that quarter already has a live list, because this is the one
 * action here that could quietly discard a lot of somebody's typing.
 */
export async function seedQuarterFromBuiltIn(formData: FormData): Promise<void> {
  const quarter = text(formData, 'quarter') as Quarter | null;
  if (!quarter || !QUARTERS.includes(quarter)) return;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('checklist_templates')
    .select('id')
    .eq('quarter', quarter)
    .eq('is_active', true)
    .maybeSingle();
  if (existing) return;

  const draft = CHECKLIST_TEMPLATES[quarter];

  const { data: created } = await supabase
    .from('checklist_templates')
    .insert({
      quarter,
      name: draft.name,
      season: draft.season,
      months: draft.months,
      focus: draft.focus,
    })
    .select('id')
    .single();

  if (!created) return;
  const templateId = (created as { id: string }).id;

  // The core list belongs to no quarter and is written exactly once. It is
  // parked on whichever quarter gets set up first; every quarter picks it
  // up. Seeding the second, third and fourth quarters must not copy it
  // again, or "edit it once" quietly becomes "edit it four times".
  const alreadyHaveCore = await coreItemsExist();
  const items = alreadyHaveCore ? draft.items : [...CORE_ITEMS, ...draft.items];

  await supabase.from('checklist_template_items').insert(
    items.map((item, i) => ({
      template_id: templateId,
      category: item.category,
      label: item.label,
      help_note: item.help ?? null,
      sort_order: (i + 1) * 10,
      is_core: item.core ?? false,
      only_water_source: item.only?.waterSource ?? null,
      only_sewer_type: item.only?.sewerType ?? null,
      only_heating_fuel: item.only?.heatingFuel ?? null,
      measurement_label: item.measure?.label ?? null,
      measurement_unit: item.measure?.unit ?? null,
      measurement_low: item.measure?.low ?? null,
      measurement_high: item.measure?.high ?? null,
    })),
  );

  done();
}

/** The heading: what the visit is called, and why this quarter looks like this. */
export async function saveTemplateMeta(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from('checklist_templates')
    .update({
      name: text(formData, 'name') ?? 'Seasonal Visit',
      season: text(formData, 'season') ?? '',
      months: text(formData, 'months') ?? '',
      focus: text(formData, 'focus'),
    })
    .eq('id', id);

  done();
}

/** Add an item, or save an edit to one. */
export async function saveChecklistItem(formData: FormData): Promise<void> {
  const templateId = text(formData, 'template_id');
  const category = text(formData, 'category');
  const label = text(formData, 'label');
  if (!templateId || !category || !label) return;

  const supabase = await createClient();

  const num = (key: string) => {
    const v = text(formData, key);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const unit = text(formData, 'measurement_unit');

  const row = {
    template_id: templateId,
    category,
    label,
    help_note: text(formData, 'help_note'),
    is_core: formData.get('is_core') != null,
    only_water_source: facts<WaterSource>(formData, 'only_water_source'),
    only_sewer_type: facts<SewerType>(formData, 'only_sewer_type'),
    only_heating_fuel: facts<HeatingFuel>(formData, 'only_heating_fuel'),
    // No unit means no reading. Clearing the unit clears the whole band,
    // so an item cannot be left half-measurement.
    measurement_unit: unit,
    measurement_label: unit ? text(formData, 'measurement_label') ?? 'Reading' : null,
    measurement_low: unit ? num('measurement_low') : null,
    measurement_high: unit ? num('measurement_high') : null,
  };

  const id = text(formData, 'id');
  if (id) {
    await supabase.from('checklist_template_items').update(row).eq('id', id);
  } else {
    // New items go to the end of their category rather than the end of the
    // list, so adding one more HVAC check does not strand it under Attic.
    const { data: siblings } = await supabase
      .from('checklist_template_items')
      .select('sort_order, category')
      .eq('template_id', templateId)
      .order('sort_order');

    const rows = (siblings ?? []) as { sort_order: number; category: string }[];
    const inCategory = rows.filter((r) => r.category === category);
    const after = inCategory.length
      ? Math.max(...inCategory.map((r) => r.sort_order))
      : rows.length
        ? Math.max(...rows.map((r) => r.sort_order))
        : 0;

    await supabase.from('checklist_template_items').insert({ ...row, sort_order: after + 5 });
  }

  done();
}

export async function deleteChecklistItem(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('checklist_template_items').delete().eq('id', id);
  done();
}

/**
 * Move an item up or down.
 *
 * Swaps sort_order with its neighbour rather than renumbering the list, so
 * two people reordering at once cannot corrupt the sequence between them.
 */
export async function moveChecklistItem(formData: FormData): Promise<void> {
  const id = text(formData, 'id');
  const direction = text(formData, 'direction');
  if (!id || (direction !== 'up' && direction !== 'down')) return;

  const supabase = await createClient();

  const { data: item } = await supabase
    .from('checklist_template_items')
    .select('id, template_id, sort_order')
    .eq('id', id)
    .maybeSingle();
  if (!item) return;

  const me = item as { id: string; template_id: string; sort_order: number };

  const { data: neighbour } = await supabase
    .from('checklist_template_items')
    .select('id, sort_order')
    .eq('template_id', me.template_id)
    [direction === 'up' ? 'lt' : 'gt']('sort_order', me.sort_order)
    .order('sort_order', { ascending: direction !== 'up' })
    .limit(1)
    .maybeSingle();
  if (!neighbour) return;

  const other = neighbour as { id: string; sort_order: number };

  await supabase
    .from('checklist_template_items')
    .update({ sort_order: other.sort_order })
    .eq('id', me.id);
  await supabase
    .from('checklist_template_items')
    .update({ sort_order: me.sort_order })
    .eq('id', other.id);

  done();
}
