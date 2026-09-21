import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import TradePartnerEditor from '@/components/admin/trade-partner-editor';
import CoverageBoard from '@/components/admin/coverage-board';
import { REQUEST_CATEGORIES } from '@/lib/service-requests';
import type { TradeCoverage, TradePerformance } from '@/lib/dispatch';
import type { TradePartner } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function TradePartnersPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  const [{ data }, { data: coverage }, { data: performance }] = await Promise.all([
    supabase.from('trade_partners').select('*').order('company_name'),
    supabase.from('trade_coverage').select('id, trade_partner_id, category, rank, notes'),
    supabase.from('trade_performance').select('*'),
  ]);

  const partners = (data ?? []) as TradePartner[];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title="Trade partners"
        subtitle="Who you call, and in what order"
        backHref="/team"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-5">
        <section>
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            Who covers what
          </h2>
          <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
            A job goes to the primary first, with a clock on it. If they decline
            or go quiet it rolls to the secondary, then the backups — so nobody
            is choosing from memory at eight on a Friday.
          </p>
          <CoverageBoard
            categories={REQUEST_CATEGORIES}
            partners={partners}
            coverage={(coverage ?? []) as TradeCoverage[]}
            performance={(performance ?? []) as TradePerformance[]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            The partners themselves
          </h2>
          <TradePartnerEditor partners={partners} />
        </section>
      </main>
      <BrandFooter />
    </div>
  );
}
