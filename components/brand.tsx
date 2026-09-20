import Link from 'next/link';
import { signOut } from '@/app/login/actions';
import type { Profile } from '@/lib/types/database';

export function BrandFooter({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const cls =
    variant === 'dark'
      ? 'text-navy-200/80 border-white/10'
      : 'text-slate-500 border-slate-200';
  return (
    <footer className={`safe-bottom border-t px-4 py-4 text-center text-xs ${cls}`}>
      B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
    </footer>
  );
}

export function HomeKeeperMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

/** Top bar used across admin and member screens. */
export function AppHeader({
  profile,
  title,
  subtitle,
  backHref,
}: {
  profile: Profile;
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 bg-navy-700 text-white shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-navy-100 active:bg-white/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        ) : (
          <HomeKeeperMark className="h-6 w-6 shrink-0 text-white" />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-navy-200">
            <RoleBadge role={profile.role} />
            {subtitle ? <span className="truncate">{subtitle}</span> : null}
          </p>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg px-2 py-2 text-xs font-medium text-navy-100 active:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

export function RoleBadge({ role }: { role: Profile['role'] }) {
  const map: Record<string, string> = {
    admin: 'bg-navy-700 text-white',
    tech: 'bg-brandgreen-600 text-white',
    member: 'bg-slate-200 text-slate-700',
    trade: 'bg-amber-600 text-white',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[role]}`}>
      {role}
    </span>
  );
}
