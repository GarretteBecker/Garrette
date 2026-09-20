import { HomeKeeperMark } from '@/components/brand';

export const metadata = { title: 'Offline — B&M HomeKeeper' };

/**
 * Shown by the service worker when a page load fails with no signal.
 * Deliberately reassuring: a tech in a basement needs to know their queued
 * work is safe, not that something broke.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy-700 px-6 text-center text-white">
      <HomeKeeperMark className="mb-5 h-10 w-10 text-white/70" />
      <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-navy-200">
        This page needs a connection. Anything you already captured on this
        phone is saved and will upload by itself once you have signal again.
      </p>
      <p className="mt-6 text-[13px] text-navy-300">
        B&amp;M Home Improvement Solutions LLC • PA Lic. #154223
      </p>
    </main>
  );
}
