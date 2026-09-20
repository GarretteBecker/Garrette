import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, formatDate } from '@/components/ui';
import { STAGE_META, STAGE_ORDER, TONE_STYLE, urgencyLabel } from '@/lib/service-requests';
import type { ServiceRequest, Property, ServiceRequestStage } from '@/lib/types/database';

/**
 * The request board.
 *
 * Grouped down the page by stage rather than across in columns: the office
 * runs this from a phone as often as a desk, and horizontal kanban is
 * miserable on a 390px screen.
 */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const profile = await requireRole('admin');
  const { stage: stageFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: requests }, { data: properties }, { data: partners }] = await Promise.all([
    supabase.from('service_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('properties').select('id, name'),
    supabase.from('trade_partners').select('id, company_name'),
  ]);

  const rows = (requests ?? []) as ServiceRequest[];
  const propertyName = new Map(
    ((properties ?? []) as Pick<Property, 'id' | 'name'>[]).map((p) => [p.id, p.name]),
  );
  const partnerName = new Map(
    ((partners ?? []) as { id: string; company_name: string }[]).map((p) => [p.id, p.company_name]),
  );

  const showing = stageFilter
    ? rows.filter((r) => r.stage === stageFilter)
    : rows.filter((r) => r.stage !== 'CLOSED');

  const countFor = (s: ServiceRequestStage) => rows.filter((r) => r.stage === s).length;
  const needsAction = rows.filter((r) => r.stage === 'NEW' || r.stage === 'TRIAGE').length;

  // Group what is on screen by stage, in pipeline order.
  const grouped = STAGE_ORDER.map((s) => ({
    stage: s,
    items: showing.filter((r) => r.stage === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title="Request board" subtitle={`${showing.length} showing`} backHref="/admin" />

      <nav className="sticky top-[60px] z-10 overflow-x-auto border-b border-slate-200 bg-white">
        <ul className="flex min-w-max gap-1 px-2 py-2">
          <li>
            <Link
              href="/admin/requests"
              className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ${
                !stageFilter ? 'bg-navy-700 text-white' : 'text-slate-600'
              }`}
            >
              Open ({rows.filter((r) => r.stage !== 'CLOSED').length})
            </Link>
          </li>
          {STAGE_ORDER.map((s) => {
            const n = countFor(s);
            if (n === 0) return null;
            return (
              <li key={s}>
                <Link
                  href={`/admin/requests?stage=${s}`}
                  className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ${
                    stageFilter === s ? 'bg-navy-700 text-white' : 'text-slate-600'
                  }`}
                >
                  {STAGE_META[s].label} ({n})
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        {needsAction > 0 && !stageFilter ? (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-600/20">
            {needsAction} request{needsAction === 1 ? '' : 's'} waiting to be triaged.
          </p>
        ) : null}

        {grouped.length === 0 ? (
          <EmptyState title="Nothing here" hint="No requests at this stage." />
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => {
              const meta = STAGE_META[group.stage];
              return (
                <section key={group.stage}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${TONE_STYLE[meta.tone].dot}`} aria-hidden="true" />
                    <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                      {meta.label}
                    </h2>
                    <span className="text-[12px] text-slate-400">{group.items.length}</span>
                    <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      with {meta.owner}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {group.items.map((r) => (
                      <li key={r.id}>
                        <Link href={`/admin/requests/${r.id}`}>
                          <Card className="p-4 active:bg-slate-50">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold leading-snug text-navy-800">{r.title}</p>
                              {r.priority === 'URGENT' ? (
                                <span className="shrink-0 rounded bg-red-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                  Emergency
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-[13px] text-slate-600">
                              {propertyName.get(r.property_id) ?? 'Property'}
                              {r.category ? ` · ${r.category}` : ''}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatDate(r.created_at)} · {urgencyLabel(r.priority)}
                              {r.trade_partner_id ? ` · ${partnerName.get(r.trade_partner_id) ?? 'Trade'}` : ''}
                            </p>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}
