// Minimal service worker.
//
// Chrome only offers "Install app" when the page registers a service worker
// with a fetch handler, so this exists mainly to satisfy that requirement.
// It deliberately does NOT cache API responses or HTML: the admin panel shows
// live financial data, and serving a stale page would be worse than an error.
// Only immutable build assets and the icons are cached.

const CACHE = 'easyfarm-static-v2';
const PRECACHE = [
  '/icon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch the API host

  // Static, content-hashed assets and icons: cache first.
  const isStatic = url.pathname.startsWith('/_next/static/') ||
                   /\.(?:svg|png|ico|woff2?)$/.test(url.pathname);
  if (!isStatic) return;                             // everything else goes to the network

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      });
    })
  );
});
