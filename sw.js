// Offline cache. Bump VERSION when you change files so phones pick up the update.
const VERSION = "liftlog-v9";
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

// ---- background reminders (Android installed app; best effort) ----
const META = "liftlog-meta";
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "reminders") e.waitUntil(caches.open(META).then((c) => c.put("/__reminders", new Response(JSON.stringify(e.data.payload)))));
});
async function checkReminders() {
  const c = await caches.open(META), r = await c.match("/__reminders"); if (!r) return;
  const d = await r.json(); if (!d.on) return;
  const now = new Date(), day = ymd(now), hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (d.logged === day) return;
  const sent = await c.match("/__sent").then((x) => (x ? x.json() : {})).catch(() => ({}));
  const fire = async (key, title, body) => { if (sent[key] === day) return; sent[key] = day; await self.registration.showNotification(title, { body, icon: "icon.svg", tag: key }); };
  const routine = d.byDay[now.getDay()];
  if (routine && hm >= d.workout) await fire("workout", `🏋️ ${routine} today`, "Your workout is ready in Lift Log.");
  if (hm >= d.streak) await fire("streak", `🔥 Keep your ${d.streakNow}-day streak`, "Log a workout or a rest day before midnight.");
  await c.put("/__sent", new Response(JSON.stringify(sent)));
}
self.addEventListener("periodicsync", (e) => { if (e.tag === "liftlog-reminder") e.waitUntil(checkReminders()); });
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow("./"))));
});
