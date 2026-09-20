/**
 * Seasonal visit checklists, Q1–Q4.
 *
 * ⚠️ ASSUMPTION — NEEDS GARRETTE'S REVIEW ⚠️
 * CLAUDE.md points at docs/homekeeper-spec.md for the real Q1–Q4 checklists,
 * but that file does not exist in this repo. These lists are built from
 * standard Mid-Atlantic (Lancaster County, PA) home maintenance practice and
 * from the equipment actually present in the Miller Home demo record.
 *
 * Treat this file as a first draft to mark up, not as the spec. When the real
 * checklists arrive, replace the arrays below — nothing else needs to change,
 * because every screen reads from here.
 */

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ChecklistTemplateItem {
  category: string;
  label: string;
}

export interface ChecklistTemplate {
  quarter: Quarter;
  season: string;
  months: string;
  focus: string;
  items: ChecklistTemplateItem[];
}

export const CHECKLIST_TEMPLATES: Record<Quarter, ChecklistTemplate> = {
  Q1: {
    quarter: 'Q1',
    season: 'Winter',
    months: 'January – March',
    focus: 'Heating under load, water intrusion, ice and safety.',
    items: [
      { category: 'HVAC', label: 'Furnace operation and filter change' },
      { category: 'HVAC', label: 'Humidifier water panel and damper setting' },
      { category: 'HVAC', label: 'Check supply/return registers for blockage' },
      { category: 'Plumbing', label: 'Inspect exposed pipes for freeze risk' },
      { category: 'Plumbing', label: 'Water heater temperature and pressure relief check' },
      { category: 'Plumbing', label: 'Test sump pump and check discharge line for ice' },
      { category: 'Life Safety', label: 'Test smoke and CO detectors' },
      { category: 'Life Safety', label: 'Verify fire extinguisher charge and location' },
      { category: 'Interior', label: 'Check for window condensation and seal failure' },
      { category: 'Interior', label: 'Look for ceiling stains indicating ice damming' },
      { category: 'Exterior', label: 'Roof and gutter check from ground for ice dams' },
      { category: 'Exterior', label: 'Check foundation and grading for meltwater pooling' },
      { category: 'Electrical', label: 'Panel inspection and GFCI/AFCI test' },
      { category: 'Structure', label: 'Basement and crawlspace moisture check' },
    ],
  },
  Q2: {
    quarter: 'Q2',
    season: 'Spring',
    months: 'April – June',
    focus: 'Cooling start-up, water management, exterior envelope after winter.',
    items: [
      { category: 'HVAC', label: 'Start and test A/C condenser, check delta-T' },
      { category: 'HVAC', label: 'Clean condenser coil and clear surrounding debris' },
      { category: 'HVAC', label: 'Replace furnace filter' },
      { category: 'HVAC', label: 'Check condensate drain and pan' },
      { category: 'Plumbing', label: 'Open and test exterior sillcocks' },
      { category: 'Plumbing', label: 'Test sump pump float and discharge' },
      { category: 'Plumbing', label: 'Check all toilets and faucets for running or leaks' },
      { category: 'Plumbing', label: 'Water softener salt level and regeneration' },
      { category: 'Exterior', label: 'Gutter and downspout inspection and clean' },
      { category: 'Exterior', label: 'Roof visual inspection after winter' },
      { category: 'Exterior', label: 'Siding, trim and caulking inspection' },
      { category: 'Exterior', label: 'Deck and railing structural check' },
      { category: 'Exterior', label: 'Grading and drainage away from foundation' },
      { category: 'Electrical', label: 'Exterior GFCI outlets and fixtures' },
      { category: 'Appliance', label: 'Dishwasher and disposal operation check' },
      { category: 'Life Safety', label: 'Test smoke and CO detectors' },
    ],
  },
  Q3: {
    quarter: 'Q3',
    season: 'Summer',
    months: 'July – September',
    focus: 'Cooling under load, moisture and pests, appliance wear.',
    items: [
      { category: 'HVAC', label: 'A/C performance under load, check refrigerant behaviour' },
      { category: 'HVAC', label: 'Replace furnace filter' },
      { category: 'HVAC', label: 'Condensate line flush' },
      { category: 'Interior', label: 'Check for humidity, musty odour, mould indicators' },
      { category: 'Plumbing', label: 'Inspect under all sinks for slow leaks' },
      { category: 'Plumbing', label: 'Water heater inspection and flush assessment' },
      { category: 'Appliance', label: 'Washer hose inspection for bulging or cracking' },
      { category: 'Appliance', label: 'Refrigerator coils and icemaker line check' },
      { category: 'Exterior', label: 'Pest entry points and wood-destroying insect check' },
      { category: 'Exterior', label: 'Trim vegetation back from siding and A/C unit' },
      { category: 'Exterior', label: 'Driveway, walkway and step condition' },
      { category: 'Garage', label: 'Garage door balance, rollers and photo-eye test' },
      { category: 'Life Safety', label: 'Test smoke and CO detectors' },
    ],
  },
  Q4: {
    quarter: 'Q4',
    season: 'Fall',
    months: 'October – December',
    focus: 'Heating season prep and winterisation.',
    items: [
      { category: 'HVAC', label: 'Furnace start-up and combustion check' },
      { category: 'HVAC', label: 'Replace furnace filter' },
      { category: 'HVAC', label: 'Replace humidifier water panel' },
      { category: 'HVAC', label: 'Thermostat schedule and battery check' },
      { category: 'Plumbing', label: 'Disconnect hoses from sillcocks' },
      { category: 'Plumbing', label: 'Water heater inspection, anode and flush assessment' },
      { category: 'Plumbing', label: 'Sump pump test before winter' },
      { category: 'Plumbing', label: 'Water softener salt level' },
      { category: 'Exterior', label: 'Clean gutters for leaf season' },
      { category: 'Exterior', label: 'Roof and flashing inspection' },
      { category: 'Exterior', label: 'Seal gaps and penetrations before cold' },
      { category: 'Appliance', label: 'Clean dryer vent run' },
      { category: 'Garage', label: 'Garage door springs, rollers and photo-eyes' },
      { category: 'Life Safety', label: 'Test smoke/CO detectors, change batteries' },
      { category: 'Attic', label: 'Attic insulation depth and ventilation check' },
      { category: 'Electrical', label: 'Panel inspection, thermal check' },
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
