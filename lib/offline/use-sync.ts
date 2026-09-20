'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { count, subscribe } from './outbox';
import { startAutoSync, syncNow } from './sync';

/** Browser connectivity as an external store, so React reads it correctly. */
function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const getOnlineSnapshot = () => navigator.onLine;
// On the server we assume online, so the markup matches the common case
// and does not flash an "offline" banner during hydration.
const getOnlineServerSnapshot = () => true;

/** Live queue depth + connectivity, for the field app's sync banner. */
export function useSync() {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );

  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setPending(await count());
  }, []);

  useEffect(() => {
    // Subscribing to the outbox and starting the auto-sync timer are both
    // "connect to an external system" work, which is what effects are for.
    const unsubscribe = subscribe(() => {
      void refresh();
    });
    const stopAuto = startAutoSync();

    return () => {
      unsubscribe();
      stopAuto();
    };
  }, [refresh]);

  const flush = useCallback(async () => {
    setSyncing(true);
    await syncNow();
    await refresh();
    setSyncing(false);
  }, [refresh]);

  return { pending, online, syncing, flush } as const;
}
