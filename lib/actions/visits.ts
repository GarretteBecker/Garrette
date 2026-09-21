'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { appliesToProperty, quarterFor, type Quarter } from '@/lib/checklist-templates';
import { loadTemplateForDate } from '@/lib/checklists';
import { notify } from '@/lib/ghl/notify';
import type { VisitType } from '@/lib/types/database';

/**
 * Put a visit on the calendar.
 *
 * Fires the GHL event so the member gets a text or email about the booking
 * without anyone typing one.
 */
export async function scheduleVisit(formData: FormData): Promise<void> {
  const propertyId = String(formData.get('property_id'));
  const scheduledFor = String(formData.get('scheduled_for') ?? '').trim();
  const visitType = (String(formData.get('visit_type') ?? 'SEASONAL')) as VisitType;
  const title = String(formData.get('title') ?? '').trim() || null;

  if (!propertyId || !scheduledFor) return;

  const supabase = await createClient();
  const template = await loadTemplateForDate(new Date(scheduledFor));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      property_id: propertyId,
      tech_id: String(formData.get('tech_id') ?? '') || null,
      visit_type: visitType,
      status: 'SCHEDULED',
      scheduled_for: scheduledFor,
      title: title ?? `${template.quarter} ${template.season} Visit`,
    })
    .select('id, title, scheduled_for')
    .single();

  if (error || !visit) return;

  await notify('visit.scheduled', propertyId, {
    visit_id: visit.id,
    visit_title: visit.title,
    visit_type: visitType,
    scheduled_for: visit.scheduled_for,
    scheduled_for_readable: new Date(scheduledFor).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }),
    booked_by: user?.id ?? null,
  });

  revalidatePath(`/team/properties/${propertyId}`);
  revalidatePath('/field');
}

/**
 * Start a visit: mark it in progress and, if it has no checklist yet, stamp
 * the seasonal template onto it.
 */
export async function startVisit(formData: FormData): Promise<void> {
  const visitId = String(formData.get('visit_id'));
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from('visits')
    .select('id, status, scheduled_for, started_at, property_id')
    .eq('id', visitId)
    .maybeSingle();

  if (!visit) return;

  const { count } = await supabase
    .from('checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId);

  if (!count) {
    const when = visit.scheduled_for ? new Date(visit.scheduled_for) : new Date();
    const template = await loadTemplateForDate(when);

    // The house decides which items it gets: no septic check on a public
    // sewer, no propane tank on an all-electric home. An item that cannot
    // apply is noise, and noise is how a checklist stops being read.
    const { data: facts } = await supabase
      .from('properties')
      .select('water_source, sewer_type, heating_fuel')
      .eq('id', (visit as { property_id?: string }).property_id ?? '')
      .maybeSingle();

    const items = template.items.filter((item) => appliesToProperty(item, facts ?? null));

    // The visit takes its own copy here and owns it from now on. Editing
    // the Q3 list in March must never rewrite what a tech recorded in August.
    await supabase.from('checklist_items').insert(
      items.map((item, i) => ({
        visit_id: visitId,
        category: item.category,
        label: item.label,
        help_note: item.help ?? null,
        result: 'NOT_CHECKED' as const,
        sort_order: (i + 1) * 10,
        // The band travels with the reading so a report written in 2030
        // knows what counted as healthy in 2026.
        measurement_label: item.measure?.label ?? null,
        measurement_unit: item.measure?.unit ?? null,
        measurement_low: item.measure?.low ?? null,
        measurement_high: item.measure?.high ?? null,
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
    .select('id, property_id, scheduled_for, title, visit_type')
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

    if ((visit as { visit_type?: string }).visit_type === 'ONBOARDING') {
      // The first document a member ever gets is the baseline, not a
      // quarterly — "here is your whole house" rather than "here is what we
      // did in April". It is the one they show somebody else.
      await supabase.from('reports').insert({
        property_id: visit.property_id,
        visit_id: visitId,
        title: 'Home Baseline Report',
        report_type: 'BASELINE',
        period_start: when.toISOString().slice(0, 10),
        period_end: when.toISOString().slice(0, 10),
      });
    } else {
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
  }

  revalidatePath(`/field/visits/${visitId}`);
  revalidatePath(`/team/properties/${visit.property_id}`);
  revalidatePath('/team/reports');
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

/**
 * Put a technician on a visit.
 *
 * Also records the assignment in property_techs, because that is what the
 * RLS policies read: a tech who is not on a property cannot open it, so
 * assigning the visit without assigning the property would give somebody a
 * job they are refused the moment they tap it.
 */
export async function assignVisitTech(formData: FormData): Promise<void> {
  const visitId = String(formData.get('visit_id') ?? '');
  const techId = String(formData.get('tech_id') ?? '') || null;
  if (!visitId) return;

  const supabase = await createClient();

  const { data: visit } = await supabase
    .from('visits')
    .select('id, property_id')
    .eq('id', visitId)
    .maybeSingle();
  if (!visit) return;

  await supabase.from('visits').update({ tech_id: techId }).eq('id', visitId);

  if (techId) {
    await supabase
      .from('property_techs')
      .upsert(
        { property_id: (visit as { property_id: string }).property_id, profile_id: techId },
        { onConflict: 'property_id,profile_id' },
      );
  }

  revalidatePath('/team/visits');
  revalidatePath('/field');
}
