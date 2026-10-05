/* QCteam app-shell service worker.
 * Caches the shell (index.html, manifest, icons) on install and the hashed build assets as they are fetched, so the
 * app opens without a network — the data layer (sync.js) already copes with being offline. Data endpoints are never
 * cached here. Navigations are network-first, so a redeploy is picked up as soon as there is a connection; the hashed
 * /assets/* files are immutable and served cache-first. */
const VERSION = "qc-shell-v3";
// Photos are content-addressed and immutable, so they are safe to keep cache-first — a picture seen once never hits the
// network again, and the product / inspection screens work offline. Capped so a long-lived phone does not fill up.
const PHOTO_CACHE = "qc-photos-v1", PHOTO_CACHE_MAX = 600;
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];
const NEVER_CACHE = [/^\/storage\//, /^\/meta\//, /^\/boot$/, /^\/sheet\//, /^\/sheets\//, /^\/api\//, /^\/files\//, /^\/backups/, /^\/proxy/, /^\/auth\//];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== PHOTO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some(rx => rx.test(url.pathname))) return;
  if (url.pathname.startsWith("/photos/")) {
    e.respondWith(caches.open(PHOTO_CACHE).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok) { c.put(req, r.clone()); trimPhotoCache(c); } return r;
    }));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put("/index.html", copy)); return r; }).catch(() => caches.match("/index.html")));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit); return hit || net; }));
});

// Oldest-first trim (Cache API keeps insertion order). Runs after a put; cheap enough not to await.
async function trimPhotoCache(c) {
  try { const keys = await c.keys(); if (keys.length <= PHOTO_CACHE_MAX) return; await Promise.all(keys.slice(0, keys.length - PHOTO_CACHE_MAX).map(k => c.delete(k))); } catch {}
}
