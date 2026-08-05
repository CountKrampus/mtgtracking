// Minimal app-shell service worker: caches same-origin static assets (the
// HTML/JS/CSS bundle) as they're successfully fetched during normal use, so
// the app can still load when offline. API requests (/api/...) are always
// passed straight to the network — this worker never caches API responses;
// offline data fallback for the collection itself is handled separately via
// IndexedDB (see src/utils/offlineDb.js), to avoid two competing staleness
// stories for the same data.
//
// CRA doesn't emit a build-time asset manifest without ejecting or adding
// workbox-webpack-plugin, so this uses a runtime "cache what succeeds, serve
// cache on network failure" strategy rather than a precache list of
// content-hashed filenames.
const CACHE_NAME = 'mtg-tracker-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCardApi = url.pathname.startsWith('/api/cards');
  const isCachedImage = url.pathname.startsWith('/api/images/');

  if (isCardApi || isCachedImage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
