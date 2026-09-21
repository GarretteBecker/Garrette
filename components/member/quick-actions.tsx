import Link from 'next/link';

/**
 * The emergency button.
 *
 * First on the dashboard, above everything including the status line,
 * because the moment it exists for is the moment nobody reads carefully:
 * somebody standing in water at 11pm should hit the right thing without
 * aiming.
 *
 * Split from QuickActions so the home's status can sit between them — the
 * two calm actions read better underneath "here is how your home is" than
 * stacked against the red.
 */
export function HelpNowButton({ hrefPrefix = '/home' }: { hrefPrefix?: string }) {
  return (
    <div className="mb-5">
      <Link
        href={`${hrefPrefix}/help`}
        className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 px-4 py-5 text-white shadow-sm transition active:scale-[0.98]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               className="h-7 w-7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4" />
            <path d="M10.4 3.9 2.5 17.3A2 2 0 0 0 4.2 20.3h15.6a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.2 0z" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] font-bold leading-tight">I need help now</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-red-100">
            Burst pipe, no heat, gas smell — what to do, in your home
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             className="h-5 w-5 shrink-0 text-white/70" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * The two everyday actions.
 *
 * A photo explains more than a paragraph, so the camera comes first and
 * lands them in the request form with the shot already attached.
 */
export default function QuickActions({ hrefPrefix = '/home' }: { hrefPrefix?: string }) {
  return (
    <div className="mb-7 grid grid-cols-2 gap-3">
      <Link
        href={`${hrefPrefix}/requests/new?camera=1`}
        className="flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-brandgreen-600 to-brandgreen-700 px-3 py-6 text-white shadow-sm transition active:scale-[0.98]"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="h-7 w-7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
        <span className="text-center">
          <span className="block text-[15px] font-bold leading-tight">Take a photo</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-brandgreen-100">
            Show us the problem
          </span>
        </span>
      </Link>

      <Link
        href={`${hrefPrefix}/requests/new`}
        className="flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-navy-700 to-navy-800 px-3 py-6 text-white shadow-sm transition active:scale-[0.98]"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="h-7 w-7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>
        </span>
        <span className="text-center">
          <span className="block text-[15px] font-bold leading-tight">Request service</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-navy-200">
            Tell us what you need
          </span>
        </span>
      </Link>
    </div>
  );
}
