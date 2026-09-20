import type { ServiceRequestStage, PriorityLevel } from '@/lib/types/database';

/**
 * The request pipeline.
 *
 * The twelve stages come straight from CLAUDE.md and their order is fixed.
 * Each one carries two descriptions: what it means internally, and what the
 * homeowner is told — a member should never have to work out what
 * "ESTIMATING" means for them.
 */

export interface StageMeta {
  stage: ServiceRequestStage;
  /** Office-facing label, spaces not underscores. */
  label: string;
  /** What the homeowner sees. */
  memberLabel: string;
  /** One line of plain English for the member. */
  memberHint: string;
  /** Who the ball is with. */
  owner: 'B&M' | 'Trade' | 'You' | '—';
  tone: 'new' | 'active' | 'waiting' | 'done';
}

export const STAGE_META: Record<ServiceRequestStage, StageMeta> = {
  NEW: {
    stage: 'NEW', label: 'New', memberLabel: 'Received',
    memberHint: 'We have your request and will look at it shortly.',
    owner: 'B&M', tone: 'new',
  },
  TRIAGE: {
    stage: 'TRIAGE', label: 'Triage', memberLabel: 'Being reviewed',
    memberHint: 'We are working out what this needs and who should do it.',
    owner: 'B&M', tone: 'active',
  },
  DISPATCHED: {
    stage: 'DISPATCHED', label: 'Dispatched', memberLabel: 'Sent to a trade',
    memberHint: 'We have sent this to one of our trade partners.',
    owner: 'Trade', tone: 'active',
  },
  ACCEPTED: {
    stage: 'ACCEPTED', label: 'Accepted', memberLabel: 'Accepted',
    memberHint: 'The trade partner has taken the job on.',
    owner: 'Trade', tone: 'active',
  },
  ESTIMATING: {
    stage: 'ESTIMATING', label: 'Estimating', memberLabel: 'Being priced',
    memberHint: 'We are putting a price together for you.',
    owner: 'Trade', tone: 'active',
  },
  AWAITING_APPROVAL: {
    stage: 'AWAITING_APPROVAL', label: 'Awaiting approval', memberLabel: 'Waiting on you',
    memberHint: 'We have sent you a price. Nothing happens until you say go.',
    owner: 'You', tone: 'waiting',
  },
  APPROVED: {
    stage: 'APPROVED', label: 'Approved', memberLabel: 'Approved',
    memberHint: 'You approved the work. We are getting it on the calendar.',
    owner: 'B&M', tone: 'active',
  },
  SCHEDULED: {
    stage: 'SCHEDULED', label: 'Scheduled', memberLabel: 'Scheduled',
    memberHint: 'Booked in. You will see the date and time here.',
    owner: 'B&M', tone: 'active',
  },
  IN_PROGRESS: {
    stage: 'IN_PROGRESS', label: 'In progress', memberLabel: 'Work underway',
    memberHint: 'Someone is on it now.',
    owner: 'Trade', tone: 'active',
  },
  COMPLETED: {
    stage: 'COMPLETED', label: 'Completed', memberLabel: 'Work finished',
    memberHint: 'The work is done. We are writing it up for your records.',
    owner: 'B&M', tone: 'active',
  },
  HOME_RECORD_UPDATED: {
    stage: 'HOME_RECORD_UPDATED', label: 'Home Record updated', memberLabel: 'Added to your Home Record',
    memberHint: 'What was done is now saved against the item in your Home Record.',
    owner: 'B&M', tone: 'active',
  },
  CLOSED: {
    stage: 'CLOSED', label: 'Closed', memberLabel: 'Closed',
    memberHint: 'All finished. The history stays in your Home Record.',
    owner: '—', tone: 'done',
  },
};

/** Fixed order — the pipeline reads left to right. */
export const STAGE_ORDER: ServiceRequestStage[] = [
  'NEW', 'TRIAGE', 'DISPATCHED', 'ACCEPTED', 'ESTIMATING', 'AWAITING_APPROVAL',
  'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'HOME_RECORD_UPDATED', 'CLOSED',
];

/** Stages still needing someone to act. Drives the office board's default view. */
export const OPEN_STAGES: ServiceRequestStage[] = STAGE_ORDER.filter(
  (s) => s !== 'CLOSED',
);

export function stageIndex(stage: ServiceRequestStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * Where a request can go next.
 *
 * Forward one step is the norm; back one step covers a mis-click. COMPLETED
 * is deliberately absent — reaching it goes through the completion form, so
 * that work always gets written up rather than a stage being flipped and
 * the detail lost. HOME_RECORD_UPDATED is set by that same function.
 */
export function nextStages(stage: ServiceRequestStage): ServiceRequestStage[] {
  const i = stageIndex(stage);
  const out: ServiceRequestStage[] = [];
  const forward = STAGE_ORDER[i + 1];
  if (forward && forward !== 'COMPLETED' && forward !== 'HOME_RECORD_UPDATED') {
    out.push(forward);
  }
  if (stage === 'HOME_RECORD_UPDATED') out.push('CLOSED');
  const back = STAGE_ORDER[i - 1];
  if (back && back !== 'COMPLETED' && back !== 'HOME_RECORD_UPDATED') out.push(back);
  return out;
}

export const TONE_STYLE: Record<StageMeta['tone'], { chip: string; dot: string }> = {
  new:     { chip: 'bg-blue-100 text-blue-900',            dot: 'bg-blue-600' },
  active:  { chip: 'bg-navy-100 text-navy-800',            dot: 'bg-navy-600' },
  waiting: { chip: 'bg-amber-100 text-amber-900',          dot: 'bg-amber-600' },
  done:    { chip: 'bg-brandgreen-100 text-brandgreen-800', dot: 'bg-brandgreen-600' },
};

/**
 * What a member picks from when raising a request.
 *
 * ⚠ ASSUMPTION — no spec to work from. These are the categories a
 * residential remodeler in Lancaster County actually gets called about.
 * Stored as free text, so changing this list needs no migration.
 */
export const REQUEST_CATEGORIES = [
  'Plumbing',
  'Heating & cooling',
  'Electrical',
  'Appliance',
  'Roof & gutters',
  'Doors & windows',
  'Exterior & siding',
  'Garage',
  'Water damage or leak',
  'Something else',
];

/** Urgency, in the homeowner's words rather than a priority enum. */
export const URGENCY_OPTIONS: {
  value: PriorityLevel;
  label: string;
  hint: string;
}[] = [
  { value: 'URGENT', label: 'Emergency', hint: 'Water running, no heat, unsafe — we need to move now.' },
  { value: 'HIGH',   label: 'Soon',      hint: 'Not an emergency, but it should not wait weeks.' },
  { value: 'MEDIUM', label: 'Normal',    hint: 'Get to it in the normal course of things.' },
  { value: 'LOW',    label: 'Whenever',  hint: 'No rush at all — bundle it with a visit.' },
];

export function urgencyLabel(priority: PriorityLevel): string {
  return URGENCY_OPTIONS.find((u) => u.value === priority)?.label ?? priority;
}
