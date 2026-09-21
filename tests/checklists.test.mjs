/**
 * The seasonal lists, checked.
 *
 * Run it with:  node --experimental-strip-types tests/checklists.test.mjs
 *
 * What it is guarding: which items a given house gets. A propane item on an
 * all-electric home is noise, and a septic check that never appears on a
 * septic home is a miss. Both are silent failures — nobody notices a check
 * that was never offered — so they are worth a test even though the rest of
 * the repo does not have any yet.
 */
import { CHECKLIST_TEMPLATES, appliesToProperty } from '../lib/checklist-templates.ts';

let fail = 0;
const ok = (name, cond) => { if (!cond) { console.log('FAIL:', name); fail++; } else console.log('ok  ', name); };

const q1 = CHECKLIST_TEMPLATES.Q1.items;
const q2 = CHECKLIST_TEMPLATES.Q2.items;
const count = (items, facts) => items.filter((i) => appliesToProperty(i, facts)).length;

const publicGas   = { water_source: 'PUBLIC', sewer_type: 'PUBLIC', heating_fuel: 'NATURAL_GAS' };
const ruralPropane= { water_source: 'WELL',   sewer_type: 'SEPTIC', heating_fuel: 'PROPANE' };
const allElectric = { water_source: 'PUBLIC', sewer_type: 'PUBLIC', heating_fuel: 'ELECTRIC' };
const unknown     = { water_source: null,     sewer_type: null,     heating_fuel: null };

const has = (items, facts, needle) =>
  items.filter((i) => appliesToProperty(i, facts)).some((i) => i.label.includes(needle));

ok('propane home gets the propane tank item',   has(q1, ruralPropane, 'Propane tank gauge'));
ok('gas home does NOT get the propane item',   !has(q1, publicGas,    'Propane tank gauge'));
ok('gas home does NOT get the oil item',       !has(q1, publicGas,    'Oil tank level'));
ok('electric home gets neither fuel item',     !has(q1, allElectric,  'Propane tank gauge') && !has(q1, allElectric, 'Oil tank level'));
ok('septic home gets the septic item',          has(q2, ruralPropane, 'Septic — drain field'));
ok('public sewer does NOT get septic',         !has(q2, publicGas,    'Septic — drain field'));
ok('well home gets the well item',              has(q2, ruralPropane, 'Well — pressure tank'));
ok('public water does NOT get the well item',  !has(q2, publicGas,    'Well — pressure tank'));

// An unrecorded house keeps everything — better a "not applicable" tick
// than a check silently never offered.
ok('unknown facts keep every item', count(q1, unknown) === q1.length && count(q2, unknown) === q2.length);
ok('null facts object keeps every item', count(q1, null) === q1.length);

// Nothing should be filtered down to a stub.
for (const [q, t] of Object.entries(CHECKLIST_TEMPLATES)) {
  for (const [name, f] of [['public gas', publicGas], ['rural propane', ruralPropane], ['all electric', allElectric]]) {
    const n = count(t.items, f);
    ok(`${q} has >= 15 items for a ${name} home (${n})`, n >= 15);
  }
}

// Every item has a category and a label, and no duplicate labels in a quarter.
for (const [q, t] of Object.entries(CHECKLIST_TEMPLATES)) {
  ok(`${q} every item has category + label`, t.items.every((i) => i.category?.trim() && i.label?.trim()));
  ok(`${q} no duplicate labels`, new Set(t.items.map((i) => i.label)).size === t.items.length);
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail ? 1 : 0);
