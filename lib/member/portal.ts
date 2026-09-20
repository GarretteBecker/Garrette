/**
 * The homeowner portal's view model.
 *
 * Every portal screen renders from these shapes, never from raw database
 * rows. That keeps two things true:
 *
 *   1. The presentational components can be rendered with fixture data (see
 *      lib/member/demo-data.ts) for a sales demo, with no database and no
 *      login, and it is the *same* components — so the demo can never drift
 *      from what a real member sees.
 *   2. The plain-English wording a homeowner reads lives in one place,
 *      rather than being scattered through JSX.
 */

import type {
  Asset, Finding, FindingStatus, PlanItem, Property, Room,
  ServiceRequestStage, Visit,
} from '@/lib/types/database';

export interface PortalReport {
  id: string;
  title: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
}

export interface PortalDocument {
  id: string;
  title: string;
  doc_type: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
}

export interface PortalPhoto {
  id: string;
  asset_id: string | null;
  finding_id: string | null;
  url: string | null;
  caption: string | null;
}

export interface PortalData {
  property: Property;
  memberFirstName: string;
  rooms: Room[];
  assets: Asset[];
  findings: Finding[];
  planItems: PlanItem[];
  visits: Visit[];
  reports: PortalReport[];
  documents: PortalDocument[];
  photos: PortalPhoto[];
  openRequests: {
    id: string; title: string; stage: string; created_at: string;
    /** Set when the job was raised off a Home Plan item. */
    finding_id?: string | null;
  }[];
}

/**
 * The open jobs that came off the Home Plan, keyed by the finding that asked
 * for them. The plan card uses this to show progress instead of a button, so
 * the plan and the request can never say different things.
 */
export function planRequests(
  openRequests: PortalData['openRequests'],
): { finding_id: string; id: string; stage: ServiceRequestStage }[] {
  return openRequests
    .filter((r) => r.finding_id)
    .map((r) => ({
      finding_id: r.finding_id!,
      id: r.id,
      stage: r.stage as ServiceRequestStage,
    }));
}

// ---------------------------------------------------------------- status

export type OverallStatus = 'GOOD' | 'ATTENTION' | 'URGENT';

export interface HomeStatus {
  overall: OverallStatus;
  /** The one-line verdict a homeowner reads first. */
  headline: string;
  /** The sentence under it. */
  detail: string;
  counts: Record<FindingStatus, number>;
  /** Findings that are actually open (not resolved). */
  openCount: number;
}

export function computeHomeStatus(findings: Finding[]): HomeStatus {
  const open = findings.filter((f) => !f.resolved_at);

  const counts = {
    GOOD: 0, MONITOR: 0, PLAN: 0, ACTION: 0, IMPROVEMENT: 0,
  } as Record<FindingStatus, number>;
  for (const f of open) counts[f.status] += 1;

  const actions = counts.ACTION;
  const plans = counts.PLAN;

  if (actions > 0) {
    return {
      overall: 'URGENT',
      headline:
        actions === 1 ? 'One thing needs attention' : `${actions} things need attention`,
      detail:
        'Everything else is in good order. We will walk you through what to do next.',
      counts,
      openCount: open.length,
    };
  }

  if (plans > 0) {
    return {
      overall: 'ATTENTION',
      headline: 'Your home is in good shape',
      detail:
        plans === 1
          ? 'There is one item to budget for, but nothing is urgent.'
          : `There are ${plans} items to budget for, but nothing is urgent.`,
      counts,
      openCount: open.length,
    };
  }

  return {
    overall: 'GOOD',
    headline: 'Your home is in good shape',
    detail: 'Nothing needs your attention right now. We are watching it for you.',
    counts,
    openCount: open.length,
  };
}

// ------------------------------------------------------------ home record

export interface RecordGroup {
  key: string;
  label: string;
  sublabel: string | null;
  assets: Asset[];
}

/** Home Record grouped by room, in the order the tech walks the house. */
export function groupByRoom(assets: Asset[], rooms: Room[]): RecordGroup[] {
  const groups = new Map<string, Asset[]>();

  for (const a of assets) {
    const key = a.room_id ?? '__whole_house__';
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  const ordered: RecordGroup[] = [];

  for (const room of rooms) {
    const list = groups.get(room.id);
    if (list?.length) {
      ordered.push({
        key: room.id,
        label: room.name,
        sublabel: [room.room_type, room.floor].filter(Boolean).join(' · ') || null,
        assets: sortAssets(list),
      });
    }
  }

  const wholeHouse = groups.get('__whole_house__');
  if (wholeHouse?.length) {
    ordered.push({
      key: '__whole_house__',
      label: 'Whole house',
      sublabel: 'Not tied to one room',
      assets: sortAssets(wholeHouse),
    });
  }

  return ordered;
}

/** Home Record grouped by system — how people think when something breaks. */
export function groupBySystem(assets: Asset[]): RecordGroup[] {
  const groups = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = groups.get(a.category) ?? [];
    list.push(a);
    groups.set(a.category, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, list]) => ({
      key: category,
      label: category,
      sublabel: null,
      assets: sortAssets(list),
    }));
}

function sortAssets(list: Asset[]): Asset[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

// -------------------------------------------------------------- warranty

export type WarrantyState = 'LIFETIME' | 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'UNKNOWN';

export interface WarrantyInfo {
  state: WarrantyState;
  label: string;
  /** Days remaining, when that is meaningful. */
  daysLeft: number | null;
}

/**
 * The seed uses a far-future date (2099) to mean "lifetime", which is how
 * Delta and similar manufacturers actually describe their coverage.
 */
export function warrantyInfo(expires: string | null, now: Date = new Date()): WarrantyInfo {
  if (!expires) return { state: 'UNKNOWN', label: 'Not recorded', daysLeft: null };

  const d = new Date(expires);
  if (Number.isNaN(d.getTime())) {
    return { state: 'UNKNOWN', label: 'Not recorded', daysLeft: null };
  }

  if (d.getFullYear() >= 2090) {
    return { state: 'LIFETIME', label: 'Lifetime warranty', daysLeft: null };
  }

  const daysLeft = Math.round((d.getTime() - now.getTime()) / 86_400_000);

  if (daysLeft < 0) return { state: 'ENDED', label: 'Warranty ended', daysLeft };
  if (daysLeft < 120) return { state: 'ENDING_SOON', label: 'Warranty ending soon', daysLeft };
  return { state: 'ACTIVE', label: 'Under warranty', daysLeft };
}

/** Rough "how far through its life is this" percentage, for the detail page. */
export function lifeUsedPercent(asset: Asset, now: Date = new Date()): number | null {
  if (!asset.install_date || !asset.expected_life_years) return null;
  const installed = new Date(asset.install_date);
  if (Number.isNaN(installed.getTime())) return null;

  const years = (now.getTime() - installed.getTime()) / (365.25 * 86_400_000);
  const pct = (years / asset.expected_life_years) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// ------------------------------------------------------------- home plan

export interface PlanGroup {
  status: FindingStatus;
  findings: Finding[];
}

/** Home Plan, grouped the way the brief names it: Action, Plan, Monitor, Improvement. */
export const PLAN_ORDER: FindingStatus[] = ['ACTION', 'PLAN', 'MONITOR', 'IMPROVEMENT'];

export function groupPlan(findings: Finding[]): PlanGroup[] {
  return PLAN_ORDER.map((status) => ({
    status,
    findings: findings.filter((f) => f.status === status && !f.resolved_at),
  })).filter((g) => g.findings.length > 0);
}

/** Total estimated investment across everything currently on the plan. */
export function investmentRange(findings: Finding[]): { low: number; high: number } | null {
  const relevant = findings.filter(
    (f) => !f.resolved_at && (f.estimated_cost_low != null || f.estimated_cost_high != null),
  );
  if (relevant.length === 0) return null;

  const low = relevant.reduce((s, f) => s + Number(f.estimated_cost_low ?? f.estimated_cost_high ?? 0), 0);
  const high = relevant.reduce((s, f) => s + Number(f.estimated_cost_high ?? f.estimated_cost_low ?? 0), 0);
  return { low, high };
}

// -------------------------------------------------------------- activity

export interface ActivityEntry {
  id: string;
  kind: 'visit' | 'report' | 'finding' | 'request';
  title: string;
  detail: string | null;
  at: string;
  href?: string;
}

/** A merged, newest-first feed for the dashboard. */
export function buildActivity(data: PortalData, limit = 6): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const v of data.visits) {
    if (v.status !== 'COMPLETED' || !v.completed_at) continue;
    entries.push({
      id: `visit-${v.id}`,
      kind: 'visit',
      title: v.title ?? 'Seasonal visit',
      detail: v.summary,
      at: v.completed_at,
    });
  }

  for (const r of data.reports) {
    entries.push({
      id: `report-${r.id}`,
      kind: 'report',
      title: r.title,
      detail: 'Your report is ready to read.',
      at: r.generated_at,
      href: `/reports/${r.id}`,
    });
  }

  for (const req of data.openRequests) {
    entries.push({
      id: `request-${req.id}`,
      kind: 'request',
      title: req.title,
      detail: `Service request · ${req.stage.replace(/_/g, ' ')}`,
      at: req.created_at,
    });
  }

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** The next scheduled visit, if there is one. */
export function nextVisit(visits: Visit[]): Visit | null {
  const upcoming = visits
    .filter((v) => v.status === 'SCHEDULED' && v.scheduled_for)
    .sort(
      (a, b) =>
        new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime(),
    );
  return upcoming[0] ?? null;
}
