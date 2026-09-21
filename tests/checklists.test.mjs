/**
 * B&M's quarterly program, checked.
 *
 *   npm test
 *
 * What this guards is mostly silent failure. Nobody notices a check that
 * was never offered — a septic item that never appears on a septic house
 * looks exactly like a septic house with no problems. Same for a core
 * item that quietly stops being core, or a measurement with no unit.
 */
import {
  CHECKLIST_TEMPLATES, CORE_ITEMS, QUARTERS,
  appliesToProperty, itemsFor, itemCountFor,
} from '@/lib/checklist-templates';

let failed = 0;
const ok = (name, cond) => {
  if (cond) console.log('ok   ', name);
  else { console.log('FAIL:', name); failed++; }
};

const HOMES = {
  publicGas:    { water_source: 'PUBLIC', sewer_type: 'PUBLIC', heating_fuel: 'NATURAL_GAS' },
  ruralPropane: { water_source: 'WELL',   sewer_type: 'SEPTIC', heating_fuel: 'PROPANE' },
  allElectric:  { water_source: 'PUBLIC', sewer_type: 'PUBLIC', heating_fuel: 'ELECTRIC' },
  oilHome:      { water_source: 'PUBLIC', sewer_type: 'PUBLIC', heating_fuel: 'OIL' },
  unknown:      { water_source: null,     sewer_type: null,     heating_fuel: null },
};

const forHouse = (quarter, facts) =>
  itemsFor(quarter).filter((i) => appliesToProperty(i, facts));
const has = (quarter, facts, needle) =>
  forHouse(quarter, facts).some((i) => i.label.toLowerCase().includes(needle.toLowerCase()));

// ---------------------------------------------------------------- core
ok('there is a core list', CORE_ITEMS.length > 100);
ok('every core item is flagged core', CORE_ITEMS.every((i) => i.core === true));
ok('no seasonal item is flagged core',
   QUARTERS.every((q) => CHECKLIST_TEMPLATES[q].items.every((i) => !i.core)));

for (const q of QUARTERS) {
  const labels = new Set(itemsFor(q).map((i) => `${i.category}||${i.label}`));
  ok(`${q} contains the whole core list`,
     CORE_ITEMS.every((c) => labels.has(`${c.category}||${c.label}`)));
}

ok('core comes before the season', itemsFor('Q1')[0].core === true);

// The safety net has to be on every visit, on every house.
for (const [name, facts] of Object.entries(HOMES)) {
  for (const q of QUARTERS) {
    const items = forHouse(q, facts);
    ok(`${q}/${name}: smoke alarms tested`,
       items.some((i) => i.label.includes('smoke alarm')));
    ok(`${q}/${name}: water leak section present`,
       items.some((i) => i.category === 'Water Leaks'));
  }
}

// ------------------------------------------------------- house matching
ok('propane home gets its tank check', has('Q4', HOMES.ruralPropane, 'Propane tank level'));
ok('gas home does not get the propane tank check', !has('Q4', HOMES.publicGas, 'Propane tank level'));
ok('oil home gets its tank check', has('Q4', HOMES.oilHome, 'Oil tank level'));
ok('all-electric gets neither fuel tank check',
   !has('Q4', HOMES.allElectric, 'Propane tank level') && !has('Q4', HOMES.allElectric, 'Oil tank level'));

ok('all-electric skips flue CO', !has('Q1', HOMES.allElectric, 'Flue carbon monoxide'));
ok('gas home gets flue CO', has('Q1', HOMES.publicGas, 'Flue carbon monoxide'));

ok('septic home gets the drain field check',
   forHouse('Q2', HOMES.ruralPropane).some((i) => i.category === 'Septic'));
ok('public sewer gets no septic section',
   !forHouse('Q2', HOMES.publicGas).some((i) => i.category === 'Septic'));

ok('well home gets the annual lab test',
   has('Q2', HOMES.ruralPropane, 'annual laboratory test'));
ok('public water gets no well section',
   !forHouse('Q2', HOMES.publicGas).some((i) => i.category === 'Well'));

ok('unrecorded facts keep every item',
   QUARTERS.every((q) => forHouse(q, HOMES.unknown).length === itemsFor(q).length));
ok('null facts keep every item', forHouse('Q1', null).length === itemsFor('Q1').length);

// ------------------------------------------------------------ hygiene
for (const q of QUARTERS) {
  const items = itemsFor(q);
  ok(`${q} every item has a category and a label`,
     items.every((i) => i.category?.trim() && i.label?.trim()));

  // The same label in two categories is fine and intended — "Shingles"
  // appears under Roof and under Roof Before Winter. The same label in
  // the SAME category is a copy-paste mistake.
  const pairs = items.map((i) => `${i.category}||${i.label}`);
  const dupes = pairs.filter((p, n) => pairs.indexOf(p) !== n);
  ok(`${q} no duplicate item within a category${dupes.length ? ` (${dupes[0]})` : ''}`,
     dupes.length === 0);

  ok(`${q} is a substantial visit for every house type`,
     Object.values(HOMES).every((f) => itemCountFor(q, f) >= 200));
}

// -------------------------------------------------------- measurements
const measured = QUARTERS.flatMap((q) => itemsFor(q)).filter((i) => i.measure);
ok('there are measurement items', measured.length >= 8);
ok('every measurement has a label and a unit',
   measured.every((i) => i.measure.label?.trim() && i.measure.unit?.trim()));
ok('every measurement band is the right way round',
   measured.every((i) => {
     const { low, high } = i.measure;
     return low == null || high == null || low <= high;
   }));
ok('every measurement item is otherwise a normal item',
   measured.every((i) => i.category?.trim() && i.label?.trim()));

// ------------------------------------------------- the "only" rules
const WATER = ['PUBLIC', 'WELL', 'SHARED_WELL', 'OTHER'];
const SEWER = ['PUBLIC', 'SEPTIC', 'MOUND', 'OTHER'];
const FUEL = ['NATURAL_GAS', 'PROPANE', 'OIL', 'ELECTRIC', 'HEAT_PUMP', 'OTHER'];
const allItems = [...CORE_ITEMS, ...QUARTERS.flatMap((q) => CHECKLIST_TEMPLATES[q].items)];
ok('every "only" rule uses real values',
   allItems.every((i) => {
     const o = i.only;
     if (!o) return true;
     return (o.waterSource ?? []).every((v) => WATER.includes(v))
         && (o.sewerType ?? []).every((v) => SEWER.includes(v))
         && (o.heatingFuel ?? []).every((v) => FUEL.includes(v));
   }));
ok('no "only" rule is an empty array that would hide nothing',
   allItems.every((i) => {
     const o = i.only;
     if (!o) return true;
     return Object.values(o).every((v) => Array.isArray(v) && v.length > 0);
   }));

// ------------------------------------------------------------- quarters
for (const q of QUARTERS) {
  const t = CHECKLIST_TEMPLATES[q];
  ok(`${q} has a name, season, months and focus`,
     [t.name, t.season, t.months, t.focus].every((v) => v?.trim()));
  ok(`${q} has its own deep dive`, t.items.length >= 50);
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed ? 1 : 0);
