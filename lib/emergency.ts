/**
 * "I Need Help Now" — what to do, for this house.
 *
 * ⚠ SAFETY-CRITICAL FILE. Read docs/emergency-help.md before changing a
 * word of it. Three rules govern everything here:
 *
 *  1. **Life before property.** Where there is any chance of fire,
 *     explosion or carbon monoxide, the first instruction is LEAVE and
 *     CALL 911 — never "go and find your shutoff". A gas leak is the
 *     clearest case: sending somebody into a gassy basement to hunt for a
 *     valve is the worst thing this app could do.
 *  2. **We are not the emergency services.** Every screen says so. B&M is
 *     who you call after you are safe, not instead of 911.
 *  3. **Never invent their house.** If we have not recorded where their
 *     shutoff is, the app says we have not recorded it. It does not guess,
 *     and it does not show a generic stock photo of somebody else's valve.
 *
 * Everything here is general homeowner guidance of the kind printed on a
 * utility company's fridge magnet, made specific only by pointing at the
 * shutoff a technician actually photographed in that member's home.
 */

export type SafetyPointKind =
  | 'WATER_MAIN'
  | 'WATER_HEATER_SHUTOFF'
  | 'GAS_MAIN'
  | 'OIL_TANK_SHUTOFF'
  | 'PROPANE_TANK_SHUTOFF'
  | 'ELECTRICAL_PANEL'
  | 'SUB_PANEL'
  | 'SUMP_PUMP'
  | 'MAIN_CLEANOUT'
  | 'SEPTIC_ACCESS'
  | 'WELL_PUMP'
  | 'FLOOR_DRAIN'
  | 'OUTSIDE_SPIGOT_SHUTOFF'
  | 'SMOKE_CO_ALARM'
  | 'FIRE_EXTINGUISHER'
  | 'OTHER';

export const SAFETY_POINT_LABEL: Record<SafetyPointKind, string> = {
  WATER_MAIN: 'Main water shutoff',
  WATER_HEATER_SHUTOFF: 'Water heater shutoff',
  GAS_MAIN: 'Main gas shutoff',
  OIL_TANK_SHUTOFF: 'Oil tank shutoff',
  PROPANE_TANK_SHUTOFF: 'Propane tank shutoff',
  ELECTRICAL_PANEL: 'Main electrical panel',
  SUB_PANEL: 'Sub panel',
  SUMP_PUMP: 'Sump pump',
  MAIN_CLEANOUT: 'Main drain cleanout',
  SEPTIC_ACCESS: 'Septic access',
  WELL_PUMP: 'Well pump',
  FLOOR_DRAIN: 'Floor drain',
  OUTSIDE_SPIGOT_SHUTOFF: 'Outside spigot shutoff',
  SMOKE_CO_ALARM: 'Smoke / CO alarm',
  FIRE_EXTINGUISHER: 'Fire extinguisher',
  OTHER: 'Other',
};

export interface SafetyPoint {
  id: string;
  kind: SafetyPointKind;
  label: string | null;
  location_note: string | null;
  how_to_note: string | null;
  photo_id: string | null;
  room_name?: string | null;
  /** Signed URL, resolved on the server. */
  photo_url?: string | null;
}

export type EmergencyContactKey =
  | 'GAS_UTILITY'
  | 'PROPANE_SUPPLIER'
  | 'ELECTRIC_UTILITY'
  | 'WATER_UTILITY';

/**
 * How the house is heated, which changes the advice.
 *
 * Mirrors the heating_fuel enum in migration 0013. It is here rather than
 * in the database types because in this file it is not a fact about the
 * house — it decides what a frightened person is told to do.
 */
export type HeatingFuel =
  | 'NATURAL_GAS'
  | 'PROPANE'
  | 'OIL'
  | 'ELECTRIC'
  | 'HEAT_PUMP'
  | 'OTHER';

export type EmergencyKind =
  | 'GAS_SMELL'
  | 'ELECTRICAL'
  | 'WATER_LEAK'
  | 'NO_WATER'
  | 'SEWAGE_BACKUP'
  | 'BASEMENT_WATER'
  | 'NO_HEAT'
  | 'NO_HOT_WATER'
  | 'ROOF_LEAK'
  | 'APPLIANCE_LEAK'
  | 'OTHER';

/** How the screen opens. EVACUATE outranks everything else on the page. */
export type EmergencySeverity = 'EVACUATE' | 'URGENT' | 'SOON';

export interface EmergencyStep {
  title: string;
  detail?: string;
  /**
   * Show the member's own safety point here. When we have not recorded
   * theirs, the step says so plainly rather than quietly disappearing.
   */
  needs?: SafetyPointKind;
  /**
   * Show a configured emergency number here.
   *
   * Never a number hard-coded in this file. A utility number varies by
   * address and changes over time, and a wrong number in a gas emergency is
   * the worst possible bug — so when the office has not configured one, the
   * app says where to find it (the bill) instead of inventing it.
   */
  contact?: EmergencyContactKey;
}

export interface EmergencyDefinition {
  kind: EmergencyKind;
  /** What the member taps. Their words, not a trade's. */
  label: string;
  /** One line so they pick the right one first time. */
  examples: string;
  severity: EmergencySeverity;
  /** Shown before anything else, in red, when severity is EVACUATE. */
  evacuate?: string;
  steps: EmergencyStep[];
  doNot?: string[];
  /** Home Record categories worth showing — theirs, with model and serial. */
  assetCategories?: string[];
  /** Pre-fills the urgent request if they ask us to come. */
  requestTitle: string;
  requestCategory: string;
}

/**
 * The two evacuate-first cases lead the list on purpose.
 *
 * A frightened person taps the first thing that matches. If "I smell gas"
 * were buried at the bottom under "no hot water", the ordering itself
 * would be a hazard.
 */
export const EMERGENCIES: EmergencyDefinition[] = [
  {
    kind: 'GAS_SMELL',
    label: 'I smell gas',
    examples: 'Rotten-egg smell, hissing near a pipe or meter',
    severity: 'EVACUATE',
    evacuate:
      'Get everyone out of the house now. Do not use light switches, appliances, or your phone until you are outside and away from the building.',
    steps: [
      {
        title: 'Leave the house, taking everyone with you',
        detail: 'Open a door on your way out if it is on your path. Do not stop to look for the leak.',
      },
      {
        title: 'From outside, call 911 and your gas utility',
        detail: 'Call from the street or a neighbour’s — not from inside. Your utility’s emergency number is on your gas bill.',
        contact: 'GAS_UTILITY',
      },
      {
        title: 'Keep everyone away until they say it is safe',
        detail: 'Do not go back in for anything, and do not start a car in an attached garage.',
      },
      {
        title: 'Once the utility has made it safe, tell us',
        detail: 'We will get your system checked and put it on your record.',
      },
    ],
    doNot: [
      'Do not switch anything on or off — a light switch can make a spark',
      'Do not go looking for the gas shutoff inside the house',
      'Do not light a match, candle or lighter',
      'Do not use your phone until you are outside',
    ],
    requestTitle: 'Gas smell — utility called',
    requestCategory: 'Heating & cooling',
  },
  {
    kind: 'ELECTRICAL',
    label: 'Burning smell, smoke or sparks',
    examples: 'Sparking outlet, hot switch plate, smell of burning plastic',
    severity: 'EVACUATE',
    evacuate:
      'If you can see flames or smoke, get everyone out and call 911 before you do anything else.',
    steps: [
      {
        title: 'If there is fire or smoke, get out and call 911',
        detail: 'Nothing below matters more than this. Do not try to fight an electrical fire with water.',
      },
      {
        title: 'If there is no fire, stop using that circuit',
        detail: 'Unplug what you safely can without touching anything hot, scorched or wet.',
      },
      {
        title: 'Switch that breaker off at your panel',
        detail: 'Only if the panel is dry and you can reach it safely. If there is any water near it, leave it and call us.',
        needs: 'ELECTRICAL_PANEL',
      },
      {
        title: 'Call us and leave it off',
        detail: 'A burning smell in wiring does not fix itself. Leave the circuit dead until an electrician has seen it.',
      },
    ],
    doNot: [
      'Do not touch a panel or outlet if you are wet or standing in water',
      'Do not put water on an electrical fire',
      'Do not switch the breaker back on to "see if it does it again"',
    ],
    assetCategories: ['Electrical'],
    requestTitle: 'Burning smell / electrical fault',
    requestCategory: 'Electrical',
  },
  {
    kind: 'WATER_LEAK',
    label: 'Water is leaking or a pipe burst',
    examples: 'Spraying pipe, water running down a wall, wet ceiling',
    severity: 'URGENT',
    steps: [
      {
        title: 'Turn the water off at the main',
        detail: 'This is the one that stops everything. A lever takes a quarter turn so it sits across the pipe; a round wheel turns clockwise and takes a lot of turns. If a wheel is stiff, turn it steadily — do not force it with a tool, because a valve that snaps leaves you with no way to stop the water at all.',
        needs: 'WATER_MAIN',
      },
      {
        title: 'If it is the water heater, close its own shutoff too',
        needs: 'WATER_HEATER_SHUTOFF',
      },
      {
        title: 'Open a low tap to drain the pressure',
        detail: 'A basement or ground-floor tap. This takes the push out of the leak while it empties.',
      },
      {
        title: 'Keep water away from anything electrical',
        detail: 'If water is near your panel or an outlet, do not touch either — tell us when you call.',
      },
      {
        title: 'Photograph everything before you mop',
        detail: 'Use the camera button in this app. It saves to your record and your insurer will want it.',
      },
    ],
    doNot: [
      'Do not stand in water near outlets or a panel',
      'Do not cut into a wall or ceiling to find the leak',
    ],
    assetCategories: ['Plumbing', 'Plumbing Fixture', 'Water Heater'],
    requestTitle: 'Water leak',
    requestCategory: 'Water damage or leak',
  },
  {
    kind: 'BASEMENT_WATER',
    label: 'Water in the basement',
    examples: 'Standing water, sump not keeping up, storm flooding',
    severity: 'URGENT',
    steps: [
      {
        title: 'Do not walk into standing water yet',
        detail: 'Not until you know nothing electrical is in it. If your panel, furnace or outlets are wet, stay out and call us.',
      },
      {
        title: 'Check your sump pump',
        detail: 'Is it running? Is the discharge outside blocked or frozen? A pump that hums but does not move water is jammed.',
        needs: 'SUMP_PUMP',
      },
      {
        title: 'If the power is out, that may be the cause',
        detail: 'A sump with no backup stops when the power does. If you are on a well, you will also lose water pressure.',
        needs: 'ELECTRICAL_PANEL',
      },
      {
        title: 'Move what you can to higher ground and photograph it',
        detail: 'Photos through this app go straight onto your record for the insurance claim.',
      },
    ],
    doNot: [
      'Do not enter water that touches an outlet, panel, furnace or appliance',
      'Do not run an extension lead into a wet area',
    ],
    assetCategories: ['Plumbing', 'Electrical'],
    requestTitle: 'Water in the basement',
    requestCategory: 'Water damage or leak',
  },
  {
    kind: 'SEWAGE_BACKUP',
    label: 'Drains backing up or sewage smell',
    examples: 'Toilets gurgling, water coming up a floor drain, foul smell',
    severity: 'URGENT',
    steps: [
      {
        title: 'Stop using water anywhere in the house',
        detail: 'No taps, no toilets, no washing machine, no dishwasher. Every gallon you send down makes it worse.',
      },
      {
        title: 'Keep everyone away from it',
        detail: 'Sewage is a health hazard. Children and pets out of the room, windows open if you can.',
      },
      {
        title: 'Find your main cleanout so we can get to it',
        detail: 'You do not need to open it — just knowing where it is saves us time when we arrive.',
        needs: 'MAIN_CLEANOUT',
      },
      {
        title: 'On septic? That changes what this is',
        detail: 'A backup on a septic system often means the tank is full rather than a blockage, and needs a pump-out.',
        needs: 'SEPTIC_ACCESS',
      },
    ],
    doNot: [
      'Do not pour drain chemicals into a backed-up line — it makes it dangerous to work on',
      'Do not keep flushing to "clear it"',
    ],
    requestTitle: 'Drain or sewage backup',
    requestCategory: 'Plumbing',
  },
  {
    kind: 'NO_HEAT',
    label: 'No heat',
    examples: 'Furnace not running, house getting cold',
    severity: 'URGENT',
    steps: [
      {
        title: 'Check the thermostat first',
        detail: 'Set to Heat, set above the room temperature, and check its batteries. This is the answer more often than anyone expects.',
      },
      {
        title: 'Check the furnace switch',
        detail: 'There is usually a switch that looks like a light switch on or near the furnace. It gets knocked off.',
      },
      {
        title: 'Check the breaker',
        detail: 'A tripped breaker sits between on and off. Push it fully off, then fully on.',
        needs: 'ELECTRICAL_PANEL',
      },
      {
        title: 'Check the filter',
        detail: 'A blocked filter can shut a furnace down on a safety. We keep your filter size on your record.',
      },
      {
        title: 'Still nothing? Tell us — and protect the pipes',
        detail: 'In a hard freeze, open the cupboard doors under sinks on outside walls and let a tap drip.',
      },
    ],
    doNot: [
      'Do not reset a furnace over and over — repeated resets can flood the burner',
      'Do not heat the house with an oven or an unvented burner',
    ],
    assetCategories: ['HVAC'],
    requestTitle: 'No heat',
    requestCategory: 'Heating & cooling',
  },
  {
    kind: 'NO_HOT_WATER',
    label: 'No hot water',
    examples: 'Cold at every tap, or hot water runs out fast',
    severity: 'SOON',
    steps: [
      {
        title: 'Check whether it is everywhere or one tap',
        detail: 'One tap is a fixture problem. Every tap is the water heater.',
      },
      {
        title: 'Electric heater? Check the breaker',
        needs: 'ELECTRICAL_PANEL',
      },
      {
        title: 'Look for water around the base of the tank',
        detail: 'If there is any, close the shutoff on the heater and tell us today. A leaking tank rarely stops leaking.',
        needs: 'WATER_HEATER_SHUTOFF',
      },
      {
        title: 'Tell us — we know its age and warranty',
        detail: 'Your heater is on your record with its install date. If it is still in warranty, that changes what we do.',
      },
    ],
    doNot: [
      'Do not relight a gas pilot if you smell gas — leave and call the utility',
      'Do not turn the thermostat above 120°F — it scalds',
    ],
    assetCategories: ['Water Heater'],
    requestTitle: 'No hot water',
    requestCategory: 'Plumbing',
  },
  {
    kind: 'NO_WATER',
    label: 'No water at all',
    examples: 'Nothing at any tap',
    severity: 'URGENT',
    steps: [
      {
        title: 'Check whether the main is closed',
        detail: 'If anyone has worked on the house recently, this is the first thing to rule out.',
        needs: 'WATER_MAIN',
      },
      {
        title: 'On a well? Check the pump breaker',
        detail: 'A well home has no water when the pump has no power. On public water, a power cut does not stop the water.',
        needs: 'WELL_PUMP',
      },
      {
        title: 'In a freeze, suspect a frozen line',
        detail: 'Open the cupboards under sinks on outside walls. Warm the area gently — never with a flame.',
      },
    ],
    doNot: [
      'Never thaw a pipe with a blowtorch or open flame',
    ],
    requestTitle: 'No water',
    requestCategory: 'Plumbing',
  },
  {
    kind: 'ROOF_LEAK',
    label: 'Roof leaking or storm damage',
    examples: 'Water through the ceiling, missing shingles, tree damage',
    severity: 'URGENT',
    steps: [
      {
        title: 'Stay off the roof',
        detail: 'A wet or storm-damaged roof is not somewhere to be, and nothing up there needs doing tonight.',
      },
      {
        title: 'Catch the water and move what is under it',
        detail: 'A bucket and a tarp. If a ceiling is bulging with trapped water, keep everyone out of that room.',
      },
      {
        title: 'Kill the power to that room if water is near a light',
        detail: 'Water running through a ceiling light fitting is an electrical problem as well as a roof one.',
        needs: 'ELECTRICAL_PANEL',
      },
      {
        title: 'Photograph it now, before anything is moved',
        detail: 'Storm damage is an insurance matter and the photos are the claim. The camera in this app files them to your record.',
      },
    ],
    doNot: [
      'Do not go up on the roof',
      'Do not pull down a wet ceiling yourself',
    ],
    requestTitle: 'Roof leak / storm damage',
    requestCategory: 'Roof & gutters',
  },
  {
    kind: 'APPLIANCE_LEAK',
    label: 'An appliance is leaking',
    examples: 'Dishwasher, washing machine, fridge line, disposal',
    severity: 'URGENT',
    steps: [
      {
        title: 'Switch it off and unplug it if you can reach the plug dry',
        detail: 'If the plug is wet or behind the water, leave it and use the breaker instead.',
      },
      {
        title: 'Close the shutoff behind the appliance',
        detail: 'Most have their own small valve on the supply line. If you cannot find it, close the main.',
        needs: 'WATER_MAIN',
      },
      {
        title: 'Get the water off the floor and check underneath',
        detail: 'Water under a floor or into a cupboard does more damage than what you can see.',
      },
      {
        title: 'Photograph it, including the model plate',
        detail: 'Point the camera at the sticker and the app reads the model and serial off it — which tells us instantly whether it is in warranty.',
      },
    ],
    assetCategories: ['Appliance', 'Plumbing Fixture'],
    requestTitle: 'Appliance leak',
    requestCategory: 'Appliance',
  },
  {
    kind: 'OTHER',
    label: 'Something else',
    examples: 'Not on this list',
    severity: 'SOON',
    steps: [
      {
        title: 'If anyone is in danger, call 911 first',
        detail: 'We are a maintenance company, not the emergency services.',
      },
      {
        title: 'Make it safe if you can do so safely',
        detail: 'Water off, power off to that circuit, everyone out of the affected room.',
      },
      {
        title: 'Tell us what is happening',
        detail: 'A photo and a sentence is enough. We will come back to you.',
      },
    ],
    requestTitle: 'Urgent help needed',
    requestCategory: 'Something else',
  },
];

export function emergencyByKind(kind: string): EmergencyDefinition | null {
  return EMERGENCIES.find((e) => e.kind === kind) ?? null;
}

/** The safety points an emergency's steps actually ask for, in step order. */
export function neededPoints(def: EmergencyDefinition): SafetyPointKind[] {
  const seen = new Set<SafetyPointKind>();
  for (const s of def.steps) {
    if (s.needs) seen.add(s.needs);
  }
  return [...seen];
}

/** What to call a recorded point on screen. */
export function pointLabel(p: SafetyPoint): string {
  return p.label?.trim() || SAFETY_POINT_LABEL[p.kind];
}

/**
 * The line under the header, in the member's own terms.
 *
 * Deliberately never promises a response time the business has not sold
 * them. Response members get priority routing; Core members get told
 * honestly that this is a callback, not a 24/7 line.
 */
export function responsePromise(hasPriority: boolean): string {
  return hasPriority
    ? 'Tell us and it goes to the top of our list — your plan includes priority response.'
    : 'Tell us and we will come back to you as soon as we can during business hours.';
}

/** Always shown. B&M is who you call once you are safe, not instead of 911. */
export const NOT_911_NOTICE =
  'B&M is not an emergency service. If anyone is in danger, or there is fire, gas or a medical emergency, call 911 first.';

/* =====================================================================
 * Propane is not natural gas, and the difference is a safety difference.
 *
 * Two facts drive everything below.
 *
 *  1. **Propane is heavier than air.** Natural gas rises and works its way
 *     out of a house. Propane sinks. It runs downhill, along the floor and
 *     down the basement stairs, and it sits there. So on a propane home
 *     "stay out of the basement" is not general caution — the basement is
 *     where the gas is, and it is the last place the smell clears.
 *
 *  2. **The propane shutoff is OUTSIDE, on the tank.** That is why this
 *     file will tell a propane member to close their valve and will never
 *     tell a natural gas member to go and find theirs. Every propane
 *     supplier's own safety sheet says shut the tank valve if you can do
 *     it safely, because you are already outside and away from the
 *     building when you do it. A natural gas shutoff is at the meter,
 *     often up against the house, and the utility's own advice is to leave
 *     it to them — so we do.
 *
 * The rule from the top of this file still governs: LEAVE comes first,
 * the valve comes after, and "if you can reach it safely" is not decoration.
 * A member who reads only step one has still done the important thing.
 *
 * Which version a member sees comes from properties.heating_fuel. When we
 * have not recorded their fuel they get the natural-gas screen, which is
 * the conservative one — leave and call, touch nothing.
 * ===================================================================== */

const PROPANE_SMELL: EmergencyDefinition = {
  kind: 'GAS_SMELL',
  label: 'I smell gas',
  examples: 'Rotten-egg smell, hissing near the tank or a gas line',
  severity: 'EVACUATE',
  evacuate:
    'Get everyone out of the house now. Do not use light switches, appliances, or your phone until you are outside and away from the building.',
  steps: [
    {
      title: 'Leave the house, taking everyone with you',
      detail: 'Open a door on your way out if it is on your path. Do not stop to look for the leak.',
    },
    {
      title: 'Stay out of the basement and any low ground',
      detail:
        'Propane is heavier than air. It sinks and collects in basements, crawlspaces and along the floor — so the lowest part of your property is the worst place to be, and the last place it clears.',
    },
    {
      title: 'From outside, close the valve on the tank — if you can reach it safely',
      detail:
        'Your tank is outdoors, which is why this is safe to do and finding a shutoff indoors would not be. Lift the lid and turn the service valve clockwise until it stops — a round wheel on most tanks, a small lever on some, and no tools either way. If the smell or the hissing is coming from the tank itself, stay away from it and skip this step.',
      needs: 'PROPANE_TANK_SHUTOFF',
    },
    {
      title: 'From outside, call 911 and your propane supplier',
      detail:
        'Call from the street or a neighbour’s — not from inside. Your supplier’s 24-hour number is on the sticker on your tank and on your delivery ticket.',
      contact: 'PROPANE_SUPPLIER',
    },
    {
      title: 'Keep everyone away until they say it is safe',
      detail: 'Do not go back in for anything, and do not start a car in an attached garage.',
    },
    {
      title: 'Nobody relights it but a technician — then tell us',
      detail:
        'After a leak the whole system has to be leak-tested and the pilots relit by a qualified person. That is the rule, not caution. We will get it done and put it on your record.',
    },
  ],
  doNot: [
    'Do not switch anything on or off — a light switch can make a spark',
    'Do not go down to the basement to look for it — that is where propane collects',
    'Do not light a match, candle or lighter',
    'Do not use your phone until you are outside',
    'Do not go near the tank if the smell or the hissing is coming from it',
  ],
  requestTitle: 'Propane smell — supplier called',
  requestCategory: 'Heating & cooling',
};

/**
 * "You are simply out of gas" is the commonest no-heat call on a delivered
 * fuel, and the one a homeowner can answer themselves in thirty seconds.
 *
 * The relight warning is not us being careful. After a run-out, propane
 * rules require the system to be leak-tested before it goes back into
 * service — which is a job for whoever fills the tank, not the homeowner.
 */
const OUT_OF_PROPANE: EmergencyStep = {
  title: 'Check the tank gauge — you may simply be out',
  detail:
    'Lift the lid on the tank and read the dial. Under 10% is low and worth a call; at zero the furnace has nothing to burn. This is the answer more often than anything else on this list.',
  needs: 'PROPANE_TANK_SHUTOFF',
};

const NO_RELIGHT_AFTER_RUNOUT =
  'Do not try to relight the system yourself after running out — it has to be leak-tested first, and your supplier does that when they fill you';

const OUT_OF_OIL: EmergencyStep = {
  title: 'Check the tank gauge — you may simply be out',
  detail:
    'The float gauge is on top of the tank. At the bottom of the sight glass the burner has nothing to burn, and a run-out usually pulls sludge into the line as well, so it needs a filter and a bleed rather than just a delivery.',
  needs: 'OIL_TANK_SHUTOFF',
};

/**
 * The same emergency, told for this house.
 *
 * Returns the definition unchanged for every fuel we have no special
 * advice for — including an unrecorded one, which falls through to the
 * conservative natural-gas wording on purpose.
 */
export function adaptForFuel(
  def: EmergencyDefinition,
  fuel: HeatingFuel | null | undefined,
): EmergencyDefinition {
  if (fuel === 'PROPANE') {
    if (def.kind === 'GAS_SMELL') return PROPANE_SMELL;
    if (def.kind === 'NO_HEAT') {
      return {
        ...def,
        steps: [def.steps[0], OUT_OF_PROPANE, ...def.steps.slice(1)],
        doNot: [...(def.doNot ?? []), NO_RELIGHT_AFTER_RUNOUT],
      };
    }
  }

  if (fuel === 'OIL' && def.kind === 'NO_HEAT') {
    return { ...def, steps: [def.steps[0], OUT_OF_OIL, ...def.steps.slice(1)] };
  }

  return def;
}

/** Every emergency, told for this house. Used by the picker. */
export function emergenciesForFuel(fuel: HeatingFuel | null | undefined): EmergencyDefinition[] {
  return EMERGENCIES.map((e) => adaptForFuel(e, fuel));
}

/**
 * The shutoffs a technician is expected to photograph on this house.
 *
 * Fuel-dependent, because chasing a technician for a natural gas meter on
 * an all-electric house trains them to ignore the prompt — and a propane
 * home with no tank valve recorded is a real gap, since that is the one
 * valve we will actually ask a member to turn.
 */
export function coreSafetyKinds(fuel: HeatingFuel | null | undefined): SafetyPointKind[] {
  const base: SafetyPointKind[] = [
    'WATER_MAIN',
    'ELECTRICAL_PANEL',
    'WATER_HEATER_SHUTOFF',
    'SUMP_PUMP',
    'MAIN_CLEANOUT',
  ];

  switch (fuel) {
    case 'PROPANE':
      return ['WATER_MAIN', 'PROPANE_TANK_SHUTOFF', 'ELECTRICAL_PANEL', ...base.slice(2)];
    case 'OIL':
      return ['WATER_MAIN', 'OIL_TANK_SHUTOFF', 'ELECTRICAL_PANEL', ...base.slice(2)];
    case 'ELECTRIC':
    case 'HEAT_PUMP':
      return base;
    // Natural gas, and an unrecorded fuel. A house we have not asked about
    // yet is more likely to have gas than not around here, and an extra
    // prompt costs a technician one tap.
    default:
      return ['WATER_MAIN', 'GAS_MAIN', 'ELECTRICAL_PANEL', ...base.slice(2)];
  }
}
