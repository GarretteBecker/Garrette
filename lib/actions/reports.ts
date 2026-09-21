'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { notify } from '@/lib/ghl/notify';

/** Admin releases a drafted report to the homeowner. */
export async function releaseReport(formData: FormData): Promise<void> {
  const reportId = String(formData.get('report_id'));
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from('reports')
    .update({
      status: 'RELEASED',
      released_at: new Date().toISOString(),
      released_by: user?.id ?? null,
    })
    .eq('id', reportId);

  // Tell GHL so it can send the member their "your report is ready" message.
  const { data: report } = await supabase
    .from('reports')
    .select('property_id, title, report_type, period_start, period_end')
    .eq('id', reportId)
    .maybeSingle();

  if (report) {
    await notify('report.released', report.property_id, {
      report_id: reportId,
      report_title: report.title,
      report_type: report.report_type,
      period_start: report.period_start,
      period_end: report.period_end,
      report_path: `/reports/${reportId}`,
    });
  }

  revalidatePath('/admin/reports');
  revalidatePath(`/reports/${reportId}`);
}

/** Pull a released report back to draft (mistake recovery). */
export async function unreleaseReport(formData: FormData): Promise<void> {
  const reportId = String(formData.get('report_id'));
  const supabase = await createClient();

  await supabase
    .from('reports')
    .update({ status: 'DRAFT', released_at: null, released_by: null })
    .eq('id', reportId);

  revalidatePath('/admin/reports');
  revalidatePath(`/reports/${reportId}`);
}

/** Mark which finding leads the report. */
export async function setHeadlineFinding(formData: FormData): Promise<void> {
  const reportId = String(formData.get('report_id'));
  const findingId = String(formData.get('finding_id') || '') || null;
  const supabase = await createClient();

  await supabase
    .from('reports')
    .update({ headline_finding_id: findingId })
    .eq('id', reportId);

  revalidatePath(`/reports/${reportId}`);
}

/** Create an Annual Property Report for a calendar year. */
/**
 * Write the baseline by hand.
 *
 * For homes already on the books when this shipped — they never had an
 * onboarding visit to hang it off, but the record exists, so the report
 * can be made from it today.
 */
export async function createBaselineReport(formData: FormData): Promise<void> {
  const propertyId = String(formData.get('property_id'));
  const supabase = await createClient();

  // One baseline per home. A second would not be a baseline.
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('property_id', propertyId)
    .eq('report_type', 'BASELINE')
    .maybeSingle();
  if (existing) return;

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('reports').insert({
    property_id: propertyId,
    title: 'Home Baseline Report',
    report_type: 'BASELINE',
    period_start: today,
    period_end: today,
  });

  revalidatePath('/admin/reports');
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function createAnnualReport(formData: FormData): Promise<void> {
  const propertyId = String(formData.get('property_id'));
  const year = Number(formData.get('year')) || new Date().getFullYear();
  const supabase = await createClient();

  await supabase.from('reports').insert({
    property_id: propertyId,
    title: `${year} Annual Property Report`,
    report_type: 'ANNUAL_REVIEW',
    period_start: `${year}-01-01`,
    period_end: `${year}-12-31`,
  });

  revalidatePath('/admin/reports');
}
