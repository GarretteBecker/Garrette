'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isStaff } from '@/lib/auth-roles';
import type { UserRole } from '@/lib/types/database';

/**
 * The console's own navigation.
 *
 * Owner-only sections are simply absent for the office rather than shown
 * and refused. A door you cannot open is better than a door that says no —
 * and it is only presentation: the pages check too, and RLS refuses the
 * data whatever the nav says.
 *
 * Horizontal and scrollable so it works at 390px and at 1600px without two
 * layouts to keep in step.
 */
const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/team', label: 'Dashboard' },
  { href: '/team/members', label: 'Members' },
  { href: '/team/properties', label: 'Properties' },
  { href: '/team/requests', label: 'Requests' },
  { href: '/team/visits', label: 'Visits' },
  { href: '/team/reports', label: 'Reports' },
  { href: '/team/trade-partners', label: 'Trades' },
  { href: '/team/warranties', label: 'Warranties' },
  { href: '/team/checklists', label: 'Checklists', adminOnly: true },
  { href: '/team/compliance', label: 'Compliance', adminOnly: true },
  { href: '/team/people', label: 'Team', adminOnly: true },
];

export default function TeamNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  if (!isStaff(role)) return null;

  const visible = LINKS.filter((l) => !l.adminOnly || role === 'admin');

  return (
    <nav aria-label="Team console" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2">
        {visible.map((l) => {
          const active = l.href === '/team' ? pathname === '/team' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-[14px] font-medium ${
                active ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
