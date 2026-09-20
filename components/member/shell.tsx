import Link from 'next/link';
import { signOut } from '@/app/login/actions';
import { HomeKeeperMark } from '@/components/brand';

export type PortalTab = 'dashboard' | 'record' | 'plan' | 'reports' | 'documents';

const TABS: {
  key: PortalTab;
  label: string;
  href: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'dashboard',
    label: 'Home',
    href: '/home',
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </>
    ),
  },
  {
    key: 'record',
    label: 'Record',
    href: '/home/record',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    key: 'plan',
    label: 'Plan',
    href: '/home/plan',
    icon: (
      <>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="m9 14 2 2 4-4" />
      </>
    ),
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/home/reports',
    icon: (
      <>
        <path d="M14 3v5h5" />
        <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
  },
  {
    key: 'documents',
    label: 'Docs',
    href: '/home/documents',
    icon: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      </>
    ),
  },
];

/**
 * The homeowner's app frame: a warm navy header and a thumb-height bottom
 * tab bar. Mobile-first — this is the screen a prospect is shown on a phone
 * at the kitchen table, so it has to feel like an app, not a web page.
 */
export default function PortalShell({
  active,
  title,
  subtitle,
  children,
  /** Demo mode drops the sign-out button and points tabs at /demo. */
  hrefPrefix = '/home',
  showSignOut = true,
}: {
  active: PortalTab;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  hrefPrefix?: string;
  showSignOut?: boolean;
}) {
  const tabs = TABS.map((t) => ({
    ...t,
    href:
      hrefPrefix === '/home'
        ? t.href
        : t.key === 'dashboard'
          ? hrefPrefix
          : `${hrefPrefix}/${t.key}`,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="safe-top sticky top-0 z-20 bg-gradient-to-b from-navy-700 to-navy-800 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <HomeKeeperMark className="h-6 w-6 shrink-0 text-white/80" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-navy-200">{subtitle}</p>
            ) : null}
          </div>
          {showSignOut ? (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg px-2 py-2 text-xs font-medium text-navy-200 active:bg-white/10"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-28 pt-5">
        {children}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <li key={t.key} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 px-1 pt-2.5 pb-1 text-[10px] font-medium transition ${
                    on ? 'text-brandgreen-600' : 'text-slate-400'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={on ? 2.2 : 1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[22px] w-[22px]"
                    aria-hidden="true"
                  >
                    {t.icon}
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Section heading used across the portal. */
export function PortalSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
