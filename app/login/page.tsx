import { Suspense } from 'react';
import LoginForm from './login-form';
import { BrandFooter } from '@/components/brand';

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
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>

      <BrandFooter variant="dark" />
    </main>
  );
}
