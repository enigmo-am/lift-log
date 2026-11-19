// Offline cache. Bump VERSION when you change files so phones pick up the update.
const VERSION = "liftlog-v7";
const FILES = ["./", "index.html", "styles.css", "theme.js", "app.js", "config.js", "qrcode.js", "avatars.js", "muscles.js", "figure.js", "sync.js", "manifest.json", "icon.svg", "fonts/outfit-latin-600-normal.woff2", "fonts/outfit-latin-700-normal.woff2", "fonts/outfit-latin-800-normal.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Network first (so updates show up), cache as fallback when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
