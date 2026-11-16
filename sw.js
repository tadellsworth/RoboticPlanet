// Terrafall service worker: network first (so updates show up right away), cache as offline fallback.
// `no-cache` makes every request check with the server for a newer copy (cheap: unchanged files
// come back as "not modified"), so a freshly published version is used the next time the game opens.
//
// Art is checked once each time the game is opened, not on every use: the day-and-night sets are let go
// and loaded again every few minutes, and asking the server about ~380 images each time (over a
// thousand requests a day-night cycle) only to hear "not modified" wasted data and battery. An image
// already checked since the game opened comes straight from the cache; and one that is in the cache
// waits at most ART_WAIT for the server before the cached copy is used, so a slow connection can't
// hold the art back (the newer copy, if there is one, is kept for next time).
const CACHE = 'botfall-v1'; // the game's first name, kept for the cache
const ART_WAIT = 3000;      // ms
let checked = new Set();    // art checked with the server since the game was last opened

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** Ask the server (never the browser's own cache), and keep a copy of a good answer. */
function fromNetwork(req) {
  return fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
}

/** Offline: the cached copy; a page that was never cached falls back to the game itself. */
function fromCache(req) {
  return caches.match(req).then((hit) => hit || (req.mode === 'navigate'
    ? caches.match('./').then((home) => home || caches.match('./index.html')).then((home) => home || Response.error())
    : Response.error()));
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') checked = new Set(); // the game is being opened: check everything afresh
  if (!/\/art\/.+\.(webp|png|jpe?g|svg)$/.test(url.pathname)) {
    e.respondWith(fromNetwork(req).catch(() => fromCache(req)));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    if (hit && checked.has(url.href)) return hit;
    checked.add(url.href);
    const net = fromNetwork(req);
    if (!hit) return net;
    e.waitUntil(net.catch(() => {})); // a slow answer still updates the cache after the cached copy has been used
    return Promise.race([net.catch(() => hit), new Promise((done) => setTimeout(() => done(hit), ART_WAIT))]);
  }));
});
