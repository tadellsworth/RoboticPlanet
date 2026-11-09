// Terrafall service worker: network first (so updates show up right away), cache as offline fallback.
// `no-cache` makes every request check with the server for a newer copy (cheap: unchanged files
// come back as "not modified"), so a freshly published version is used the next time the game opens.
const CACHE = 'botfall-v1'; // the game's first name, kept for the cache
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
