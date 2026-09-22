import { Suspense } from 'react';
import Link from 'next/link';
import JoinForm from './join-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { BrandFooter } from '@/components/brand';

// Checked at request time, not at build time. These pages ask whether the
// database is connected; prerendering freezes that answer into the HTML,
// so pasting the keys in afterwards would leave them saying "not connected"
// until somebody thought to rebuild.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Set up your account — B&M HomeKeeper' };

/**
 * Where an invited person creates their account.
 *
 * Deliberately not linked from anywhere public except the sign-in page.
 * It is not a marketing page and there is nothing to sign up for — without
 * an invite the database refuses, whatever is typed here.
 */
export default function JoinPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-navy-700">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Set up your account
            </h1>
            <p className="mt-1 text-sm text-navy-200">B&amp;M HomeKeeper</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl">
            {isSupabaseConfigured() ? (
              <Suspense fallback={null}>
                <JoinForm />
              </Suspense>
            ) : (
              <div className="text-center">
                <p className="font-semibold text-navy-800">Not connected yet</p>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                  This app has not been connected to its database, so there is
                  nothing to join yet.
                </p>
                <Link href="/demo" className="mt-4 inline-block font-semibold text-brandgreen-700">
                  See the sample home
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <BrandFooter variant="dark" />
    </main>
  );
}
