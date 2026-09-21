import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, formatDate } from '@/components/ui';
import { loadTemplateForDate } from '@/lib/checklists';
import SyncBanner from '@/components/field/sync-banner';
import type { Visit, Property } from '@/lib/types/database';

function isToday(value: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default async function FieldHomePage() {
  const profile = await requireRole('tech', 'admin');
  const supabase = await createClient();

  // RLS already limits this to properties this tech is assigned to.
  const { data: visits } = await supabase
    .from('visits')
    .select('*')
    .in('status', ['SCHEDULED', 'IN_PROGRESS'])
    .order('scheduled_for');

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, address_line1, city, state');

  const visitRows = (visits ?? []) as Visit[];
  const propertyById = new Map(
    ((properties ?? []) as Pick<Property, 'id' | 'name' | 'address_line1' | 'city' | 'state'>[])
      .map((p) => [p.id, p]),
  );

  const today = visitRows.filter((v) => isToday(v.scheduled_for) || v.status === 'IN_PROGRESS');
  const upcoming = visitRows.filter((v) => !today.includes(v));
  const template = await loadTemplateForDate();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <AppHeader profile={profile} title="Field" subtitle={profile.full_name} />
      <SyncBanner />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <div className="mb-4 rounded-xl bg-navy-700 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-navy-200">
            Current season
          </p>
          <p className="text-lg font-semibold">
            {template.quarter} · {template.season}
          </p>
          <p className="text-sm text-navy-200">{template.focus}</p>
        </div>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Today
        </h2>
        {today.length === 0 ? (
          <EmptyState title="Nothing scheduled today" hint="Upcoming visits are listed below." />
        ) : (
          <ul className="space-y-3">
            {today.map((v) => (
              <VisitCard key={v.id} visit={v} property={propertyById.get(v.property_id)} big />
            ))}
          </ul>
        )}

        {upcoming.length > 0 ? (
          <>
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Coming up
            </h2>
            <ul className="space-y-2">
              {upcoming.map((v) => (
                <VisitCard key={v.id} visit={v} property={propertyById.get(v.property_id)} />
              ))}
            </ul>
          </>
        ) : null}
      </main>

      <BrandFooter />
    </div>
  );
}

function VisitCard({
  visit,
  property,
  big = false,
}: {
  visit: Visit;
  property?: Pick<Property, 'id' | 'name' | 'address_line1' | 'city' | 'state'>;
  big?: boolean;
}) {
  return (
    <li>
      <Link href={`/field/visits/${visit.id}`} className="block">
        <Card className={big ? 'p-5 ring-2 ring-brandgreen-600' : 'p-4'}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate font-semibold text-navy-800 ${big ? 'text-lg' : ''}`}>
                {property?.name ?? 'Property'}
              </p>
              <p className="truncate text-sm text-slate-600">
                {property ? `${property.address_line1}, ${property.city}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {visit.title ?? visit.visit_type} • {formatDate(visit.scheduled_for)}
              </p>
            </div>
            {visit.status === 'IN_PROGRESS' ? (
              <span className="shrink-0 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
                In progress
              </span>
            ) : null}
          </div>
          {big ? (
            <p className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-lg bg-brandgreen-600 font-semibold text-white">
              Open visit
            </p>
          ) : null}
        </Card>
      </Link>
    </li>
  );
}
