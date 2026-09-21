/**
 * B&M's Quarterly Home Safety & Preventive Maintenance Program.
 *
 * This is Garrette's own program, written September 2026, not a generic
 * maintenance list. The promise it implements:
 *
 *   Four times a year we inspect the home for safety concerns, water
 *   intrusion, developing failures, deferred maintenance, current-standard
 *   concerns, and conditions that could become expensive or create issues
 *   during a future home sale.
 *
 *   The goal is "market-ready all year", not "nothing is broken today".
 *
 * ── Two editorial decisions, so nobody wonders later ────────────────────
 *
 * 1. Garrette's spec listed the *signs* to look for — dripping, rust,
 *    corrosion, mineral deposits, swollen cabinets, staining — as their
 *    own checkboxes. Twenty-eight fixtures times eleven signs is three
 *    hundred ticks for one section, which is how a checklist stops being
 *    read. The signs are carried as the section's help note instead, where
 *    a technician sees them while doing the work.
 *
 * 2. "Current-standard concern" is used throughout, never "code
 *    violation". Pennsylvania's UCC adopts the 2021 IRC / 2020 NEC with
 *    state amendments from 1 January 2026, but municipalities administer
 *    enforcement and an existing condition is usually lawfully
 *    grandfathered. B&M flags what a future buyer's inspector will raise;
 *    the municipality and the trade make code determinations.
 *
 * To change any of this, use /admin/checklists — not this file. See
 * docs/checklists.md.
 */

import type { ChecklistApplies, ChecklistTemplateItem } from '@/lib/checklist-templates';

const WELL: ChecklistApplies = { waterSource: ['WELL', 'SHARED_WELL'] };
const SEPTIC: ChecklistApplies = { sewerType: ['SEPTIC', 'MOUND'] };
const PROPANE: ChecklistApplies = { heatingFuel: ['PROPANE'] };
const OIL: ChecklistApplies = { heatingFuel: ['OIL'] };
const BURNS_FUEL: ChecklistApplies = { heatingFuel: ['NATURAL_GAS', 'PROPANE', 'OIL'] };

/** Shorthand — everything in this file is a core item unless stated. */
const c = (
  category: string,
  label: string,
  extra: Partial<ChecklistTemplateItem> = {},
): ChecklistTemplateItem => ({ category, label, core: true, ...extra });

const LEAK_SIGNS =
  'Dripping, rust, corrosion, mineral deposits, swollen cabinet bottoms, soft flooring, staining, failed caulk, musty smell, mould-like growth. Hand on it, not just eyes — a slow leak is dry by the time you look.';

/* =====================================================================
 * THE CORE LIST — every visit, every quarter.
 *
 * These never rotate out. Fire, electrical faults, water intrusion and
 * moisture develop in weeks, not seasons, so a list that only checks them
 * in the right quarter checks them too late.
 * ===================================================================== */
export const CORE_ITEMS: ChecklistTemplateItem[] = [
  // ---------------------------------------------------------------- 1
  c('Life Safety', 'Test every accessible smoke alarm'),
  c('Life Safety', 'Record smoke alarm manufacture date where visible', {
    help: 'The date is printed on the back. This is the one that matters — an expired alarm still beeps when you test it.',
  }),
  c('Life Safety', 'Flag any alarm approaching its 10-year replacement age'),
  c('Life Safety', 'Smoke alarm inside every bedroom'),
  c('Life Safety', 'Smoke alarm outside each sleeping area'),
  c('Life Safety', 'Smoke alarm on every level of the home'),
  c('Life Safety', 'Test every accessible CO alarm'),
  c('Life Safety', 'CO coverage near sleeping areas'),
  c('Life Safety', 'Fire extinguisher locations'),
  c('Life Safety', 'Fire extinguisher pressure indicator in the green'),
  c('Life Safety', 'Fire extinguisher physical condition and date'),
  c('Life Safety', 'Main emergency egress paths clear'),
  c('Life Safety', 'Exterior doors operate and latch'),
  c('Life Safety', 'Accessible bedroom windows open and close'),
  c('Life Safety', 'No blocked bedroom egress', {
    help: 'Furniture, storage, security bars, a window painted shut, a basement bedroom with no way out.',
  }),
  c('Life Safety', 'Stair treads secure — none loose'),
  c('Life Safety', 'Handrails secure and continuous'),
  c('Life Safety', 'Guards and railings secure'),
  c('Life Safety', 'Trip and fall hazards'),
  c('Life Safety', 'Stair and landing lighting works'),
  c('Life Safety', 'Loose flooring and floor transitions'),
  c('Life Safety', 'Extension cords not used as permanent wiring'),
  c('Life Safety', 'Power strips not overloaded or daisy-chained'),
  c('Life Safety', 'Combustible storage clear of mechanical equipment', {
    help: 'Paint, paper, fabric, gasoline near the furnace or water heater. Very common and very easy to fix on the spot.',
  }),
  c('Life Safety', 'Emergency shutoffs accessible and not blocked'),

  // ---------------------------------------------------------------- 2
  c('Water Leaks', 'Toilet base, tank, supply valve and supply line — every toilet', { help: LEAK_SIGNS }),
  c('Water Leaks', 'Bathroom vanity, supply valves, drain and trap', { help: LEAK_SIGNS }),
  c('Water Leaks', 'Tub valve area and tub drain'),
  c('Water Leaks', 'Shower enclosure, corners, caulking and door seals', {
    help: 'Separating caulk at the corners is the early stage of the leak that later shows in the ceiling below.',
  }),
  c('Water Leaks', 'Kitchen sink, faucet, drain and trap', { help: LEAK_SIGNS }),
  c('Water Leaks', 'Garbage disposal body and connections'),
  c('Water Leaks', 'Dishwasher supply and drain connection'),
  c('Water Leaks', 'Refrigerator and icemaker supply line'),
  c('Water Leaks', 'Washing machine valves and hoses', {
    help: 'Rubber hoses are a five-year part. Braided stainless is about $20 and ends the problem.',
  }),
  c('Water Leaks', 'Laundry standpipe and drain'),
  c('Water Leaks', 'Utility sink and connections'),
  c('Water Leaks', 'Water heater body, fittings and floor around it'),
  c('Water Leaks', 'Boiler piping and circulators', { only: BURNS_FUEL }),
  c('Water Leaks', 'Whole-house filter housing'),
  c('Water Leaks', 'Water softener, brine tank and lines'),
  c('Water Leaks', 'Exterior hose bibs, inside and out'),
  c('Water Leaks', 'All visible basement plumbing', { help: LEAK_SIGNS }),
  c('Water Leaks', 'All exposed crawlspace plumbing', { help: LEAK_SIGNS }),
  c('Water Leaks', 'Thermal scan anywhere the pattern looks wrong', {
    help: 'Wet shows cooler. Scan under baths, around the water heater, and any ceiling below a wet room.',
  }),

  // ---------------------------------------------------------------- 3
  c('Moisture', 'Basement relative humidity', {
    measure: { label: 'Basement humidity', unit: '%', low: 30, high: 55 },
    help: 'Above 60% you are growing something. Record it every visit — the trend is the finding.',
  }),
  c('Moisture', 'Crawlspace relative humidity', {
    measure: { label: 'Crawlspace humidity', unit: '%', low: 30, high: 60 },
  }),
  c('Moisture', 'Main floor relative humidity', {
    measure: { label: 'Main floor humidity', unit: '%', low: 30, high: 50 },
  }),
  c('Moisture', 'Visible foundation walls'),
  c('Moisture', 'Re-check every previously recorded leak location', {
    help: 'Open last visit on the Home Record first. This item is only worth anything if you know where to look.',
  }),
  c('Moisture', 'Around every basement window and window well'),
  c('Moisture', 'Sump area and surrounding slab'),
  c('Moisture', 'Ceilings below bathrooms'),
  c('Moisture', 'Ceilings below roof penetrations'),
  c('Moisture', 'Moisture meter reading where anything looks suspicious', {
    measure: { label: 'Highest moisture reading', unit: '%', high: 16 },
    help: 'Record the highest reading you found and say where. Above about 16% in wood is wet enough to act on.',
  }),

  // ---------------------------------------------------------------- 4
  c('Electrical', 'Panel exterior — condition, labelling, clearance'),
  c('Electrical', 'Panel interior, only within your scope and training', {
    help: 'Dead front off only if you are trained and it is dry. Anything questionable stops here and goes to a licensed electrician.',
  }),
  c('Electrical', 'Corrosion or moisture in or around the panel'),
  c('Electrical', 'Overheating indicators — discolouration, smell, melted insulation'),
  c('Electrical', 'Thermal scan the panel under load', {
    help: 'Loose terminations show as heat long before they show as fire.',
  }),
  c('Electrical', 'Missing breaker blanks'),
  c('Electrical', 'Missing junction box covers'),
  c('Electrical', 'Damaged switches and receptacles'),
  c('Electrical', 'Missing receptacle cover plates'),
  c('Electrical', 'Test GFCI protection — bathrooms'),
  c('Electrical', 'Test GFCI protection — kitchen'),
  c('Electrical', 'Test GFCI protection — garage'),
  c('Electrical', 'Test GFCI protection — basement'),
  c('Electrical', 'Test GFCI protection — exterior'),
  c('Electrical', 'Test GFCI protection — laundry where applicable', {
    help: 'GFCIs fail dead, protecting nothing, and nothing tells you. Press test and reset on every one.',
  }),
  c('Electrical', 'Exterior receptacle covers — in-use type where exposed'),
  c('Electrical', 'Exposed or damaged wiring'),
  c('Electrical', 'Unsupported or improperly run wiring'),
  c('Electrical', 'Homeowner electrical modifications'),
  c('Electrical', 'Open junction boxes'),
  c('Electrical', 'Note older wiring systems — knob and tube, cloth-covered', {
    help: 'Record it, do not judge it. It changes their insurability, which is a conversation worth having early.',
  }),
  c('Electrical', 'Note Federal Pacific, Zinsco or other legacy equipment', {
    help: 'Record the panel brand for specialist review. Insurers act on these regardless of how the engineering argument settles.',
  }),
  c('Electrical', 'Note aluminium branch wiring where observed'),
  c('Electrical', 'Service entrance, mast and drip loop from the ground'),
  c('Electrical', 'Visible bonding and grounding, including the water line bond', {
    help: 'The water-line bond is routinely lost when somebody puts a plastic section in the supply.',
  }),

  // ---------------------------------------------------------------- 5
  c('Plumbing', 'Main water shutoff accessible and operable', {
    help: 'A valve that never moves seizes, and a seized valve snaps when it is finally needed. Close it, open it, note if it is stiff.',
  }),
  c('Plumbing', 'Main shutoff labelled'),
  c('Plumbing', 'Static water pressure', {
    measure: { label: 'Water pressure', unit: 'psi', low: 40, high: 80 },
    help: 'Gauge on an outside bib with nothing running. Over 80 psi destroys everything downstream and voids some warranties.',
  }),
  c('Plumbing', 'Compare pressure against the previous visit'),
  c('Plumbing', 'Accessible supply piping — material, condition, supports'),
  c('Plumbing', 'Accessible drain piping — material, condition, supports'),
  c('Plumbing', 'Corrosion at fittings and dissimilar metals'),
  c('Plumbing', 'Slow drains'),
  c('Plumbing', 'Leaking fixtures'),
  c('Plumbing', 'Loose toilets'),
  c('Plumbing', 'Running toilets', { help: 'Dye tablet in the tank. The commonest invisible bill in a house.' }),
  c('Plumbing', 'Faucet operation and aerators'),
  c('Plumbing', 'Exterior hose bibs and vacuum breakers'),
  c('Plumbing', 'Visible sewer cleanouts located and accessible'),
  c('Plumbing', 'Sewer odours anywhere in the house', {
    help: 'A dry trap, a failed wax ring, or a vent problem. Worth chasing — people stop noticing their own house.',
  }),
  c('Plumbing', 'Note any recurring drain concern'),
  c('Plumbing', 'Water hammer'),
  c('Plumbing', 'Freeze vulnerability on any exposed run'),

  // ---------------------------------------------------------------- 6
  c('HVAC', 'Furnace, boiler or heat pump overall condition'),
  c('HVAC', 'Filter condition'),
  c('HVAC', 'Record the filter size', {
    help: 'Goes on the Home Record so the member can buy their own between visits.',
  }),
  c('HVAC', 'Replace the filter'),
  c('HVAC', 'Thermostat operation and batteries'),
  c('HVAC', 'Condensate leakage anywhere around the equipment'),
  c('HVAC', 'Condensate drain line clear'),
  c('HVAC', 'Condensate pump operation and float switch', {
    help: 'Test the float, do not look at it. It is the device that stops a ceiling coming down.',
  }),
  c('HVAC', 'Visible ductwork condition'),
  c('HVAC', 'Disconnected ducts'),
  c('HVAC', 'Crushed or kinked flex duct'),
  c('HVAC', 'Excessive rust on cabinet or plenum'),
  c('HVAC', 'Soot or other combustion indicators', { only: BURNS_FUEL }),
  c('HVAC', 'Visible flue and vent connector joints', { only: BURNS_FUEL }),
  c('HVAC', 'Visible gas piping, supports and sediment trap', { only: BURNS_FUEL }),
  c('HVAC', 'Damaged duct or line-set insulation'),
  c('HVAC', 'Outdoor condenser or heat pump condition'),
  c('HVAC', 'Clearance around the outdoor unit'),
  c('HVAC', 'Unusual noise or vibration'),
  c('HVAC', 'Record equipment age against the data plate'),

  // ---------------------------------------------------------------- 7
  c('Water Heater', 'Record approximate age from the serial number', {
    help: 'Average age at failure is about 10.7 years, and by 12 nearly three in four have gone. This is the most forecastable failure in the house.',
  }),
  c('Water Heater', 'Tank corrosion, especially at the base and seams'),
  c('Water Heater', 'Any leakage'),
  c('Water Heater', 'Supply connections and shutoff'),
  c('Water Heater', 'Visible TPR discharge piping', {
    help: 'Full size, downward, terminating where a scald cannot reach anyone. No threads on the end.',
  }),
  c('Water Heater', 'Drain valve condition'),
  c('Water Heater', 'Drain pan present where applicable'),
  c('Water Heater', 'Drain pan free of standing water and draining'),
  c('Water Heater', 'Expansion tank present and charged', {
    help: 'Tap it — hollow on top, solid at the bottom. A dead one spikes pressure and pops the TPR.',
  }),
  c('Water Heater', 'Venting on combustion units', { only: BURNS_FUEL }),
  c('Water Heater', 'Backdraft or soot indicators at the draft hood', { only: BURNS_FUEL }),
  c('Water Heater', 'Shutoff accessible'),
  c('Water Heater', 'Combustibles clear of the unit'),
  c('Water Heater', 'Record condition trend against the previous visit'),

  // ---------------------------------------------------------------- 8
  c('Basement & Crawl', 'Water intrusion'),
  c('Basement & Crawl', 'Foundation cracks'),
  c('Basement & Crawl', 'Photograph existing cracks at the marked points', {
    help: 'Same three spots, same angle, tape measure in frame. A crack means nothing; a crack that grew 3mm in a year is a finding.',
  }),
  c('Basement & Crawl', 'Widest crack width at the marked point', {
    measure: { label: 'Widest marked crack', unit: 'mm', high: 6 },
  }),
  c('Basement & Crawl', 'Efflorescence'),
  c('Basement & Crawl', 'Foundation displacement or bowing'),
  c('Basement & Crawl', 'Floor movement or settlement'),
  c('Basement & Crawl', 'Beam and post condition'),
  c('Basement & Crawl', 'Joist condition'),
  c('Basement & Crawl', 'Sill plate and band joist condition'),
  c('Basement & Crawl', 'Rot'),
  c('Basement & Crawl', 'Wood-destroying insect evidence', {
    help: 'Mud tubes on the foundation, frass, hollow-sounding wood. Sill plate and band joist first.',
  }),
  c('Basement & Crawl', 'Mould-like growth'),
  c('Basement & Crawl', 'Plumbing leakage'),
  c('Basement & Crawl', 'Electrical concerns'),
  c('Basement & Crawl', 'Insulation condition'),
  c('Basement & Crawl', 'Vapour barrier condition'),
  c('Basement & Crawl', 'Exposed soil'),
  c('Basement & Crawl', 'Pest evidence'),
  c('Basement & Crawl', 'Sump pump operation'),
  c('Basement & Crawl', 'Sump float operation', { help: 'Lift the float by hand. It should start straight away.' }),
  c('Basement & Crawl', 'Sump check valve and discharge line'),
  c('Basement & Crawl', 'Sump backup pump and battery condition', {
    help: 'A sump with no backup stops exactly when the storm takes the power out. Batteries are a 3–5 year part.',
  }),
  c('Basement & Crawl', 'Sewage ejector condition where applicable'),

  // ---------------------------------------------------------------- 9
  c('Exterior', 'Roof from the ground — missing or damaged shingles'),
  c('Exterior', 'Visible flashing concerns'),
  c('Exterior', 'Gutters'),
  c('Exterior', 'Downspouts'),
  c('Exterior', 'Downspout discharge location', {
    help: 'Lancaster County is karst. Water dumped at the foundation does not just wet a basement — it washes fines out from under the footing.',
  }),
  c('Exterior', 'Ponding water'),
  c('Exterior', 'Negative grading against the foundation'),
  c('Exterior', 'Soil erosion'),
  c('Exterior', 'Foundation exterior'),
  c('Exterior', 'Siding'),
  c('Exterior', 'Masonry'),
  c('Exterior', 'Exterior trim'),
  c('Exterior', 'Windows'),
  c('Exterior', 'Exterior doors'),
  c('Exterior', 'Exterior caulking and penetrations'),
  c('Exterior', 'Fascia'),
  c('Exterior', 'Soffit'),
  c('Exterior', 'Deck'),
  c('Exterior', 'Porch'),
  c('Exterior', 'Steps'),
  c('Exterior', 'Exterior handrails'),
  c('Exterior', 'Exterior guards'),
  c('Exterior', 'Retaining walls'),
  c('Exterior', 'Driveway'),
  c('Exterior', 'Walkways'),
  c('Exterior', 'Tree limbs contacting the structure'),
  c('Exterior', 'Vegetation against siding or roof'),
  c('Exterior', 'Wood-to-soil contact'),

  // ---------------------------------------------------------------- 10
  c('Garage', 'Garage door operation'),
  c('Garage', 'Photo-eye sensors aligned and working'),
  c('Garage', 'Auto-reverse on a 2x4 laid flat', {
    help: 'Two minutes, and it is the one that matters. Test it every visit.',
  }),
  c('Garage', 'Door tracks, rollers and hardware'),
  c('Garage', 'Damaged door panels'),
  c('Garage', 'Garage-to-house door — self-closing, condition, latching'),
  c('Garage', 'Visible fire separation concerns', {
    help: 'Penetrations and missing drywall at the house wall and ceiling. Current-standard concern, not a violation call.',
  }),
  c('Garage', 'Gasoline and flammable storage'),
  c('Garage', 'Extension cord use'),
  c('Garage', 'Electrical hazards'),
  c('Garage', 'Water intrusion'),
  c('Garage', 'Floor cracking and trip hazards'),
  c('Garage', 'EV charging equipment visual condition'),
  c('Garage', 'Combustible storage around the furnace or water heater'),
];

export const CORE = { WELL, SEPTIC, PROPANE, OIL, BURNS_FUEL };

/** Shorthand for a seasonal item — belongs to one quarter only. */
const s = (
  category: string,
  label: string,
  extra: Partial<ChecklistTemplateItem> = {},
): ChecklistTemplateItem => ({ category, label, ...extra });

/* =====================================================================
 * Q1 — WINTER, January to March
 * Deep dive: fire, heating, radon, attic and cold-weather problems.
 *
 * The most safety-heavy visit of the year. Winter is also the only time
 * the attic tells the truth: frost, condensation and rusting nails show
 * up in January and are invisible in June.
 * ===================================================================== */
export const Q1_ITEMS: ChecklistTemplateItem[] = [
  s('Heating', 'Furnace or boiler deep visual inspection'),
  s('Heating', 'Filter replaced and size confirmed'),
  s('Heating', 'Venting and vent connector', { only: BURNS_FUEL }),
  s('Heating', 'Flue condition', { only: BURNS_FUEL }),
  s('Heating', 'Rust on cabinet, plenum and vent'),
  s('Heating', 'Soot or scorching at the burner compartment', { only: BURNS_FUEL }),
  s('Heating', 'Gas piping, supports and sediment trap', { only: BURNS_FUEL }),
  s('Heating', 'Combustion air supply adequate', {
    only: BURNS_FUEL,
    help: 'A sealed-up basement starves the burner. Look for a combustion air duct, and for anything blocking it.',
  }),
  s('Heating', 'Boiler pressure and any leaks', { only: BURNS_FUEL }),
  s('Heating', 'Radiator leaks and bleed valves'),
  s('Heating', 'Baseboard condition and fins clear'),
  s('Heating', 'Heat pump operation observations'),
  s('Heating', 'Outdoor heat pump clear of snow and ice'),
  s('Heating', 'Condensate system through the heating season'),
  s('Heating', 'Humidifier condition, water panel and damper'),
  s('Heating', 'Thermostat operation and heating schedule'),
  s('Heating', 'Supply air temperature rise', {
    measure: { label: 'Temperature rise', unit: '°F', low: 35, high: 65 },
    help: 'Supply minus return. Check the data plate for this furnace’s range — outside it is an airflow or firing rate problem.',
  }),
  s('Heating', 'Flue carbon monoxide reading', {
    only: BURNS_FUEL,
    measure: { label: 'Flue CO', unit: 'ppm', high: 100 },
    help: 'Healthy is roughly 10–50 ppm in the flue. Past 100 is incomplete combustion. The house itself should read 0.',
  }),
  s('Heating', 'Ambient carbon monoxide in the mechanical room', {
    only: BURNS_FUEL,
    measure: { label: 'Ambient CO', unit: 'ppm', high: 0 },
    help: 'Should be zero. Anything above it stops the visit and goes to the member immediately.',
  }),

  s('Fireplace & Chimney', 'Fireplace condition', { only: BURNS_FUEL }),
  s('Fireplace & Chimney', 'Damper operation', { only: BURNS_FUEL }),
  s('Fireplace & Chimney', 'Firebox deterioration', { only: BURNS_FUEL }),
  s('Fireplace & Chimney', 'Hearth and hearth extension', { only: BURNS_FUEL }),
  s('Fireplace & Chimney', 'Visible flue and liner concerns', { only: BURNS_FUEL }),
  s('Fireplace & Chimney', 'Chimney exterior from the ground'),
  s('Fireplace & Chimney', 'Chimney cap present and intact'),
  s('Fireplace & Chimney', 'Crown condition'),
  s('Fireplace & Chimney', 'Masonry and mortar joints'),
  s('Fireplace & Chimney', 'Chimney flashing'),
  s('Fireplace & Chimney', 'Record last sweep date, recommend specialist where needed'),

  s('Attic — Winter', 'Roof deck staining', {
    help: 'Winter is when this shows. Stains that are invisible in summer appear as frost patterns in January.',
  }),
  s('Attic — Winter', 'Active leakage'),
  s('Attic — Winter', 'Frost on the underside of the sheathing'),
  s('Attic — Winter', 'Condensation'),
  s('Attic — Winter', 'Rusting roofing nails', {
    help: 'Rusty nail points mean warm moist air is reaching the deck. It is a ventilation problem, not a roof problem.',
  }),
  s('Attic — Winter', 'Mould-like growth on sheathing'),
  s('Attic — Winter', 'Bath fan discharges outdoors, not into the attic'),
  s('Attic — Winter', 'Kitchen exhaust termination'),
  s('Attic — Winter', 'Dryer exhaust not terminating in the attic', {
    help: 'Common, serious, and a current-standard concern a buyer’s inspector will always write up.',
  }),
  s('Attic — Winter', 'Insulation coverage and depth'),
  s('Attic — Winter', 'Insulation gaps and compressed areas'),
  s('Attic — Winter', 'Air leakage at top plates, chases and can lights'),
  s('Attic — Winter', 'Soffit ventilation'),
  s('Attic — Winter', 'Blocked soffit vents', {
    help: 'Insulation stuffed into the soffits is the usual cause, and it bakes the roof in summer as well.',
  }),
  s('Attic — Winter', 'Ridge ventilation'),
  s('Attic — Winter', 'Rodent activity'),
  s('Attic — Winter', 'Roof framing movement'),
  s('Attic — Winter', 'Improper framing alterations', {
    help: 'Cut rafters and removed collar ties, usually from somebody running a duct or making storage space.',
  }),

  s('Freeze Protection', 'Exposed plumbing in unheated space'),
  s('Freeze Protection', 'Crawlspace pipes'),
  s('Freeze Protection', 'Garage plumbing'),
  s('Freeze Protection', 'Exterior hose bibs — hoses off, frost-free working'),
  s('Freeze Protection', 'Foundation penetrations sealed'),
  s('Freeze Protection', 'Door weather seals'),
  s('Freeze Protection', 'Window weather seals'),
  s('Freeze Protection', 'Pipe insulation intact'),

  s('Radon', 'Has this home ever been tested?', {
    help: 'Lancaster County averages 11.4 pCi/L against 1.3 nationally, and around 40% of PA homes tested exceed the EPA action level. Winter, with the house shut up, is the right time.',
  }),
  s('Radon', 'Record the date of the last test'),
  s('Radon', 'Mitigation system present and intact'),
  s('Radon', 'Manometer reading', {
    measure: { label: 'Manometer', unit: 'in. w.c.', low: 0.5, high: 2 },
    help: 'A level manometer means the fan has stopped. Nothing else in the house will tell anyone that.',
  }),
  s('Radon', 'Fan audibly running'),
  s('Radon', 'Mitigation piping undamaged and properly terminated'),
  s('Radon', 'Review the last mitigation system test'),
  s('Radon', 'Schedule a retest if due', {
    help: 'Even a mitigated home should be retested at least every two years.',
  }),
];

/* =====================================================================
 * Q2 — SPRING, April to June
 * Deep dive: water, roof, drainage, structure and exterior.
 *
 * The "what did winter do?" visit.
 * ===================================================================== */
export const Q2_ITEMS: ChecklistTemplateItem[] = [
  s('Roof', 'Full assessment — ground, binoculars or drone as appropriate', {
    help: 'If it is too steep or too fragile to walk, ladder the perimeter and fly it. Do not skip it and do not guess.',
  }),
  s('Roof', 'Shingle condition'),
  s('Roof', 'Lifted or missing tabs'),
  s('Roof', 'Nail pops'),
  s('Roof', 'Ridge'),
  s('Roof', 'Valleys'),
  s('Roof', 'Plumbing vent boots', {
    help: 'The commonest roof leak there is, and one of the cheapest fixes. Always look at these.',
  }),
  s('Roof', 'Chimney flashing'),
  s('Roof', 'Wall and step flashing'),
  s('Roof', 'Skylights'),
  s('Roof', 'Other roof penetrations'),
  s('Roof', 'Moss and algae'),
  s('Roof', 'Tree damage'),
  s('Roof', 'Visible sagging or deflection'),
  s('Roof', 'Gutter attachment'),
  s('Roof', 'Record approximate roof age'),
  s('Roof', 'Record replacement forecast', {
    help: 'A year band, not a date. It goes on the capital plan so a $14,000 roof is never a surprise.',
  }),

  s('Gutters & Drainage', 'Debris removed or cleaning scheduled'),
  s('Gutters & Drainage', 'Gutter pitch'),
  s('Gutters & Drainage', 'Leaking seams'),
  s('Gutters & Drainage', 'Loose hangers'),
  s('Gutters & Drainage', 'Downspouts secure and connected'),
  s('Gutters & Drainage', 'Underground drains flowing'),
  s('Gutters & Drainage', 'Discharge locations away from the foundation'),
  s('Gutters & Drainage', 'Splash blocks and extensions'),
  s('Gutters & Drainage', 'Ponding against the structure'),
  s('Gutters & Drainage', 'Soil settlement at the foundation'),
  s('Gutters & Drainage', 'Negative grade'),
  s('Gutters & Drainage', 'Erosion'),
  s('Gutters & Drainage', 'Window wells and their drains'),
  s('Gutters & Drainage', 'Foundation drainage generally'),

  s('Foundation & Structure', 'Foundation cracks — full exterior and interior pass'),
  s('Foundation & Structure', 'Compare against the previous crack photographs'),
  s('Foundation & Structure', 'Measure significant movement where practical'),
  s('Foundation & Structure', 'Bowing'),
  s('Foundation & Structure', 'Settlement'),
  s('Foundation & Structure', 'Masonry deterioration'),
  s('Foundation & Structure', 'Efflorescence'),
  s('Foundation & Structure', 'Basement moisture after spring rain'),
  s('Foundation & Structure', 'Crawlspace moisture after spring rain'),
  s('Foundation & Structure', 'Beam and post condition'),
  s('Foundation & Structure', 'Joists'),
  s('Foundation & Structure', 'Sill plates'),

  s('Sump System', 'Test the primary pump'),
  s('Sump System', 'Float switch'),
  s('Sump System', 'Check valve'),
  s('Sump System', 'Discharge line'),
  s('Sump System', 'Backup pump operation'),
  s('Sump System', 'Backup battery condition and age'),
  s('Sump System', 'High-water alarm'),
  s('Sump System', 'Exterior discharge location and termination'),

  s('Exterior Envelope', 'Siding'),
  s('Exterior Envelope', 'Brick'),
  s('Exterior Envelope', 'Stucco', {
    help: 'Window and door corners, kickouts and band joists. On hard-coat stucco from 1985–2005 the failure is invisible from outside — probe if anything reads wrong.',
  }),
  s('Exterior Envelope', 'Stone'),
  s('Exterior Envelope', 'Exterior trim'),
  s('Exterior Envelope', 'Rot'),
  s('Exterior Envelope', 'Failed caulk'),
  s('Exterior Envelope', 'Penetrations and sealant'),
  s('Exterior Envelope', 'Peeling paint'),
  s('Exterior Envelope', 'Window seals and failed insulated units'),
  s('Exterior Envelope', 'Door seals'),
  s('Exterior Envelope', 'Fascia'),
  s('Exterior Envelope', 'Soffit'),

  s('Deck & Porch', 'Ledger attachment and flashing', {
    help: 'Ledger attachment is what actually collapses decks. Look for lags or through-bolts, not nails, and for flashing over the ledger.',
  }),
  s('Deck & Porch', 'Posts — probe at grade', {
    help: 'Probe, do not look. A post that is sound at eye level can be gone at the ground.',
  }),
  s('Deck & Porch', 'Footings where visible'),
  s('Deck & Porch', 'Beams'),
  s('Deck & Porch', 'Joists and hangers'),
  s('Deck & Porch', 'Deck boards'),
  s('Deck & Porch', 'Rot'),
  s('Deck & Porch', 'Fasteners and corrosion'),
  s('Deck & Porch', 'Railings'),
  s('Deck & Porch', 'Guards and baluster spacing'),
  s('Deck & Porch', 'Stairs and stringers'),
  s('Deck & Porch', 'Handrails'),
  s('Deck & Porch', 'Lateral movement'),
  s('Deck & Porch', 'Loose components'),

  s('Pests & WDI', 'Mud tubes'),
  s('Pests & WDI', 'Carpenter ant activity'),
  s('Pests & WDI', 'Wood damage'),
  s('Pests & WDI', 'Frass'),
  s('Pests & WDI', 'Rodent entry points'),
  s('Pests & WDI', 'Bee and wasp nesting'),
  s('Pests & WDI', 'Wood-to-soil contact'),
  s('Pests & WDI', 'Mulch against siding'),
  s('Pests & WDI', 'Vegetation against the structure'),
  s('Pests & WDI', 'Recommend specialist WDI inspection where warranted'),

  s('Well', 'Well head condition', { only: WELL }),
  s('Well', 'Well cap sealed and secure', { only: WELL }),
  s('Well', 'Visible damage to casing', { only: WELL }),
  s('Well', 'Grading around the well head', { only: WELL }),
  s('Well', 'Standing water near the well', { only: WELL }),
  s('Well', 'Evidence of recent flooding', { only: WELL }),
  s('Well', 'Record water treatment equipment', { only: WELL }),
  s('Well', 'Review the previous water test', { only: WELL }),
  s('Well', 'Schedule the annual laboratory test', {
    only: WELL,
    help: 'PA DEP recommends annual total coliform, nitrates, total dissolved solids and pH. Use a PA-accredited lab. Pennsylvania regulates none of this, which is exactly why it is worth doing.',
  }),
  s('Well', 'Pressure tank charge and pump short-cycling', {
    only: WELL,
    help: 'Short-cycling means a waterlogged tank, and it burns out pumps.',
  }),

  s('Septic', 'Locate system records', { only: SEPTIC }),
  s('Septic', 'Record the previous inspection date', { only: SEPTIC }),
  s('Septic', 'Record the previous pumping date', {
    only: SEPTIC,
    help: 'PA DEP suggests pumping every three to five years depending on use and tank size. Put the date on the record either way.',
  }),
  s('Septic', 'Visible tank and risers', { only: SEPTIC }),
  s('Septic', 'Ground condition over the tank and field', { only: SEPTIC }),
  s('Septic', 'Wet areas over the drain field', { only: SEPTIC }),
  s('Septic', 'Sewage odour', { only: SEPTIC }),
  s('Septic', 'Abnormally lush vegetation over the field', { only: SEPTIC }),
  s('Septic', 'Encroachment on the drain field', { only: SEPTIC }),
  s('Septic', 'Trees and shrubs near the field', { only: SEPTIC }),
  s('Septic', 'Vehicle traffic over the system', { only: SEPTIC }),
  s('Septic', 'Sump and downspouts not discharging toward the field', { only: SEPTIC }),
];

/* =====================================================================
 * Q3 — SUMMER, July to September
 * Deep dive: cooling, plumbing, kitchens, bathrooms and high-water-use.
 *
 * The interior systems visit. It is also the one that quietly supports
 * the remodelling side of the business — every bathroom gets looked at
 * properly once a year — without the visit turning into a sales call.
 * ===================================================================== */
export const Q3_ITEMS: ChecklistTemplateItem[] = [
  s('Air Conditioning', 'Condenser condition'),
  s('Air Conditioning', 'Coil cleanliness where visible'),
  s('Air Conditioning', 'Vegetation clearance — two feet all round'),
  s('Air Conditioning', 'Electrical disconnect condition'),
  s('Air Conditioning', 'Line-set insulation intact', {
    help: 'Missing line-set insulation is free efficiency, lost permanently until somebody replaces it.',
  }),
  s('Air Conditioning', 'Condensate piping'),
  s('Air Conditioning', 'Condensate pump'),
  s('Air Conditioning', 'Drain pan free of standing water'),
  s('Air Conditioning', 'Filter'),
  s('Air Conditioning', 'Supply and return airflow room by room'),
  s('Air Conditioning', 'Unusual vibration or noise'),
  s('Air Conditioning', 'Thermostat and cooling schedule'),
  s('Air Conditioning', 'Visible duct leakage'),
  s('Air Conditioning', 'Attic duct sweating'),
  s('Air Conditioning', 'Temperature split across the coil', {
    measure: { label: 'Temperature split', unit: '°F', low: 15, high: 22 },
    help: 'Supply minus return, once it has run 15 minutes. Record it — a split falling year over year is a charge or airflow problem months before the member notices.',
  }),
  s('Air Conditioning', 'Compressor amp draw against the nameplate', {
    measure: { label: 'Compressor amps', unit: 'A' },
    help: 'Write the nameplate RLA in the note. Rising amps is a compressor on the way out, and nothing else shows it.',
  }),
  s('Air Conditioning', 'Indoor relative humidity with the system running', {
    measure: { label: 'Indoor humidity', unit: '%', low: 35, high: 55 },
  }),

  s('Bathrooms', 'Toilet secured to the floor — every bathroom'),
  s('Bathrooms', 'Toilet leakage at base and tank'),
  s('Bathrooms', 'Toilet supply line'),
  s('Bathrooms', 'Toilet shutoff valve operates'),
  s('Bathrooms', 'Vanity supply lines'),
  s('Bathrooms', 'Vanity drain and trap'),
  s('Bathrooms', 'Sink seal at the countertop'),
  s('Bathrooms', 'Tub condition'),
  s('Bathrooms', 'Shower condition'),
  s('Bathrooms', 'Shower pan concerns'),
  s('Bathrooms', 'Grout'),
  s('Bathrooms', 'Caulking at joints and corners'),
  s('Bathrooms', 'Shower glass and hardware'),
  s('Bathrooms', 'Shower door seals'),
  s('Bathrooms', 'Valve operation and temperature'),
  s('Bathrooms', 'Drain speed'),
  s('Bathrooms', 'Flooring'),
  s('Bathrooms', 'Baseboards'),
  s('Bathrooms', 'Moisture at walls and floors'),
  s('Bathrooms', 'Exhaust fan operation'),
  s('Bathrooms', 'Exhaust fan discharges outdoors where observable', {
    help: 'A bath fan dumping into the attic is a current-standard concern and a mould problem. Confirm it at the soffit or roof.',
  }),
  s('Bathrooms', 'GFCI protection'),
  s('Bathrooms', 'Lighting'),
  s('Bathrooms', 'Visible electrical concerns'),

  s('Kitchen', 'Sink'),
  s('Kitchen', 'Faucet'),
  s('Kitchen', 'Shutoff valves operate'),
  s('Kitchen', 'Supply lines'),
  s('Kitchen', 'Drain and trap'),
  s('Kitchen', 'Garbage disposal'),
  s('Kitchen', 'Dishwasher supply'),
  s('Kitchen', 'Dishwasher drain and high loop or air gap'),
  s('Kitchen', 'Dishwasher leakage'),
  s('Kitchen', 'Refrigerator water line', {
    help: 'Plastic push-fit lines behind a fridge nobody moves. A classic slow flood.',
  }),
  s('Kitchen', 'Icemaker'),
  s('Kitchen', 'Range operation'),
  s('Kitchen', 'Range anti-tip bracket', {
    help: 'A child-safety item, missing on most ranges, and a buyer’s inspector writes it up every time.',
  }),
  s('Kitchen', 'Gas connector condition', { only: BURNS_FUEL }),
  s('Kitchen', 'Hood operation'),
  s('Kitchen', 'Hood exhaust termination where observable'),
  s('Kitchen', 'Cabinets below plumbing'),
  s('Kitchen', 'Countertop seams'),
  s('Kitchen', 'Backsplash and caulking'),
  s('Kitchen', 'GFCI protection'),
  s('Kitchen', 'Visible electrical concerns'),

  s('Laundry', 'Washer valves'),
  s('Laundry', 'Washer hoses'),
  s('Laundry', 'Hose deterioration and age', {
    help: 'Rubber is a five-year part. Braided stainless is about $20 and ends the problem for good.',
  }),
  s('Laundry', 'Drain and standpipe'),
  s('Laundry', 'Drain pan where present'),
  s('Laundry', 'Dryer connection'),
  s('Laundry', 'Dryer duct condition'),
  s('Laundry', 'Excessive lint in the run', {
    help: 'Failure to clean causes about a third of dryer fires, and those fires cause half the dryer fire deaths.',
  }),
  s('Laundry', 'Crushed ducting behind the dryer'),
  s('Laundry', 'Plastic or foil flexible duct in use', {
    help: 'Current-standard concern. Rigid or semi-rigid metal is what should be there.',
  }),
  s('Laundry', 'Exterior termination'),
  s('Laundry', 'Exterior flap opens and closes'),
  s('Laundry', 'Moisture build-up in the laundry area'),
  s('Laundry', 'Electrical or gas connection condition'),

  s('Interior', 'Doors'),
  s('Interior', 'Windows'),
  s('Interior', 'Locks and latches'),
  s('Interior', 'Flooring'),
  s('Interior', 'Loose transitions'),
  s('Interior', 'Drywall cracks', {
    help: 'Photograph anything stair-stepped or over a door. In karst country that is the early tell of movement.',
  }),
  s('Interior', 'Ceiling staining'),
  s('Interior', 'Wall staining'),
  s('Interior', 'Windowsill moisture'),
  s('Interior', 'Condensation'),
  s('Interior', 'Stairways'),
  s('Interior', 'Interior handrails'),
  s('Interior', 'Interior guardrails'),
  s('Interior', 'Ventilation generally'),
  s('Interior', 'Musty odours'),
  s('Interior', 'Visible pest evidence'),

  s('Storm Check', 'Roof damage indications'),
  s('Storm Check', 'Trees and limbs over the structure'),
  s('Storm Check', 'Gutters after summer storms'),
  s('Storm Check', 'Downspouts'),
  s('Storm Check', 'Basement leakage after heavy rain'),
  s('Storm Check', 'Window wells'),
  s('Storm Check', 'Sump activity'),
  s('Storm Check', 'Soil erosion'),
  s('Storm Check', 'Exterior penetrations'),

  s('Septic', 'Surfacing or odour after heavy summer use', { only: SEPTIC }),
];

/* =====================================================================
 * Q4 — FALL, October to December
 * Deep dive: winterisation, plus the annual Market-Ready audit.
 *
 * The largest report of the year, and the one that makes the membership
 * worth more than the sum of the visits. Everything below the
 * winterisation section exists to answer one question years early:
 * "what will a buyer's inspector find, and what will I have to disclose?"
 * ===================================================================== */
export const Q4_ITEMS: ChecklistTemplateItem[] = [
  s('Winter Prep', 'Heating system readiness'),
  s('Winter Prep', 'Filter replaced'),
  s('Winter Prep', 'Thermostat and heating schedule set'),
  s('Winter Prep', 'Furnace or boiler leak inspection'),
  s('Winter Prep', 'Flue', { only: BURNS_FUEL }),
  s('Winter Prep', 'Gas lines visually', { only: BURNS_FUEL }),
  s('Winter Prep', 'Exterior heat pump clearance before snow'),
  s('Winter Prep', 'Humidifier serviced and damper opened'),
  s('Winter Prep', 'Hose bibs'),
  s('Winter Prep', 'Hoses removed', {
    help: 'A hose left on a frost-free sillcock defeats it completely. The single commonest burst pipe there is.',
  }),
  s('Winter Prep', 'Frost-free hose bib condition'),
  s('Winter Prep', 'Irrigation winterised'),
  s('Winter Prep', 'Crawlspace freeze protection'),
  s('Winter Prep', 'Garage plumbing protection'),
  s('Winter Prep', 'Exterior penetrations sealed'),
  s('Winter Prep', 'Door weatherstripping'),
  s('Winter Prep', 'Window weatherstripping'),
  s('Winter Prep', 'Propane tank level before the cold', {
    only: PROPANE,
    measure: { label: 'Propane level', unit: '%', low: 30 },
    help: 'Tell them the number. A run-out in January needs a leak test before it will relight.',
  }),
  s('Winter Prep', 'Oil tank level, filter and line before the cold', { only: OIL }),

  s('Roof Before Winter', 'Shingles'),
  s('Roof Before Winter', 'Flashing'),
  s('Roof Before Winter', 'Plumbing boots'),
  s('Roof Before Winter', 'Chimney'),
  s('Roof Before Winter', 'Gutters cleaned after leaf drop'),
  s('Roof Before Winter', 'Downspouts flowing'),
  s('Roof Before Winter', 'Debris removed from valleys and behind the chimney'),
  s('Roof Before Winter', 'Trees overhanging the roof'),
  s('Roof Before Winter', 'Fascia'),
  s('Roof Before Winter', 'Soffits'),

  s('Fire & CO Annual', 'Every smoke alarm tested'),
  s('Fire & CO Annual', 'Every CO alarm tested'),
  s('Fire & CO Annual', 'Every manufacture date recorded', {
    help: 'Ten years for smoke, seven to ten for CO. This is the annual audit — get every one of them.',
  }),
  s('Fire & CO Annual', 'Batteries replaced'),
  s('Fire & CO Annual', 'Interconnection works where applicable', {
    help: 'Press and hold one. They should all sound. If they do not, coverage is worse than it looks.',
  }),
  s('Fire & CO Annual', 'Fire extinguishers serviced or replaced'),
  s('Fire & CO Annual', 'Furnace surroundings clear'),
  s('Fire & CO Annual', 'Fireplace surroundings clear'),
  s('Fire & CO Annual', 'Space heater use and placement'),
  s('Fire & CO Annual', 'Combustible storage'),
  s('Fire & CO Annual', 'Extension cord use'),
  s('Fire & CO Annual', 'Holiday lighting risks'),

  s('Attic Annual', 'Roof sheathing'),
  s('Attic Annual', 'Moisture'),
  s('Attic Annual', 'Ventilation'),
  s('Attic Annual', 'Insulation depth', {
    measure: { label: 'Insulation depth', unit: 'in', low: 14 },
    help: 'Measure it in three places and record the lowest. R-49 is roughly 14–16 inches of blown fibreglass.',
  }),
  s('Attic Annual', 'Air leakage'),
  s('Attic Annual', 'Exhaust ducts terminate outdoors'),
  s('Attic Annual', 'Rodent evidence'),
  s('Attic Annual', 'Electrical in the attic'),
  s('Attic Annual', 'Framing'),
  s('Attic Annual', 'Roof leakage'),

  // ---- The annual audit. This is the part no inspector can ever do.
  s('Market Ready — Systems', 'Roof age and replacement forecast'),
  s('Market Ready — Systems', 'Furnace age'),
  s('Market Ready — Systems', 'A/C age'),
  s('Market Ready — Systems', 'Boiler age', { only: BURNS_FUEL }),
  s('Market Ready — Systems', 'Water heater age'),
  s('Market Ready — Systems', 'Electrical panel make, size and condition'),
  s('Market Ready — Systems', 'Well information', { only: WELL }),
  s('Market Ready — Systems', 'Septic information', { only: SEPTIC }),
  s('Market Ready — Systems', 'Radon system and test history'),
  s('Market Ready — Systems', 'Water treatment equipment'),
  s('Market Ready — Systems', 'Sump pumps and backup'),
  s('Market Ready — Systems', 'Appliances'),
  s('Market Ready — Systems', 'Windows'),
  s('Market Ready — Systems', 'Exterior siding'),
  s('Market Ready — Systems', 'Deck'),
  s('Market Ready — Systems', 'Major renovations recorded'),

  s('Market Ready — Records', 'Every repair this year has a date and contractor'),
  s('Market Ready — Records', 'Description recorded'),
  s('Market Ready — Records', 'Photographs attached'),
  s('Market Ready — Records', 'Invoice attached'),
  s('Market Ready — Records', 'Warranty recorded'),
  s('Market Ready — Records', 'Permit attached where one was required'),
  s('Market Ready — Records', 'Inspection approval attached where applicable', {
    help: 'This bundle is the whole resale argument. Sixteen quarterly reports and a paper trail beats any pre-listing inspection.',
  }),

  // ---- Reverse-engineering the seller disclosure, years early.
  s('Seller Disclosure Review', 'Roof', {
    help: 'These seventeen mirror the categories PA’s Seller Disclosure Law asks a seller about. We are answering them years before the house is listed.',
  }),
  s('Seller Disclosure Review', 'Basement and crawlspace'),
  s('Seller Disclosure Review', 'Termites, WDI, pests and dry rot'),
  s('Seller Disclosure Review', 'Structural concerns'),
  s('Seller Disclosure Review', 'Additions and remodelling'),
  s('Seller Disclosure Review', 'Water system'),
  s('Seller Disclosure Review', 'Sewer or septic'),
  s('Seller Disclosure Review', 'Plumbing'),
  s('Seller Disclosure Review', 'Heating'),
  s('Seller Disclosure Review', 'Cooling'),
  s('Seller Disclosure Review', 'Electrical'),
  s('Seller Disclosure Review', 'Appliances and equipment'),
  s('Seller Disclosure Review', 'Soil and drainage'),
  s('Seller Disclosure Review', 'Sinkholes', {
    help: 'A named category in PA law, and a real one here. Karst limestone under most of the county.',
  }),
  s('Seller Disclosure Review', 'Hazardous materials'),
  s('Seller Disclosure Review', 'Stormwater facilities'),
  s('Seller Disclosure Review', 'Any other known material defect'),

  // ---- Not code violations. Things a buyer's inspector will raise.
  s('Marketability Watch', 'Missing GFCI protection', {
    help: 'This whole section is written as "current-standard concern", never as a code violation. PA’s UCC adopts the 2021 IRC and 2020 NEC from 1 Jan 2026, municipalities enforce it, and most existing conditions are lawfully grandfathered. We flag what a buyer’s inspector will raise; the municipality and the trade make code calls.',
  }),
  s('Marketability Watch', 'Missing or ageing smoke protection'),
  s('Marketability Watch', 'Missing or ageing CO protection'),
  s('Marketability Watch', 'Electrical panel concerns'),
  s('Marketability Watch', 'Uncovered junction boxes'),
  s('Marketability Watch', 'Unsafe wiring'),
  s('Marketability Watch', 'Stair handrails'),
  s('Marketability Watch', 'Guardrails'),
  s('Marketability Watch', 'Deck safety'),
  s('Marketability Watch', 'Bedroom egress'),
  s('Marketability Watch', 'Garage to house separation'),
  s('Marketability Watch', 'Garage door safety sensors'),
  s('Marketability Watch', 'Dryer vent installation'),
  s('Marketability Watch', 'Bath ventilation'),
  s('Marketability Watch', 'Kitchen ventilation'),
  s('Marketability Watch', 'Water heater installation'),
  s('Marketability Watch', 'TPR discharge'),
  s('Marketability Watch', 'Combustion venting', { only: BURNS_FUEL }),
  s('Marketability Watch', 'Improper plumbing traps'),
  s('Marketability Watch', 'Active leaks'),
  s('Marketability Watch', 'Improper drainage'),
  s('Marketability Watch', 'Negative grading'),
  s('Marketability Watch', 'Sump discharge'),
  s('Marketability Watch', 'Roof nearing end of life'),
  s('Marketability Watch', 'Foundation movement'),
  s('Marketability Watch', 'Mould or moisture'),
  s('Marketability Watch', 'WDI evidence'),
  s('Marketability Watch', 'Radon history'),
  s('Marketability Watch', 'Well water records', { only: WELL }),
  s('Marketability Watch', 'Septic records', { only: SEPTIC }),
  s('Marketability Watch', 'Renovations that look unpermitted'),
  s('Marketability Watch', 'Missing repair documentation'),
];
