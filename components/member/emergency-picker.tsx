import Link from 'next/link';
import {
  emergenciesForFuel, NOT_911_NOTICE, responsePromise, type HeatingFuel,
} from '@/lib/emergency';
import { bmEmergencyPhone, telHref } from '@/lib/emergency-contacts';

const SEVERITY_BAR: Record<string, string> = {
  EVACUATE: 'bg-red-600',
  URGENT: 'bg-amber-500',
  SOON: 'bg-navy-600',
};

/**
 * "What is happening?" — the first screen of urgent help.
 *
 * The two evacuate-first cases sit at the top, in that order, because a
 * frightened person taps the first thing that matches and the ordering is
 * therefore part of the safety design, not a layout choice.
 *
 * Every tile is big enough to hit one-handed without looking carefully.
 */
export default function EmergencyPicker({
  hrefPrefix = '/home',
  hasPriority,
  fuel = null,
}: {
  hrefPrefix?: string;
  hasPriority: boolean;
  /** Their heating fuel, which changes the wording under "I smell gas". */
  fuel?: HeatingFuel | null;
}) {
  const bm = bmEmergencyPhone();
  const emergencies = emergenciesForFuel(fuel);

  return (
    <>
      <div className="mb-4 rounded-2xl bg-red-50 p-4 ring-1 ring-red-600/25">
        <p className="text-[14px] font-semibold leading-relaxed text-red-900">
          {NOT_911_NOTICE}
        </p>
        <a
          href="tel:911"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-red-700 text-[15px] font-bold text-white active:scale-[0.99]"
        >
          Call 911
        </a>
      </div>

      <p className="mb-3 text-[15px] leading-relaxed text-slate-700">
        Tell us what is happening and we will show you what to do in{' '}
        <span className="font-semibold text-navy-800">your</span> home — which
        shutoff, where it is, and what it looks like.
      </p>

      <ul className="space-y-2.5">
        {emergencies.map((e) => (
          <li key={e.kind}>
            <Link
              href={`${hrefPrefix}/help/${e.kind.toLowerCase()}`}
              className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
            >
              <span className={`w-1.5 shrink-0 ${SEVERITY_BAR[e.severity]}`} aria-hidden="true" />
              <span className="flex flex-1 items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-snug text-navy-800">
                    {e.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                    {e.examples}
                  </span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     className="h-5 w-5 shrink-0 text-slate-300" strokeLinecap="round" strokeLinejoin="round"
                     aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-2xl bg-navy-700 p-4 text-white">
        <p className="text-[14px] leading-relaxed text-navy-100">
          {responsePromise(hasPriority)}
        </p>
        {bm ? (
          <a
            href={telHref(bm)}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-white text-[15px] font-bold text-navy-800 active:scale-[0.99]"
          >
            Call B&amp;M — {bm}
          </a>
        ) : null}
      </div>
    </>
  );
}
