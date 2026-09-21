import type {
  FindingStatus,
  ServiceRequestStage,
  AssetCondition,
  ChecklistResult,
} from './database';

/**
 * The five finding statuses and their colors are fixed by CLAUDE.md.
 * Everything that renders a status pulls from here so the colors can
 * never drift apart across screens.
 */
export const FINDING_STATUSES: FindingStatus[] = [
  'GOOD',
  'MONITOR',
  'PLAN',
  'ACTION',
  'IMPROVEMENT',
];

interface StatusStyle {
  label: string;
  colorName: string;
  /** Solid chip — used on dark headers and the field app status picker. */
  solid: string;
  /** Soft chip — used in lists and on white cards. */
  soft: string;
  /** Left border accent for list rows. */
  border: string;
  /** Plain-English meaning, shown to members. */
  meaning: string;
}

export const FINDING_STATUS_STYLES: Record<FindingStatus, StatusStyle> = {
  GOOD: {
    label: 'GOOD',
    colorName: 'green',
    solid: 'bg-[#2E5E3A] text-white',
    soft: 'bg-green-50 text-[#23482c] ring-1 ring-green-600/20',
    border: 'border-l-[#2E5E3A]',
    meaning: 'Working as it should. Nothing needed.',
  },
  MONITOR: {
    label: 'MONITOR',
    colorName: 'blue',
    solid: 'bg-blue-700 text-white',
    soft: 'bg-blue-50 text-blue-900 ring-1 ring-blue-700/20',
    border: 'border-l-blue-700',
    meaning: 'Fine for now. We are keeping an eye on it.',
  },
  PLAN: {
    label: 'PLAN',
    colorName: 'amber',
    solid: 'bg-amber-600 text-white',
    soft: 'bg-amber-50 text-amber-900 ring-1 ring-amber-600/20',
    border: 'border-l-amber-600',
    meaning: 'Budget for this. Not urgent, but it is coming.',
  },
  ACTION: {
    label: 'ACTION',
    colorName: 'red',
    solid: 'bg-red-700 text-white',
    soft: 'bg-red-50 text-red-900 ring-1 ring-red-700/20',
    border: 'border-l-red-700',
    meaning: 'Needs attention soon.',
  },
  IMPROVEMENT: {
    label: 'IMPROVEMENT',
    colorName: 'purple',
    solid: 'bg-violet-700 text-white',
    soft: 'bg-violet-50 text-violet-900 ring-1 ring-violet-700/20',
    border: 'border-l-violet-700',
    meaning: 'Optional upgrade worth considering.',
  },
};

/**
 * The same five colors as raw hex, for the places a Tailwind class will not
 * do: inline styles, print stylesheets, and small colored label text.
 * All five clear WCAG AA against white (checked: 5.02:1 at worst).
 */
export const FINDING_STATUS_HEX: Record<FindingStatus, string> = {
  GOOD: '#2E5E3A',
  MONITOR: '#1d4ed8',
  PLAN: '#b45309',
  ACTION: '#b91c1c',
  IMPROVEMENT: '#6d28d9',
};

/** Stage order, and the display labels with spaces instead of underscores. */
export const SERVICE_REQUEST_STAGES: ServiceRequestStage[] = [
  'NEW',
  'TRIAGE',
  'DISPATCHED',
  'ACCEPTED',
  'ESTIMATING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'HOME_RECORD_UPDATED',
  'CLOSED',
];

export function stageLabel(stage: ServiceRequestStage): string {
  return stage.replace(/_/g, ' ');
}

export const ASSET_CONDITIONS: AssetCondition[] = [
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'END_OF_LIFE',
  'UNKNOWN',
];

export function conditionLabel(condition: AssetCondition): string {
  return condition.replace(/_/g, ' ');
}

export const CHECKLIST_RESULTS: ChecklistResult[] = [
  'PASS',
  'ATTENTION',
  'FAIL',
  'NOT_APPLICABLE',
  'NOT_CHECKED',
];

/**
 * What a technician can say about one item.
 *
 * Six results, and each one names the action rather than the severity —
 * "Repair recommended" tells a member what happens next in a way that
 * "Fail" never did. The palette deliberately rhymes with the finding
 * statuses above: green is fine, blue is watch it, amber is planned work,
 * red is now, purple is somebody else's trade.
 *
 * ATTENTION and FAIL are retired. They still render so that visits done
 * before 2026 read correctly, and CHECKLIST_RESULT_CHOICES leaves them
 * out so nobody can record a new one.
 */
export const CHECKLIST_RESULT_STYLES: Record<
  ChecklistResult,
  { label: string; chip: string; blurb?: string }
> = {
  PASS:               { label: 'Good',       chip: 'bg-[#2E5E3A] text-white',  blurb: 'No action needed' },
  MAINTENANCE_DUE:    { label: 'Maintenance', chip: 'bg-amber-600 text-white',  blurb: 'Routine work recommended' },
  MONITOR:            { label: 'Monitor',    chip: 'bg-sky-700 text-white',    blurb: 'Not failing yet — track it' },
  REPAIR_RECOMMENDED: { label: 'Repair',     chip: 'bg-orange-700 text-white', blurb: 'Plan the repair' },
  SAFETY_URGENT:      { label: 'Urgent',     chip: 'bg-red-700 text-white',    blurb: 'Safety — address now' },
  SPECIALIST_REVIEW:  { label: 'Specialist', chip: 'bg-purple-700 text-white', blurb: 'Needs the right trade' },
  NOT_APPLICABLE:     { label: 'N/A',        chip: 'bg-slate-400 text-white',  blurb: 'Not on this house' },
  NOT_CHECKED:        { label: 'Not yet',    chip: 'bg-slate-200 text-slate-700' },
  // Retired — readable, never offered.
  ATTENTION:          { label: 'Watch',      chip: 'bg-amber-700 text-white' },
  FAIL:               { label: 'Fail',       chip: 'bg-red-800 text-white' },
};

/** What the field screen offers, in the order a tech reaches for them. */
export const CHECKLIST_RESULT_CHOICES: ChecklistResult[] = [
  'PASS',
  'MAINTENANCE_DUE',
  'MONITOR',
  'REPAIR_RECOMMENDED',
  'SAFETY_URGENT',
  'SPECIALIST_REVIEW',
  'NOT_APPLICABLE',
];

/** Anything that is not "Good", "N/A" or untouched needs to reach the member. */
export function needsAttention(result: ChecklistResult): boolean {
  return !['PASS', 'NOT_APPLICABLE', 'NOT_CHECKED'].includes(result);
}

/** Common asset categories, offered as suggestions in the asset form. */
export const ASSET_CATEGORIES = [
  'Appliance',
  'Doors',
  'Electrical',
  'Exterior',
  'Garage',
  'HVAC',
  'Life Safety',
  'Plumbing',
  'Plumbing Fixture',
  'Roof',
  'Shower System',
  'Water Heater',
  'Windows',
  'Other',
];
