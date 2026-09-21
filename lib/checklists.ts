import { createClient } from '@/lib/supabase/server';
import {
  CHECKLIST_TEMPLATES, QUARTERS, quarterFor,
  type ChecklistTemplate, type ChecklistTemplateItem, type Quarter,
} from '@/lib/checklist-templates';
import type { HeatingFuel, SewerType, WaterSource } from '@/lib/types/database';

/**
 * Loading the seasonal lists.
 *
 * The database is the truth once a quarter has been set up on
 * /admin/checklists. Until then the built-in draft in
 * lib/checklist-templates.ts stands in, so a fresh install still schedules
 * a usable visit on day one and nothing breaks between the migration
 * running and Garrette writing his own lists.
 *
 * `source` is carried all the way to the screens on purpose. A technician
 * and the office should both be able to see at a glance whether they are
 * working from B&M's list or from the stranger's draft.
 */
export type TemplateSource = 'db' | 'builtin';

export interface LoadedTemplate extends ChecklistTemplate {
  source: TemplateSource;
  /** Null when this is the built-in draft. */
  id: string | null;
}

interface TemplateRow {
  id: string;
  quarter: Quarter;
  name: string;
  season: string;
  months: string;
  focus: string | null;
}

export interface TemplateItemRow {
  id: string;
  template_id: string;
  category: string;
  label: string;
  help_note: string | null;
  sort_order: number;
  only_water_source: WaterSource[] | null;
  only_sewer_type: SewerType[] | null;
  only_heating_fuel: HeatingFuel[] | null;
}

/** A stored row in the shape the rest of the app already understands. */
export function rowToItem(r: TemplateItemRow): ChecklistTemplateItem {
  const only = {
    ...(r.only_water_source?.length ? { waterSource: r.only_water_source } : {}),
    ...(r.only_sewer_type?.length ? { sewerType: r.only_sewer_type } : {}),
    ...(r.only_heating_fuel?.length ? { heatingFuel: r.only_heating_fuel } : {}),
  };
  return {
    category: r.category,
    label: r.label,
    ...(r.help_note ? { help: r.help_note } : {}),
    ...(Object.keys(only).length ? { only } : {}),
  };
}

function builtIn(quarter: Quarter): LoadedTemplate {
  return { ...CHECKLIST_TEMPLATES[quarter], source: 'builtin', id: null };
}

/**
 * One quarter's list.
 *
 * A stored template with **no items** falls back to the draft rather than
 * handing a technician an empty visit — half-finished setup should not
 * cost a member their quarterly check.
 */
export async function loadTemplate(quarter: Quarter): Promise<LoadedTemplate> {
  const supabase = await createClient();

  const { data: t } = await supabase
    .from('checklist_templates')
    .select('id, quarter, name, season, months, focus')
    .eq('quarter', quarter)
    .eq('is_active', true)
    .maybeSingle();

  if (!t) return builtIn(quarter);
  const row = t as TemplateRow;

  const { data: items } = await supabase
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', row.id)
    .order('sort_order');

  const rows = (items ?? []) as TemplateItemRow[];
  if (rows.length === 0) return builtIn(quarter);

  return {
    quarter: row.quarter,
    name: row.name,
    season: row.season,
    months: row.months,
    focus: row.focus ?? '',
    items: rows.map(rowToItem),
    source: 'db',
    id: row.id,
  };
}

/** The list for a date — what a visit on that day should carry. */
export async function loadTemplateForDate(date: Date = new Date()): Promise<LoadedTemplate> {
  return loadTemplate(quarterFor(date));
}

/** All four, for the editor and for the "what we check" screens. */
export async function loadAllTemplates(): Promise<Record<Quarter, LoadedTemplate>> {
  const loaded = await Promise.all(QUARTERS.map((q) => loadTemplate(q)));
  return Object.fromEntries(QUARTERS.map((q, i) => [q, loaded[i]])) as Record<
    Quarter,
    LoadedTemplate
  >;
}

/** The raw stored rows, which the editor needs so it can address each item. */
export async function loadEditableTemplates(): Promise<
  { template: TemplateRow; items: TemplateItemRow[] }[]
> {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('checklist_templates')
    .select('id, quarter, name, season, months, focus')
    .eq('is_active', true);

  const rows = (templates ?? []) as TemplateRow[];
  if (rows.length === 0) return [];

  const { data: items } = await supabase
    .from('checklist_template_items')
    .select('*')
    .in('template_id', rows.map((r) => r.id))
    .order('sort_order');

  const all = (items ?? []) as TemplateItemRow[];
  return rows
    .sort((a, b) => a.quarter.localeCompare(b.quarter))
    .map((template) => ({
      template,
      items: all.filter((i) => i.template_id === template.id),
    }));
}
