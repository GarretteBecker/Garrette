import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, LinkButton, StatusPill, formatDate } from '@/components/ui';
import type { FindingStatus } from '@/lib/types/database';

interface PropertyRow {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  year_built: number | null;
  square_feet: number | null;
  plan_tier: string | null;
  member_since: string | null;
}

export default async function AdminHomePage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const [{ data: properties }, { data: findings }, { data: requests }, { data: visits }] =
    await Promise.all([
      supabase.from('properties').select('*').order('name'),
      supabase.from('findings').select('id, property_id, status'),
      supabase
        .from('service_requests')
        .select('id, property_id, title, stage, created_at')
        .not('stage', 'in', '("CLOSED")')
        .order('created_at', { ascending: false }),
      supabase
        .from('visits')
        .select('id, property_id, title, status, scheduled_for')
        .eq('status', 'SCHEDULED')
        .order('scheduled_for'),
    ]);

  const rows = (properties ?? []) as PropertyRow[];

  // Count open ACTION findings per property for the attention column.
  const actionCounts = new Map<string, number>();
  for (const f of findings ?? []) {
    const row = f as { property_id: string; status: FindingStatus };
    if (row.status === 'ACTION') {
      actionCounts.set(row.property_id, (actionCounts.get(row.property_id) ?? 0) + 1);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title="HomeKeeper Admin" subtitle={profile.full_name} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Card className="p-3">
            <p className="text-2xl font-semibold text-navy-700">{rows.length}</p>
            <p className="text-xs text-slate-500">Properties</p>
          </Card>
          <Card className="p-3">
            <p className="text-2xl font-semibold text-navy-700">{(requests ?? []).length}</p>
            <p className="text-xs text-slate-500">Open requests</p>
          </Card>
          <Card className="p-3">
            <p className="text-2xl font-semibold text-navy-700">{(visits ?? []).length}</p>
            <p className="text-xs text-slate-500">Upcoming visits</p>
          </Card>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Properties
          </h2>
          <LinkButton href="/admin/trade-partners" variant="secondary">
            Trade partners
          </LinkButton>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No properties yet"
            hint="Run supabase/seed.sql to load the Miller Home demo, or add a property."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => {
              const actions = actionCounts.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/properties/${p.id}`}
                    className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-800">{p.name}</p>
                        <p className="truncate text-sm text-slate-600">
                          {p.address_line1}, {p.city} {p.state} {p.postal_code}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {p.year_built ? `Built ${p.year_built}` : 'Year unknown'}
                          {p.square_feet ? ` • ${p.square_feet.toLocaleString()} sq ft` : ''}
                          {p.plan_tier ? ` • ${p.plan_tier}` : ''}
                        </p>
                      </div>
                      {actions > 0 ? (
                        <span className="shrink-0 rounded bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-800 ring-1 ring-red-700/20">
                          {actions} action
                        </span>
                      ) : (
                        <StatusPill status="GOOD" />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Member since {formatDate(p.member_since)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
