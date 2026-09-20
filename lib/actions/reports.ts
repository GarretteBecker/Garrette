'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
