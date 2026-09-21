import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, formatDate } from '@/components/ui';
import OfferCard from '@/components/trade/offer-card';
import { RESPONSE_LABEL, type DispatchOffer } from '@/lib/dispatch';
import { STAGE_META } from '@/lib/service-requests';
import type { ServiceRequestStage } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

/**
 * The trade partner's screen.
 *
 * Without this, "dispatch" is still a phone call somebody has to remember
 * to log. Here a partner sees what they have been offered, with the clock
 * on it, and answers with one tap.
 *
 * RLS does the scoping: dispatch_offers is readable only by the partner it
 * belongs to, and a request only while they hold a live offer on it. There
 * is deliberately no property list, no member list and no way to reach the
 * customer database from here.
 */
export default async function TradePortalPage() {
  const profile = await requireRole('trade');
  const supabase = await createClient();

  const { data: offerRows } = await supabase
    .from('dispatch_offers')
    .select('id, service_request_id, trade_partner_id, rank, offered_at, respond_by, response, responded_at, decline_reason')
    .order('offered_at', { ascending: false });

  const offers = (offerRows ?? []) as DispatchOffer[];
  const requestIds = [...new Set(offers.map((o) => o.service_request_id))];

  const { data: requestRows } = requestIds.length
    ? await supabase
        .from('service_requests')
        .select('id, property_id, title, description, stage, scheduled_for, priority')
        .in('id', requestIds)
    : { data: [] };

  type Req = {
    id: string; property_id: string; title: string; description: string | null;
    stage: ServiceRequestStage; scheduled_for: string | null; priority: string;
  };
  const requests = new Map(((requestRows ?? []) as Req[]).map((r) => [r.id, r]));

  const propertyIds = [...new Set([...requests.values()].map((r) => r.property_id))];
  const { data: propRows } = propertyIds.length
    ? await supabase.from('properties').select('id, address_line1, city').in('id', propertyIds)
    : { data: [] };
  const properties = new Map(
    ((propRows ?? []) as { id: string; address_line1: string; city: string }[])
      .map((p) => [p.id, `${p.address_line1}, ${p.city}`]),
  );

  const pending = offers.filter((o) => o.response === 'PENDING');
  const accepted = offers.filter((o) => o.response === 'ACCEPTED');
  const past = offers.filter((o) => o.response !== 'PENDING' && o.response !== 'ACCEPTED');

  const where = (o: DispatchOffer) => {
    const req = requests.get(o.service_request_id);
    return req ? properties.get(req.property_id) ?? 'A member’s home' : 'A member’s home';
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader profile={profile} title="Your jobs" subtitle={profile.full_name} />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-5">
        {/* --------------------------------------------- needs an answer */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            {pending.length === 0
              ? 'Nothing waiting on you'
              : pending.length === 1
                ? 'One job needs an answer'
                : `${pending.length} jobs need an answer`}
          </h2>
          {pending.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500 ring-1 ring-slate-200">
              When B&amp;M sends you a job it will appear here with a clock on it.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((o) => {
                const req = requests.get(o.service_request_id);
                return (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    title={req?.title ?? 'Job'}
                    property={where(o)}
                    description={req?.description ?? null}
                  />
                );
              })}
            </ul>
          )}
        </section>

        {/* --------------------------------------------- taken on */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            Jobs you have taken ({accepted.length})
          </h2>
          {accepted.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500 ring-1 ring-slate-200">
              Nothing on your list right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {accepted.map((o) => {
                const req = requests.get(o.service_request_id);
                const meta = req ? STAGE_META[req.stage] : null;
                return (
                  <li key={o.id}>
                    <Card className="p-4">
                      <p className="font-semibold text-navy-800">{req?.title ?? 'Job'}</p>
                      <p className="mt-0.5 text-[13px] text-slate-600">{where(o)}</p>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {meta ? meta.label : ''}
                        {req?.scheduled_for
                          ? ` · booked ${new Date(req.scheduled_for).toLocaleString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: 'numeric', minute: '2-digit',
                            })}`
                          : ' · B&M will confirm a date with the homeowner'}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --------------------------------------------- history */}
        {past.length > 0 ? (
          <section>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
              Earlier
            </h2>
            <Card className="divide-y divide-slate-100">
              {past.slice(0, 20).map((o) => {
                const req = requests.get(o.service_request_id);
                return (
                  <div key={o.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 text-[14px] text-navy-800">
                      {req?.title ?? 'Job'}
                      <span className="block text-[12px] text-slate-500">
                        {formatDate(o.offered_at)}
                        {o.decline_reason ? ` · ${o.decline_reason}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-medium text-slate-500">
                      {RESPONSE_LABEL[o.response]}
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>
        ) : null}

        {offers.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            hint="B&M will send work here. You will get a text when a job comes in."
          />
        ) : null}
      </main>

      <BrandFooter />
    </div>
  );
}
