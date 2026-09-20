import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/brand';
import SyncBanner from '@/components/field/sync-banner';
import VisitWorkspace from '@/components/field/visit-workspace';
import { startVisit } from '@/lib/actions/visits';
import { Card, formatDate } from '@/components/ui';
import { quarterFor, CHECKLIST_TEMPLATES } from '@/lib/checklist-templates';
import type { Visit, Property, Room, Asset, ChecklistItem, Finding } from '@/lib/types/database';

export default async function FieldVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole('tech', 'admin');
  const { id } = await params;
  const supabase = await createClient();

  const { data: visit } = await supabase.from('visits').select('*').eq('id', id).maybeSingle();
  if (!visit) notFound();

  const v = visit as Visit;

  const [
    { data: property },
    { data: rooms },
    { data: assets },
    { data: checklist },
    { data: findings },
  ] = await Promise.all([
    supabase.from('properties').select('*').eq('id', v.property_id).maybeSingle(),
    supabase.from('rooms').select('*').eq('property_id', v.property_id).order('sort_order'),
    supabase.from('assets').select('*').eq('property_id', v.property_id).order('name'),
    supabase.from('checklist_items').select('*').eq('visit_id', id).order('sort_order'),
    supabase.from('findings').select('*').eq('visit_id', id).order('created_at', { ascending: false }),
  ]);

  if (!property) notFound();
  const p = property as Property;

  const items = (checklist ?? []) as ChecklistItem[];
  const quarter = quarterFor(v.scheduled_for ? new Date(v.scheduled_for) : new Date());
  const template = CHECKLIST_TEMPLATES[quarter];

  // Not started yet: show the big green start button and nothing else.
  if (v.status === 'SCHEDULED' || items.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-100">
        <AppHeader profile={profile} title={p.name} subtitle={p.address_line1} backHref="/field" />
        <SyncBanner />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {formatDate(v.scheduled_for)}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-navy-800">
              {v.title ?? `${template.quarter} ${template.season} Visit`}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{template.focus}</p>
            <p className="mt-4 text-sm text-slate-500">
              {template.items.length} checklist items will be loaded for{' '}
              {template.quarter} ({template.months}).
            </p>

            <form action={startVisit} className="mt-5">
              <input type="hidden" name="visit_id" value={v.id} />
              <button
                type="submit"
                className="h-14 w-full rounded-lg bg-brandgreen-600 text-lg font-semibold text-white active:scale-[0.99]"
              >
                Start visit
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-slate-500">
              Start this while you still have signal — the checklist then works offline.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <AppHeader profile={profile} title={p.name} subtitle={v.title ?? template.season} backHref="/field" />
      <SyncBanner />
      <VisitWorkspace
        visit={v}
        property={p}
        rooms={(rooms ?? []) as Room[]}
        assets={(assets ?? []) as Asset[]}
        checklist={items}
        findings={(findings ?? []) as Finding[]}
        techId={profile.id}
      />
    </div>
  );
}
