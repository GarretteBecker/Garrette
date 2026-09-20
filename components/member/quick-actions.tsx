import Link from 'next/link';

/**
 * The two things a homeowner opens this app to do.
 *
 * Deliberately the largest, loudest thing on the dashboard after the status
 * line. A member who has just found water on the floor should not have to
 * hunt — the camera is one tap from the front door, and it lands them in the
 * request form with the photo already attached.
 */
export default function QuickActions({ hrefPrefix = '/home' }: { hrefPrefix?: string }) {
  return (
    <div className="mb-7 grid grid-cols-2 gap-3">
      {/* Camera first: a photo explains more than a paragraph. */}
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
