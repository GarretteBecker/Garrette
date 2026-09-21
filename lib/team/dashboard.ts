import { createClient } from '@/lib/supabase/server';
import { STAGE_ORDER } from '@/lib/service-requests';
import { TIERS, type MembershipTier } from '@/lib/membership';
import type { ServiceRequestStage } from '@/lib/types/database';

/**
 * Everything the morning screen needs, in one pass.
 *
 * RLS decides what comes back, so an ops user and the owner run exactly
 * the same queries and simply see the rows they are allowed to see. No
 * role branching in here on purpose — a dashboard that filters in
 * TypeScript is a dashboard that leaks the day somebody forgets to.
 */

export interface DashboardVisit {
  id: string;
  property_id: string;
  property_name: string;
  title: string | null;
  status: string;
  scheduled_for: string | null;
  tech_name: string | null;
}

interface Named { id: string; property_id: string; property_name: string; title: string; created_at: string }

export interface TeamDashboard {
  today: DashboardVisit[];
  thisWeek: DashboardVisit[];
  unassignedVisits: number;
  stageCounts: { stage: ServiceRequestStage; count: number }[];
  openRequests: number;
  waitingOnUs: number;
  actionFindings: Named[];
  reportsAwaitingReview: Named[];
  renewals: { property_id: string; name: string; renews_on: string; tier: MembershipTier }[];
  members: { total: number; byTier: Record<MembershipTier, number>; mrr: number; annualised: number };
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export async function loadDashboard(): Promise<TeamDashboard> {
  const supabase = await createClient();
  const todayStart = startOfDay(new Date());
  const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const in30 = new Date(todayStart); in30.setDate(in30.getDate() + 30);

  const [
    { data: properties }, { data: visits }, { data: requests },
    { data: findings }, { data: reports }, { data: profiles },
  ] = await Promise.all([
    supabase.from('properties').select('id, name, tier, billing_cycle, commitment_start, commitment_months, is_demo'),
    supabase.from('visits')
      .select('id, property_id, title, status, scheduled_for, tech_id')
      .in('status', ['SCHEDULED', 'IN_PROGRESS'])
      .lt('scheduled_for', weekEnd.toISOString())
      .order('scheduled_for'),
    supabase.from('service_requests').select('id, stage'),
    supabase.from('findings')
      .select('id, property_id, title, created_at')
      .eq('status', 'ACTION')
      .is('resolved_at', null)
      .order('created_at'),
    supabase.from('reports')
      .select('id, property_id, title, created_at')
      .is('released_at', null)
      .order('created_at'),
    supabase.from('profiles').select('id, full_name'),
  ]);

  const allProps = (properties ?? []) as {
    id: string; name: string; tier: MembershipTier;
    billing_cycle: string; commitment_start: string | null; commitment_months: number;
    is_demo?: boolean;
  }[];
  // Names come from every property, including the demo, so a demo visit
  // still reads sensibly. Everything that describes the BUSINESS — member
  // count, revenue, renewals — uses real members only.
  const propName = new Map(allProps.map((p) => [p.id, p.name]));
  const props = allProps.filter((p) => !p.is_demo);
  const techName = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]),
  );

  const visitRows: DashboardVisit[] = ((visits ?? []) as {
    id: string; property_id: string; title: string | null;
    status: string; scheduled_for: string | null; tech_id: string | null;
  }[]).map((v) => ({
    id: v.id,
    property_id: v.property_id,
    property_name: propName.get(v.property_id) ?? 'Unknown property',
    title: v.title,
    status: v.status,
    scheduled_for: v.scheduled_for,
    tech_name: v.tech_id ? techName.get(v.tech_id) ?? null : null,
  }));

  const isToday = (v: DashboardVisit) => {
    if (v.status === 'IN_PROGRESS') return true;
    if (!v.scheduled_for) return false;
    const d = new Date(v.scheduled_for);
    return d >= todayStart && d < tomorrow;
  };
  const today = visitRows.filter(isToday);
  const thisWeek = visitRows.filter((v) => !isToday(v));

  const reqRows = (requests ?? []) as { id: string; stage: ServiceRequestStage }[];
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: reqRows.filter((r) => r.stage === stage).length,
  }));

  // Stages where the ball is with B&M and nobody here put it there. These
  // are the ones that go quiet and cost a member a week.
  const OURS: ServiceRequestStage[] = ['NEW', 'TRIAGE', 'APPROVED'];

  // Renewal = commitment_start rolled forward by whole commitment terms
  // until it lands in the future. Handles a member three years in.
  const renewals: TeamDashboard['renewals'] = [];
  for (const p of props) {
    if (!p.commitment_start || !p.commitment_months) continue;
    const renews = new Date(p.commitment_start);
    let guard = 0;
    while (renews < todayStart && guard++ < 200) {
      renews.setMonth(renews.getMonth() + p.commitment_months);
    }
    if (renews <= in30) {
      renewals.push({
        property_id: p.id, name: p.name,
        renews_on: renews.toISOString().slice(0, 10), tier: p.tier,
      });
    }
  }
  renewals.sort((a, b) => a.renews_on.localeCompare(b.renews_on));

  const byTier: Record<MembershipTier, number> = { CORE: 0, RESPONSE: 0 };
  let mrr = 0;
  for (const p of props) {
    const tier = TIERS[p.tier];
    if (!tier) continue;
    byTier[p.tier] += 1;
    // Annual prepay still earns every month — spreading it is the only way
    // the number means anything month to month.
    mrr += p.billing_cycle === 'ANNUAL_PREPAID' ? tier.annualPrepaid / 12 : tier.monthly;
  }

  const named = (rows: unknown): Named[] =>
    ((rows ?? []) as { id: string; property_id: string; title: string; created_at: string }[])
      .map((r) => ({ ...r, property_name: propName.get(r.property_id) ?? 'Unknown property' }));

  return {
    today,
    thisWeek,
    unassignedVisits: visitRows.filter((v) => !v.tech_name).length,
    stageCounts,
    openRequests: reqRows.filter((r) => r.stage !== 'CLOSED').length,
    waitingOnUs: reqRows.filter((r) => OURS.includes(r.stage)).length,
    actionFindings: named(findings),
    reportsAwaitingReview: named(reports),
    renewals,
    members: {
      total: props.length,   // demo homes excluded — see above
      byTier,
      mrr: Math.round(mrr),
      annualised: Math.round(mrr * 12),
    },
  };
}
