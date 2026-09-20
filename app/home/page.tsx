import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, StatusPill, formatDate } from '@/components/ui';
import { FINDING_STATUSES } from '@/lib/types/finding-status';
import type { Property, Finding, PlanItem } from '@/lib/types/database';

/**
 * Member portal — deliberately thin for now. RLS means this page can only
 * ever return the signed-in homeowner's own property, no matter what.
 */
export default async function MemberHomePage() {
  const profile = await requireRole('member');
  const supabase = await createClient();

  const { data: properties } = await supabase.from('properties').select('*').limit(1);
  const property = (properties ?? [])[0] as Property | undefined;

  if (!property) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader profile={profile} title="HomeKeeper" />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <EmptyState
            title="No home linked to your account yet"
            hint="Give B&M a call and we'll get you connected."
          />
        </main>
        <BrandFooter />
      </div>
    );
  }

  const [{ data: findings }, { data: plan }, { data: reports }] = await Promise.all([
    supabase.from('findings').select('*').eq('property_id', property.id)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('plan_items').select('*').eq('property_id', property.id).order('sort_order'),
    supabase.from('reports').select('id, title, generated_at, status')
      .eq('property_id', property.id).order('generated_at', { ascending: false }),
  ]);

  const findingRows = (findings ?? []) as Finding[];
  const planRows = (plan ?? []) as PlanItem[];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title={property.name} subtitle="Your Home Record" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <Card className="mb-5 p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Where things stand</h2>
          <div className="grid grid-cols-5 gap-2">
            {FINDING_STATUSES.map((s) => (
              <div key={s} className="text-center">
                <p className="text-2xl font-semibold text-navy-800">
                  {findingRows.filter((f) => f.status === s).length}
                </p>
                <StatusPill status={s} />
              </div>
            ))}
          </div>
        </Card>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your reports
        </h2>
        {(reports ?? []).length === 0 ? (
          <EmptyState title="No reports yet" hint="You'll see one after each visit." />
        ) : (
          <ul className="mb-5 space-y-2">
            {((reports ?? []) as { id: string; title: string; generated_at: string }[]).map((r) => (
              <li key={r.id}>
                <Link href={`/reports/${r.id}`}>
                  <Card className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-navy-800">{r.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(r.generated_at)}</p>
                    </div>
                    <span className="text-sm font-semibold text-brandgreen-600">Read</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your Home Plan
        </h2>
        {planRows.length === 0 ? (
          <EmptyState title="Nothing planned right now" />
        ) : (
          <ul className="space-y-2">
            {planRows.map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <p className="font-medium text-navy-800">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {[item.target_season, item.target_year].filter(Boolean).join(' ')}
                  </p>
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
