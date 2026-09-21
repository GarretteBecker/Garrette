import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card } from '@/components/ui';
import AssignTech from '@/components/team/assign-tech';
import type { Profile } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface VisitRow {
  id: string;
  property_id: string;
  tech_id: string | null;
  visit_type: string;
  status: string;
  scheduled_for: string | null;
  title: string | null;
}

interface Day {
  key: string;
  label: string;
  isToday: boolean;
  visits: (VisitRow & { property_name: string })[];
}

/**
 * Six weeks of visits, a day per row.
 *
 * A grid month view is the wrong shape here: a quarterly programme puts
 * one or two visits on a day, and the office needs to see who is going
 * and whether anybody is going at all. Empty days are left out entirely
 * rather than drawn as blank boxes.
 */
function buildDays(rows: (VisitRow & { property_name: string })[]): Day[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  const byDay = new Map<string, (VisitRow & { property_name: string })[]>();
  for (const v of rows) {
    if (!v.scheduled_for) continue;
    const key = new Date(v.scheduled_for).toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(v);
    byDay.set(key, list);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, visits]) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      }),
      isToday: key === todayKey,
      visits: visits.sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? '')),
    }));
}

export default async function VisitsPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  const from = new Date();
  from.setDate(from.getDate() - 14);

  const [{ data: visits }, { data: properties }, { data: profiles }] = await Promise.all([
    supabase.from('visits')
      .select('id, property_id, tech_id, visit_type, status, scheduled_for, title')
      .gte('scheduled_for', from.toISOString())
      .order('scheduled_for'),
    supabase.from('properties').select('id, name'),
    supabase.from('profiles').select('id, full_name, role, is_active'),
  ]);

  const propName = new Map(
    ((properties ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );
  const techs = ((profiles ?? []) as Profile[]).filter((p) => p.role === 'tech' && p.is_active);
  const techName = new Map(techs.map((t) => [t.id, t.full_name]));

  const rows = ((visits ?? []) as VisitRow[]).map((v) => ({
    ...v,
    property_name: propName.get(v.property_id) ?? 'Unknown property',
  }));

  const days = buildDays(rows);
  const unassigned = rows.filter((v) => !v.tech_id && v.status === 'SCHEDULED').length;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader profile={profile} title="Visits" subtitle="Who is going where" backHref="/team" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-5">
        {unassigned > 0 ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-600/25">
            <p className="text-[14px] font-semibold text-amber-900">
              {unassigned} scheduled {unassigned === 1 ? 'visit has' : 'visits have'} nobody assigned.
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-900/80">
              An unassigned visit does not appear in anybody&rsquo;s field app, so
              nobody turns up.
            </p>
          </div>
        ) : null}

        <p className="text-[13px] leading-relaxed text-slate-600">
          Everything booked from two weeks ago onwards. Book a new visit from a
          home&rsquo;s page — the visit needs to know which house it is for.
        </p>

        {days.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-semibold text-navy-800">Nothing on the calendar.</p>
            <p className="mt-1 text-[14px] text-slate-600">
              Open a home from <Link href="/team/members" className="font-medium text-brandgreen-700 underline">Members</Link>{' '}
              and schedule its next visit.
            </p>
          </Card>
        ) : (
          days.map((day) => (
            <section key={day.key}>
              <h2 className={`mb-1.5 text-[13px] font-semibold uppercase tracking-wider ${
                day.isToday ? 'text-brandgreen-700' : 'text-slate-500'
              }`}>
                {day.isToday ? `Today · ${day.label}` : day.label}
              </h2>
              <ul className="space-y-2">
                {day.visits.map((v) => (
                  <li key={v.id}>
                    <Card className="p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/team/properties/${v.property_id}`}
                                className="font-medium text-navy-800 hover:underline">
                            {v.property_name}
                          </Link>
                          <p className="text-[13px] text-slate-500">
                            {v.title ?? v.visit_type}
                            {v.scheduled_for ? ` · ${new Date(v.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                          v.status === 'COMPLETED' ? 'bg-brandgreen-100 text-brandgreen-800'
                          : v.status === 'IN_PROGRESS' ? 'bg-navy-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                        }`}>
                          {v.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                      {v.status === 'SCHEDULED' ? (
                        <AssignTech
                          visitId={v.id}
                          currentTechId={v.tech_id}
                          currentTechName={v.tech_id ? techName.get(v.tech_id) ?? null : null}
                          techs={techs.map((t) => ({ id: t.id, name: t.full_name }))}
                        />
                      ) : v.tech_id ? (
                        <p className="mt-1.5 text-[13px] text-slate-500">
                          {techName.get(v.tech_id) ?? 'Assigned'}
                        </p>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <BrandFooter />
    </div>
  );
}
