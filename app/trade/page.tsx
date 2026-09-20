import { requireRole } from '@/lib/auth';
import { AppHeader, BrandFooter } from '@/components/brand';
import { EmptyState } from '@/components/ui';

/**
 * Trade partner portal — later phase per CLAUDE.md. The role, the RLS
 * policies and the dispatch fields already exist; this screen is the
 * placeholder that keeps the routing honest.
 */
export default async function TradePortalPage() {
  const profile = await requireRole('trade');
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} title="Dispatched jobs" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <EmptyState
          title="Trade portal coming in a later phase"
          hint="You'll see the jobs B&M dispatches to you here."
        />
      </main>
      <BrandFooter />
    </div>
  );
}
