import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import {
  Card,
  EmptyState,
  StatusPill,
  formatDate,
  formatMoneyRange,
} from '@/components/ui';
import { FINDING_STATUSES, stageLabel } from '@/lib/types/finding-status';
import RoomEditor from '@/components/admin/room-editor';
import AssetEditor from '@/components/admin/asset-editor';
import DocumentManager, { type DocRow } from '@/components/admin/document-manager';
import { scheduleVisit } from '@/lib/actions/visits';
import { saveMembership } from '@/lib/actions/properties';
import { TIERS, money, type MembershipTier } from '@/lib/membership';
import { inputClass, Field } from '@/components/ui';
import type { AssetPhoto } from '@/components/admin/asset-photos';
import type {
  Property, Room, Asset, Visit, Finding, PlanItem, ServiceRequest, Member,
} from '@/lib/types/database';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'record', label: 'Home Record' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'findings', label: 'Findings' },
  { key: 'visits', label: 'Visits' },
  { key: 'plan', label: 'Home Plan' },
  { key: 'requests', label: 'Requests' },
  { key: 'documents', label: 'Documents' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireRole('admin');
  const { id } = await params;
  const { tab } = await searchParams;

  const active: TabKey = (TABS.find((t) => t.key === tab)?.key ?? 'overview') as TabKey;

  const supabase = await createClient();

  const [
    { data: property },
    { data: members },
    { data: rooms },
    { data: assets },
    { data: visits },
    { data: findings },
    { data: planItems },
    { data: requests },
    { data: documents },
    { data: photoRows },
  ] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).maybeSingle(),
    supabase.from('members').select('*').eq('property_id', id),
    supabase.from('rooms').select('*').eq('property_id', id).order('sort_order'),
    supabase.from('assets').select('*').eq('property_id', id).order('category').order('name'),
    supabase.from('visits').select('*').eq('property_id', id).order('scheduled_for', { ascending: false }),
    supabase.from('findings').select('*').eq('property_id', id).order('created_at', { ascending: false }),
    supabase.from('plan_items').select('*').eq('property_id', id).order('sort_order'),
    supabase.from('service_requests').select('*').eq('property_id', id).order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, doc_type, storage_path, size_bytes, created_at')
      .eq('property_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('photos')
      .select('id, asset_id, storage_path, caption, note, kind, scan_status')
      .eq('property_id', id)
      .not('asset_id', 'is', null)
      .order('created_at', { ascending: false }),
  ]);

  if (!property) notFound();

  const p = property as Property;
  const roomRows = (rooms ?? []) as Room[];
  const assetRows = (assets ?? []) as Asset[];
  const visitRows = (visits ?? []) as Visit[];
  const findingRows = (findings ?? []) as Finding[];
  const planRows = (planItems ?? []) as PlanItem[];
  const requestRows = (requests ?? []) as ServiceRequest[];
  const memberRows = (members ?? []) as Member[];
  const documentRows = (documents ?? []) as DocRow[];

  // Sign each asset photo once, on the server. The bucket is private, so a
  // raw storage path is useless without one of these.
  const photosByAsset: Record<string, AssetPhoto[]> = {};
  for (const row of (photoRows ?? []) as {
    id: string;
    asset_id: string;
    storage_path: string;
    caption: string | null;
    note: string | null;
    kind: string;
    scan_status: string;
  }[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(row.storage_path, 3600);
    const list = photosByAsset[row.asset_id] ?? [];
    list.push({
      id: row.id,
      storage_path: row.storage_path,
      caption: row.caption,
      note: row.note,
      kind: row.kind,
      scan_status: row.scan_status,
      url: signed?.signedUrl ?? null,
    });
    photosByAsset[row.asset_id] = list;
  }

  const counts = FINDING_STATUSES.map((s) => ({
    status: s,
    n: findingRows.filter((f) => f.status === s).length,
  }));

  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title={p.name}
        subtitle={`${p.address_line1}, ${p.city} ${p.state}`}
        backHref="/admin"
      />

      {/* Horizontally scrollable tabs — works one-handed on a phone. */}
      <nav className="sticky top-[60px] z-10 overflow-x-auto border-b border-slate-200 bg-white">
        <ul className="flex min-w-max gap-1 px-2 py-2">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/properties/${id}?tab=${t.key}`}
                className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ${
                  active === t.key
                    ? 'bg-navy-700 text-white'
                    : 'text-slate-600 active:bg-slate-100'
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        {active === 'overview' ? (
          <div className="space-y-5">
            <Card className="p-4">
              <h2 className="mb-3 font-semibold text-navy-800">The home</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Built" value={p.year_built?.toString() ?? '—'} />
                <Detail label="Size" value={p.square_feet ? `${p.square_feet.toLocaleString()} sq ft` : '—'} />
                <Detail label="Bedrooms" value={p.bedrooms?.toString() ?? '—'} />
                <Detail label="Bathrooms" value={p.bathrooms?.toString() ?? '—'} />
                <Detail label="Lot" value={p.lot_size_acres ? `${p.lot_size_acres} acres` : '—'} />
                <Detail label="Tier" value={TIERS[((p as unknown as { tier?: MembershipTier }).tier ?? 'CORE')].name} />
                <Detail label="Member since" value={formatDate(p.member_since)} />
                <Detail label="Items tracked" value={assetRows.length.toString()} />
              </dl>
              {p.notes ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{p.notes}</p>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold text-navy-800">Status summary</h2>
              <div className="grid grid-cols-5 gap-2">
                {counts.map(({ status, n }) => (
                  <div key={status} className="text-center">
                    <p className="text-2xl font-semibold text-navy-800">{n}</p>
                    <StatusPill status={status} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-1 font-semibold text-navy-800">Membership</h2>
              <p className="mb-3 text-[13px] text-slate-500">
                Tier gates quarterly visits, quarterly reports, the Hub and
                urgent help — enforced in the database, not just here.
              </p>
              <form action={saveMembership} className="space-y-3">
                <input type="hidden" name="property_id" value={id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tier" htmlFor="tier">
                    <select
                      id="tier"
                      name="tier"
                      defaultValue={(p as unknown as { tier?: MembershipTier }).tier ?? 'CORE'}
                      className={inputClass}
                    >
                      {(['CORE', 'RESPONSE'] as MembershipTier[]).map((t) => (
                        <option key={t} value={t}>
                          {TIERS[t].name} — {money(TIERS[t].monthly)}/mo
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Billing" htmlFor="billing_cycle">
                    <select
                      id="billing_cycle"
                      name="billing_cycle"
                      defaultValue={(p as unknown as { billing_cycle?: string }).billing_cycle ?? 'MONTHLY'}
                      className={inputClass}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL_PREPAID">Annual prepaid</option>
                    </select>
                  </Field>
                </div>
                <Field label="Agreement started" htmlFor="commitment_start" hint="12-month initial term.">
                  <input
                    id="commitment_start"
                    name="commitment_start"
                    type="date"
                    defaultValue={(p as unknown as { commitment_start?: string }).commitment_start ?? ''}
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white">
                  Save membership
                </button>
              </form>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold text-navy-800">Homeowners</h2>
              {memberRows.length === 0 ? (
                <p className="text-sm text-slate-500">No homeowners linked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {memberRows.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-navy-800">
                          {m.first_name} {m.last_name}
                          {m.is_primary ? (
                            <span className="ml-2 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy-700">
                              Primary
                            </span>
                          ) : null}
                        </p>
                        <p className="text-slate-500">{m.email ?? m.phone ?? '—'}</p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {m.profile_id ? 'Portal access' : 'No login'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ) : null}

        {active === 'record' ? (
          <AssetEditor
            propertyId={id}
            assets={assetRows}
            rooms={roomRows}
            photosByAsset={photosByAsset}
          />
        ) : null}

        {active === 'rooms' ? <RoomEditor propertyId={id} rooms={roomRows} /> : null}

        {active === 'findings' ? (
          findingRows.length === 0 ? (
            <EmptyState title="No findings recorded" />
          ) : (
            <ul className="space-y-2">
              {findingRows.map((f) => (
                <li key={f.id}>
                  <Card className="border-l-4 border-l-slate-200 p-4">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <p className="font-semibold text-navy-800">{f.title}</p>
                      <StatusPill status={f.status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {roomNameById.get(f.room_id ?? '') ?? 'Whole house'} • {formatDate(f.created_at)}
                    </p>
                    {f.description ? (
                      <p className="mt-2 text-sm text-slate-700">{f.description}</p>
                    ) : null}
                    {f.recommendation ? (
                      <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">
                        <span className="font-medium">Recommendation: </span>
                        {f.recommendation}
                      </p>
                    ) : null}
                    {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high) ? (
                      <p className="mt-2 text-sm font-medium text-navy-700">
                        Est. {formatMoneyRange(f.estimated_cost_low, f.estimated_cost_high)}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {active === 'visits' ? (
          <>
          <Card className="mb-4 p-4">
            <h2 className="mb-3 font-semibold text-navy-800">Schedule a visit</h2>
            <form action={scheduleVisit} className="space-y-3">
              <input type="hidden" name="property_id" value={id} />
              <input
                name="scheduled_for"
                type="datetime-local"
                required
                aria-label="Date and time"
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <select name="visit_type" defaultValue="SEASONAL" aria-label="Visit type" className={inputClass}>
                  <option value="SEASONAL">Seasonal</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="SERVICE">Service</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                </select>
                <input name="title" placeholder="Title (optional)" aria-label="Title" className={inputClass} />
              </div>
              <button type="submit" className="h-12 w-full rounded-lg bg-brandgreen-600 font-semibold text-white">
                Schedule &amp; notify the member
              </button>
            </form>
          </Card>
          {visitRows.length === 0 ? (
            <EmptyState title="No visits yet" />
          ) : (
            <ul className="space-y-2">
              {visitRows.map((v) => (
                <li key={v.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-navy-800">{v.title ?? v.visit_type}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(v.completed_at ?? v.scheduled_for)} • {v.status}
                        </p>
                      </div>
                      <Link
                        href={`/admin/visits/${v.id}`}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                      >
                        Open
                      </Link>
                    </div>
                    {v.summary ? (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-700">{v.summary}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          </>
        ) : null}

        {active === 'plan' ? (
          planRows.length === 0 ? (
            <EmptyState title="No Home Plan items yet" />
          ) : (
            <ul className="space-y-2">
              {planRows.map((item) => (
                <li key={item.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-navy-800">{item.title}</p>
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {[item.target_season, item.target_year].filter(Boolean).join(' ')}
                      {item.category ? ` • ${item.category}` : ''}
                    </p>
                    {item.description ? (
                      <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                    ) : null}
                    {formatMoneyRange(item.estimated_cost_low, item.estimated_cost_high) ? (
                      <p className="mt-2 text-sm font-medium text-navy-700">
                        {formatMoneyRange(item.estimated_cost_low, item.estimated_cost_high)}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {active === 'requests' ? (
          requestRows.length === 0 ? (
            <EmptyState title="No service requests" />
          ) : (
            <ul className="space-y-2">
              {requestRows.map((r) => (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-navy-800">{r.title}</p>
                      <span className="shrink-0 rounded bg-navy-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        {stageLabel(r.stage)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Opened {formatDate(r.created_at)}</p>
                    {r.description ? (
                      <p className="mt-2 text-sm text-slate-700">{r.description}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {active === 'documents' ? (
          <DocumentManager propertyId={id} documents={documentRows} />
        ) : null}
      </main>

      <BrandFooter />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium text-navy-800">{value}</dd>
    </div>
  );
}
