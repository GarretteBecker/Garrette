'use client';

import { useSync } from '@/lib/offline/use-sync';

/**
 * Always-visible connectivity state. A tech in a basement needs to know at a
 * glance that their work is saved locally and will go up later — silence
 * here is what makes people re-enter findings twice.
 */
export default function SyncBanner() {
  const { pending, online, syncing, flush } = useSync();

  if (online && pending === 0) {
    return (
      <div className="bg-brandgreen-600/10 px-4 py-1.5 text-center text-xs font-medium text-brandgreen-800">
        Online · everything saved
      </div>
    );
  }

  if (!online) {
    return (
      <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white">
        Offline — {pending} change{pending === 1 ? '' : 's'} saved on this phone.
        They will upload when you get signal.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="w-full bg-navy-700 px-4 py-2 text-center text-xs font-semibold text-white"
    >
      {syncing
        ? 'Uploading…'
        : `${pending} change${pending === 1 ? '' : 's'} waiting — tap to upload now`}
    </button>
  );
}
