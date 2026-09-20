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

export const CHECKLIST_RESULT_STYLES: Record<ChecklistResult, { label: string; chip: string }> = {
  PASS:           { label: 'Pass',    chip: 'bg-[#2E5E3A] text-white' },
  ATTENTION:      { label: 'Watch',   chip: 'bg-amber-600 text-white' },
  FAIL:           { label: 'Fail',    chip: 'bg-red-700 text-white' },
  NOT_APPLICABLE: { label: 'N/A',     chip: 'bg-slate-400 text-white' },
  NOT_CHECKED:    { label: 'Not yet', chip: 'bg-slate-200 text-slate-700' },
};

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
