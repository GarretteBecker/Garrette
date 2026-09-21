/**
 * Fixture data for the no-login sales demo at /demo.
 *
 * This mirrors supabase/seed.sql (the Miller Home) closely enough to look
 * real on a phone at a kitchen table. It is entirely fictional and touches
 * no database — /demo renders the SAME components the live portal uses, so
 * what a prospect sees is what a member gets.
 *
 * Dates are computed relative to "now" so the demo never goes stale: the
 * next visit is always a few weeks out, the last visit always recent.
 */

import type { PortalData } from './portal';
import type {
  Asset, ChecklistItem, Finding, PlanItem, PriorityLevel, Room,
  ServiceRequestStage, Visit,
} from '@/lib/types/database';
import type { StatusEvent } from '@/components/member/request-status';
import type { Agreement } from '@/lib/agreements';
import type { SafetyPoint } from '@/lib/emergency';
import { itemsFor, type Quarter } from '@/lib/checklist-templates';

const PROPERTY_ID = 'demo-property';

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Same, but pinned to a sensible appointment slot rather than "now". */
function daysFromNowAt(n: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function room(id: string, name: string, type: string, floor: string, order: number): Room {
  return {
    id, property_id: PROPERTY_ID, name, room_type: type, floor,
    notes: null, sort_order: order,
  };
}

const ROOMS: Room[] = [
  room('r1', 'Kitchen', 'Kitchen', 'Main', 10),
  room('r2', 'Primary Bathroom', 'Bathroom', 'Upper', 20),
  room('r3', 'Hall Bathroom', 'Bathroom', 'Upper', 30),
  room('r4', 'Powder Room', 'Bathroom', 'Main', 40),
  room('r5', 'Laundry Room', 'Utility', 'Main', 50),
  room('r6', 'Basement', 'Basement', 'Lower', 60),
  room('r7', 'Garage', 'Garage', 'Main', 70),
  room('r8', 'Attic', 'Attic', 'Attic', 80),
  room('r9', 'Exterior', 'Exterior', 'Exterior', 90),
];

interface AssetSeed {
  id: string; roomId: string | null; category: string; name: string;
  make?: string; model?: string; serial?: string; finish?: string;
  installed?: string; warranty?: string; life?: number;
  condition?: Asset['condition']; serviced?: string; where?: string; notes?: string;
}

function asset(s: AssetSeed): Asset {
  return {
    id: s.id,
    property_id: PROPERTY_ID,
    room_id: s.roomId,
    category: s.category,
    name: s.name,
    manufacturer: s.make ?? null,
    model: s.model ?? null,
    serial_number: s.serial ?? null,
    finish: s.finish ?? null,
    install_date: s.installed ?? null,
    warranty_expires: s.warranty ?? null,
    expected_life_years: s.life ?? null,
    condition: s.condition ?? 'GOOD',
    last_serviced_at: s.serviced ?? null,
    location_notes: s.where ?? null,
    notes: s.notes ?? null,
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
  };
}

const ASSETS: Asset[] = [
  asset({ id: 'a1', roomId: 'r1', category: 'Plumbing Fixture', name: 'Kitchen Faucet',
    make: 'Delta', model: 'Trinsic 9159-AR-DST', serial: 'DL-9159-114277',
    finish: 'Arctic Stainless', installed: '2021-06-18', warranty: '2099-12-31', life: 15,
    where: 'Kitchen sink', notes: 'Delta lifetime limited warranty on finish and function. Pull-down magnetic docking spray.' }),
  asset({ id: 'a2', roomId: 'r2', category: 'Plumbing Fixture', name: 'Primary Bath Faucet — Left Vanity',
    make: 'Delta', model: 'Trinsic 559LF-SS', serial: 'DL-559-208841', finish: 'Stainless',
    installed: '2022-04-02', warranty: '2099-12-31', life: 15, where: 'Left basin, double vanity' }),
  asset({ id: 'a3', roomId: 'r2', category: 'Plumbing Fixture', name: 'Primary Bath Faucet — Right Vanity',
    make: 'Delta', model: 'Trinsic 559LF-SS', serial: 'DL-559-208842', finish: 'Stainless',
    installed: '2022-04-02', warranty: '2099-12-31', life: 15, where: 'Right basin, double vanity' }),
  asset({ id: 'a4', roomId: 'r2', category: 'Shower System', name: 'Onyx Shower Base & Surround',
    make: 'Onyx Collection', model: 'Custom 60x36 Base + 3-Panel Surround', serial: 'ONX-2022-04117',
    finish: 'Bone / Matrix pattern', installed: '2022-04-02', warranty: '2037-04-02', life: 30,
    serviced: '2026-09-08', where: 'Primary bathroom',
    notes: 'Cast-to-order onyx. Clean with non-abrasive only — no bleach or scouring pads. That is what voids the finish warranty.' }),
  asset({ id: 'a5', roomId: 'r2', category: 'Plumbing Fixture', name: 'Shower Valve & Trim',
    make: 'Delta', model: 'Trinsic T17T259-SS TempAssure 17T', serial: 'DL-17T-556120',
    finish: 'Stainless', installed: '2022-04-02', warranty: '2099-12-31', life: 20,
    where: 'Primary shower', notes: 'Thermostatic valve with integrated volume control.' }),
  asset({ id: 'a6', roomId: 'r3', category: 'Plumbing Fixture', name: 'Hall Bath Toilet',
    make: 'American Standard', model: 'Cadet 3 215AA.104', serial: 'AS-215-904471',
    installed: '2019-08-20', life: 25, condition: 'FAIR', where: 'Hall bathroom',
    notes: 'Flapper replaced 2025. Running intermittently — on the plan.' }),
  asset({ id: 'a7', roomId: 'r4', category: 'Plumbing Fixture', name: 'Powder Room Toilet',
    make: 'Kohler', model: 'Wellworth K-3987', serial: 'KH-3987-22841',
    installed: '1998-05-01', life: 25, condition: 'FAIR', where: 'Powder room',
    notes: 'Original to the house. Nearing the end of its expected service life.' }),
  asset({ id: 'a8', roomId: 'r6', category: 'Water Heater', name: 'Gas Water Heater — 50 gal',
    make: 'Bradford White', model: 'RG250T6N', serial: 'BW-RG250-FE4471928',
    installed: '2019-11-07', warranty: '2025-11-07', life: 12, condition: 'FAIR',
    serviced: '2026-09-08', where: 'Basement, northeast corner',
    notes: '50 gallon atmospheric vent, natural gas. Anode rod has never been replaced.' }),
  asset({ id: 'a9', roomId: 'r6', category: 'HVAC', name: 'Gas Furnace',
    make: 'Carrier', model: 'Infinity 59TN6A080V17--14', serial: 'CR-59TN-4218H09412',
    installed: '2014-10-02', warranty: '2024-10-02', life: 20, serviced: '2026-09-08',
    where: 'Basement mechanical area',
    notes: '80,000 BTU, 96% AFUE two-stage. Filter size 16x25x5 — handy to know when you buy them.' }),
  asset({ id: 'a10', roomId: 'r9', category: 'HVAC', name: 'A/C Condenser — 3 ton',
    make: 'Carrier', model: '24ANB136A003', serial: 'CR-24ANB-3814W22087',
    installed: '2014-10-02', warranty: '2024-10-02', life: 15, condition: 'FAIR',
    serviced: '2026-04-14', where: 'Exterior, east side pad' }),
  asset({ id: 'a11', roomId: 'r6', category: 'HVAC', name: 'Whole-House Humidifier',
    make: 'Aprilaire', model: '700M', serial: 'AP-700-1190338', installed: '2014-10-02',
    life: 15, serviced: '2026-09-08', where: 'Furnace supply plenum',
    notes: 'Water panel changed each fall visit.' }),
  // Relative to today so warranty watch is never dead on the demo home —
  // fixed dates go stale, and a feature that looks broken in a sales demo
  // may as well not exist.
  asset({ id: 'a12', roomId: null, category: 'HVAC', name: 'Smart Thermostat',
    make: 'ecobee', model: 'Smart Thermostat Premium EB-STATE6', serial: 'EB-STATE6-1192840',
    installed: '2023-02-14', warranty: daysFromNow(58).slice(0, 10), life: 10,
    where: 'Living room, interior wall', notes: 'Remote sensor in the primary bedroom.' }),
  asset({ id: 'a13', roomId: 'r6', category: 'Electrical', name: 'Main Electrical Panel — 200A',
    make: 'Square D', model: 'QO140M200 Homeline 200A', serial: 'SQ-QO140-9928471',
    installed: '1998-05-01', life: 40, serviced: '2026-04-14', where: 'Basement, south wall',
    notes: '200 amp service, 40 space. Six open breaker positions.' }),
  asset({ id: 'a14', roomId: 'r6', category: 'Plumbing', name: 'Sump Pump',
    make: 'Zoeller', model: 'M53 Mighty-Mate 1/3 HP', serial: 'ZL-M53-772019',
    installed: '2021-03-22', warranty: '2024-03-22', life: 10, serviced: '2026-04-14',
    where: 'Basement, northwest pit', notes: 'Cast iron 1/3 HP. No battery backup yet.' }),
  asset({ id: 'a15', roomId: 'r6', category: 'Plumbing', name: 'Main Water Shutoff',
    model: 'Ball valve, 1 in.', installed: '1998-05-01', life: 40,
    where: 'Basement, north wall where the service enters',
    notes: 'IMPORTANT: this is the valve to close in a plumbing emergency. Turns clockwise.' }),
  asset({ id: 'a16', roomId: 'r6', category: 'Plumbing', name: 'Water Softener',
    make: 'Culligan', model: 'HE Twin 1.5', serial: 'CU-HET-4429183',
    installed: '2020-07-15', warranty: daysFromNow(112).slice(0, 10), life: 15, serviced: '2026-09-08',
    where: 'Basement, beside the water entry' }),
  asset({ id: 'a17', roomId: 'r1', category: 'Appliance', name: 'Dishwasher',
    make: 'Bosch', model: '800 Series SHPM88Z75N', serial: 'BS-SHPM-FD9812774',
    finish: 'Stainless', installed: '2021-06-18', warranty: '2023-06-18', life: 12,
    where: 'Left of the sink' }),
  asset({ id: 'a18', roomId: 'r1', category: 'Appliance', name: 'Refrigerator',
    make: 'GE', model: 'Profile PVD28BYNFS', serial: 'GE-PVD28-RA912847',
    finish: 'Fingerprint Resistant Stainless', installed: '2021-06-18', warranty: '2022-06-18',
    life: 14, where: 'Kitchen, north wall',
    notes: 'Water line to the icemaker has its own shutoff behind the unit.' }),
  asset({ id: 'a19', roomId: 'r1', category: 'Appliance', name: 'Gas Range',
    make: 'Bosch', model: '800 Series HGI8056UC', serial: 'BS-HGI8-FD9814402',
    finish: 'Stainless', installed: '2021-06-18', warranty: '2022-06-18', life: 15 }),
  asset({ id: 'a20', roomId: 'r5', category: 'Appliance', name: 'Clothes Washer',
    make: 'LG', model: 'WM4000HWA', serial: 'LG-WM40-812SN04471', finish: 'White',
    installed: '2022-09-30', warranty: '2023-09-30', life: 12,
    notes: 'Braided stainless supply hoses fitted at the same time.' }),
  asset({ id: 'a21', roomId: 'r5', category: 'Appliance', name: 'Clothes Dryer',
    make: 'LG', model: 'DLEX4000W', serial: 'LG-DLEX-812SN04512', finish: 'White',
    installed: '2022-09-30', warranty: '2023-09-30', life: 13, serviced: '2026-09-08',
    notes: 'Vent run cleaned at each fall visit.' }),
  asset({ id: 'a22', roomId: 'r9', category: 'Roof', name: 'Architectural Shingle Roof',
    make: 'Owens Corning', model: 'Duration Storm — Estate Gray', finish: 'Estate Gray',
    installed: '2016-08-15', warranty: '2046-08-15', life: 30, serviced: '2026-09-08',
    where: 'Whole house', notes: 'Transferable limited lifetime warranty — paperwork is in your Documents.' }),
  asset({ id: 'a23', roomId: 'r9', category: 'Exterior', name: 'Gutters & Downspouts',
    model: '5 in. K-style seamless aluminum', finish: 'White', installed: '2016-08-15',
    life: 25, condition: 'FAIR', serviced: '2026-09-08', where: 'Whole house perimeter',
    notes: 'No gutter guards. Heavy maple leaf load in fall.' }),
  asset({ id: 'a24', roomId: 'r9', category: 'Windows', name: 'Double-Hung Windows (18)',
    make: 'Andersen', model: '400 Series Tilt-Wash', finish: 'White', installed: '1998-05-01',
    life: 30, condition: 'FAIR', where: 'Whole house', notes: '18 units. Three have failed seals.' }),
  asset({ id: 'a25', roomId: 'r9', category: 'Exterior', name: 'Rear Deck',
    model: 'Pressure-treated pine, 12x16', installed: '2005-06-01', life: 20,
    condition: 'POOR', serviced: '2026-09-08', where: 'Off the dining room slider',
    notes: 'Frame is sound; decking and rail are weathered.' }),
  asset({ id: 'a26', roomId: 'r7', category: 'Garage', name: 'Garage Door Opener',
    make: 'LiftMaster', model: '87504-267 Secure View', serial: 'LM-87504-771029384',
    installed: '2023-11-04', warranty: '2028-11-04', life: 15, serviced: '2026-09-08',
    where: 'Garage ceiling', notes: 'Belt drive, battery backup, camera.' }),
  asset({ id: 'a27', roomId: null, category: 'Life Safety', name: 'Smoke & CO Detectors (7)',
    make: 'Kidde', model: '21031373 Hardwired w/ Battery Backup', installed: '2021-03-15',
    life: 10, serviced: '2026-09-08', where: 'Each bedroom, both hallways, basement stair',
    notes: 'Hardwired and interconnected. Batteries changed each fall visit.' }),
  asset({ id: 'a28', roomId: 'r8', category: 'Exterior', name: 'Attic Insulation',
    model: 'Blown-in cellulose, approx. R-30', installed: '1998-05-01', life: 40,
    condition: 'FAIR', where: 'Attic floor' }),
];

interface FindingSeed {
  id: string; status: Finding['status']; title: string; roomId?: string; assetId?: string;
  description: string; recommendation: string; low?: number; high?: number; days: number;
}

function finding(s: FindingSeed): Finding {
  return {
    id: s.id,
    property_id: PROPERTY_ID,
    visit_id: null,
    room_id: s.roomId ?? null,
    asset_id: s.assetId ?? null,
    status: s.status,
    title: s.title,
    description: s.description,
    recommendation: s.recommendation,
    priority: s.status === 'ACTION' ? 'HIGH' : 'MEDIUM',
    estimated_cost_low: s.low ?? null,
    estimated_cost_high: s.high ?? null,
    created_by: null,
    resolved_at: null,
    created_at: daysFromNow(-s.days),
  };
}

const FINDINGS: Finding[] = [
  finding({ id: 'f1', status: 'ACTION', title: 'Water heater corrosion at top fittings',
    roomId: 'r6', assetId: 'a8', days: 12,
    description: 'Light rust staining at the cold inlet and hot outlet nipples. The unit is a 2019 Bradford White, now seven years old, and the anode rod has never been pulled. The tank is holding and there is no active leak today.',
    recommendation: 'Plan a replacement in the next 12–18 months rather than waiting for it to let go in a finished basement. We can flush the tank and pull the anode in the meantime to buy time.',
    low: 1850, high: 2400 }),
  finding({ id: 'f2', status: 'ACTION', title: 'Deck decking and railing failing',
    roomId: 'r9', assetId: 'a25', days: 159,
    description: 'The 2005 pressure-treated decking is cupped and splitting, with several soft boards near the stair, and two rail balusters are loose. The framing, posts and ledger are still sound and correctly flashed.',
    recommendation: 'Re-deck over the existing frame with composite and replace the railing. This is the headline item on your plan for spring.',
    low: 9500, high: 13500 }),
  finding({ id: 'f3', status: 'PLAN', title: 'No gutter guards — heavy leaf load',
    roomId: 'r9', assetId: 'a23', days: 159,
    description: 'Three mature silver maples overhang the rear and east elevations. The gutters filled twice between visits this year, and overflow is already staining the siding below the rear corner.',
    recommendation: 'Micro-mesh guards on the full perimeter. We can do this alongside the spring visit.',
    low: 1400, high: 2100 }),
  finding({ id: 'f4', status: 'PLAN', title: 'Sump pump has no battery backup',
    roomId: 'r6', assetId: 'a14', days: 159,
    description: 'A single 1/3 HP pump on a standard outlet. The basement sits below the water table in heavy spring rain, and a power cut during a storm would leave the pit unprotected.',
    recommendation: 'Add a battery backup pump with its own float and a high-water alarm.',
    low: 850, high: 1250 }),
  finding({ id: 'f5', status: 'MONITOR', title: 'Hall bath toilet running intermittently',
    roomId: 'r3', assetId: 'a6', days: 159,
    description: 'The flapper is leaking by and the tank refills every few hours. It was already replaced once in 2025, so the flush valve seat is the more likely culprit.',
    recommendation: 'Replace the flush valve assembly at the next visit. Low cost, no urgency, but it is wasting water.',
    low: 145, high: 260 }),
  finding({ id: 'f6', status: 'MONITOR', title: 'Powder room toilet is original to the house',
    roomId: 'r4', assetId: 'a7', days: 12,
    description: 'Installed at build in 1998, now 28 years old and past typical service life. The bowl and tank are intact with no cracks and no weeping at the base.',
    recommendation: 'Nothing to do yet. We will watch for weeping at the closet flange. Budget a replacement in the next two to three years.',
    low: 450, high: 700 }),
  finding({ id: 'f7', status: 'MONITOR', title: 'Failed window seals — 3 of 18 units',
    roomId: 'r9', assetId: 'a24', days: 12,
    description: 'Fogging between the panes in the two dining room units and one in bedroom 3. The other fifteen are clear.',
    recommendation: 'The glass units can be replaced individually without replacing the windows. We will watch for more and do them as a batch at five or six.',
    low: 1200, high: 1900 }),
  finding({ id: 'f8', status: 'GOOD', title: 'Furnace operating well for its age',
    roomId: 'r6', assetId: 'a9', days: 12,
    description: 'Twelve years old, clean ignition on both stages, no error history in the control, heat exchanger visually clear and combustion looked correct. Filter and humidifier panel replaced at this visit.',
    recommendation: 'Stay on the twice-yearly rhythm. Expect another six to eight years of service.' }),
  finding({ id: 'f9', status: 'GOOD', title: 'Roof in excellent condition',
    roomId: 'r9', assetId: 'a22', days: 12,
    description: 'Ten years into a thirty-year expectation. No lifted or missing shingles, granule loss normal for age, step and valley flashing intact, boots and vent collars sound.',
    recommendation: 'Nothing needed. We re-inspect every fall.' }),
  finding({ id: 'f10', status: 'GOOD', title: 'Onyx shower performing as new',
    roomId: 'r2', assetId: 'a4', days: 12,
    description: 'Four years in with no crazing, staining or seam separation. The caulk joint at the base is intact and flexible, and the Delta valve is holding temperature correctly.',
    recommendation: 'Keep using non-abrasive cleaner only. No bleach, no scouring pads.' }),
  finding({ id: 'f11', status: 'IMPROVEMENT', title: 'Attic insulation could be topped up',
    roomId: 'r8', assetId: 'a28', days: 12,
    description: 'Blown-in cellulose measures roughly R-30 across the attic floor, which met code in 1998. Current recommendation for this climate zone is R-49 to R-60, and several spots near the eaves are thin.',
    recommendation: 'Adding six to eight inches would cut winter heating cost noticeably, and it is inexpensive while the attic is otherwise empty.',
    low: 1900, high: 2800 }),
  finding({ id: 'f12', status: 'IMPROVEMENT', title: 'Panel has room for a generator interlock',
    roomId: 'r6', assetId: 'a13', days: 159,
    description: 'The Square D panel has six open positions and the service is sized with room to spare. An interlock kit plus an exterior inlet would let you run the furnace, sump, fridge and lights from a portable generator.',
    recommendation: 'Worth considering given the sump exposure during storm outages.',
    low: 1600, high: 2400 }),
];

const PLAN_ITEMS: PlanItem[] = [
  { id: 'p1', property_id: PROPERTY_ID, finding_id: 'f4', title: 'Add sump pump battery backup',
    description: null, category: 'Plumbing', target_year: new Date().getFullYear(),
    // Its job (sr2) is booked in, and in the live app a trigger keeps these
    // two in step. The fixture has to agree or the demo contradicts itself.
    target_season: 'Fall', priority: 'HIGH', status: 'SCHEDULED',
    estimated_cost_low: 850, estimated_cost_high: 1250, sort_order: 10 },
  { id: 'p2', property_id: PROPERTY_ID, finding_id: 'f3', title: 'Install gutter guards',
    description: null, category: 'Exterior', target_year: new Date().getFullYear() + 1,
    target_season: 'Spring', priority: 'MEDIUM', status: 'PROPOSED',
    estimated_cost_low: 1400, estimated_cost_high: 2100, sort_order: 20 },
  { id: 'p3', property_id: PROPERTY_ID, finding_id: 'f2', title: 'Re-deck and re-rail rear deck',
    description: null, category: 'Exterior', target_year: new Date().getFullYear() + 1,
    target_season: 'Spring', priority: 'HIGH', status: 'PROPOSED',
    estimated_cost_low: 9500, estimated_cost_high: 13500, sort_order: 30 },
  { id: 'p4', property_id: PROPERTY_ID, finding_id: 'f1', title: 'Replace water heater',
    description: null, category: 'Plumbing', target_year: new Date().getFullYear() + 1,
    target_season: 'Fall', priority: 'HIGH', status: 'PROPOSED',
    estimated_cost_low: 1850, estimated_cost_high: 2400, sort_order: 40 },
  { id: 'p5', property_id: PROPERTY_ID, finding_id: 'f11', title: 'Top up attic insulation to R-49',
    description: null, category: 'Energy', target_year: new Date().getFullYear() + 1,
    target_season: 'Fall', priority: 'MEDIUM', status: 'PROPOSED',
    estimated_cost_low: 1900, estimated_cost_high: 2800, sort_order: 50 },
  { id: 'p6', property_id: PROPERTY_ID, finding_id: 'f12', title: 'Generator interlock and inlet',
    description: null, category: 'Electrical', target_year: new Date().getFullYear() + 2,
    target_season: 'Spring', priority: 'LOW', status: 'PROPOSED',
    estimated_cost_low: 1600, estimated_cost_high: 2400, sort_order: 60 },
];

const VISITS: Visit[] = [
  { id: 'v-next', property_id: PROPERTY_ID, tech_id: null, visit_type: 'SEASONAL',
    status: 'SCHEDULED', scheduled_for: daysFromNowAt(23, 9), started_at: null, completed_at: null,
    title: 'Winter Seasonal Visit', summary: null, member_notes: null },
  { id: 'v1', property_id: PROPERTY_ID, tech_id: null, visit_type: 'SEASONAL',
    status: 'COMPLETED', scheduled_for: daysFromNow(-12), started_at: daysFromNow(-12),
    completed_at: daysFromNow(-12), title: 'Fall Seasonal Visit',
    summary: 'Heating season prep. Furnace filter and humidifier panel replaced, dryer vent cleaned, detector batteries changed, garage door checked, hoses off the sillcocks. The water heater is showing its age — we have put it on your plan.',
    member_notes: null },
  { id: 'v2', property_id: PROPERTY_ID, tech_id: null, visit_type: 'SEASONAL',
    status: 'COMPLETED', scheduled_for: daysFromNow(-159), started_at: daysFromNow(-159),
    completed_at: daysFromNow(-159), title: 'Spring Seasonal Visit',
    summary: 'Full spring walkthrough. A/C started and verified, sump pump tested, sillcocks opened, gutters checked. Two items raised for the plan: the deck and the hall bath toilet.',
    member_notes: null },
  // The onboarding visit the baseline report came out of.
  { id: 'v0', property_id: PROPERTY_ID, tech_id: null, visit_type: 'ONBOARDING',
    status: 'COMPLETED', scheduled_for: daysFromNow(-560), started_at: daysFromNow(-560),
    completed_at: daysFromNow(-560), title: 'Baseline Visit',
    summary: 'Full documentation walkthrough — every room, every system, every plate we could get a camera on. Water shutoffs photographed, panel mapped and breakers labelled, filter sizes recorded. Two items raised for the plan; everything else sound for its age.',
    member_notes: null },
  // The quarter where nothing was wrong.
  { id: 'v3', property_id: PROPERTY_ID, tech_id: null, visit_type: 'SEASONAL',
    status: 'COMPLETED', scheduled_for: daysFromNow(-250), started_at: daysFromNow(-250),
    completed_at: daysFromNow(-250), title: 'Summer Seasonal Visit',
    summary: 'Full summer walkthrough — cooling, exterior, attic and crawl. Condenser coil cleaned and refrigerant pressures verified, dryer vent clear, sump tested under load, grading and downspouts checked, attic inspected for moisture. Everything we looked at came back in good order.',
    member_notes: null },
];

/**
 * Service requests, in full.
 *
 * One at each of the three moments that matter on a sales call: waiting on
 * the homeowner to approve a price, approved and booked in, and just raised.
 * The middle of the pipeline is where the product earns its fee, so the demo
 * has to show it rather than stop at a list.
 */
export interface DemoRequest {
  id: string;
  title: string;
  stage: ServiceRequestStage;
  /** Set when the job came off the Home Plan. */
  finding_id: string | null;
  priority: PriorityLevel;
  category: string | null;
  roomName: string | null;
  assetName: string | null;
  assetModel: string | null;
  description: string;
  created_at: string;
  estimate_amount: number | null;
  approved_at: string | null;
  scheduled_for: string | null;
  work_performed: string | null;
  parts_used: string | null;
  events: StatusEvent[];
}

function ev(
  id: string,
  from: ServiceRequestStage | null,
  to: ServiceRequestStage,
  note: string | null,
  days: number,
): StatusEvent {
  return { id, from_stage: from, to_stage: to, note, created_at: daysFromNow(days) };
}

export const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: 'sr1',
    title: 'Hall bath toilet running between flushes',
    stage: 'AWAITING_APPROVAL',
    finding_id: null,
    priority: 'MEDIUM',
    category: 'Plumbing',
    roomName: 'Hall Bathroom',
    assetName: 'Hall Bath Toilet',
    assetModel: 'Cadet 3 215AA.104',
    description:
      'It runs for about thirty seconds every hour or so, mostly overnight. We replaced the flapper last year and it was fine for a while.',
    created_at: daysFromNow(-6),
    estimate_amount: 340,
    approved_at: null,
    scheduled_for: null,
    work_performed: null,
    parts_used: null,
    events: [
      ev('sr1e1', null, 'NEW', 'Raised from the homeowner portal.', -6),
      ev('sr1e2', 'NEW', 'TRIAGE', 'Looked at the Home Record — 2019 unit, flapper already done once.', -5),
      ev('sr1e3', 'TRIAGE', 'DISPATCHED', 'Sent to Stauffer Plumbing.', -5),
      ev('sr1e4', 'DISPATCHED', 'ACCEPTED', 'Stauffer Plumbing accepted.', -4),
      ev('sr1e5', 'ACCEPTED', 'ESTIMATING', 'Pricing a full rebuild kit rather than another flapper.', -3),
      ev('sr1e6', 'ESTIMATING', 'AWAITING_APPROVAL', 'Price sent to the homeowner.', -1),
    ],
  },
  {
    id: 'sr2',
    title: 'Sump pump battery backup install',
    stage: 'SCHEDULED',
    finding_id: 'f4',
    priority: 'MEDIUM',
    category: 'Plumbing',
    roomName: 'Basement',
    assetName: 'Sump Pump',
    assetModel: 'M53 Mighty-Mate 1/3 HP',
    description:
      'You flagged on the spring visit that there is no backup if the power goes out. We would like to get that sorted before spring storms.',
    created_at: daysFromNow(-11),
    estimate_amount: 1180,
    approved_at: daysFromNow(-4),
    scheduled_for: daysFromNowAt(9, 9),
    work_performed: null,
    parts_used: null,
    events: [
      ev('sr2e1', null, 'NEW', 'Asked for from the Home Plan.', -11),
      ev('sr2e2', 'NEW', 'TRIAGE', 'Matched to the Home Plan item from the spring visit.', -10),
      ev('sr2e3', 'TRIAGE', 'ESTIMATING', 'Pricing a 75Ah backup system with alarm.', -8),
      ev('sr2e4', 'ESTIMATING', 'AWAITING_APPROVAL', 'Price sent to the homeowner.', -6),
      ev('sr2e5', 'AWAITING_APPROVAL', 'APPROVED', 'Homeowner approved the estimate.', -4),
      ev('sr2e6', 'APPROVED', 'SCHEDULED', 'Booked in.', -3),
    ],
  },
  {
    id: 'sr3',
    title: 'Kitchen disposal humming but not spinning',
    stage: 'TRIAGE',
    finding_id: null,
    priority: 'MEDIUM',
    category: 'Appliance',
    roomName: 'Kitchen',
    assetName: null,
    assetModel: null,
    description: 'It hums when switched on but nothing turns. Switched it off at the wall for now.',
    created_at: daysFromNow(-2),
    estimate_amount: null,
    approved_at: null,
    scheduled_for: null,
    work_performed: null,
    parts_used: null,
    events: [
      ev('sr3e1', null, 'NEW', 'Raised from the homeowner portal.', -2),
      ev('sr3e2', 'NEW', 'TRIAGE', 'Checking whether this is the reset or the motor.', -1),
    ],
  },
];

/**
 * The demo home's agreement.
 *
 * Signed today, so the three-business-day cancellation window is OPEN and
 * the demo shows the Cancel button rather than describing it. Nothing is
 * written anywhere when it is pressed.
 */
export const DEMO_AGREEMENT: Agreement = {
  id: 'demo-agreement',
  property_id: PROPERTY_ID,
  tier: 'RESPONSE',
  billing_cycle: 'ANNUAL_PREPAID',
  price_monthly: 299,
  price_annual: 3289,
  commitment_months: 12,
  signed_at: daysFromNow(0),
  signed_by_name: 'Sarah Miller',
  term_start: daysFromNow(0).slice(0, 10),
  term_end: daysFromNow(365).slice(0, 10),
  auto_renew: true,
  renewal_notice_days_before_max: 20,
  renewal_notice_days_before_min: 10,
  renewal_notice_sent_at: null,
  renewal_notice_method: null,
  // Third business day from today — computed the same way the database does,
  // so the demo cannot quietly disagree with the real thing.
  rescission_deadline: addBusinessDays(new Date(), 3),
  rescinded_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  document_id: null,
  status: 'ACTIVE',
  notes: null,
};

/** Weekends only, matching public.add_business_days in migration 0012. */
function addBusinessDays(from: Date, n: number): string {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * The demo home's shutoffs.
 *
 * One is deliberately absent — there is no recorded main gas shutoff — so
 * the demo also shows the honest "we have not recorded yours yet" state
 * rather than only the happy path. A prospect should see both.
 */
export const DEMO_SAFETY_POINTS: SafetyPoint[] = [
  {
    id: 'sp1',
    kind: 'WATER_MAIN',
    label: 'Main water shutoff',
    location_note: 'Basement, northwest corner, on the wall just past the stairs where the line comes in through the foundation.',
    how_to_note: 'Round wheel on the valve above the meter. Turn it clockwise until it stops — it takes a lot of turns, and it may be stiff. If it will not move, stop and call rather than forcing it.',
    photo_id: 'demo-photo-water-main',
    room_name: 'Basement',
    // A real photograph, so the demo shows a finished shutoff card rather
    // than an empty one. Every /demo screen is banner-labelled as sample
    // data, so nothing here is claiming to be anybody's house.
    photo_url: '/reference/water-main.jpg',
  },
  {
    id: 'sp2',
    kind: 'WATER_HEATER_SHUTOFF',
    label: 'Water heater shutoff',
    location_note: 'On the cold inlet at the top of the Bradford White, northeast corner of the basement.',
    how_to_note: 'Blue handle on the right-hand pipe. Quarter turn.',
    photo_id: null,
    room_name: 'Basement',
    photo_url: null,
  },
  {
    id: 'sp3',
    kind: 'ELECTRICAL_PANEL',
    label: 'Main electrical panel',
    location_note: 'Basement, south wall beside the workbench. 200 amp Square D, 40 space.',
    how_to_note: 'Main breaker is the large one at the top. Furnace is breaker 14, sump is 22.',
    photo_id: null,
    room_name: 'Basement',
    photo_url: null,
  },
  {
    id: 'sp4',
    kind: 'SUMP_PUMP',
    label: 'Sump pump',
    location_note: 'Basement, northwest pit under the plywood cover.',
    how_to_note: 'Zoeller M53. Lift the float by hand to test it — it should start straight away.',
    photo_id: null,
    room_name: 'Basement',
    photo_url: null,
  },
  {
    id: 'sp6',
    kind: 'PROPANE_TANK_SHUTOFF',
    label: 'Propane tank shutoff',
    location_note: '500 gallon tank behind the garage, off the gravel turnaround. The valve is under the green dome lid at the end nearest the house.',
    how_to_note: 'Lift the lid. Turn the service valve clockwise until it stops — a wheel or a small lever depending on the tank, and no tools either way. The gauge beside it reads the level as a percentage.',
    photo_id: 'demo-photo-propane-tank',
    room_name: null,
    photo_url: '/reference/propane-tank.jpg',
  },
  {
    id: 'sp5',
    kind: 'MAIN_CLEANOUT',
    label: 'Main drain cleanout',
    location_note: 'Basement floor, three feet from the base of the soil stack. Black cap, flush with the slab.',
    how_to_note: null,
    photo_id: null,
    room_name: 'Basement',
    photo_url: null,
  },
];

/**
 * Checklists behind the demo reports.
 *
 * The clean-quarter report needs real numbers to stand on — "we went through
 * 47 checks and every one passed" is only worth reading if the 47 is true.
 */
function checks(
  visitId: string,
  quarter: Quarter,
  attention: string[] = [],
): ChecklistItem[] {
  // Real labels, not "Check 1" — the report prints these, and a prospect
  // reading three hundred of them is exactly the point. itemsFor puts the
  // core list in front of the season's deep dive, same as a real visit.
  return itemsFor(quarter).map((t, i) => {
    const flagged = attention.some((a) => t.label.toLowerCase().includes(a));

    // A plausible reading for the demo: mid-band where there is a band,
    // and nothing invented where there is not.
    let measurement_value: number | null = null;
    if (t.measure) {
      const { low, high } = t.measure;
      if (low != null && high != null) measurement_value = Math.round(((low + high) / 2) * 10) / 10;
      else if (high != null) measurement_value = high;
      else if (low != null) measurement_value = low;
    }

    return {
      id: `${visitId}-c${i}`,
      visit_id: visitId,
      category: t.category,
      label: t.label,
      help_note: t.help ?? null,
      result: flagged ? ('REPAIR_RECOMMENDED' as const) : ('PASS' as const),
      notes: null,
      sort_order: i,
      measurement_label: t.measure?.label ?? null,
      measurement_unit: t.measure?.unit ?? null,
      measurement_low: t.measure?.low ?? null,
      measurement_high: t.measure?.high ?? null,
      measurement_value,
    };
  });
}

export const DEMO_CHECKLISTS: Record<string, ChecklistItem[]> = {
  v0: checks('v0', 'Q1'),
  v1: checks('v1', 'Q4', ['water heater', 'anode']),
  v2: checks('v2', 'Q2', ['deck', 'toilet']),
  // The clean quarter: every single item passed.
  v3: checks('v3', 'Q3'),
};

export const DEMO_PORTAL_DATA: PortalData = {
  property: {
    id: PROPERTY_ID,
    name: 'The Miller Home',
    address_line1: '123 Maple Ave',
    address_line2: null,
    city: 'Lancaster',
    state: 'PA',
    postal_code: '17601',
    year_built: 1998,
    square_feet: 2400,
    bedrooms: 4,
    bathrooms: 2.5,
    lot_size_acres: 0.31,
    plan_tier: 'HomeKeeper Response',
    // The sample home is on propane — a 500 gallon tank behind the garage,
    // which is a normal Lancaster County house and lets the demo show the
    // propane version of "I smell gas". Change to 'NATURAL_GAS' to see the
    // conservative version a gas home (or an unrecorded one) gets.
    heating_fuel: 'PROPANE',
    // The sample home is a Response member, so the demo shows the whole
    // product. Flip this to 'CORE' to see what a Core member sees.
    tier: 'RESPONSE',
    billing_cycle: 'ANNUAL_PREPAID',
    commitment_start: '2024-03-01',
    commitment_months: 12,
    member_discount_used_ytd: 310,
    member_discount_year_start: '2026-03-01',
    member_since: '2024-03-01',
    notes: null,
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
  },
  memberFirstName: 'Sarah',
  rooms: ROOMS,
  assets: ASSETS,
  findings: FINDINGS,
  planItems: PLAN_ITEMS,
  visits: VISITS,
  reports: [
    { id: 'demo-r1', title: 'Fall HomeKeeper Report', report_type: 'VISIT_SUMMARY',
      period_start: daysFromNow(-90), period_end: daysFromNow(-12), generated_at: daysFromNow(-12) },
    { id: 'demo-r2', title: 'Spring HomeKeeper Report', report_type: 'VISIT_SUMMARY',
      period_start: daysFromNow(-240), period_end: daysFromNow(-159), generated_at: daysFromNow(-159) },
    { id: 'demo-r3', title: 'Annual Property Report', report_type: 'ANNUAL_REVIEW',
      period_start: daysFromNow(-365), period_end: daysFromNow(-1), generated_at: daysFromNow(-160) },
    // A quarter where nothing was wrong. Worth showing a prospect: it is
    // what most of their quarters will look like, and it is the report that
    // has to feel like good news rather than an empty page.
    { id: 'demo-r4', title: 'Summer HomeKeeper Report', report_type: 'VISIT_SUMMARY',
      period_start: daysFromNow(-330), period_end: daysFromNow(-250), generated_at: daysFromNow(-250) },
    // The first thing they ever received. Oldest, so it sits at the bottom
    // of their list — which is where it belongs, and where a prospect will
    // scroll to when you say "and this is what you get on day one".
    { id: 'demo-r0', title: 'Home Baseline Report', report_type: 'BASELINE',
      period_start: daysFromNow(-560), period_end: daysFromNow(-560), generated_at: daysFromNow(-560) },
  ],
  documents: [
    { id: 'd1', title: 'Owens Corning roof warranty certificate', doc_type: 'WARRANTY',
      storage_path: '', size_bytes: 284_000, created_at: daysFromNow(-400) },
    { id: 'd2', title: 'Onyx Collection care and warranty guide', doc_type: 'WARRANTY',
      storage_path: '', size_bytes: 1_100_000, created_at: daysFromNow(-380) },
    { id: 'd3', title: 'Carrier Infinity furnace owner manual', doc_type: 'MANUAL',
      storage_path: '', size_bytes: 4_200_000, created_at: daysFromNow(-370) },
    { id: 'd4', title: 'Bosch 800 Series dishwasher manual', doc_type: 'MANUAL',
      storage_path: '', size_bytes: 2_600_000, created_at: daysFromNow(-360) },
    { id: 'd5', title: 'Primary bath remodel — final invoice', doc_type: 'INVOICE',
      storage_path: '', size_bytes: 96_000, created_at: daysFromNow(-350) },
    { id: 'd6', title: 'Township permit — kitchen remodel', doc_type: 'PERMIT',
      storage_path: '', size_bytes: 140_000, created_at: daysFromNow(-340) },
  ],
  photos: [],
  openRequests: DEMO_REQUESTS.map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    created_at: r.created_at,
    finding_id: r.finding_id,
  })),
};
