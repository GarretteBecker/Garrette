import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, formatDate } from '@/components/ui';
import { releaseReport, unreleaseReport } from '@/lib/actions/reports';
import type { Property } from '@/lib/types/database';

interface ReportRow {
  id: string;
  property_id: string;
  title: string;
  report_type: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'RELEASED';
  period_start: string | null;
  period_end: string | null;
  released_at: string | null;
  generated_at: string;
}

export default async function AdminReportsPage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const [{ data: reports }, { data: properties }] = await Promise.all([
    supabase.from('reports').select('*').order('generated_at', { ascending: false }),
    supabase.from('properties').select('id, name'),
  ]);

  const rows = (reports ?? []) as ReportRow[];
  const nameById = new Map(
    ((properties ?? []) as Pick<Property, 'id' | 'name'>[]).map((p) => [p.id, p.name]),
  );

  const drafts = rows.filter((r) => r.status !== 'RELEASED');
  const released = rows.filter((r) => r.status === 'RELEASED');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title="Reports" subtitle="Review before release" backHref="/admin" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Waiting for your review ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            hint="A draft report appears here each time a visit is completed."
          />
        ) : (
          <ul className="space-y-2">
            {drafts.map((r) => (
              <li key={r.id}>
                <Card className="p-4 ring-2 ring-amber-400">
                  <p className="font-semibold text-navy-800">{r.title}</p>
                  <p className="text-sm text-slate-600">{nameById.get(r.property_id)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/reports/${r.id}`}
                      className="inline-flex h-11 items-center rounded-lg bg-navy-700 px-4 text-sm font-semibold text-white"
                    >
                      Review
                    </Link>
                    <form action={releaseReport}>
                      <input type="hidden" name="report_id" value={r.id} />
                      <button
                        type="submit"
                        className="h-11 rounded-lg bg-brandgreen-600 px-4 text-sm font-semibold text-white"
                      >
                        Release to member
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Released ({released.length})
        </h2>
        {released.length === 0 ? (
          <EmptyState title="Nothing released yet" />
        ) : (
          <ul className="space-y-2">
            {released.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-800">{r.title}</p>
                      <p className="truncate text-sm text-slate-600">
                        {nameById.get(r.property_id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Released {formatDate(r.released_at)}
                      </p>
                    </div>
                    <Link
                      href={`/reports/${r.id}`}
                      className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                    >
                      Open
                    </Link>
                  </div>
                  <form action={unreleaseReport} className="mt-2">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="text-xs font-medium text-slate-500 underline">
                      Pull back to draft
                    </button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
