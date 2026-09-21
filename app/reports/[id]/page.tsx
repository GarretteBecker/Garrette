import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ReportDocument, { type ReportRow } from '@/components/reports/report-document';
import { type ReportFile } from '@/components/admin/report-attachments';
import type { Property, Finding, PlanItem, Visit, ChecklistItem, Member, Asset } from '@/lib/types/database';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
  if (!report) notFound();
  const r = report as ReportRow;

  const isStaff = profile.role === 'admin' || profile.role === 'tech';

  const [{ data: property }, { data: members }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', r.property_id).maybeSingle(),
    supabase.from('members').select('*').eq('property_id', r.property_id),
  ]);
  if (!property) notFound();
  const p = property as Property;

  const isAnnual = r.report_type === 'ANNUAL_REVIEW';

  // Findings in scope: this visit for a quarterly report, the whole period
  // for an annual one.
  const findingsQuery = supabase.from('findings').select('*').eq('property_id', r.property_id);
  const { data: allFindings } = isAnnual
    ? await findingsQuery
        .gte('created_at', r.period_start ?? '1900-01-01')
        .lte('created_at', `${r.period_end ?? '2999-12-31'}T23:59:59`)
        .order('created_at', { ascending: false })
    : await findingsQuery.eq('visit_id', r.visit_id ?? '').order('created_at', { ascending: false });

  const findings = (allFindings ?? []) as Finding[];

  const [{ data: planItems }, { data: visit }, { data: checklist }, { data: assets }] =
    await Promise.all([
      supabase
        .from('plan_items')
        .select('*')
        .eq('property_id', r.property_id)
        .in('status', ['PROPOSED', 'APPROVED', 'SCHEDULED', 'DEFERRED'])
        .order('target_year')
        .order('sort_order'),
      r.visit_id
        ? supabase.from('visits').select('*').eq('id', r.visit_id).maybeSingle()
        : Promise.resolve({ data: null }),
      r.visit_id
        ? supabase.from('checklist_items').select('*').eq('visit_id', r.visit_id).order('sort_order')
        : Promise.resolve({ data: [] }),
      supabase
        .from('assets')
        .select('*')
        .eq('property_id', r.property_id)
        .gte('updated_at', r.period_start ?? '1900-01-01')
        .order('updated_at', { ascending: false }),
    ]);

  const plan = (planItems ?? []) as PlanItem[];
  const v = (visit ?? null) as Visit | null;
  const items = (checklist ?? []) as ChecklistItem[];
  const recordUpdates = (assets ?? []) as Asset[];
  const memberRows = (members ?? []) as Member[];

  // Photos for the findings in this report, as signed URLs.
  const findingIds = findings.map((f) => f.id);
  const photoUrls = new Map<string, string[]>();
  if (findingIds.length > 0) {
    const { data: photos } = await supabase
      .from('photos')
      .select('finding_id, storage_path')
      .in('finding_id', findingIds);

    for (const row of (photos ?? []) as { finding_id: string; storage_path: string }[]) {
      const { data: signed } = await supabase.storage
        .from('property-photos')
        .createSignedUrl(row.storage_path, 3600);
      if (signed?.signedUrl) {
        const list = photoUrls.get(row.finding_id) ?? [];
        list.push(signed.signedUrl);
        photoUrls.set(row.finding_id, list);
      }
    }
  }

  // Files the office attached to this report. RLS hides these from a member
  // until the report is released (migration 0009).
  const { data: attachmentRows } = await supabase
    .from('documents')
    .select('id, title, doc_type, storage_path, size_bytes, created_at')
    .eq('report_id', id)
    .order('created_at');

  const attachments: (ReportFile & { url: string | null })[] = [];
  for (const row of (attachmentRows ?? []) as ReportFile[]) {
    const { data: signed } = await supabase.storage
      .from('property-docs')
      .createSignedUrl(row.storage_path, 3600);
    attachments.push({ ...row, url: signed?.signedUrl ?? null });
  }

  return (
    <ReportDocument
      report={r}
      property={p}
      visit={v}
      members={memberRows}
      findings={findings}
      checklist={items}
      plan={plan}
      recordUpdates={recordUpdates}
      photoUrls={photoUrls}
      attachments={attachments}
      isStaff={isStaff}
    />
  );
}
