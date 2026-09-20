'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CHECKLIST_TEMPLATES, quarterFor, type Quarter } from '@/lib/checklist-templates';

/**
 * Start a visit: mark it in progress and, if it has no checklist yet, stamp
 * the seasonal template onto it.
 */
export async function startVisit(formData: FormData): Promise<void> {
  const visitId = String(formData.get('visit_id'));
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from('visits')
    .select('id, status, scheduled_for, started_at')
    .eq('id', visitId)
    .maybeSingle();

  if (!visit) return;

  const { count } = await supabase
    .from('checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId);

  if (!count) {
    const when = visit.scheduled_for ? new Date(visit.scheduled_for) : new Date();
    const quarter: Quarter = quarterFor(when);
    const template = CHECKLIST_TEMPLATES[quarter];

    await supabase.from('checklist_items').insert(
      template.items.map((item, i) => ({
        visit_id: visitId,
        category: item.category,
        label: item.label,
        result: 'NOT_CHECKED' as const,
        sort_order: (i + 1) * 10,
      })),
    );
  }

  await supabase
    .from('visits')
    .update({
      status: 'IN_PROGRESS',
      started_at: visit.started_at ?? new Date().toISOString(),
    })
    .eq('id', visitId);

  revalidatePath(`/field/visits/${visitId}`);
}

/**
 * Complete a visit and draft the quarterly report.
 *
 * The report row is created in DRAFT so an admin reviews it before the
 * member ever sees it.
 */
export async function completeVisit(formData: FormData): Promise<void> {
  const visitId = String(formData.get('visit_id'));
  const summary = String(formData.get('summary') ?? '').trim();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from('visits')
    .select('id, property_id, scheduled_for, title')
    .eq('id', visitId)
    .maybeSingle();

  if (!visit) return;

  const completedAt = new Date().toISOString();

  await supabase
    .from('visits')
    .update({
      status: 'COMPLETED',
      completed_at: completedAt,
      summary: summary || null,
    })
    .eq('id', visitId);

  // Draft the quarterly report for this visit, if one does not exist yet.
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('visit_id', visitId)
    .maybeSingle();

  if (!existing) {
    const when = visit.scheduled_for ? new Date(visit.scheduled_for) : new Date(completedAt);
    const quarter = quarterFor(when);
    const period = periodForQuarter(quarter, when.getFullYear());

    await supabase.from('reports').insert({
      property_id: visit.property_id,
      visit_id: visitId,
      title: `${quarter} ${when.getFullYear()} HomeKeeper Report`,
      report_type: 'VISIT_SUMMARY',
      period_start: period.start,
      period_end: period.end,
    });
  }

  revalidatePath(`/field/visits/${visitId}`);
  revalidatePath(`/admin/properties/${visit.property_id}`);
  revalidatePath('/admin/reports');
}

function periodForQuarter(quarter: Quarter, year: number) {
  const ranges: Record<Quarter, [string, string]> = {
    Q1: [`${year}-01-01`, `${year}-03-31`],
    Q2: [`${year}-04-01`, `${year}-06-30`],
    Q3: [`${year}-07-01`, `${year}-09-30`],
    Q4: [`${year}-10-01`, `${year}-12-31`],
  };
  const [start, end] = ranges[quarter];
  return { start, end };
}
