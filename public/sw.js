/**
 * B&M HomeKeeper service worker.
 *
 * Deliberately conservative. This app shows one household's private data, so
 * the worker never caches an authenticated HTML page — a cached Home Record
 * served to the wrong person would be exactly the failure CLAUDE.md rule 2
 * exists to prevent.
 *
 * What it does:
 *   - caches the static build output, which is public and content-hashed
 *   - serves a friendly offline page when a navigation fails
 *   - stays out of the way of everything else
 *
 * What it does NOT do: queue writes. The field app's offline queue is its own
 * IndexedDB outbox (lib/offline/), which survives without any of this.
 */

const VERSION = 'hk-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch anything cross-origin (Supabase, signed media URLs) or our
  // own API routes.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Immutable build assets: cache-first, they are content-hashed.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Page loads: always go to the network (private data), fall back to the
  // offline page if there is no signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error()),
      ),
    );
  }
});
