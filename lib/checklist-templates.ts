/**
 * The seasonal visit lists — the built-in draft.
 *
 * ⚠️ THIS IS A DRAFT, AND IT IS NO LONGER THE ONLY COPY. ⚠️
 *
 * Since migration 0018 the real lists live in the database and are edited
 * at /admin/checklists. What is in this file is the starting point offered
 * there: press "start from the built-in list" on a quarter and these items
 * are copied in for you to mark up. After that, the database wins and this
 * file is only the fallback for a quarter nobody has set up yet.
 *
 * Which means: **to change what B&M checks, use the screen, not this file.**
 *
 * Where the draft came from: standard Mid-Atlantic (Lancaster County, PA)
 * home maintenance practice, plus the equipment in the demo Home Record.
 * Garrette has not yet marked it up, so read it as a competent stranger's
 * list rather than as B&M's.
 */

import type { HeatingFuel, Quarter, SewerType, WaterSource } from '@/lib/types/database';

export type { Quarter };

/**
 * Restricts an item to the houses it actually applies to.
 *
 * A septic item on a public-sewer home is noise, and noise is how a
 * checklist stops being read. An empty/absent rule means every house.
 */
export interface ChecklistApplies {
  waterSource?: WaterSource[];
  sewerType?: SewerType[];
  heatingFuel?: HeatingFuel[];
}

/**
 * An item that asks for a reading instead of a tick.
 *
 * The band is what healthy looks like, not a pass mark. Outside it is the
 * technician's prompt to look harder and the report's reason to say
 * something — it is never automatically a failure.
 */
export interface ChecklistMeasurement {
  /** "Temperature split", "Flue CO". Shown above the number box. */
  label: string;
  /** °F, ppm, psi, %, A, pCi/L, in. w.c., mm. */
  unit: string;
  low?: number;
  high?: number;
}

export interface ChecklistTemplateItem {
  category: string;
  label: string;
  /** What "good" looks like. Field screen only — never the member's report. */
  help?: string;
  only?: ChecklistApplies;
  /**
   * Goes on every visit, whatever the season.
   *
   * Fire, water and moisture do not wait for the right quarter, so the
   * safety and leak sections never rotate out. Written once, edited once,
   * appears four times.
   */
  core?: boolean;
  measure?: ChecklistMeasurement;
}

export interface ChecklistTemplate {
  quarter: Quarter;
  name: string;
  season: string;
  months: string;
  focus: string;
  /** The season's deep dive. The core list is added on top — see itemsFor. */
  items: ChecklistTemplateItem[];
}

/** The facts about a house that decide which items apply to it. */
export interface PropertyFacts {
  water_source?: WaterSource | null;
  sewer_type?: SewerType | null;
  heating_fuel?: HeatingFuel | null;
}

/**
 * Does this item belong on this house's list?
 *
 * An unrecorded fact keeps the item. We would rather a technician tick
 * "not applicable" on a septic item than never be shown it on a house
 * whose sewer type nobody has filled in yet.
 */
export function appliesToProperty(
  item: Pick<ChecklistTemplateItem, 'only'>,
  facts: PropertyFacts | null | undefined,
): boolean {
  const only = item.only;
  if (!only) return true;

  const match = <T,>(allowed: T[] | undefined, actual: T | null | undefined) =>
    !allowed || allowed.length === 0 || actual == null || allowed.includes(actual);

  return (
    match(only.waterSource, facts?.water_source) &&
    match(only.sewerType, facts?.sewer_type) &&
    match(only.heatingFuel, facts?.heating_fuel)
  );
}

import { CORE_ITEMS, Q1_ITEMS, Q2_ITEMS, Q3_ITEMS, Q4_ITEMS } from '@/lib/checklist-content';

export { CORE_ITEMS };

/**
 * The four quarters.
 *
 * `items` is the season's deep dive only. The core list is added on top
 * by itemsFor() — see the note on `core` above for why.
 */
export const CHECKLIST_TEMPLATES: Record<Quarter, ChecklistTemplate> = {
  Q1: {
    quarter: 'Q1',
    name: 'Winter Visit',
    season: 'Winter',
    months: 'January – March',
    focus:
      'The heaviest safety visit of the year: fire, heating under real load, radon, and the attic — which only tells the truth in winter.',
    items: Q1_ITEMS,
  },
  Q2: {
    quarter: 'Q2',
    name: 'Spring Visit',
    season: 'Spring',
    months: 'April – June',
    focus:
      'What did the winter do? Roof, drainage, structure and the whole exterior envelope, plus the well and septic annual.',
    items: Q2_ITEMS,
  },
  Q3: {
    quarter: 'Q3',
    name: 'Summer Visit',
    season: 'Summer',
    months: 'July – September',
    focus:
      'Cooling under load, and the inside of the house room by room — every bathroom, the kitchen, and the laundry.',
    items: Q3_ITEMS,
  },
  Q4: {
    quarter: 'Q4',
    name: 'Fall Visit',
    season: 'Fall',
    months: 'October – December',
    focus:
      'Everything that has to be right before the first hard freeze, plus the annual Market-Ready audit: what a future buyer’s inspector would find, answered years early.',
    items: Q4_ITEMS,
  },
};

/**
 * A quarter's full list — the core items, then the season's deep dive.
 *
 * Core comes first on purpose. If a visit gets cut short, the part that
 * was completed is the part that catches fire and water.
 */
export function itemsFor(quarter: Quarter): ChecklistTemplateItem[] {
  return [...CORE_ITEMS, ...CHECKLIST_TEMPLATES[quarter].items];
}

/** How many items a given house actually gets this quarter. */
export function itemCountFor(
  quarter: Quarter,
  facts?: PropertyFacts | null,
): number {
  return itemsFor(quarter).filter((i) => appliesToProperty(i, facts)).length;
}

/** Which quarter a date falls in. */
export function quarterFor(date: Date = new Date()): Quarter {
  const m = date.getMonth();
  if (m <= 2) return 'Q1';
  if (m <= 5) return 'Q2';
  if (m <= 8) return 'Q3';
  return 'Q4';
}

export function templateFor(date: Date = new Date()): ChecklistTemplate {
  return CHECKLIST_TEMPLATES[quarterFor(date)];
}

export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
