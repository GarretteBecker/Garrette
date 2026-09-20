import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, EmptyState, formatDate } from '@/components/ui';
import WarrantyNoticeButton from '@/components/admin/warranty-notice-button';
import { warrantyCountdown, type WarrantyResponse } from '@/lib/warranty';

export const dynamic = 'force-dynamic';

interface WatchRow {
  asset_id: string;
  property_id: string;
  property_name: string;
  asset_name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  warranty_expires: string;
  days_left: number;
  notice_id: string | null;
  notified_at: string | null;
  response: WarrantyResponse | null;
}

/**
 * Warranty watch, for the office.
 *
 * Every row here is a member who is about to lose free cover on something,
 * and a job you are well placed to sell. It is the most commercially useful
 * screen in the app for exactly the same reason it is the most useful to
 * them: nobody else is watching these dates.
 *
 * Sorted by how little time is left, so the top of the list is the one that
 * costs somebody money first.
 */
export default async function WarrantiesPage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const { data } = await supabase.from('warranty_watch').select('*');
  const rows = (data ?? []) as WatchRow[];

  const untold = rows.filter((r) => !r.notified_at);
  const waiting = rows.filter((r) => r.notified_at && r.response !== 'WANTS');
  const said_yes = rows.filter((r) => r.response === 'WANTS');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title="Warranty watch"
        subtitle={`${rows.length} running out`}
        backHref="/admin"
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-5">
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
          Items coming out of warranty in the next 120 days. Telling a member
          costs nothing and can save them a few thousand dollars — and a
          warranty check is a job you are already set up to price, schedule
          and write up. Anything a member has declined drops off this list.
        </p>

        <Group
          title="Nobody has told them"
          hint="These are the ones worth doing today."
          tone="amber"
          rows={untold}
          empty="Everyone has been told."
          showButton
        />

        <Group
          title="Told, waiting on them"
          hint="They know. No need to chase twice."
          tone="navy"
          rows={waiting}
          empty="Nothing waiting."
        />

        <Group
          title="They asked us to look"
          hint="A job exists for each of these — find it on the request board."
          tone="green"
          rows={said_yes}
          empty="None yet."
        />

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing coming out of warranty"
            hint="Warranty dates live on Home Record items. The more of them you fill in, the more this screen is worth."
          />
        ) : null}
      </main>

      <BrandFooter />
    </div>
  );
}

const TONE = {
  amber: 'bg-amber-50 text-amber-900 ring-amber-600/25',
  navy: 'bg-navy-50 text-navy-800 ring-navy-100',
  green: 'bg-brandgreen-50 text-brandgreen-800 ring-brandgreen-600/25',
} as const;

function Group({
  title, hint, tone, rows, empty, showButton = false,
}: {
  title: string;
  hint: string;
  tone: keyof typeof TONE;
  rows: WatchRow[];
  empty: string;
  showButton?: boolean;
}) {
  return (
    <section>
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {rows.length > 0 ? (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ring-1 ${TONE[tone]}`}>
            {rows.length}
          </span>
        ) : null}
      </div>
      <p className="mb-2 text-[12px] leading-relaxed text-slate-500">{hint}</p>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500 ring-1 ring-slate-200">
          {empty}
        </p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.asset_id} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/admin/properties/${r.property_id}?tab=record`}
                  className="font-semibold text-navy-800 hover:underline"
                >
                  {r.asset_name}
                </Link>
                <span
                  className={`shrink-0 text-[13px] ${
                    r.days_left <= 30 ? 'font-semibold text-amber-800' : 'text-slate-500'
                  }`}
                >
                  ends {warrantyCountdown(r.days_left)}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-600">
                {r.property_name}
                {[r.manufacturer, r.model].filter(Boolean).length
                  ? ` · ${[r.manufacturer, r.model].filter(Boolean).join(' ')}`
                  : ''}
                {r.serial_number ? ` · ${r.serial_number}` : ''}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-400">
                Warranty to {formatDate(r.warranty_expires)}
                {r.notified_at ? ` · told ${formatDate(r.notified_at)}` : ''}
              </p>
              {showButton ? <WarrantyNoticeButton assetId={r.asset_id} /> : null}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
