"use strict";
// Optional Google Drive sync. Data goes to a hidden "app data" folder in the user's OWN Google Drive
// (scope drive.appdata: the app can only see its own file, nothing else in your Drive).
// Needs a Google OAuth Client ID in config.js. Without one, the app stays local-only.

const Sync = (() => {
  // drive.appdata: your private data file.  drive.file: only files this app creates (your public friend card).
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file";
  const FILE = "liftlog-data.json";
  const TOKEN_KEY = "liftlog.gtoken";
  let gis = null, timer = null, running = false, lastHash = null;

  const apiKey = () => (typeof LIFTLOG_CONFIG !== "undefined" && LIFTLOG_CONFIG.googleApiKey) || "";
  const clientId = () => (typeof LIFTLOG_CONFIG !== "undefined" && LIFTLOG_CONFIG.googleClientId) || "";
  const available = () => !!clientId();
  const on = () => available() && S.sync && S.sync.provider === "drive";

  function cached() {
    try { const t = JSON.parse(localStorage.getItem(TOKEN_KEY)); if (t && t.exp > Date.now() + 60e3) return t.token; } catch (e) {}
    return null;
  }
  function loadGis() {
    return (gis ||= new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = res; s.onerror = () => { gis = null; rej(new Error("Couldn't reach Google. Are you offline?")); };
      document.head.appendChild(s);
    }));
  }
  // interactive = true only from a tap (browsers block sign-in popups otherwise)
  async function token(interactive) {
    const c = cached(); if (c) return c;
    if (!interactive) throw Object.assign(new Error("Tap sync to sign in again"), { needsTap: true });
    await loadGis();
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: SCOPE,
        callback: (r) => {
          if (r.error) return rej(new Error(r.error_description || r.error));
          localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }));
          res(r.access_token);
        },
        error_callback: (e) => rej(new Error(e.type === "popup_closed" ? "Sign-in was closed" : "Sign-in failed")),
      });
      client.requestAccessToken({ prompt: "" });
    });
  }
  async function api(t, url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + t, ...(opts.headers || {}) } });
    if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); throw Object.assign(new Error("Google sign-in expired"), { needsTap: true }); }
    if (!r.ok) throw new Error("Drive error " + r.status);
    return r;
  }
  async function findFile(t) {
    const q = encodeURIComponent(`name='${FILE}'`);
    const r = await api(t, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`);
    return (await r.json()).files?.[0] || null;
  }
  async function upload(t, id, body) {
    if (id) {
      await api(t, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
      return id;
    }
    const b = "liftlog" + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name: FILE, parents: ["appDataFolder"] });
    const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
    const r = await api(t, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body: multipart });
    return (await r.json()).id;
  }

  // Public friend card: a small stats-only JSON in your Drive, readable by anyone who has its link.
  async function publishCard(t) {
    if (typeof publicCard !== "function") return;
    const body = JSON.stringify(publicCard());
    try {
      if (S.sync.pubId) {
        await api(t, `https://www.googleapis.com/upload/drive/v3/files/${S.sync.pubId}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
      } else {
        const b = "liftlog" + Math.random().toString(36).slice(2);
        const meta = JSON.stringify({ name: "Lift Log friend card.json", mimeType: "application/json",
          description: "Your public Lift Log card (name, level, streak and summary stats only). Friends' apps read it to show your live stats. Delete it to stop sharing." });
        const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
        const r = await api(t, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body: multipart });
        const id = (await r.json()).id;
        await api(t, `https://www.googleapis.com/drive/v3/files/${id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) });
        S.sync.pubId = id;
      }
      S.sync.pubError = "";
    } catch (e) {
      if (e.message.includes("404")) S.sync.pubId = null; // card file was deleted; recreate next time
      S.sync.pubError = e.message;
    }
  }
  // Read a friend's public card. Needs the API key from config.js (public files need no sign-in).
  async function fetchCard(id) {
    if (!apiKey() || !id) return null;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${apiKey()}`);
    if (!r.ok) throw new Error("Friend card " + r.status);
    return r.json();
  }
  async function refreshFriends() {
    let n = 0;
    for (const f of S.friends || []) {
      if (!f.p) continue;
      try { const c = await fetchCard(f.p); if (c && c.id === f.id) { Object.assign(f, c, { p: f.p, key: f.key, added: f.added }); n++; } } catch (e) {}
    }
    if (n) localStorage.setItem(KEY, JSON.stringify(S));
    return n;
  }

  function payload(state) {
    const { draft, timer, sync, lastBackup, ...rest } = state;
    return rest;
  }
  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }

  // Merge two copies: workouts/rest days/weights/friends are combined; profile & routines come from the newer copy.
  function merge(local, remote) {
    if (!remote) return local;
    const del = {
      w: [...new Set([...(local.deleted?.w || []), ...(remote.deleted?.w || [])])],
      r: [...new Set([...(local.deleted?.r || []), ...(remote.deleted?.r || [])])],
      wt: [...new Set([...(local.deleted?.wt || []), ...(remote.deleted?.wt || [])])],
    };
    const newer = (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
    const byId = new Map();
    [...(remote.workouts || []), ...(local.workouts || [])].forEach((w) => byId.set(w.id, w));
    const weights = new Map();
    const olderW = newer === local ? remote : local;
    [...(olderW.weights || []), ...(newer.weights || [])].forEach((x) => weights.set(x.date, x));
    const friends = new Map();
    [...(olderW.friends || []), ...(newer.friends || [])].forEach((f) => friends.set(f.key, f));
    return {
      ...local,
      profile: newer.profile, routines: newer.routines, customEx: newer.customEx || {}, appearance: newer.appearance || local.appearance, uni: newer.uni || {}, showcase: newer.showcase || [],
      workouts: [...byId.values()].filter((w) => !del.w.includes(w.id)),
      restDays: [...new Set([...(local.restDays || []), ...(remote.restDays || [])])].filter((d) => !del.r.includes(d)).sort(),
      weights: [...weights.values()].filter((x) => !del.wt.includes(x.date)),
      friends: [...friends.values()],
      deleted: del,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
    };
  }

  async function run(interactive) {
    if (!on() || running) return;
    running = true; status("syncing");
    try {
      const t = await token(interactive);
      const f = await findFile(t);
      let remote = null;
      if (f) remote = await (await api(t, `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json();
      const merged = merge(payload(S), remote);
      const body = JSON.stringify(merged);
      const id = await upload(t, f && f.id, body);
      Object.assign(S, merged);
      await publishCard(t);
      S.sync = { ...S.sync, fileId: id, lastSync: Date.now(), error: "" };
      lastHash = hash(JSON.stringify(payload(S)));
      localStorage.setItem(KEY, JSON.stringify(S));
      invalidate(); status("ok");
      if (remote && typeof render === "function") render();
    } catch (e) {
      S.sync = { ...S.sync, error: e.message, needsTap: !!e.needsTap };
      localStorage.setItem(KEY, JSON.stringify(S));
      status(e.needsTap ? "tap" : "error");
    } finally { running = false; }
  }
  // Called after every save: uploads a few seconds later, only if real data changed.
  function schedule() {
    if (!on()) return;
    const h = hash(JSON.stringify(payload(S)));
    if (h === lastHash) return;
    status("pending");
    clearTimeout(timer); timer = setTimeout(() => run(false), 4000);
  }
  let statusCb = () => {};
  function status(s) { statusCb(s); }
  function onStatus(cb) { statusCb = cb; }
  function signOut() { const c = cached(); localStorage.removeItem(TOKEN_KEY); try { if (c && window.google) google.accounts.oauth2.revoke(c); } catch (e) {} }

  return { available, on, run, schedule, merge, onStatus, signOut, fetchCard, refreshFriends, hasToken: () => !!cached() };
})();
