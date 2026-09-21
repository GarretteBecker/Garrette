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

export interface ChecklistTemplateItem {
  category: string;
  label: string;
  /** What "good" looks like. Field screen only — never the member's report. */
  help?: string;
  only?: ChecklistApplies;
}

export interface ChecklistTemplate {
  quarter: Quarter;
  name: string;
  season: string;
  months: string;
  focus: string;
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

const WELL: ChecklistApplies = { waterSource: ['WELL', 'SHARED_WELL'] };
const SEPTIC: ChecklistApplies = { sewerType: ['SEPTIC', 'MOUND'] };
const PROPANE: ChecklistApplies = { heatingFuel: ['PROPANE'] };
const OIL: ChecklistApplies = { heatingFuel: ['OIL'] };
const HEAT_PUMP: ChecklistApplies = { heatingFuel: ['HEAT_PUMP'] };
const BURNS_FUEL: ChecklistApplies = { heatingFuel: ['NATURAL_GAS', 'PROPANE', 'OIL'] };

export const CHECKLIST_TEMPLATES: Record<Quarter, ChecklistTemplate> = {
  Q1: {
    quarter: 'Q1',
    name: 'Winter Visit',
    season: 'Winter',
    months: 'January – March',
    focus:
      'The heating system under real load, water that should not be getting in, and the safety equipment you only need once.',
    items: [
      { category: 'HVAC', label: 'Furnace running under load — flame, cycle, noise',
        help: 'Let it run a full cycle. Listen at start-up and shutdown, not just while it is running.' },
      { category: 'HVAC', label: 'Change the furnace filter and record the size',
        help: 'The size goes on the Home Record so the member can buy their own between visits.' },
      { category: 'HVAC', label: 'Humidifier water panel and damper set for winter' },
      { category: 'HVAC', label: 'Every supply and return register open and unblocked',
        help: 'Furniture and rugs. A closed-off room is usually a blocked return.' },
      { category: 'HVAC', label: 'Heat pump defrost cycle, and clear ice from the outdoor unit', only: HEAT_PUMP },
      { category: 'Fuel', label: 'Propane tank gauge, regulator date and line condition', only: PROPANE,
        help: 'Regulators have a service life. Note the date stamp — the supplier owns the tank, not the regulator dates.' },
      { category: 'Fuel', label: 'Oil tank level, gauge, legs and line condition', only: OIL },
      { category: 'Plumbing', label: 'Exposed pipes on outside walls and in unheated space' },
      { category: 'Plumbing', label: 'Water heater — temperature, T&P valve, any weeping at the base' },
      { category: 'Plumbing', label: 'Sump pump test, and the outside discharge is not iced shut',
        help: 'A frozen discharge is a working pump with nowhere to go. Walk outside and look.' },
      { category: 'Plumbing', label: 'Exercise the main water shutoff so it does not seize',
        help: 'A valve that never moves is a valve that snaps in an emergency. Close it, open it, note if it is stiff.' },
      { category: 'Life Safety', label: 'Test every smoke and CO alarm, and read the date stamp',
        help: 'They expire — ten years for smoke, seven to ten for CO. An expired alarm that beeps is still expired.' },
      { category: 'Life Safety', label: 'Fire extinguisher charge, date and location' },
      { category: 'Interior', label: 'Window condensation and failed seals' },
      { category: 'Interior', label: 'Ceiling and wall stains that mean an ice dam or a roof leak' },
      { category: 'Exterior', label: 'Roof and gutters from the ground — ice dams, sagging, icicle lines' },
      { category: 'Exterior', label: 'Foundation and grading where the meltwater runs' },
      { category: 'Electrical', label: 'Panel inspection, and test every GFCI and AFCI' },
      { category: 'Structure', label: 'Basement and crawlspace moisture, and the vapour barrier' },
      { category: 'Air Quality', label: 'Radon — mitigation fan running, or flag that the house has never been tested',
        help: 'Lancaster County is a high-radon area and winter is the right time to test, with the house shut up.' },
    ],
  },

  Q2: {
    quarter: 'Q2',
    name: 'Spring Visit',
    season: 'Spring',
    months: 'April – June',
    focus:
      'Getting the cooling running before it is needed, and finding what the winter did to the outside of the house.',
    items: [
      { category: 'HVAC', label: 'Start the A/C and measure the temperature split',
        help: 'Supply against return. Roughly 15–20°F on a working system. Write the number down — next year it means something.' },
      { category: 'HVAC', label: 'Clean the condenser coil and clear two feet around the unit' },
      { category: 'HVAC', label: 'Change the furnace filter' },
      { category: 'HVAC', label: 'Condensate drain and pan — flush the line, test the float switch',
        help: 'The float switch is the thing that stops a ceiling coming down. Test it, do not just look at it.' },
      { category: 'Plumbing', label: 'Open and test every outside spigot, check the vacuum breakers' },
      { category: 'Plumbing', label: 'Sump pump float, check valve and discharge' },
      { category: 'Plumbing', label: 'Every toilet and faucet for a silent leak',
        help: 'Dye tablet in the tank. A running toilet is the commonest invisible bill in a house.' },
      { category: 'Plumbing', label: 'Water softener salt level and regeneration' },
      { category: 'Plumbing', label: 'Well — pressure tank, pump cycling, and the annual water test', only: WELL,
        help: 'Short-cycling means a waterlogged tank. The test is bacteria and nitrates at minimum.' },
      { category: 'Septic', label: 'Septic — drain field condition, and years since the last pump-out', only: SEPTIC,
        help: 'Most tanks want pumping every three to five years. Put the date on the record either way.' },
      { category: 'Exterior', label: 'Clean gutters and downspouts, and check they discharge away from the house' },
      { category: 'Exterior', label: 'Roof inspection after winter — shingles, flashing, boots, ridge' },
      { category: 'Exterior', label: 'Siding, trim and caulking' },
      { category: 'Exterior', label: 'Deck, railing and stairs — probe the posts at grade',
        help: 'Probe, do not look. A post that is sound at eye level can be gone at the ground.' },
      { category: 'Exterior', label: 'Grading and drainage away from the foundation' },
      { category: 'Exterior', label: 'Driveway, walk and steps — trip hazards and winter damage' },
      { category: 'Electrical', label: 'Outside GFCI outlets, fixtures and covers' },
      { category: 'Appliance', label: 'Dishwasher and disposal operation, and the supply shutoff' },
      { category: 'Life Safety', label: 'Test every smoke and CO alarm' },
    ],
  },

  Q3: {
    quarter: 'Q3',
    name: 'Summer Visit',
    season: 'Summer',
    months: 'July – September',
    focus:
      'Cooling under real load, the moisture and the pests that only show up in the heat, and the appliances that fail quietly.',
    items: [
      { category: 'HVAC', label: 'A/C under load — temperature split, suction line, ice on the coil',
        help: 'A cold beer-can-sweaty suction line is right. Frost on it is low charge or low airflow.' },
      { category: 'HVAC', label: 'Change the furnace filter' },
      { category: 'HVAC', label: 'Flush the condensate line and test the safety switch' },
      { category: 'HVAC', label: 'Attic temperature and ventilation — soffits clear, ridge vent working',
        help: 'A baking attic in August is a roof ageing at double speed. Insulation stuffed into the soffits is the usual cause.' },
      { category: 'Interior', label: 'Humidity reading, musty smell, any mould indicators' },
      { category: 'Interior', label: 'Basement dehumidifier operation and drain line' },
      { category: 'Plumbing', label: 'Under every sink for a slow leak',
        help: 'Hand on the trap and the supply line, not just eyes. A slow leak is dry by the time you look.' },
      { category: 'Plumbing', label: 'Water heater — anode assessment, sediment flush, expansion tank charge' },
      { category: 'Plumbing', label: 'Toilet supply lines and angle stops' },
      { category: 'Appliance', label: 'Washing machine hoses — bulging, cracking, and the date on them',
        help: 'Rubber hoses are a five-year part. Braided stainless is the fix and it is cheap.' },
      { category: 'Appliance', label: 'Refrigerator coils and the ice maker line' },
      { category: 'Appliance', label: 'Dryer vent run cleaned, and the outside flap opens' },
      { category: 'Exterior', label: 'Pest and wood-destroying insect check — mud tubes, bee holes, rot',
        help: 'Sill plate, band joist, and anywhere wood meets the ground.' },
      { category: 'Exterior', label: 'Cut vegetation back off the siding and clear of the A/C unit' },
      { category: 'Exterior', label: 'Exterior paint, caulk and wood trim before the weather turns' },
      { category: 'Exterior', label: 'Driveway, walkway and step condition' },
      { category: 'Septic', label: 'Septic — any surfacing or odour after heavy summer use', only: SEPTIC },
      { category: 'Garage', label: 'Garage door balance and rollers, and test the photo-eye and auto-reverse',
        help: 'Auto-reverse on a 2x4 laid flat. It is a two-minute test and it is the one that matters.' },
      { category: 'Life Safety', label: 'Test every smoke and CO alarm' },
    ],
  },

  Q4: {
    quarter: 'Q4',
    name: 'Fall Visit',
    season: 'Fall',
    months: 'October – December',
    focus:
      'Everything that has to be right before the first hard freeze, done while there is still time to fix it.',
    items: [
      { category: 'HVAC', label: 'Furnace start-up and combustion check — flame, heat exchanger, draft',
        help: 'This is the visit where a cracked heat exchanger gets caught. Take the time.' },
      { category: 'HVAC', label: 'Change the furnace filter' },
      { category: 'HVAC', label: 'Replace the humidifier water panel and open the damper' },
      { category: 'HVAC', label: 'Thermostat schedule and batteries' },
      { category: 'HVAC', label: 'Heat pump — auxiliary heat comes on when it should', only: HEAT_PUMP },
      { category: 'Fuel', label: 'Propane tank gauge and lines before the cold', only: PROPANE,
        help: 'Tell them what percentage they are at. A run-out in January needs a leak test before it relights.' },
      { category: 'Fuel', label: 'Oil tank level and filter before the cold', only: OIL },
      { category: 'Venting', label: 'Chimney and flue — cap, liner, draft, and the last sweep date', only: BURNS_FUEL },
      { category: 'Plumbing', label: 'Disconnect every hose and drain the sillcocks',
        help: 'A hose left on a frost-free sillcock defeats it entirely. This is the single commonest burst pipe there is.' },
      { category: 'Plumbing', label: 'Water heater inspection, anode and flush assessment' },
      { category: 'Plumbing', label: 'Sump pump test before winter' },
      { category: 'Plumbing', label: 'Water softener salt level' },
      { category: 'Exterior', label: 'Clean gutters after the leaves are down' },
      { category: 'Exterior', label: 'Roof and flashing inspection' },
      { category: 'Exterior', label: 'Seal gaps and penetrations before the cold' },
      { category: 'Appliance', label: 'Clean the dryer vent run' },
      { category: 'Garage', label: 'Garage door springs, rollers and photo-eyes' },
      { category: 'Attic', label: 'Insulation depth, ventilation, and any daylight showing' },
      { category: 'Electrical', label: 'Panel inspection and thermal check' },
      { category: 'Life Safety', label: 'Test every smoke and CO alarm, and change the batteries' },
    ],
  },
};

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
