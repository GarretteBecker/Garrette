import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from './login-form';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { BrandFooter } from '@/components/brand';

// Checked at request time, not at build time. These pages ask whether the
// database is connected; prerendering freezes that answer into the HTML,
// so pasting the keys in afterwards would leave them saying "not connected"
// until somebody thought to rebuild.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-navy-700">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V21h14V9.5" />
                <path d="M9.5 21v-6h5v6" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              B&amp;M HomeKeeper
            </h1>
            <p className="mt-1 text-sm text-navy-200">One number for your home.</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-xl">
            {isSupabaseConfigured() ? (
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            ) : (
              <div className="text-center">
                <p className="text-lg font-semibold text-navy-800">
                  Almost there
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                  The app is running, but it has not been connected to its
                  database yet, so there is nobody to log in as.
                </p>
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-left text-[13px] leading-relaxed text-slate-600">
                  Add <span className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</span> and{' '}
                  <span className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> in your
                  hosting settings, then deploy again.
                </p>
                <Link
                  href="/demo"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-brandgreen-600 font-semibold text-white"
                >
                  See the sample home instead
                </Link>
                <p className="mt-2 text-[12px] text-slate-500">
                  The demo needs no database — it works right now.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BrandFooter variant="dark" />
    </main>
  );
}
