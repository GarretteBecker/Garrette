'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, which is what makes the app installable on
 * a phone home screen. Failure is non-fatal — the app works fine without it.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[pwa] service worker registration failed:', error);
      });
    };

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
