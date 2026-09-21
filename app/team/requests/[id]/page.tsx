import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, Field, inputClass, formatDate, formatMoneyRange } from '@/components/ui';
import { STAGE_META, TONE_STYLE, nextStages, urgencyLabel, REQUEST_CATEGORIES, URGENCY_OPTIONS } from '@/lib/service-requests';
import { moveStage, triageRequest, setEstimate, scheduleRequest } from '@/lib/actions/service-requests';
import CompletionForm from '@/components/admin/completion-form';
import JobPhotos, { type JobPhoto } from '@/components/admin/job-photos';
import DispatchPanel from '@/components/admin/dispatch-panel';
import type { DispatchOffer } from '@/lib/dispatch';
import type { ServiceRequest, Asset, Room, TradePartner, ServiceRequestStage } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStaff();
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
      supabase.from('photos').select('id, storage_path, mime_type, kind, note').eq('service_request_id', id).order('created_at'),
      supabase.from('properties').select('name, address_line1, city').eq('id', r.property_id).maybeSingle(),
    ]);

  // A job raised off the Home Plan carries our own recommendation with it.
  // Whoever prices it should be looking at what we told the member, not at
  // a title they have to go and look up.
  const { data: planFinding } = r.finding_id
    ? await supabase
        .from('findings')
        .select('id, title, status, recommendation, estimated_cost_low, estimated_cost_high')
        .eq('id', r.finding_id)
        .maybeSingle()
    : { data: null };

  const roomRows = (rooms ?? []) as Room[];
  const assetRows = (assets ?? []) as Asset[];
  const partnerRows = (partners ?? []) as TradePartner[];

  // Dispatch: every offer on this job, and who covers its category.
  const [{ data: offerRows }, { data: coverageRows }] = await Promise.all([
    supabase
      .from('dispatch_offers')
      .select('id, service_request_id, trade_partner_id, rank, offered_at, respond_by, response, responded_at, decline_reason')
      .eq('service_request_id', id)
      .order('offered_at'),
    r.category
      ? supabase
          .from('trade_coverage')
          .select('trade_partner_id, category, rank')
          .eq('category', r.category)
      : Promise.resolve({ data: [] }),
  ]);

  const partnerById = new Map(partnerRows.map((tp) => [tp.id, tp]));
  const offers: DispatchOffer[] = ((offerRows ?? []) as DispatchOffer[]).map((o) => ({
    ...o,
    company_name: partnerById.get(o.trade_partner_id)?.company_name ?? null,
    phone: partnerById.get(o.trade_partner_id)?.phone ?? null,
  }));

  const rankOrder = { PRIMARY: 1, SECONDARY: 2, BACKUP: 3 } as const;
  const bench = ((coverageRows ?? []) as { trade_partner_id: string; rank: keyof typeof rankOrder }[])
    .map((c) => {
      const tp = partnerById.get(c.trade_partner_id);
      return tp && tp.is_active
        ? {
            id: tp.id,
            company_name: tp.company_name,
            rank: c.rank as string,
            offered: offers.some((o) => o.trade_partner_id === tp.id),
          }
        : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => rankOrder[a.rank as 'PRIMARY'] - rankOrder[b.rank as 'PRIMARY']);

  const linkedAsset = assetRows.find((a) => a.id === r.asset_id) ?? null;
  const meta = STAGE_META[r.stage];

  // What the member sent vs what we photographed on the job. Same table,
  // told apart by kind, and kept apart on screen so neither gets mistaken
  // for the other.
  const attachments: { id: string; url: string; isVideo: boolean }[] = [];
  const jobPhotos: JobPhoto[] = [];
  type MediaRow = {
    id: string; storage_path: string; mime_type: string | null;
    kind: string | null; note: string | null;
  };
  for (const m of (media ?? []) as MediaRow[]) {
    const { data: signed } = await supabase.storage
      .from('property-photos')
      .createSignedUrl(m.storage_path, 3600);
    if (!signed?.signedUrl) continue;
    const isVideo = (m.mime_type ?? '').startsWith('video/');
    if (m.kind === 'BEFORE' || m.kind === 'AFTER') {
      jobPhotos.push({ id: m.id, url: signed.signedUrl, isVideo, kind: m.kind, note: m.note });
    } else {
      attachments.push({ id: m.id, url: signed.signedUrl, isVideo });
    }
  }

  const canComplete = ['SCHEDULED', 'IN_PROGRESS', 'APPROVED'].includes(r.stage);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title={r.title}
        subtitle={(property as { name?: string } | null)?.name ?? 'Request'}
        backHref="/team/requests"
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

        {/* ------------------------------------------- member approval */}
        {r.approved_at ? (
          <div className="rounded-2xl bg-brandgreen-50 p-4 ring-1 ring-brandgreen-600/25">
            <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
              Member approved
            </p>
            <p className="mt-1 text-[15px] font-semibold text-navy-800">
              {new Date(r.approved_at).toLocaleString('en-US', {
                weekday: 'short', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
              {r.estimate_amount != null ? ` · ${formatMoneyRange(r.estimate_amount, null)}` : ''}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brandgreen-900/80">
              {r.scheduled_for
                ? `Booked for ${new Date(r.scheduled_for).toLocaleString()}.`
                : 'They are waiting on a date from us. Book it in below.'}
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------- from the Home Plan */}
        {planFinding ? (
          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-navy-500">
              From the Home Plan
            </p>
            <p className="mt-1 font-semibold text-navy-800">
              {(planFinding as { title: string }).title}
            </p>
            {(planFinding as { recommendation: string | null }).recommendation ? (
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
                {(planFinding as { recommendation: string }).recommendation}
              </p>
            ) : null}
            <p className="mt-2 text-[13px] text-slate-500">
              We estimated{' '}
              <span className="font-semibold text-navy-800">
                {formatMoneyRange(
                  (planFinding as { estimated_cost_low: number | null }).estimated_cost_low,
                  (planFinding as { estimated_cost_high: number | null }).estimated_cost_high,
                ) ?? 'no figure'}
              </span>
              . They have asked for a firm price — closing this job out will
              also clear the item from their plan.
            </p>
            <Link
              href={`/team/properties/${r.property_id}?tab=plan`}
              className="mt-2 inline-block text-[13px] font-semibold text-brandgreen-600"
            >
              Open their Home Plan
            </Link>
          </Card>
        ) : null}

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
          <h2 className="mb-1 font-semibold text-navy-800">Dispatch</h2>
          <p className="mb-3 text-[13px] leading-relaxed text-slate-500">
            A job is <span className="font-semibold">offered</span>, not assigned.
            The partner gets a clock to answer; if they decline or go quiet,
            roll it to the next one. Every step stays on the record.
          </p>
          <DispatchPanel
            requestId={r.id}
            category={r.category}
            offers={offers}
            bench={bench.length > 0 ? bench : partnerRows
              .filter((tp) => tp.is_active)
              .map((tp) => ({
                id: tp.id,
                company_name: `${tp.company_name} — ${tp.trade}`,
                rank: null,
                offered: offers.some((o) => o.trade_partner_id === tp.id),
              }))}
          />
        </Card>

        {/* ------------------------------------------- money + date */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-1 font-semibold text-navy-800">Estimate</h2>
            <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
              Sending a price puts the job in the member&rsquo;s hands — nothing
              moves until they approve it on their phone.
            </p>
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

          <Card className={`p-4 ${r.stage === 'APPROVED' ? 'ring-2 ring-brandgreen-600' : ''}`}>
            <h2 className="mb-1 font-semibold text-navy-800">Schedule</h2>
            <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
              {r.stage === 'APPROVED'
                ? 'Approved and waiting on a date. Booking it moves the job to Scheduled and tells the member.'
                : 'Booking a date moves the job to Scheduled and tells the member.'}
            </p>
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

        {/* ------------------------------------------- job photos */}
        <JobPhotos propertyId={r.property_id} requestId={r.id} photos={jobPhotos} />

        {/* ------------------------------------------- close out */}
        {canComplete ? (
          <CompletionForm requestId={r.id} asset={linkedAsset} photoCount={jobPhotos.length} />
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
                      href={`/team/properties/${r.property_id}?tab=record`}
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
