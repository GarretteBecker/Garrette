import { notFound } from 'next/navigation';
import ReportDocument, { type ReportRow } from '@/components/reports/report-document';
import BaselineDocument from '@/components/reports/baseline-document';
import { DEMO_PORTAL_DATA, DEMO_CHECKLISTS, DEMO_SAFETY_POINTS } from '@/lib/member/demo-data';
import type { Finding, Member } from '@/lib/types/database';

/**
 * A real report, from fixture data.
 *
 * The demo's Reports tab used to link at /reports/<id>, which is behind the
 * login wall — so on a sales call it was a dead end at exactly the moment
 * you want to hand somebody the thing they are buying.
 *
 * `demo-r4` is deliberately a clean quarter: nothing wrong, forty-seven
 * checks passed. That is what most of their quarters will look like, and it
 * is the report that has to feel like good news rather than an empty page.
 */
export function generateStaticParams() {
  return DEMO_PORTAL_DATA.reports.map((r) => ({ id: r.id }));
}

/** Which visit each demo report was written up from. */
const VISIT_FOR: Record<string, string | null> = {
  'demo-r0': 'v0',   // the baseline
  'demo-r1': 'v1',
  'demo-r2': 'v2',
  'demo-r3': null,   // annual — covers the whole year
  'demo-r4': 'v3',   // the clean quarter
};

/** Findings in scope for each report, mirroring what the live page queries. */
function findingsFor(reportId: string): Finding[] {
  const all = DEMO_PORTAL_DATA.findings;
  if (reportId === 'demo-r0') return all;                      // baseline: the whole house
  if (reportId === 'demo-r3') return all;                      // annual: everything
  if (reportId === 'demo-r4') return [];                       // the clean quarter
  if (reportId === 'demo-r2') return all.filter((f) => ['f2', 'f5'].includes(f.id));
  return all.filter((f) => ['f1', 'f3', 'f4', 'f11', 'f12'].includes(f.id));
}

export default async function DemoReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = DEMO_PORTAL_DATA.reports.find((r) => r.id === id);
  if (!meta) notFound();

  const visitId = VISIT_FOR[id] ?? null;
  const visit = visitId
    ? DEMO_PORTAL_DATA.visits.find((v) => v.id === visitId) ?? null
    : null;

  const report: ReportRow = {
    id: meta.id,
    property_id: DEMO_PORTAL_DATA.property.id,
    visit_id: visitId,
    title: meta.title,
    report_type: meta.report_type,
    period_start: meta.period_start,
    period_end: meta.period_end,
    generated_at: meta.generated_at,
    status: 'RELEASED',
    released_at: meta.generated_at,
    headline_finding_id: null,
  };

  const member: Member = {
    id: 'demo-member',
    property_id: DEMO_PORTAL_DATA.property.id,
    profile_id: null,
    first_name: DEMO_PORTAL_DATA.memberFirstName,
    last_name: 'Miller',
    email: null,
    phone: null,
    is_primary: true,
    relationship: null,
  };

  if (meta.report_type === 'BASELINE') {
    return (
      <BaselineDocument
        report={report}
        property={DEMO_PORTAL_DATA.property}
        visit={visit}
        members={[member]}
        assets={DEMO_PORTAL_DATA.assets}
        rooms={DEMO_PORTAL_DATA.rooms.map((r) => ({ id: r.id, name: r.name }))}
        findings={findingsFor(id)}
        checklist={visitId ? DEMO_CHECKLISTS[visitId] ?? [] : []}
        plan={DEMO_PORTAL_DATA.planItems}
        safetyPoints={DEMO_SAFETY_POINTS}
        isStaff={false}
        demo
      />
    );
  }

  return (
    <ReportDocument
      report={report}
      property={DEMO_PORTAL_DATA.property}
      visit={visit}
      members={[member]}
      findings={findingsFor(id)}
      checklist={visitId ? DEMO_CHECKLISTS[visitId] ?? [] : []}
      plan={DEMO_PORTAL_DATA.planItems}
      recordUpdates={DEMO_PORTAL_DATA.assets.filter((a) => a.last_serviced_at)}
      photoUrls={new Map()}
      attachments={[]}
      isStaff={false}
      demo
    />
  );
}
