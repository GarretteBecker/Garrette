import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import TradePartnerEditor from '@/components/admin/trade-partner-editor';
import type { TradePartner } from '@/lib/types/database';

export default async function TradePartnersPage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const { data } = await supabase
    .from('trade_partners')
    .select('*')
    .order('company_name');

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title="Trade partners"
        subtitle="Subs you dispatch work to"
        backHref="/admin"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <TradePartnerEditor partners={(data ?? []) as TradePartner[]} />
      </main>
      <BrandFooter />
    </div>
  );
}
