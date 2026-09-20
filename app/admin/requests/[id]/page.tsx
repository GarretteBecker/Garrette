import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, Field, inputClass, formatDate, formatMoneyRange } from '@/components/ui';
import { STAGE_META, TONE_STYLE, nextStages, urgencyLabel, REQUEST_CATEGORIES, URGENCY_OPTIONS } from '@/lib/service-requests';
import { moveStage, triageRequest, assignTradePartner, setEstimate, scheduleRequest } from '@/lib/actions/service-requests';
import CompletionForm from '@/components/admin/completion-form';
import type { ServiceRequest, Asset, Room, TradePartner, ServiceRequestStage } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole('admin');
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!request) notFound();
  const r = request as ServiceRequest;

  const [{ data: rooms }, { data: assets }, { data: partners }, { data: events }, { data: media }, { data: property }] =
    await Promise.all([
      supabase.from('rooms').select('*').eq('property_id', r.property_id).order('sort_order'),
      supabase.from('assets').select('*').eq('property_id', r.property_id).order('name'),
      supabase.from('trade_partners').select('*').eq('is_active', true).order('company_name'),
      supabase
        .from('service_request_events')
        .select('id, from_stage, to_stage, note, created_at')
        .eq('service_request_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('photos').select('id, storage_path, mime_type').eq('service_request_id', id),
      supabase.from('properties').select('name, address_line1, city').eq('id', r.property_id).maybeSingle(),
    ]);

  const roomRows = (rooms ?? []) as Room[];
  const assetRows = (assets ?? []) as Asset[];
  const partnerRows = (partners ?? []) as TradePartner[];
  const linkedAsset = assetRows.find((a) => a.id === r.asset_id) ?? null;
  const meta = STAGE_META[r.stage];

  const attachments: { id: string; url: string; isVideo: boolean }[] = [];
  for (const m of (media ?? []) as { id: string; storage_path: string; mime_type: string | null }[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(m.storage_path, 3600);
    if (signed?.signedUrl) {
      attachments.push({ id: m.id, url: signed.signedUrl, isVideo: (m.mime_type ?? '').startsWith('video/') });
    }
  }

  const canComplete = ['SCHEDULED', 'IN_PROGRESS', 'APPROVED'].includes(r.stage);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title={r.title}
        subtitle={(property as { name?: string } | null)?.name ?? 'Request'}
        backHref="/admin/requests"
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        {/* ------------------------------------------- current stage */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${TONE_STYLE[meta.tone].dot}`} aria-hidden="true" />
            <p className="font-semibold text-navy-800">{meta.label}</p>
            <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-slate-400">
              with {meta.owner}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            Raised {formatDate(r.created_at)} · {urgencyLabel(r.priority)}
            {r.category ? ` · ${r.category}` : ''}
          </p>

          {nextStages(r.stage).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStages(r.stage).map((s: ServiceRequestStage) => (
                <form action={moveStage} key={s}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <input type="hidden" name="to_stage" value={s} />
                  <button
                    type="submit"
                    className="h-11 rounded-lg bg-navy-700 px-4 text-sm font-semibold text-white active:scale-[0.99]"
                  >
                    → {STAGE_META[s].label}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </Card>

        {/* ------------------------------------------- what they said */}
        <Card className="p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            What the member reported
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{r.description}</p>
          {attachments.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {attachments.map((a) =>
                a.isVideo ? (
                  <video key={a.id} src={a.url} controls playsInline
                         className="aspect-square w-full rounded-lg bg-black object-cover ring-1 ring-slate-200" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a.id} src={a.url} alt="Attached"
                       className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200" />
                ),
              )}
            </div>
          ) : null}
        </Card>

        {/* ------------------------------------------- triage */}
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Triage</h2>
          <form action={triageRequest} className="space-y-3">
            <input type="hidden" name="request_id" value={r.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="category">
                <select id="category" name="category" defaultValue={r.category ?? ''} className={inputClass}>
                  <option value="">—</option>
                  {REQUEST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Urgency" htmlFor="priority">
                <select id="priority" name="priority" defaultValue={r.priority} className={inputClass}>
                  {URGENCY_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Room" htmlFor="room_id">
              <select id="room_id" name="room_id" defaultValue={r.room_id ?? ''} className={inputClass}>
                <option value="">—</option>
                {roomRows.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
            <Field
              label="Home Record item"
              htmlFor="asset_id"
              hint="Link this and the completed work updates that item automatically."
            >
              <select id="asset_id" name="asset_id" defaultValue={r.asset_id ?? ''} className={inputClass}>
                <option value="">Not linked</option>
                {assetRows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.model ? ` — ${a.model}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white">
              Save triage
            </button>
          </form>
        </Card>

        {/* ------------------------------------------- dispatch */}
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Dispatch</h2>
          <form action={assignTradePartner} className="space-y-3">
            <input type="hidden" name="request_id" value={r.id} />
            <select
              name="trade_partner_id"
              defaultValue={r.trade_partner_id ?? ''}
              aria-label="Trade partner"
              className={inputClass}
            >
              <option value="">Choose a trade partner…</option>
              {partnerRows.map((p) => (
                <option key={p.id} value={p.id}>{p.company_name} — {p.trade}</option>
              ))}
            </select>
            <button type="submit" className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white">
              Dispatch
            </button>
          </form>
        </Card>

        {/* ------------------------------------------- money + date */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-navy-800">Estimate</h2>
            <form action={setEstimate} className="space-y-3">
              <input type="hidden" name="request_id" value={r.id} />
              <input
                name="estimate_amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={r.estimate_amount ?? ''}
                placeholder="1095.00"
                aria-label="Estimate amount"
                className={inputClass}
              />
              <button type="submit" className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white">
                Send for approval
              </button>
            </form>
            {r.estimate_amount != null ? (
              <p className="mt-2 text-[13px] text-slate-500">
                Current: {formatMoneyRange(r.estimate_amount, null)}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-navy-800">Schedule</h2>
            <form action={scheduleRequest} className="space-y-3">
              <input type="hidden" name="request_id" value={r.id} />
              <input
                name="scheduled_for"
                type="datetime-local"
                aria-label="Scheduled for"
                className={inputClass}
              />
              <button type="submit" className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white">
                Book it in
              </button>
            </form>
            {r.scheduled_for ? (
              <p className="mt-2 text-[13px] text-slate-500">
                Booked: {new Date(r.scheduled_for).toLocaleString()}
              </p>
            ) : null}
          </Card>
        </div>

        {/* ------------------------------------------- close out */}
        {canComplete ? (
          <CompletionForm requestId={r.id} asset={linkedAsset} />
        ) : null}

        {r.work_performed ? (
          <Card className="p-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Work performed
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{r.work_performed}</p>
            {r.parts_used ? (
              <p className="mt-2 text-[13px] text-slate-600">
                <span className="font-semibold">Parts:</span> {r.parts_used}
              </p>
            ) : null}
            {r.record_updated_at ? (
              <p className="mt-3 rounded-lg bg-brandgreen-50 px-3 py-2 text-[13px] text-brandgreen-800">
                Home Record updated {formatDate(r.record_updated_at)}
                {linkedAsset ? (
                  <>
                    {' — '}
                    <Link
                      href={`/admin/properties/${r.property_id}?tab=record`}
                      className="font-semibold underline underline-offset-2"
                    >
                      {linkedAsset.name}
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </Card>
        ) : null}

        {/* ------------------------------------------- history */}
        <Card className="p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Stage history
          </h2>
          <ol className="space-y-2.5">
            {((events ?? []) as { id: string; from_stage: ServiceRequestStage | null; to_stage: ServiceRequestStage; note: string | null; created_at: string }[]).map((e) => (
              <li key={e.id} className="flex gap-3 text-[13px]">
                <span className="shrink-0 text-slate-400">{formatDate(e.created_at)}</span>
                <span className="min-w-0">
                  <span className="font-medium text-navy-800">
                    {e.from_stage ? `${STAGE_META[e.from_stage].label} → ` : ''}
                    {STAGE_META[e.to_stage].label}
                  </span>
                  {e.note ? <span className="block text-slate-600">{e.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </main>

      <BrandFooter />
    </div>
  );
}
