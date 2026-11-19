"use strict";
// Lift Log v2: a free, offline workout logger. All data stays in this browser (localStorage).

const KEY = "liftlog.v1";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


// ---------- state ----------
function blankProfile() {
  return { name: "", avatar: "", avatarPreset: "", avatarImg: "", height: "", goal: "Build muscle", weeklyTarget: 5,
    restCompound: 120, restIsolation: 75, playlist: "", memberId: Math.random().toString(36).slice(2, 8).toUpperCase() };
}
function blank() {
  return { version: 4, profile: blankProfile(), weights: [], workouts: [], restDays: [], routines: [], customEx: {},
    draft: null, timer: null, uni: {}, showcase: [], friends: [], deleted: { w: [], r: [], wt: [] },
    sync: { provider: "local", lastSync: null, fileId: null, error: "" }, appearance: { mode: "system", theme: "classic", style: "tint" },
    lastBackup: null, updatedAt: 0 };
}
let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version) return migrate(s);
  } catch (e) {}
  return blank();
}
function migrate(s) {
  const b = blank();
  const out = Object.assign(b, s);
  out.profile = Object.assign(blankProfile(), s.profile || {});
  if (s.name && !out.profile.name) out.profile.name = s.name;
  out.deleted = Object.assign({ w: [], r: [], wt: [] }, s.deleted || {});
  out.sync = Object.assign(b.sync, s.sync || {});
  out.appearance = Object.assign(b.appearance, s.appearance || {});
  if (s.onboarded == null) out.onboarded = !!((s.workouts && s.workouts.length) || (s.profile && s.profile.name));
  out.version = 4;
  return out;
}
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save. Storage is full or blocked."); }
  if (typeof Sync !== "undefined") Sync.schedule();
}

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = (s) => parseYmd(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtShort = (s) => parseYmd(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
const round1 = (v) => Math.round(v * 10) / 10;
const isBW = (name) => BODYWEIGHT.test(name);
const isUni = (name) => (name in S.uni ? S.uni[name] : UNILATERAL.test(name));
const restFor = (name) => (COMPOUND.test(name) ? +S.profile.restCompound || 120 : +S.profile.restIsolation || 75);
const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 12) / 30) : 0);
const setVol = (s) => (s.w || 0) * (s.r || 0) * (s.u ? 2 : 1);
const mmss = (sec) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
function fmtSet(name, s) { const base = isBW(name) && !s.w ? `${s.r}` : `${round1(s.w)}×${s.r}`; return s.u ? base + "/side" : base; }
function fmtKg(v) { return v >= 10000 ? (v / 1000).toFixed(1) + "t" : Math.round(v).toLocaleString() + " kg"; }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2800);
}
function weekStart(s) { const d = parseYmd(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return ymd(d); } // Monday
const liftSessions = () => S.workouts.filter((w) => (w.sets || []).length);

// ---------- derived data ----------
let _cache = null;
function sessionsByExercise() {
  if (_cache && _cache.n === S.workouts.length && _cache.ref === S.workouts) return _cache.map;
  const map = {};
  for (const w of [...S.workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const per = {};
    for (const s of w.sets || []) { if (!s.r && !s.w) continue; (per[s.ex] ||= []).push(s); }
    for (const [ex, sets] of Object.entries(per)) {
      const top = Math.max(...sets.map((s) => s.w || 0));
      const topSet = sets.filter((s) => (s.w || 0) === top).sort((a, b) => b.r - a.r)[0];
      (map[ex] ||= []).push({
        date: w.date, sets, top, topReps: topSet.r,
        e1rm: Math.max(...sets.map((s) => e1rm(s.w, s.r))),
        volume: sets.reduce((a, s) => a + setVol(s), 0),
        reps: Math.max(...sets.map((s) => s.r || 0)),
        totalReps: sets.reduce((a, s) => a + (s.r || 0), 0),
      });
    }
  }
  _cache = { n: S.workouts.length, ref: S.workouts, map };
  return map;
}
function invalidate() { _cache = null; _bs = null; }
function lastSession(ex) { const l = sessionsByExercise()[ex]; return l ? l[l.length - 1] : null; }

function activeDays() {
  const set = new Set(S.restDays);
  for (const w of S.workouts) set.add(w.date);
  return set;
}
function streaks() {
  const days = activeDays();
  let cur = 0, d = today();
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const x of [...days].sort()) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { cur, best, loggedToday: days.has(today()) };
}
function muscleSets(fromDate, toDate) {
  const out = Object.fromEntries(Object.keys(MUSCLES).map((k) => [k, 0]));
  for (const w of S.workouts) {
    if (w.date < fromDate || w.date > toDate) continue;
    for (const s of w.sets || []) {
      if (!s.r && !s.w) continue;
      const m = musclesFor(s.ex);
      m.p.forEach((k) => (out[k] += 1));
      m.s.forEach((k) => (out[k] += 0.5));
    }
  }
  return out;
}
function allPRs() {
  // every session where an exercise beat its previous best
  const out = [];
  for (const [ex, list] of Object.entries(sessionsByExercise())) {
    const bw = isBW(ex); let best = -Infinity;
    list.forEach((x, i) => {
      const sc = bw ? x.reps : x.e1rm;
      if (i > 0 && sc > best) out.push({ ex, date: x.date, text: bw ? `${x.reps} reps` : `${round1(x.top)} kg × ${x.topReps}${x.sets[0].u ? "/side" : ""}` });
      best = Math.max(best, sc);
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function totals() {
  const ls = liftSessions();
  const sets = ls.reduce((a, w) => a + w.sets.length, 0);
  const vol = ls.reduce((a, w) => a + w.sets.reduce((b, s) => b + setVol(s), 0), 0);
  return { sessions: ls.length, sets, vol };
}
function levelInfo() {
  const t = totals();
  const xp = t.sets * 10 + t.sessions * 50 + allPRs().length * 25;
  let lvl = 1; const need = (L) => 75 * L * (L + 1);
  while (xp >= need(lvl)) lvl++;
  const lo = need(lvl - 1) * (lvl > 1 ? 1 : 0), hi = need(lvl);
  return { xp, lvl, pct: (xp - lo) / (hi - lo), toNext: hi - xp };
}

function coachFlags() {
  const flags = [], t = today();
  for (const [ex, list] of Object.entries(sessionsByExercise())) {
    if (list.length < 2) continue;
    const bw = isBW(ex), score = (x) => (bw ? x.reps : x.e1rm);
    const last = list[list.length - 1], prev = list[list.length - 2];
    const daysAgo = (parseYmd(t) - parseYmd(last.date)) / 864e5;
    if (daysAgo > 21) continue;
    const bestBefore = Math.max(...list.slice(0, -1).map(score));
    if (!bw && last.top > prev.top && daysAgo <= 14) {
      const lastMin = Math.min(...last.sets.map((s) => s.r)), prevMin = Math.min(...prev.sets.map((s) => s.r));
      if (prevMin - lastMin >= 3) {
        flags.push({ kind: "warn", ex, text: `Reps fell from ${prevMin} to ${lastMin} after jumping to ${round1(last.top)} kg. Go back to ${round1(prev.top)} kg until you hit the top of your rep range.` });
        continue;
      }
    }
    if (score(last) > bestBefore && daysAgo <= 7) { flags.push({ kind: "good", ex, text: bw ? `New best: ${last.reps} reps` : `New best: ${round1(last.top)} kg × ${last.topReps}` }); continue; }
    const cutoff = addDays(t, -35);
    const recent = list.filter((x) => x.date >= cutoff), older = list.filter((x) => x.date < cutoff);
    if (recent.length >= 3 && older.length && Math.max(...recent.map(score)) <= Math.max(...older.map(score)))
      flags.push({ kind: "warn", ex, text: `No new best in 5 weeks (${recent.length} sessions). Try a lighter week or a different rep range.` });
  }
  return flags.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "warn" ? -1 : 1));
}

// ---------- badges ----------
let _bs = null;
function badgeStats() {
  if (_bs && _bs.u === S.updatedAt) return _bs.v;
  const t = totals(), st = streaks(), map = sessionsByExercise(), ls = liftSessions();
  const bw = +(S.weights.at(-1)?.kg) || 0;
  const top = (re) => Math.max(0, ...Object.entries(map).filter(([e]) => re.test(e)).flatMap(([, l]) => l.map((x) => x.top)));
  const pullReps = Math.max(0, ...Object.entries(map).filter(([e]) => /pull ?ups?\b|\bchin ?ups?\b/i.test(e)).flatMap(([, l]) => l.map((x) => x.reps)));
  const weeks = {};
  ls.forEach((w) => { const k = weekStart(w.date); weeks[k] = (weeks[k] || 0) + 1; });
  let allMuscles = false;
  for (const k of Object.keys(weeks)) { const ms = muscleSets(k, addDays(k, 6)); if (Object.values(ms).every((v) => v > 0)) allMuscles = true; }
  // consecutive weeks hitting the weekly goal
  const goal = +S.profile.weeklyTarget || 5;
  let perfect = 0, run = 0;
  Object.keys(weeks).sort().forEach((k, i, arr) => {
    const prevOk = i > 0 && addDays(arr[i - 1], 7) === k;
    run = weeks[k] >= goal ? (prevOk ? run : 0) + 1 : 0; perfect = Math.max(perfect, run);
  });
  const dates = [...new Set(ls.map((w) => w.date))].sort();
  const comeback = dates.some((d, i) => i > 0 && (parseYmd(d) - parseYmd(dates[i - 1])) / 864e5 >= 7);
  const weekend = Object.keys(weeks).some((k) => dates.includes(addDays(k, 5)) && dates.includes(addDays(k, 6)));
  const hours = S.workouts.filter((w) => w.start).map((w) => +w.start.slice(0, 2));
  const m4 = muscleSets(addDays(today(), -27), today());
  const balanced = Object.keys(GROUPS).every((g) => GROUPS[g].reduce((a, k) => a + m4[k], 0) >= 0.75 * GROUPS[g].reduce((a, k) => a + WEEKLY_TARGET[k] * 4, 0));
  const v = { ...t, best: st.best, bw, squat: top(/barbell squat/i), bench: top(/bench press/i), legpress: top(/leg press/i), pullReps,
    bestWeek: Math.max(0, ...Object.values(weeks)), allMuscles, perfect, comeback, weekend, balanced,
    unique: Object.keys(map).length, rests: S.restDays.length, weighIns: S.weights.length, friends: (S.friends || []).length,
    marathon: S.workouts.some((w) => w.dur >= 90), quick: S.workouts.some((w) => w.dur && w.dur <= 45 && (w.sets || []).length >= 15),
    early: hours.some((h) => h < 8), late: hours.some((h) => h >= 21), prs: allPRs().length,
    avatar: !!(S.profile.avatarImg || S.profile.avatarPreset) };
  _bs = { u: S.updatedAt, v };
  return v;
}
const B = (id, icon, name, desc, cat, test) => ({ id, icon, name, desc, cat, test });
const BADGES = [
  B("first", "🎯", "First rep", "Log your first workout", "Consistency", (b) => b.sessions >= 1),
  B("w10", "🏋️", "Regular", "10 workouts", "Consistency", (b) => b.sessions >= 10),
  B("w25", "🎽", "Gym rat", "25 workouts", "Consistency", (b) => b.sessions >= 25),
  B("w50", "🏆", "Committed", "50 workouts", "Consistency", (b) => b.sessions >= 50),
  B("w100", "👑", "Centurion", "100 workouts", "Consistency", (b) => b.sessions >= 100),
  B("w200", "🗿", "Iron habit", "200 workouts", "Consistency", (b) => b.sessions >= 200),
  B("w365", "🌍", "Year of iron", "365 workouts", "Consistency", (b) => b.sessions >= 365),
  B("full", "📅", "Full week", "6 workouts in one week", "Consistency", (b) => b.bestWeek >= 6),
  B("perfect4", "🎖️", "On target", "Hit your weekly goal 4 weeks in a row", "Consistency", (b) => b.perfect >= 4),
  B("weekend", "🛹", "Weekend warrior", "Train on both Saturday and Sunday", "Consistency", (b) => b.weekend),
  B("comeback", "🔁", "Comeback", "Return after a week or more off", "Consistency", (b) => b.comeback),
  B("rest20", "😴", "Recovery pro", "Log 20 rest days", "Consistency", (b) => b.rests >= 20),
  B("s7", "🔥", "Week warrior", "7-day streak", "Streaks", (b) => b.best >= 7),
  B("s14", "✨", "Fortnight", "14-day streak", "Streaks", (b) => b.best >= 14),
  B("s30", "⚡", "Month of grind", "30-day streak", "Streaks", (b) => b.best >= 30),
  B("s60", "🌋", "Unstoppable", "60-day streak", "Streaks", (b) => b.best >= 60),
  B("s100", "💯", "Hundred club", "100-day streak", "Streaks", (b) => b.best >= 100),
  B("s200", "☄️", "Relentless", "200-day streak", "Streaks", (b) => b.best >= 200),
  B("s365", "🌞", "Full orbit", "365-day streak", "Streaks", (b) => b.best >= 365),
  B("sets500", "💪", "Set machine", "500 sets", "Volume", (b) => b.sets >= 500),
  B("sets1k", "🦾", "Thousand sets", "1,000 sets", "Volume", (b) => b.sets >= 1000),
  B("sets2500", "🤖", "Rep factory", "2,500 sets", "Volume", (b) => b.sets >= 2500),
  B("sets5k", "🏭", "Industrial", "5,000 sets", "Volume", (b) => b.sets >= 5000),
  B("t10", "🧱", "10 tonnes", "Lift 10,000 kg in total", "Volume", (b) => b.vol >= 1e4),
  B("t50", "🏗️", "50 tonnes", "Lift 50,000 kg in total", "Volume", (b) => b.vol >= 5e4),
  B("t100", "🚀", "100 tonnes", "Lift 100,000 kg in total", "Volume", (b) => b.vol >= 1e5),
  B("t250", "🐋", "Blue whale", "Lift 250,000 kg in total", "Volume", (b) => b.vol >= 2.5e5),
  B("t500", "🚢", "Cargo ship", "Lift 500,000 kg in total", "Volume", (b) => b.vol >= 5e5),
  B("t1000", "🌌", "Megaton", "Lift 1,000,000 kg in total", "Volume", (b) => b.vol >= 1e6),
  B("bwsq", "🦵", "Bodyweight squat", "Squat your own bodyweight", "Strength", (b) => b.bw > 0 && b.squat >= b.bw),
  B("bwbench", "🛡️", "Bodyweight bench", "Bench your own bodyweight", "Strength", (b) => b.bw > 0 && b.bench >= b.bw),
  B("sq100", "💥", "Triple digits", "Squat 100 kg", "Strength", (b) => b.squat >= 100),
  B("sq140", "🦍", "Three plates", "Squat 140 kg", "Strength", (b) => b.squat >= 140),
  B("bp60", "🥈", "Plate up", "Bench 60 kg", "Strength", (b) => b.bench >= 60),
  B("bp100", "🥇", "Two plates", "Bench 100 kg", "Strength", (b) => b.bench >= 100),
  B("lp300", "🐘", "Leg press beast", "Leg press 300 kg", "Strength", (b) => b.legpress >= 300),
  B("pu5", "🧗", "Pull-up five", "5 pull-ups in one set", "Strength", (b) => b.pullReps >= 5),
  B("pu10", "🦅", "Pull-up pro", "10 pull-ups in one set", "Strength", (b) => b.pullReps >= 10),
  B("pu15", "🐒", "Monkey bars", "15 pull-ups in one set", "Strength", (b) => b.pullReps >= 15),
  B("pr10", "⭐", "PR hunter", "Set 10 personal bests", "Strength", (b) => b.prs >= 10),
  B("pr25", "🌟", "PR machine", "Set 25 personal bests", "Strength", (b) => b.prs >= 25),
  B("pr50", "💫", "Record breaker", "Set 50 personal bests", "Strength", (b) => b.prs >= 50),
  B("pr100", "🏅", "Legend", "Set 100 personal bests", "Strength", (b) => b.prs >= 100),
  B("ex25", "🧭", "Explorer", "Try 25 different exercises", "Explorer", (b) => b.unique >= 25),
  B("ex50", "🗺️", "Globetrotter", "Try 50 different exercises", "Explorer", (b) => b.unique >= 50),
  B("allm", "🧩", "Complete", "Train every muscle in one week", "Explorer", (b) => b.allMuscles),
  B("balanced", "⚖️", "Balanced", "Hit 75% of target for every muscle group over 4 weeks", "Explorer", (b) => b.balanced),
  B("early", "🌅", "Early bird", "Start a workout before 8 am", "Lifestyle", (b) => b.early),
  B("late", "🌙", "Night owl", "Start a workout after 9 pm", "Lifestyle", (b) => b.late),
  B("marathon", "⏳", "Marathon", "A 90-minute session", "Lifestyle", (b) => b.marathon),
  B("quick", "⏱️", "Efficient", "15+ sets in 45 minutes or less", "Lifestyle", (b) => b.quick),
  B("wt10", "⚖", "Tracker", "Log your bodyweight 10 times", "Lifestyle", (b) => b.weighIns >= 10),
  B("look", "🎨", "Fresh look", "Pick an avatar or upload a photo", "Lifestyle", (b) => b.avatar),
  B("squad", "🤝", "Squad up", "Add a friend", "Lifestyle", (b) => b.friends >= 1),
];
const earnedBadges = () => { const b = badgeStats(); return BADGES.filter((x) => x.test(b)); };
function showcaseBadges() {
  const earned = new Set(earnedBadges().map((x) => x.id));
  let ids = (S.showcase || []).filter((id) => earned.has(id));
  if (!ids.length) { // default: your best badge from each of the headline categories
    const e = earnedBadges();
    ids = ["Streaks", "Strength", "Volume", "Consistency", "Explorer", "Lifestyle"].map((c) => e.filter((x) => x.cat === c).at(-1)).filter(Boolean).map((x) => x.id);
  }
  return ids.slice(0, 3).map((id) => BADGES.find((x) => x.id === id));
}

// ---------- profile card, avatar, friends ----------
function avatarHTML(size = 44, who = S.profile) {
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.45}px`;
  if (who.avatarImg) return `<div class="avatar img" style="${style}"><img src="${who.avatarImg}" alt=""></div>`;
  const preset = who.avatarPreset || who.av;
  if (preset && AVATARS[preset]) return `<div class="avatar svg" style="${style}">${avatarSVG(preset)}</div>`;
  const ch = (who.avatar || (who.name || who.n || "?").trim()[0] || "?").toUpperCase();
  return `<div class="avatar" style="${style}">${esc(ch)}</div>`;
}
function bestLifts() {
  const b = badgeStats();
  return { sq: b.squat, bp: b.bench, pu: b.pullReps };
}
function myCardData() {
  const lv = levelInfo(), st = streaks(), t = totals(), bl = bestLifts();
  const first = liftSessions().map((w) => w.date).sort()[0] || today();
  return { v: 1, n: S.profile.name || "Lifter", av: S.profile.avatarPreset || "", g: S.profile.goal, id: S.profile.memberId,
    lv: lv.lvl, st: st.cur, bs: st.best, wo: t.sessions, t: Math.round(t.vol / 100) / 10, ...bl,
    b: showcaseBadges().map((x) => x.id), since: first.slice(0, 7), at: today(), ...(Sync.on() && S.sync.pubId ? { p: S.sync.pubId } : {}) };
}
const b64u = { enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))) };
function shareURL(d = myCardData()) { return `${location.origin}${location.pathname}#f=${b64u.enc(JSON.stringify(d))}`; }
function qrSVG(text) {
  try { const q = qrcode(0, "L"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); }
  catch (e) { return ""; }
}
const sinceLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" }); };

// d = card data (mine or a friend's)
function dogtagHTML(d, mine = true) {
  const badges = (d.b || []).map((id) => BADGES.find((x) => x.id === id)).filter(Boolean);
  const who = mine ? S.profile : { n: d.n, av: d.av };
  return `<div class="tag-wrap"><div class="tag" tabindex="0" role="button" aria-label="Profile card, tap to flip">
    <div class="tag-face tag-front">
      <div class="tag-hole"></div>
      <div class="tag-main">
        ${avatarHTML(54, who)}
        <div class="tag-id">
          <div class="tag-name">${esc(d.n)}</div>
          <div class="tag-sub">LV ${d.lv} · ${esc(d.g || "")}</div>
          <div class="tag-sub mono">ID ${esc(d.id || "------")} · since ${sinceLabel(d.since || today().slice(0, 7))}</div>
        </div>
      </div>
      ${mine ? `<div class="tag-qr">${qrSVG(shareURL(d))}</div>` : `<div class="tag-qr big">🔥<b>${d.st}</b></div>`}
      <div class="tag-hint">tap to flip ↻</div>
    </div>
    <div class="tag-face tag-back">
      <div class="tag-hole"></div>
      <div class="tag-stats">
        <div><b>🔥 ${d.st}</b><span>streak</span></div><div><b>${d.wo}</b><span>workouts</span></div>
        <div><b>${d.t}t</b><span>lifted</span></div><div><b>${d.bs}</b><span>best</span></div>
      </div>
      <div class="tag-lifts">
        <span>Squat <b>${d.sq ? round1(d.sq) + " kg" : "–"}</b></span><span>Bench <b>${d.bp ? round1(d.bp) + " kg" : "–"}</b></span><span>Pull-ups <b>${d.pu || "–"}</b></span>
      </div>
      <div class="tag-badges">${badges.map((x) => `<span title="${esc(x.name)}">${x.icon}<small>${esc(x.name)}</small></span>`).join("") || `<small class="muted">No badges pinned</small>`}</div>
    </div>
  </div></div>`;
}
function wireDogtag(root = document) {
  $$(".tag", root).forEach((t) => {
    const flip = () => t.classList.toggle("flipped");
    t.addEventListener("click", flip);
    t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  });
}
async function shareMyCard() {
  const url = shareURL();
  try {
    if (navigator.share) { await navigator.share({ title: "My Lift Log card", text: `Add me on Lift Log 💪`, url }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("Card link copied. Send it to a friend"); } catch (e) { prompt("Copy this link:", url); }
}
// ---------- modal ----------
function openModal(html, onMount) {
  closeModal();
  const m = document.createElement("div"); m.className = "modal"; m.id = "modal";
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-x" aria-label="Close">✕</button>${html}</div>`;
  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".sheet-x")) closeModal(); });
  if (onMount) onMount($(".sheet", m));
}
function closeModal() { const m = $("#modal"); if (m) m.remove(); }

function checkFriendLink() {
  const h = location.hash; if (!h.startsWith("#f=")) return;
  history.replaceState(null, "", location.pathname + location.search);
  let d; try { d = JSON.parse(b64u.dec(h.slice(3))); } catch (e) { toast("That friend link looks broken"); return; }
  if (d.id && d.id === S.profile.memberId) { toast("That's your own card 😄"); return; }
  const key = (d.id || d.n) + "";
  if (d.p) Sync.fetchCard(d.p).then((live) => { if (live) Object.assign(d, live, { p: d.p }); }).catch(() => {});
  const exists = (S.friends || []).some((f) => f.key === key);
  openModal(`<h2>${exists ? "Update friend" : "Add friend?"}</h2>${dogtagHTML(d, false)}
    <p class="small muted">Friends are stored on this device only. Ask them to send a fresh link to update their stats.</p>
    <button class="btn primary block" id="addFriend">${exists ? "Update card" : "Add to my friends"}</button>`, (sh) => {
    wireDogtag(sh);
    $("#addFriend", sh).onclick = () => {
      S.friends = (S.friends || []).filter((f) => f.key !== key); S.friends.push({ ...d, key, added: today() });
      save(); closeModal(); toast(`${d.n} added 🤝`); tab = "profile"; render();
    };
  });
}

// ---------- routing ----------
let tab = "home";
$$(".tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
function render() {
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#streakBadge").innerHTML = `🔥 ${streaks().cur}`;
  statusChip();
  $("#modeBtn").textContent = document.documentElement.dataset.mode === "dark" ? "☀️" : "🌙";
  hideTip();
  ({ home: renderHome, activity: renderActivity, stats: renderStats, friends: renderFriends, profile: renderProfile })[tab]();
  renderTimer();
}

// ---------- HOME ----------
function greeting() { const h = new Date().getHours(); return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function routineForToday() { const d = new Date().getDay(); return S.routines.find((r) => r.day === d) || S.routines[0]; }
let homeRoutine = null, homeWeek = 0; // homeWeek: 0 = this week, 1 = last week, ...

function renderHome() {
  if (S.draft) return renderLogger();
  const st = streaks(), lv = levelInfo(), p = S.profile;
  const r = homeRoutine != null && S.routines[homeRoutine] ? S.routines[homeRoutine] : routineForToday();
  const wk = weekStart(today()), vwk = addDays(wk, -7 * homeWeek);
  const weekSessions = liftSessions().filter((w) => w.date >= wk);
  const viewSessions = liftSessions().filter((w) => w.date >= vwk && w.date <= addDays(vwk, 6));
  const firstLog = [...activeDays()].sort()[0] || today();
  const canBack = addDays(vwk, -1) >= weekStart(firstLog);
  const weekVol = weekSessions.reduce((a, w) => a + w.sets.reduce((b, s) => b + setVol(s), 0), 0);
  const target = +p.weeklyTarget || 5;
  const days = activeDays(), rest = new Set(S.restDays), lifted = new Set(S.workouts.map((w) => w.date));

  // muscles targeted by today's routine
  const lv5 = {};
  (r ? r.exercises : []).forEach((ex) => { const m = musclesFor(ex); m.s.forEach((k) => (lv5[k] = Math.max(lv5[k] || 0, 2))); m.p.forEach((k) => (lv5[k] = 5)); });
  const primary = Object.keys(lv5).filter((k) => lv5[k] === 5);

  const prs = allPRs().filter((x) => x.date >= addDays(today(), -14)).slice(0, 4);
  const flags = coachFlags().filter((f) => f.kind === "warn").slice(0, 2);
  const b = badgeStats(), earned = earnedBadges();
  const nextBadge = BADGES.find((x) => !x.test(b));

  let html = `
  <div class="hello-line"><div class="hello">${greeting()}${p.name ? ", " + esc(p.name.split(" ")[0]) : ""} 👋</div>
    <div class="small muted">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div></div>
  ${dogtagHTML(myCardData())}
  <div class="xp-row"><span class="lvl">Lv ${lv.lvl}</span><div class="xp"><div style="width:${Math.round(lv.pct * 100)}%"></div></div>
    <span class="small muted">${lv.toNext.toLocaleString()} XP to go</span></div>

  <div class="card">
    <div class="row"><div><div class="big">🔥 ${st.cur}</div><div class="small muted">day streak · best ${st.best}</div></div><span class="spacer"></span>
      ${ring(viewSessions.length, target, homeWeek === 0 ? "this week" : "that week")}</div>
    <div class="wk-nav"><button class="icon-btn" id="wkBack" ${canBack ? "" : "disabled"} aria-label="Previous week">‹</button>
      <span>${homeWeek === 0 ? "This week" : homeWeek === 1 ? "Last week" : `${fmtShort(vwk)} – ${fmtShort(addDays(vwk, 6))}`}</span>
      <button class="icon-btn" id="wkFwd" ${homeWeek === 0 ? "disabled" : ""} aria-label="Next week">›</button></div>
    <div class="weekstrip">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(vwk, i), cls = lifted.has(d) ? "done" : rest.has(d) ? "rest" : d === today() ? "today" : d < today() ? "miss" : "";
      return `<div class="wd ${cls}" title="${fmtDate(d)}"><span>${"MTWTFSS"[i]}</span><i>${lifted.has(d) ? "✓" : rest.has(d) ? "z" : ""}</i><small>${+d.slice(8)}</small></div>`;
    }).join("")}</div>
  </div>`;

  if (!S.routines.length) html += `<div class="card empty-plan"><div style="font-size:36px">📋</div><h2>Set up your routine</h2>
    <p class="small muted">Plan your training days once, and each day's workout will be ready here with your last numbers.</p>
    <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn primary" id="newR">+ Create routine</button><button class="btn" id="tplR">📚 Use a template</button></div>
    <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost small" id="startBtn">Start an empty workout</button><button class="btn ghost small" id="restBtn" ${st.loggedToday ? "disabled" : ""}>Log rest day</button></div><select id="routineSel" hidden><option value="-1"></option></select></div>`;
  else html += `<div class="card">
    <div class="row"><h2 style="margin:0">${st.loggedToday ? "Done for today ✓" : "Today's plan"}</h2><span class="spacer"></span>
      <select id="routineSel" class="compact">${S.routines.map((x, i) => `<option value="${i}" ${x === r ? "selected" : ""}>${esc(x.name)}</option>`).join("")}<option value="-1">Empty workout</option></select></div>
    <div class="plan">
      <div class="mini">${figureSVG(FIGURE_FRONT, (k) => lv5[k] || 0, "")}${figureSVG(FIGURE_BACK, (k) => lv5[k] || 0, "")}</div>
      <div class="plan-list">
        <div class="chips">${primary.map((k) => `<span class="chip">${MUSCLES[k]}</span>`).join("")}</div>
        ${(r ? r.exercises : []).map((ex) => { const l = lastSession(ex); return `<div class="pl"><span>${esc(ex)}</span><span class="muted">${l ? fmtSet(ex, l.sets.reduce((a, s) => (setVol(s) > setVol(a) || (isBW(ex) && s.r > a.r) ? s : a), l.sets[0])) : "new"}</span></div>`; }).join("")}
      </div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="startBtn" style="flex:1">▶ Start workout</button>
      <button class="btn" id="restBtn" ${st.loggedToday ? "disabled" : ""}>Rest day</button></div>
  </div>

  <div class="tiles">
    <div class="card tile"><div class="num">${weekSessions.reduce((a, w) => a + w.sets.length, 0)}</div><div class="lbl">sets this week</div></div>
    <div class="card tile"><div class="num">${fmtKg(weekVol)}</div><div class="lbl">lifted this week</div></div>
    <div class="card tile"><div class="num">${totals().sessions}</div><div class="lbl">total workouts</div></div>
  </div>`;

  if (prs.length) html += `<div class="card"><h2>Recent PRs 🏆</h2>${prs.map((x) => `<div class="pr-row"><span>${esc(x.ex)}</span><span class="spacer"></span><b>${esc(x.text)}</b><span class="small muted" style="width:52px;text-align:right">${fmtShort(x.date)}</span></div>`).join("")}</div>`;
  if (flags.length) html += `<div class="card"><h2>Coach says</h2>${flags.map((x) => `<div class="flag warn"><span class="ic">!</span><div><b>${esc(x.ex)}</b><br><span class="ink2">${esc(x.text)}</span></div></div>`).join("")}<button class="btn small ghost" id="moreFlags">See all notes →</button></div>`;

  html += `<div class="card"><div class="row"><h2 style="margin:0">Badges</h2><span class="spacer"></span><span class="small muted">${earned.length}/${BADGES.length}</span></div>
    <div class="badge-strip">${earned.slice(-6).reverse().map((x) => `<div class="badge on" title="${esc(x.desc)}"><span>${x.icon}</span><small>${esc(x.name)}</small></div>`).join("")}</div>
    ${nextBadge ? `<div class="small muted">Next up: ${nextBadge.icon} <b>${esc(nextBadge.name)}</b>: ${esc(nextBadge.desc)}</div>` : ""}</div>`;

  const embed = spotifyEmbed(p.playlist);
  html += embed
    ? `<div class="card"><div class="row"><h2 style="margin:0">Gym playlist 🎧</h2><span class="spacer"></span><a class="btn small" href="${esc(p.playlist)}" target="_blank" rel="noopener">Open in Spotify</a></div>
       <iframe class="spotify" src="${embed}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`
    : `<div class="card row"><span>🎧 Add your Spotify gym playlist in Profile to play it from here.</span></div>`;

  $("#view").innerHTML = html;
  wireDogtag($("#view"));
  $("#routineSel").onchange = (e) => { homeRoutine = +e.target.value; if (homeRoutine >= 0) renderHome(); };
  $("#startBtn").onclick = () => { const i = +$("#routineSel").value; S.draft = newDraft(S.routines[i]); save(); render(); };
  const nr = $("#newR"); if (nr) { nr.onclick = () => editRoutine(-1); $("#tplR").onclick = chooseTemplate; }
  $("#wkBack").onclick = () => { homeWeek++; renderHome(); };
  $("#wkFwd").onclick = () => { homeWeek = Math.max(0, homeWeek - 1); renderHome(); };
  const rb = $("#restBtn"); if (rb) rb.onclick = () => { if (!S.restDays.includes(today())) S.restDays.push(today()); save(); toast("Rest day logged. Streak safe 🔥"); render(); };
  const mf = $("#moreFlags"); if (mf) mf.onclick = () => { tab = "activity"; actView = "progress"; render(); };
}
function ring(v, target, label) {
  const r = 26, c = 2 * Math.PI * r, f = Math.min(1, v / target);
  return `<div class="ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${r}" class="rbg"/>
    <circle cx="32" cy="32" r="${r}" class="rfg" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37">${v}/${target}</text></svg><div class="small muted">${label}</div></div>`;
}
function spotifyEmbed(url) {
  const m = String(url || "").match(/open\.spotify\.com\/(?:intl-\w+\/)?(playlist|album|artist|track)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : "";
}

// ---------- LOGGER ----------
function newDraft(routine) {
  return {
    date: today(), name: routine ? routine.name : "Workout", startedAt: Date.now(),
    exercises: (routine ? routine.exercises : []).map((ex) => {
      const last = lastSession(ex);
      const n = last ? Math.max(3, Math.min(last.sets.length, 5)) : 3;
      return { ex, uni: isUni(ex), sets: Array.from({ length: n }, () => ({ w: "", r: "", done: false })) };
    }),
  };
}
function renderLogger() {
  const D = S.draft;
  D.startedAt ||= Date.now();
  const doneCount = D.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const allCount = D.exercises.reduce((a, e) => a + e.sets.length, 0);
  let html = `<div class="card logger-head"><div class="row"><div><h2 style="margin:0">${esc(D.name)}</h2>
      <div class="small muted"><span id="elapsed">${mmss((Date.now() - D.startedAt) / 1000)}</span> · ${doneCount}/${allCount} sets done</div></div>
      <span class="spacer"></span><input type="date" id="draftDate" value="${D.date}" style="width:auto"></div>
      <div class="xp" style="margin-top:10px"><div style="width:${allCount ? (doneCount / allCount) * 100 : 0}%"></div></div></div>`;
  D.exercises.forEach((e, ei) => {
    const last = lastSession(e.ex), bw = isBW(e.ex);
    html += `<div class="card ex" data-ei="${ei}">
      <div class="ex-head"><span class="ex-name">${esc(e.ex)}</span><span class="spacer"></span>
        <button class="chip-btn ${e.uni ? "on" : ""}" data-act="uni" title="Log reps per side">Per side</button>
        <button class="btn ghost small" data-act="rmex" aria-label="Remove exercise">✕</button></div>
      <div class="last">${last ? `Last (${fmtShort(last.date)}): ${last.sets.map((s) => fmtSet(e.ex, s)).join(", ")}` : "First time, no history yet"} · rest ${mmss(restFor(e.ex))}</div>
      <div class="set-head"><span>Set</span><span>${bw ? "+kg" : "kg"}</span><span>${e.uni ? "Reps/side" : "Reps"}</span><span>Done</span><span></span></div>
      ${e.sets.map((s, si) => {
        const ls = last && last.sets[Math.min(si, last.sets.length - 1)];
        return `<div class="set ${s.done ? "done" : ""}" data-si="${si}"><span class="n">${si + 1}</span>
          <input type="number" inputmode="decimal" step="0.5" data-f="w" value="${s.w}" placeholder="${ls && ls.w ? round1(ls.w) : bw ? "0" : "kg"}">
          <input type="number" inputmode="numeric" data-f="r" value="${s.r}" placeholder="${ls ? ls.r : "reps"}">
          <button class="tick" data-act="done" aria-label="Mark set done">✓</button>
          <button class="x" data-act="rmset" aria-label="Remove set">×</button></div>`;
      }).join("")}
      <button class="btn ghost small" data-act="addset">+ Add set</button>
    </div>`;
  });
  html += `<div class="card"><div class="row">
      <input type="text" id="addExName" list="exList" placeholder="Add exercise…"><button class="btn" id="addExBtn">Add</button></div>
    <datalist id="exList">${allExerciseNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="small muted">Tap ✓ when you finish a set. It fills in last time's numbers if you left them empty and starts your rest timer.</p>
    <div class="row"><button class="btn primary" id="finishBtn" style="flex:1">Finish workout</button><button class="btn danger" id="discardBtn">Discard</button></div></div>`;
  $("#view").innerHTML = html;

  $("#draftDate").onchange = (e) => { D.date = e.target.value || today(); save(); };
  $$(".set input").forEach((inp) => inp.addEventListener("input", (e) => {
    const ei = +e.target.closest(".ex").dataset.ei, si = +e.target.closest(".set").dataset.si;
    D.exercises[ei].sets[si][e.target.dataset.f] = e.target.value; save();
  }));
  $$("[data-act]").forEach((b) => b.addEventListener("click", (e) => {
    const exEl = e.currentTarget.closest(".ex"), ei = +exEl.dataset.ei, act = e.currentTarget.dataset.act, ex = D.exercises[ei];
    if (act === "addset") ex.sets.push({ w: "", r: "", done: false });
    if (act === "rmset") ex.sets.splice(+e.currentTarget.closest(".set").dataset.si, 1);
    if (act === "rmex") { if (!confirm(`Remove ${ex.ex}?`)) return; D.exercises.splice(ei, 1); }
    if (act === "uni") { ex.uni = !ex.uni; S.uni[ex.ex] = ex.uni; }
    if (act === "done") {
      const si = +e.currentTarget.closest(".set").dataset.si, s = ex.sets[si];
      if (!s.done) {
        const last = lastSession(ex.ex), ls = last && last.sets[Math.min(si, last.sets.length - 1)];
        if (s.r === "" && ls) s.r = String(ls.r);
        if (s.w === "" && ls) s.w = ls.w ? String(round1(ls.w)) : "";
        if (s.r === "") { toast("Enter your reps first"); return; }
        s.done = true; unlockAudio(); startTimer(restFor(ex.ex), ex.ex);
      } else s.done = false;
    }
    save(); renderLogger();
  }));
  $("#addExBtn").onclick = () => {
    const n = $("#addExName").value.trim(); if (!n) return;
    D.exercises.push({ ex: n, uni: isUni(n), sets: [0, 1, 2].map(() => ({ w: "", r: "", done: false })) }); save(); renderLogger();
    ensureTagged(n);
  };
  $("#discardBtn").onclick = () => { if (confirm("Discard this workout?")) { S.draft = null; S.timer = null; save(); render(); } };
  $("#finishBtn").onclick = finishWorkout;
}
function allExerciseNames() {
  const s = new Set([...Object.keys(EXERCISE_MUSCLES), ...Object.keys(customMuscles())]);
  S.workouts.forEach((w) => (w.sets || []).forEach((x) => s.add(x.ex)));
  S.routines.forEach((r) => r.exercises.forEach((x) => s.add(x)));
  return [...s].sort();
}
function finishWorkout() {
  const D = S.draft, sets = [];
  const before = sessionsByExercise();
  D.exercises.forEach((e) => {
    const last = lastSession(e.ex);
    e.sets.forEach((s, si) => {
      const r = num(s.r); if (!r) return;
      let w = num(s.w);
      if (w == null) { const ls = last && last.sets[Math.min(si, last.sets.length - 1)]; w = ls ? ls.w : 0; }
      const o = { ex: e.ex, w, r }; if (e.uni) o.u = 1; sets.push(o);
    });
  });
  if (!sets.length) { toast("Add reps to at least one set first"); return; }
  const st = new Date(D.startedAt || Date.now());
  const dur = Math.max(1, Math.round((Date.now() - (D.startedAt || Date.now())) / 60000));
  S.workouts.push({ id: "w" + Date.now(), date: D.date, name: D.name, sets, dur: dur < 300 ? dur : undefined, start: `${pad(st.getHours())}:${pad(st.getMinutes())}` });
  S.draft = null; S.timer = null; invalidate(); save();
  const after = sessionsByExercise();
  let prs = 0;
  for (const ex of new Set(sets.map((s) => s.ex))) {
    const old = before[ex]; if (!old) continue;
    const sc = (x) => (isBW(ex) ? x.reps : x.e1rm);
    const latest = after[ex].filter((x) => x.date === D.date).pop();
    if (latest && sc(latest) > Math.max(...old.map(sc))) prs++;
  }
  toast(prs ? `Workout saved. ${prs} new PR${prs > 1 ? "s" : ""}! 🏆` : "Workout saved 💪");
  render();
}

// ---------- REST TIMER ----------
let audioCtx = null;
function unlockAudio() { try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {} }
function beep() {
  if (!audioCtx) return;
  [0, 0.25, 0.5].forEach((t) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.22);
  });
}
function startTimer(sec, ex) { S.timer = { end: Date.now() + sec * 1000, total: sec, ex }; save(); renderTimer(); }
function renderTimer() {
  let bar = $("#timerBar");
  if (!S.timer) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement("div"); bar.id = "timerBar"; bar.className = "timerbar";
    bar.innerHTML = `<div class="tfill"></div><div class="row"><div><div class="small muted" id="tEx"></div><div class="tnum" id="tNum"></div></div><span class="spacer"></span>
      <button class="btn small" data-t="-15">−15s</button><button class="btn small" data-t="15">+15s</button><button class="btn small primary" data-t="skip">Skip</button></div>`;
    document.body.appendChild(bar);
    bar.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => {
      if (!S.timer) return;
      if (b.dataset.t === "skip") S.timer = null; else { S.timer.end += +b.dataset.t * 1000; S.timer.total = Math.max(1, S.timer.total + +b.dataset.t); }
      save(); renderTimer();
    }));
  }
  tickTimer();
}
function tickTimer() {
  if (!S.timer) return;
  const left = Math.max(0, (S.timer.end - Date.now()) / 1000), bar = $("#timerBar"); if (!bar) return;
  $("#tNum", bar).textContent = left > 0 ? mmss(Math.ceil(left)) : "Go! 💪";
  $("#tEx", bar).textContent = left > 0 ? `Rest after ${S.timer.ex}` : "Rest over";
  $(".tfill", bar).style.width = `${(1 - left / S.timer.total) * 100}%`;
  bar.classList.toggle("over", left <= 0);
  if (left <= 0 && !S.timer.alerted) {
    S.timer.alerted = true; save(); beep(); if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    setTimeout(() => { if (S.timer && S.timer.alerted) { S.timer = null; save(); renderTimer(); } }, 6000);
  }
}
setInterval(() => {
  tickTimer();
  const el = $("#elapsed"); if (el && S.draft) el.textContent = mmss((Date.now() - S.draft.startedAt) / 1000);
}, 250);

// ---------- HISTORY ----------
const subView = () => $("#sub") || $("#view");
function renderHistory() {
  const items = [...S.workouts.map((w) => ({ type: "w", date: w.date, w })), ...S.restDays.map((d) => ({ type: "r", date: d }))]
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { subView().innerHTML = `<div class="card">Nothing logged yet. Log today's workout, or import your history in Profile → Import data.</div>`; return; }
  let html = "", month = "";
  for (const it of items.slice(0, 400)) {
    const m = parseYmd(it.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (m !== month) { month = m; html += `<h3 class="month">${m}</h3>`; }
    if (it.type === "r") { html += `<div class="card row slim"><span>${fmtDate(it.date)}</span><span class="spacer"></span><span class="pill">😴 Rest day</span></div>`; continue; }
    const w = it.w, per = {};
    (w.sets || []).forEach((s) => (per[s.ex] ||= []).push(s));
    const vol = (w.sets || []).reduce((a, s) => a + setVol(s), 0);
    const ms = {}; (w.sets || []).forEach((s) => { const mm = musclesFor(s.ex); mm.p.forEach((k) => (ms[k] = 5)); mm.s.forEach((k) => (ms[k] ||= 2)); });
    html += `<div class="card sess" data-id="${w.id}">
      <div class="row"><div class="micro">${figureSVG(FIGURE_FRONT, (k) => ms[k] || 0, "")}</div><div><div style="font-weight:600">${esc(w.name)}</div>
        <div class="small muted">${fmtDate(w.date)}${w.start ? " · " + w.start : ""}${w.dur ? " · " + w.dur + " min" : ""}</div></div>
      <span class="spacer"></span><div class="small ink2" style="text-align:right">${(w.sets || []).length} sets<br>${fmtKg(vol)}</div></div>
      <div class="sess-detail" hidden>
        ${Object.entries(per).map(([ex, ss]) => `<div><b>${esc(ex)}</b>: ${ss.map((s) => fmtSet(ex, s)).join(", ")}</div>`).join("") || "<div>Cardio / activity</div>"}
        <div class="row" style="margin-top:8px"><button class="btn small" data-copy="${w.id}">Repeat this workout</button><button class="btn small danger" data-del="${w.id}">Delete</button></div>
      </div></div>`;
  }
  subView().innerHTML = html;
  $$(".sess").forEach((c) => c.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.del) { if (confirm("Delete this session?")) { S.workouts = S.workouts.filter((w) => w.id !== t.dataset.del); S.deleted.w.push(t.dataset.del); invalidate(); save(); render(); } return; }
    if (t.dataset.copy) {
      const w = S.workouts.find((x) => x.id === t.dataset.copy);
      S.draft = newDraft({ name: w.name, exercises: [...new Set(w.sets.map((s) => s.ex))] }); save(); tab = "home"; render(); return;
    }
    const d = $(".sess-detail", c); d.hidden = !d.hidden;
  }));
}

// ---------- ACTIVITY (history + progress) ----------
let actView = "history";
function renderActivity() {
  $("#view").innerHTML = `<div class="seg full" style="margin-bottom:12px"><button data-av="history" class="${actView === "history" ? "on" : ""}">History</button><button data-av="progress" class="${actView === "progress" ? "on" : ""}">Progress</button></div><div id="sub"></div>`;
  $$("[data-av]").forEach((b) => (b.onclick = () => { actView = b.dataset.av; renderActivity(); }));
  actView === "history" ? renderHistory() : renderProgress();
}

// ---------- PROGRESS ----------
let progEx = null, progMetric = "top";
function renderProgress() {
  const map = sessionsByExercise();
  const names = Object.keys(map).sort((a, b) => map[b].length - map[a].length);
  if (!names.length) { subView().innerHTML = `<div class="card">No exercise history yet.</div>`; return; }
  if (!progEx || !map[progEx]) progEx = names.find((n) => !isBW(n)) || names[0];
  const bw = isBW(progEx);
  const metrics = bw ? [["reps", "Best reps"], ["totalReps", "Total reps"]] : [["top", "Top weight"], ["e1rm", "Est. 1RM"], ["volume", "Volume"]];
  if (!metrics.find((m) => m[0] === progMetric)) progMetric = metrics[0][0];
  const list = map[progEx], vals = list.map((x) => x[progMetric]);
  const first = vals[0], last = vals[vals.length - 1], best = Math.max(...vals);
  const unit = progMetric === "reps" || progMetric === "totalReps" ? " reps" : " kg";
  const change = first ? Math.round(((last - first) / first) * 100) : 0;
  const rec = (key, f) => list.reduce((a, x) => (f(x) > f(a) ? x : a), list[0]);
  const heavy = rec("top", (x) => x.top), strong = rec("e1rm", (x) => x.e1rm), most = rec("reps", (x) => x.reps), bigv = rec("vol", (x) => x.volume);
  const m = musclesFor(progEx), lvm = {}; m.s.forEach((k) => (lvm[k] = 2)); m.p.forEach((k) => (lvm[k] = 5));

  subView().innerHTML = `
  <div class="card">
    <select id="exSel">${names.map((n) => `<option ${n === progEx ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    <div class="row" style="margin:12px 0 4px"><div class="seg">${metrics.map(([k, l]) => `<button data-m="${k}" class="${k === progMetric ? "on" : ""}">${l}</button>`).join("")}</div></div>
    <div class="hero" style="margin:10px 0">
      <div class="stat"><div class="num">${round1(last)}<span class="small muted">${unit}</span></div><div class="lbl">latest</div></div>
      <div class="stat"><div class="num">${round1(best)}<span class="small muted">${unit}</span></div><div class="lbl">best ever</div></div>
      <div class="stat"><div class="num" style="color:${change >= 0 ? "var(--good)" : "var(--warn)"}">${change >= 0 ? "+" : ""}${change}%</div><div class="lbl">since first log</div></div>
    </div>
    <div id="chartBox"></div>
    <div class="legend"><span><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="var(--card)" stroke="var(--accent)" stroke-width="2"/></svg> new best</span><span>${list.length} sessions</span></div>
    <details><summary>Show as table</summary>
      <table class="data"><tr><th>Date</th><th>Sets</th><th>${metrics.find((x) => x[0] === progMetric)[1]}</th></tr>
      ${[...list].reverse().map((x) => `<tr><td>${fmtShort(x.date)}</td><td>${x.sets.map((s) => fmtSet(progEx, s)).join(", ")}</td><td>${round1(x[progMetric])}</td></tr>`).join("")}</table>
    </details>
  </div>
  <div class="card"><h2>Records</h2><div class="plan">
    <div class="mini">${figureSVG(FIGURE_FRONT, (k) => lvm[k] || 0, "")}${figureSVG(FIGURE_BACK, (k) => lvm[k] || 0, "")}</div>
    <div class="plan-list">
      ${bw ? "" : `<div class="pl"><span>Heaviest</span><b>${round1(heavy.top)} kg × ${heavy.topReps}</b></div>
      <div class="pl"><span>Best est. 1RM</span><b>${round1(strong.e1rm)} kg</b></div>`}
      <div class="pl"><span>Most reps in a set</span><b>${most.reps}</b></div>
      ${bw ? "" : `<div class="pl"><span>Biggest session</span><b>${fmtKg(bigv.volume)}</b></div>`}
      <div class="pl"><span>Sessions</span><b>${list.length}</b></div>
      <div class="pl"><span>Total sets</span><b>${list.reduce((a, x) => a + x.sets.length, 0)}</b></div>
      <div class="small muted" style="margin-top:6px">Works: ${[...m.p.map((k) => MUSCLES[k]), ...m.s.map((k) => MUSCLES[k].toLowerCase())].join(", ") || "not mapped yet"} · <a href="#" id="editMus">edit</a></div>
    </div></div></div>
  <div class="card"><h2>Coach notes</h2><div id="flags"></div></div>`;
  $("#exSel").onchange = (e) => { progEx = e.target.value; renderProgress(); };
  $("#editMus").onclick = (e) => { e.preventDefault(); tagExercise(progEx, renderProgress); };
  $$(".seg button").forEach((b) => (b.onclick = () => { progMetric = b.dataset.m; renderProgress(); }));
  lineChart($("#chartBox"), list.map((x) => ({ date: x.date, v: x[progMetric], tip: x.sets.map((s) => fmtSet(progEx, s)).join(", ") })), unit, { prs: true });
  const f = coachFlags();
  $("#flags").innerHTML = f.length ? f.map((x) => `<div class="flag ${x.kind}"><span class="ic">${x.kind === "good" ? "▲" : "!"}</span><div><b>${esc(x.ex)}</b><br><span class="ink2">${esc(x.text)}</span></div></div>`).join("")
    : `<p class="muted small">Nothing to flag in the last 3 weeks. Keep logging.</p>`;
}

// ---------- charts ----------
let _gid = 0;
// smooth path through points (monotone-ish Catmull-Rom → cubic Bézier, clamped so it never overshoots)
function smoothPath(P) {
  if (P.length < 3) return P.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = 0.18;
    let c1y = p1[1] + (p2[1] - p0[1]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    c1y = Math.min(hi, Math.max(lo, c1y)); c2y = Math.min(hi, Math.max(lo, c2y));
    d += `C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)},${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function lineChart(box, pts, unit, opt = {}) {
  const W = 360, H = opt.h || 200, L = 34, R = 14, T = 22, B = 24, id = "g" + ++_gid;
  if (!pts.length) { box.innerHTML = `<p class="small muted">No data yet.</p>`; return; }
  if (pts.length === 1) pts = [pts[0], pts[0]];
  const t0 = parseYmd(pts[0].date).getTime(), t1 = parseYmd(pts[pts.length - 1].date).getTime();
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pv = (hi - lo) * 0.15 || hi * 0.1 || 1; lo = opt.zero ? 0 : Math.max(0, lo - pv); hi += pv;
  const x = (d) => L + ((parseYmd(d).getTime() - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = niceTicks(lo, hi, 3);
  let runMax = -Infinity;
  const pr = pts.map((p) => { const isPr = opt.prs && p.v > runMax; runMax = Math.max(runMax, p.v); return isPr; });
  const P = pts.map((p) => [x(p.date), y(p.v)]);
  const path = smoothPath(P);
  const area = `${path}L${P.at(-1)[0]},${H - B}L${P[0][0]},${H - B}Z`;
  const tk = (v) => (v >= 1000 ? round1(v / 1000) + "k" : round1(v));
  const last = pts.at(-1), bi = vs.indexOf(Math.max(...vs));
  const fmtV = (v) => (unit === " kg" && v >= 1000 ? fmtKg(v) : round1(v) + unit);
  const xt = [pts[0], pts[pts.length - 1]];
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="grid dash" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${tk(t)}</text>`).join("")}
    ${xt.map((p, i) => `<text class="axis" x="${x(p.date)}" y="${H - 6}" text-anchor="${i ? "end" : "start"}">${fmtShort(p.date)}</text>`).join("")}
    <path d="${area}" fill="url(#${id})" class="area-in"/>
    <path class="line glowline" d="${path}"/>
    ${pts.length <= 40 ? pts.map((p, i) => pr[i] ? `<circle class="pr" cx="${P[i][0]}" cy="${P[i][1]}" r="4.5"/>` : "").join("") : ""}
    ${pts.length > 2 && bi !== pts.length - 1 ? `<g class="peak"><circle cx="${P[bi][0]}" cy="${P[bi][1]}" r="3"/><text x="${P[bi][0]}" y="${P[bi][1] - 9}" text-anchor="middle">${opt.peakLabel || "best"} ${tk(vs[bi])}</text></g>` : ""}
    <circle class="endpt" cx="${P.at(-1)[0]}" cy="${P.at(-1)[1]}" r="5"/>
    <g class="endlbl" transform="translate(${Math.min(P.at(-1)[0], W - 40)},${Math.max(P.at(-1)[1] - 14, 12)})"><rect x="-30" y="-12" width="60" height="18" rx="9"/><text y="1" text-anchor="middle">${tk(last.v)}${unit === " kg" ? "" : unit}</text></g>
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/><circle class="hoverpt" r="5" visibility="hidden"/>
    <rect class="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg>`;
  const svg = $("svg", box), cross = $(".cross", box), hp = $(".hoverpt", box), hit = $(".hit", box);
  const move = (ev) => {
    const bb = svg.getBoundingClientRect(), cx = ((ev.clientX - bb.left) / bb.width) * W;
    let i = 0, bd = Infinity; P.forEach((q, j) => { const d = Math.abs(q[0] - cx); if (d < bd) { bd = d; i = j; } });
    const p = pts[i];
    cross.setAttribute("x1", P[i][0]); cross.setAttribute("x2", P[i][0]); cross.setAttribute("visibility", "visible");
    hp.setAttribute("cx", P[i][0]); hp.setAttribute("cy", P[i][1]); hp.setAttribute("visibility", "visible");
    showTip(ev.clientX, ev.clientY, `<b>${opt.label ? opt.label(p) : fmtDate(p.date)}</b><br>${fmtV(p.v)}${pr[i] ? " · new best" : ""}${p.tip ? "<br>" + esc(p.tip) : ""}`);
  };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hp.setAttribute("visibility", "hidden"); hideTip(); });
}
function barChart(box, data, opt = {}) {
  // data: [{label, v, tip, hl}]; opt: {h, every, min, target, targetLabel, values}
  const W = 360, H = opt.h || 160, L = 8, R = 8, B = 22, T = 20, n = data.length, id = "b" + ++_gid;
  const max = Math.max(opt.min || 1, opt.target || 0, ...data.map((d) => d.v));
  const bw = (W - L - R) / n, gap = Math.max(4, bw * 0.28);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const best = Math.max(...data.map((d) => d.v));
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".55"/></linearGradient></defs>
    <line class="grid" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
    ${data.map((d, i) => { const x0 = L + i * bw + gap / 2, w = bw - gap;
      return `<rect x="${x0}" y="${T}" width="${w}" height="${y(0) - T}" rx="${Math.min(6, w / 2)}" class="bar-bg"/>` +
        (d.v > 0 ? `<rect x="${x0}" y="${y(d.v)}" width="${w}" height="${y(0) - y(d.v)}" rx="${Math.min(6, w / 2)}" fill="url(#${id})" class="bar2 ${d.hl || (opt.values && d.v === best) ? "hl" : ""}" style="animation-delay:${i * 30}ms"/>` : "") +
        ((opt.values && d.v > 0) || (d.hl && d.v > 0) ? `<text class="bval" x="${x0 + w / 2}" y="${y(d.v) - 5}" text-anchor="middle">${d.v}</text>` : ""); }).join("")}
    ${opt.target ? `<line class="target-line" x1="${L}" x2="${W - R}" y1="${y(opt.target)}" y2="${y(opt.target)}"/><text class="tlbl" x="${W - R}" y="${y(opt.target) - 5}" text-anchor="end">${opt.targetLabel || "goal"} ${opt.target}</text>` : ""}
    ${data.map((d, i) => (opt.every ? i % opt.every === 0 || i === n - 1 : true) ? `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>` : "").join("")}
    ${data.map((d, i) => `<rect x="${L + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-i="${i}" class="hitb"/>`).join("")}
  </svg>`;
  $$(".hitb", box).forEach((r) => {
    const f = (ev) => { const d = data[+r.dataset.i]; showTip(ev.clientX, ev.clientY, d.tip); };
    r.addEventListener("pointerenter", f); r.addEventListener("pointerdown", f); r.addEventListener("pointerleave", hideTip);
  });
}
// 24-hour clock: one petal per hour, length = workouts started in that hour
function clockChart(box, hours) {
  const S0 = 280, c = S0 / 2, r0 = 34, r1 = 112, counts = Array(24).fill(0);
  hours.forEach((h) => counts[h % 24]++);
  const max = Math.max(1, ...counts), peak = counts.indexOf(Math.max(...counts));
  const arc = (h, rr) => { const a0 = ((h - 6) / 24) * 2 * Math.PI + 0.03, a1 = ((h - 5) / 24) * 2 * Math.PI - 0.03;
    const p = (a, r) => `${(c + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(a0, r0)}L${p(a0, rr)}A${rr},${rr} 0 0 1 ${p(a1, rr)}L${p(a1, r0)}A${r0},${r0} 0 0 0 ${p(a0, r0)}Z`; };
  box.innerHTML = `<svg class="chart clock" viewBox="0 0 ${S0} ${S0}">
    <circle cx="${c}" cy="${c}" r="${r1}" class="clock-ring"/><circle cx="${c}" cy="${c}" r="${(r0 + r1) / 2}" class="clock-ring"/>
    ${counts.map((v, h) => `<path d="${arc(h, r0 + 4)}" class="petal-bg"/>${v ? `<path d="${arc(h, r0 + 4 + (r1 - r0 - 4) * (v / max))}" class="petal ${h === peak ? "hl" : ""}" data-h="${h}"/>` : ""}`).join("")}
    ${[0, 6, 12, 18].map((h) => { const a = ((h - 6) / 24) * 2 * Math.PI; return `<text class="axis" x="${c + Math.cos(a) * (r1 + 14)}" y="${c + Math.sin(a) * (r1 + 14) + 4}" text-anchor="middle">${h === 0 ? "0h" : h + "h"}</text>`; }).join("")}
    <text x="${c}" y="${c - 4}" text-anchor="middle" class="clock-big">${hours.length ? pad(peak) + ":00" : "–"}</text>
    <text x="${c}" y="${c + 13}" text-anchor="middle" class="axis">favourite</text>
    ${counts.map((v, h) => `<path d="${arc(h, r1)}" fill="transparent" data-i="${h}" class="hitc"/>`).join("")}
  </svg>`;
  $$(".hitc", box).forEach((el) => {
    const f = (ev) => { const h = +el.dataset.i; showTip(ev.clientX, ev.clientY, `<b>${pad(h)}:00–${pad((h + 1) % 24)}:00</b><br>${counts[h]} workout${counts[h] === 1 ? "" : "s"} started`); };
    el.addEventListener("pointerenter", f); el.addEventListener("pointerdown", f); el.addEventListener("pointerleave", hideTip);
  });
}
function radarChart(box, axes) {
  // axes: [{label, v (0..1.5), tip}]
  const S0 = 300, c = S0 / 2, R = 104, n = axes.length, cap = 1.5;
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const poly = (f) => axes.map((_, i) => pt(i, f).join(",")).join(" ");
  const vals = axes.map((a) => Math.min(cap, a.v) / cap);
  box.innerHTML = `<svg class="chart radar" viewBox="0 0 ${S0} ${S0}">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon class="grid" fill="none" points="${poly(f)}"/>`).join("")}
    ${axes.map((_, i) => `<line class="grid" x1="${c}" y1="${c}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}"/>`).join("")}
    <polygon class="target" points="${poly(1 / cap)}"/>
    <polygon class="rfill" points="${vals.map((v, i) => pt(i, v).join(",")).join(" ")}"/>
    ${vals.map((v, i) => `<circle class="dot" cx="${pt(i, v)[0]}" cy="${pt(i, v)[1]}" r="4"/>`).join("")}
    ${axes.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text class="rlbl" x="${x}" y="${y + 4}" text-anchor="middle">${a.label}</text>`; }).join("")}
    ${axes.map((a, i) => { const [x, y] = pt(i, 1.1); return `<circle cx="${x}" cy="${y}" r="26" fill="transparent" data-i="${i}" class="hitr"/>`; }).join("")}
  </svg>`;
  $$(".hitr", box).forEach((el) => {
    const f = (ev) => showTip(ev.clientX, ev.clientY, axes[+el.dataset.i].tip);
    el.addEventListener("pointerenter", f); el.addEventListener("pointerdown", f); el.addEventListener("pointerleave", hideTip);
  });
}
function niceTicks(lo, hi, n) {
  const span = hi - lo || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}
function showTip(cx, cy, html) {
  const t = $("#tooltip"); t.innerHTML = html; t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = cx + 12, top = cy - r.height - 12;
  if (left + r.width > innerWidth - 8) left = cx - r.width - 12;
  if (left < 8) left = 8;
  if (top < 8) top = cy + 16;
  t.style.left = left + "px"; t.style.top = top + "px";
}
function hideTip() { const t = $("#tooltip"); if (t) t.hidden = true; }
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".chart, .figure, .cal")) hideTip(); });

// ---------- STATS ----------
let selMuscle = null;
function ringSVG(frac, size, stroke, label, cls = "") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg class="mring ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rbg" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rfg ${frac >= 1 ? "full" : ""}" stroke-width="${stroke}" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dy=".35em">${label}</text></svg>`;
}
function lastTrained(k) {
  const ws = [...liftSessions()].sort((a, b) => b.date.localeCompare(a.date));
  for (const w of ws) if (w.sets.some((s) => { const m = musclesFor(s.ex); return m.p.includes(k) || m.s.includes(k); })) return w;
  return null;
}
function muscleDetailHTML(k, ms, from, to, mult) {
  const tg = WEEKLY_TARGET[k] * mult, frac = ms[k] / tg, lw = lastTrained(k);
  const ago = lw ? Math.round((parseYmd(today()) - parseYmd(lw.date)) / 864e5) : null;
  const contrib = {};
  liftSessions().filter((w) => w.date >= from && w.date <= to).forEach((w) => w.sets.forEach((s) => {
    const m = musclesFor(s.ex); const v = m.p.includes(k) ? 1 : m.s.includes(k) ? 0.5 : 0; if (v) contrib[s.ex] = (contrib[s.ex] || 0) + v; }));
  const top = Object.entries(contrib).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const status = ms[k] === 0 ? ["⚪", "Not trained yet"] : frac >= 1 ? ["🟢", "Target hit"] : frac >= 0.6 ? ["🟡", `${round1(tg - ms[k])} more sets to target`] : ["🟠", `${round1(tg - ms[k])} more sets to target`];
  const recov = ago == null ? "" : ago <= 1 ? "💤 Recovering (trained in the last 48 h)" : ago <= 3 ? "✅ Recovered, ready to train" : `⏰ Last trained ${ago} days ago`;
  return `<div class="mdetail">${ringSVG(frac, 92, 10, `${Math.round(Math.min(frac, 9.99) * 100)}%`, "big")}
    <div class="mdetail-txt"><div class="mname">${MUSCLES[k]}</div>
      <div><b>${round1(ms[k])}</b> <span class="muted">of ${tg} sets</span></div>
      <div class="small">${status[0]} ${status[1]}</div>
      <div class="small muted">${recov}</div></div></div>
    ${top.length ? `<div class="contrib">${top.map(([ex, v]) => `<div><span>${esc(ex)}</span><div class="cbar"><i style="width:${(v / top[0][1]) * 100}%"></i></div><b>${round1(v)}</b></div>`).join("")}</div>`
      : `<p class="small muted">No sets for this muscle in this period.</p>`}`;
}

let statPeriod = "week0";
function renderStats() {
  const wk = weekStart(today());
  const periods = { week0: ["This week", wk, addDays(wk, 6), 1], week1: ["Last week", addDays(wk, -7), addDays(wk, -1), 1], month: ["4 weeks", addDays(wk, -21), addDays(wk, 6), 4] };
  const [plabel, from, to, mult] = periods[statPeriod];
  const ms = muscleSets(from, to);
  const tgt = (k) => WEEKLY_TARGET[k] * mult;
  const lvl = (k) => { const r = ms[k] / tgt(k); return ms[k] === 0 ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : r < 1 ? 4 : 5; };
  const order = Object.keys(MUSCLES).sort((a, b) => ms[a] / tgt(a) - ms[b] / tgt(b));
  const maxV = Math.max(...Object.keys(MUSCLES).map((k) => Math.max(ms[k], tgt(k))));

  // 4-week balance & distribution
  const m4 = muscleSets(addDays(today(), -27), today());
  const groupSum = (g, src) => GROUPS[g].reduce((a, k) => a + src[k], 0);
  const groupTgt = (g) => GROUPS[g].reduce((a, k) => a + WEEKLY_TARGET[k] * 4, 0);
  const totalSets4 = Object.keys(GROUPS).reduce((a, g) => a + groupSum(g, m4), 0) || 1;
  const t = totals(), st = streaks();
  const durs = S.workouts.filter((w) => w.dur).slice(-20).map((w) => w.dur);
  const avgDur = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;

  // week vs last week
  const lw0 = weekStart(today());
  const wkStats = (a) => { const ss = liftSessions().filter((w) => w.date >= a && w.date <= addDays(a, 6));
    const d = ss.filter((w) => w.dur); return { n: ss.length, sets: ss.reduce((x, w) => x + w.sets.length, 0), vol: ss.reduce((x, w) => x + w.sets.reduce((y, q) => y + setVol(q), 0), 0), dur: d.length ? Math.round(d.reduce((x, w) => x + w.dur, 0) / d.length) : 0 }; };
  const cw = wkStats(lw0), pw = wkStats(addDays(lw0, -7));
  const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  const kpi = (label, val, a, b) => { const d = delta(a, b); return `<div class="kpi"><span class="klbl">${label}</span><b>${val}</b>${d == null ? `<span class="kd">–</span>` : `<span class="kd ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}%</span>`}</div>`; };
  if (!selMuscle) selMuscle = order.find((k) => ms[k] < tgt(k)) || order[0];

  $("#view").innerHTML = `
  <div class="card"><div class="row"><h2 style="margin:0">This week</h2><span class="spacer"></span><span class="small muted">vs last week</span></div>
    <div class="kpis">${kpi("Workouts", cw.n, cw.n, pw.n)}${kpi("Sets", cw.sets, cw.sets, pw.sets)}${kpi("Volume", fmtKg(cw.vol), cw.vol, pw.vol)}${kpi("Avg time", cw.dur ? cw.dur + "m" : "–", cw.dur, pw.dur)}</div></div>
  <div class="card" id="muscleCard">
    <div class="row"><h2 style="margin:0">Muscles</h2><span class="spacer"></span>
      <div class="seg">${Object.entries(periods).map(([k, v]) => `<button data-p="${k}" class="${k === statPeriod ? "on" : ""}">${v[0]}</button>`).join("")}</div></div>
    <div class="explorer">
      <div class="body-wrap">${figureSVG(FIGURE_FRONT, lvl, "Front")}${figureSVG(FIGURE_BACK, lvl, "Back")}</div>
      <div id="mDetail">${muscleDetailHTML(selMuscle, ms, from, to, mult)}</div>
    </div>
    <div class="legend"><span><i class="sw l0"></i>none</span><span><i class="sw l2"></i>&lt;50%</span><span><i class="sw l3"></i>50–75%</span><span><i class="sw l4"></i>75–99%</span><span><i class="sw l5"></i>target hit</span></div>
    <div class="ring-groups">${Object.entries(GROUPS).map(([g, ks]) => `<div class="rg"><div class="rg-h">${g}</div><div class="rg-row">${ks.map((k) =>
      `<button class="rchip ${k === selMuscle ? "sel" : ""}" data-sel="${k}">${ringSVG(ms[k] / tgt(k), 52, 6, round1(ms[k]))}<span>${MUSCLES[k]}</span></button>`).join("")}</div></div>`).join("")}</div>
    <p class="small muted">Ring = sets vs ${plabel === "4 weeks" ? "4-week" : "weekly"} target, number = sets done. Tap a ring or a muscle on the body for details. Main muscle = 1 set, helper = ½.</p>
  </div>
  <div class="card"><h2>Muscle balance</h2><p class="small muted" style="margin-top:-4px">Last 4 weeks vs target. The dashed line is 100%, so a lopsided shape means some groups are getting more than others.</p><div id="radar"></div></div>
  <div class="card"><h2>Where your sets go</h2><p class="small muted" style="margin-top:-4px">Share of all sets, last 4 weeks</p>
    <div class="dist2">${(() => { const arr = Object.keys(GROUPS).map((g) => [g, groupSum(g, m4) / totalSets4, groupSum(g, m4)]).sort((a, b) => b[1] - a[1]); const mx = arr[0][1] || 1;
      const ic = { Chest: "🫁", Back: "🦅", Shoulders: "🛡️", Arms: "💪", Legs: "🦵", Core: "🎯" };
      return arr.map(([g, f, n], i) => `<div class="drow"><span class="dic">${ic[g]}</span><div class="dbody"><div class="dtop"><b>${g}</b><span>${Math.round(f * 100)}% · ${round1(n)} sets</span></div>
        <div class="dtrack"><i style="width:${(f / mx) * 100}%;animation-delay:${i * 60}ms"></i></div></div></div>`).join(""); })()}</div></div>
  <div class="card"><h2>Weekly volume</h2><div id="volChart"></div></div>
  <div class="card"><h2>Workouts per week</h2><div id="wkChart"></div></div>
  <div class="card"><h2>Consistency</h2>
    <div class="hero" style="margin-bottom:12px"><div class="stat"><div class="num">🔥 ${st.cur}</div><div class="lbl">current streak</div></div>
      <div class="stat"><div class="num">${st.best}</div><div class="lbl">longest streak</div></div></div>
    <div class="cal" id="cal"></div>
    <div class="legend"><span><i class="sw l0"></i>no log</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--s2)"></i>rest day</span>
      <span><i class="sw l2"></i>light</span><span><i class="sw l3"></i>medium</span><span><i class="sw l4"></i>big session</span></div></div>
  <div class="card"><h2>Favourite training days</h2><div id="dowChart"></div></div>
  <div class="card"><h2>When you train</h2><p class="small muted" style="margin-top:-4px">Each petal is an hour of the day; longer = more workouts started then.</p><div id="todChart"></div>${avgDur ? `<p class="small muted">Average session: <b>${avgDur} min</b> (last ${durs.length})</p>` : ""}</div>
  <div class="card"><h2>Ask an AI coach 🤖</h2><p class="small ink2">Copies a summary of your last 4 weeks (workouts, top sets, sets per muscle, coach notes). Paste it into Claude, Gemini or ChatGPT and ask for advice.</p>
    <button class="btn" id="copyCoach">📋 Copy my summary</button></div>
  <div class="card"><h2>All time</h2><div class="hero">
    <div class="stat"><div class="num">${t.sessions}</div><div class="lbl">workouts</div></div>
    <div class="stat"><div class="num">${t.sets.toLocaleString()}</div><div class="lbl">sets</div></div>
    <div class="stat"><div class="num">${(t.vol / 1000).toFixed(1)}t</div><div class="lbl">lifted</div></div>
    <div class="stat"><div class="num">${allPRs().length}</div><div class="lbl">PRs</div></div></div></div>`;

  $$("[data-p]").forEach((b) => (b.onclick = () => { statPeriod = b.dataset.p; renderStats(); }));
  $("#copyCoach").onclick = async () => { const txt = coachSummary(); try { await navigator.clipboard.writeText(txt); toast("Summary copied. Paste it into your AI chat"); } catch (e) { openModal(`<h2>Your summary</h2><textarea style="min-height:300px">${esc(txt)}</textarea>`); } };
  const selectM = (k) => {
    selMuscle = k;
    $("#mDetail").innerHTML = muscleDetailHTML(k, ms, from, to, mult);
    $$("#muscleCard .rchip").forEach((b) => b.classList.toggle("sel", b.dataset.sel === k));
    $$("#muscleCard .m").forEach((el) => el.classList.toggle("sel", el.dataset.m === k));
  };
  $$("#muscleCard .m").forEach((el) => {
    el.addEventListener("click", () => selectM(el.dataset.m));
    el.addEventListener("pointerenter", (ev) => showTip(ev.clientX, ev.clientY, `<b>${MUSCLES[el.dataset.m]}</b><br>${round1(ms[el.dataset.m])} of ${tgt(el.dataset.m)} sets`));
    el.addEventListener("pointerleave", hideTip);
  });
  $$("#muscleCard .rchip").forEach((b) => (b.onclick = () => selectM(b.dataset.sel)));
  selectM(selMuscle);
  radarChart($("#radar"), Object.keys(GROUPS).map((g) => { const v = groupSum(g, m4) / groupTgt(g); return { label: g, v, tip: `<b>${g}</b><br>${round1(groupSum(g, m4))} sets · ${Math.round(v * 100)}% of target` }; }));

  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(wk, -7 * i), we = addDays(ws, 6), ss = liftSessions().filter((w) => w.date >= ws && w.date <= we);
    weeks.push({ ws, c: ss.length, vol: ss.reduce((a, w) => a + w.sets.reduce((b, s) => b + setVol(s), 0), 0), sets: ss.reduce((a, w) => a + w.sets.length, 0) });
  }
  lineChart($("#volChart"), weeks.map((w) => ({ date: w.ws, v: w.vol, tip: `${w.c} workouts · ${w.sets} sets` })), " kg", { zero: true, h: 180, peakLabel: "best week", label: (p) => "Week of " + fmtShort(p.date) });
  barChart($("#wkChart"), weeks.map((w, i) => ({ label: fmtShort(w.ws), v: w.c, hl: i === 11, tip: `<b>Week of ${fmtShort(w.ws)}</b><br>${w.c} workout${w.c === 1 ? "" : "s"}` })), { every: 3, target: +S.profile.weeklyTarget || 5, targetLabel: "goal" });
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: DAYS[d], v: liftSessions().filter((w) => parseYmd(w.date).getDay() === d).length }));
  dow.forEach((d) => (d.tip = `<b>${d.label}</b><br>${d.v} workouts`));
  barChart($("#dowChart"), dow, { values: true, h: 150 });
  clockChart($("#todChart"), S.workouts.filter((w) => w.start).map((w) => +w.start.slice(0, 2)));
  calendar($("#cal"));
}
function calendar(el) {
  const weeks = 26, end = today(), start = addDays(weekStart(end), -7 * (weeks - 1));
  const vol = {}, rest = new Set(S.restDays);
  S.workouts.forEach((w) => (vol[w.date] = (vol[w.date] || 0) + Math.max(1, (w.sets || []).length)));
  let html = "";
  for (let d = start; d <= addDays(weekStart(end), 6); d = addDays(d, 1)) {
    const v = vol[d] || 0;
    const cls = d > end ? "future" : v ? (v < 12 ? "l1" : v < 20 ? "l2" : "l3") : rest.has(d) ? "rest" : "";
    html += `<div class="${cls}" data-d="${d}" data-v="${v}"></div>`;
  }
  el.innerHTML = html;
  $$("div[data-d]", el).forEach((c) => {
    const f = (ev) => { const d = c.dataset.d, v = +c.dataset.v; showTip(ev.clientX, ev.clientY, `<b>${fmtDate(d)}</b><br>${v ? v + " sets" : rest.has(d) ? "Rest day" : "Nothing logged"}`); };
    c.addEventListener("pointerenter", f); c.addEventListener("pointerdown", f); c.addEventListener("pointerleave", hideTip);
  });
  el.scrollLeft = el.scrollWidth;
}

// ---------- routine templates & exercise tagging ----------
const TEMPLATES = {
  ul: { name: "Upper / Lower", desc: "4 days · balanced and simple", routines: [
    { name: "Upper A", day: 1, exercises: ["Barbell Bench Press", "Barbell Row", "Overhead Press", "Cable Lat Pulldown", "Dumbbell Bicep Curl", "Cable Tricep Pushdown"] },
    { name: "Lower A", day: 2, exercises: ["Barbell Squat", "Romanian Deadlift", "Leg Press", "Standing Calf Raise", "Planks"] },
    { name: "Upper B", day: 4, exercises: ["Incline Dumbbell Press", "Pull Ups", "Dumbbell Shoulder Press", "Seated Cable Rows", "Dumbbell Hammer Curl", "Overhead Dumbbell Triceps Extension"] },
    { name: "Lower B", day: 5, exercises: ["Deadlift", "Dumbbell Bulgarian Split Squat", "Seated Leg Curl Machine", "Seated Calf Raise", "Hanging Leg Raise"] } ] },
};
function chooseTemplate() {
  openModal(`<h2>Start from a template</h2><p class="small muted">A simple, balanced 4-day plan.</p><p class="small muted">You can rename, reorder and swap every exercise afterwards.</p>
    <div class="rlist">${Object.entries(TEMPLATES).map(([id, t]) => `<button class="rrow" data-t="${id}"><div class="rmeta"><b>${t.name}</b><span class="small muted">${t.desc}</span></div><span class="chev">›</span></button>`).join("")}</div>
    <button class="btn block" id="blankR" style="margin-top:10px">+ Build my own from scratch</button>`, (sh) => {
    $$("[data-t]", sh).forEach((b) => (b.onclick = () => {
      if (S.routines.length && !confirm("Add these routines next to your existing ones?")) return;
      S.routines.push(...JSON.parse(JSON.stringify(TEMPLATES[b.dataset.t].routines))); save(); closeModal(); render(); toast("Routines added");
    }));
    $("#blankR", sh).onclick = () => editRoutine(-1);
  });
}
// Tap a muscle once = main muscle, twice = helper, three times = off.
function tagExercise(name, onDone) {
  const cur = musclesFor(name);
  const st = {}; cur.p.forEach((k) => (st[k] = 2)); cur.s.forEach((k) => (st[k] ||= 1));
  const known = knownExercise(name);
  const draw = (sh) => {
    const lv = (k) => (st[k] === 2 ? 5 : st[k] === 1 ? 2 : 0);
    $(".tag-figs", sh).innerHTML = figureSVG(FIGURE_FRONT, lv, "Front") + figureSVG(FIGURE_BACK, lv, "Back");
    $(".tag-chips", sh).innerHTML = Object.keys(MUSCLES).map((k) => `<button class="mchip s${st[k] || 0}" data-k="${k}">${MUSCLES[k]}</button>`).join("");
    $$("[data-m], [data-k]", sh).forEach((el) => el.addEventListener("click", (e) => {
      const k = el.dataset.m || el.dataset.k; st[k] = ((st[k] || 0) + 2) % 3; draw(sh); // 0 -> 2 -> 1 -> 0
    }));
  };
  openModal(`<h2>Which muscles does it work?</h2>
    <p class="small ink2"><b>${esc(name)}</b>${known ? "" : " isn't in the built-in library yet."} Tap a muscle once for <b>main</b>, twice for <b>helper</b>, three times to clear. ${!known && (cur.p.length || cur.s.length) ? "I've pre-selected a guess from the name." : ""}</p>
    <div class="body-wrap tag-figs"></div>
    <div class="legend"><span><i class="sw l5"></i>main (1 set)</span><span><i class="sw l2"></i>helper (½ set)</span></div>
    <div class="tag-chips"></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="tagSave" style="flex:1">Save</button>${customMuscles()[name] ? `<button class="btn" id="tagReset">Reset to default</button>` : ""}</div>`, (sh) => {
    draw(sh);
    $("#tagSave", sh).onclick = () => {
      const p = Object.keys(st).filter((k) => st[k] === 2), s = Object.keys(st).filter((k) => st[k] === 1);
      if (!p.length) { toast("Pick at least one main muscle"); return; }
      S.customEx = { ...(S.customEx || {}), [name]: { p, s } }; invalidate(); save(); closeModal(); toast("Muscles saved"); if (onDone) onDone();
    };
    const rs = $("#tagReset", sh); if (rs) rs.onclick = () => { delete S.customEx[name]; invalidate(); save(); closeModal(); if (onDone) onDone(); };
  });
}
// Ask about muscles only for brand-new names.
function ensureTagged(name, onDone) { if (knownExercise(name)) return onDone && onDone(); tagExercise(name, onDone); }
function sheetLibrary() {
  const names = allExerciseNames();
  openModal(`<h2>Exercise library</h2><p class="small muted">${Object.keys(EXERCISE_MUSCLES).length} built-in exercises, plus any you've added. Tap one to see or change the muscles it counts towards.</p>
    <div class="row"><input type="text" id="libQ" placeholder="Search…"><button class="btn" id="libNew">+ New</button></div>
    <div class="lib-list"></div>`, (sh) => {
    const draw = () => {
      const q = $("#libQ", sh).value.toLowerCase();
      $(".lib-list", sh).innerHTML = names.filter((n) => n.toLowerCase().includes(q)).slice(0, 200).map((n) => { const m = musclesFor(n);
        return `<button class="lib-row" data-n="${esc(n)}"><div><b>${esc(n)}</b><small>${m.p.map((k) => MUSCLES[k]).join(", ") || "⚠️ not tagged"}${customMuscles()[n] ? " · custom" : ""}</small></div><span class="chev">›</span></button>`; }).join("");
      $$("[data-n]", sh).forEach((b) => (b.onclick = () => tagExercise(b.dataset.n, sheetLibrary)));
    };
    $("#libQ", sh).oninput = draw; draw();
    $("#libNew", sh).onclick = () => { const n = ($("#libQ", sh).value || prompt("Exercise name:") || "").trim(); if (n) tagExercise(n.replace(/\b\w/g, (c) => c.toUpperCase()), sheetLibrary); };
  });
}

// ---------- PROFILE ----------
function sparkline(vals, w = 120, h = 30) {
  if (vals.length < 2) return "";
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 3 - ((v - lo) / r) * (h - 6)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
}
function backupAgo() {
  const t = Math.max(S.lastBackup || 0, Sync.on() ? S.sync.lastSync || 0 : 0);
  return t ? timeAgo(t) : "never";
}
function renderProfile() {
  const p = S.profile, earned = earnedBadges(), show = showcaseBadges(), lv = levelInfo(), a = S.appearance;
  const w = [...S.weights].sort((x, y) => x.date.localeCompare(y.date));
  const tiles = [
    ["edit", "✏️", "Edit profile", esc(p.name || "Add your name"), ""],
    ["look", "🎨", "Appearance", `${THEMES[a.theme]?.name || "Classic"} · ${a.mode === "system" ? "auto" : a.mode}`, `<div class="tile-sw" style="background:${themePreview(a.theme, document.documentElement.dataset.mode)}"></div>`],
    ["bw", "⚖️", "Bodyweight", w.length ? `${w.at(-1).kg} kg` : "Not logged yet", sparkline(w.slice(-12).map((x) => x.kg))],
    ["badges", "🏅", "Badges", `${earned.length} of ${BADGES.length}`, `<div class="mini-bar"><div style="width:${(earned.length / BADGES.length) * 100}%"></div></div>`],
    ["routines", "📋", "Routines", `${S.routines.length} routines`, `<div class="day-dots">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<i class="${S.routines.some((r) => r.day === d) ? "on" : ""}">${DAYS[d][0]}</i>`).join("")}</div>`],
    ["data", Sync.on() ? "☁️" : "💾", "Data & backup", Sync.on() ? `Drive · synced ${S.sync.lastSync ? timeAgo(S.sync.lastSync) : "never"}` : `On device · backup ${backupAgo()}`, ""],
    ["library", "🏋️", "Exercise library", `${Object.keys(EXERCISE_MUSCLES).length + Object.keys(customMuscles()).filter((n) => !EXERCISE_MUSCLES[n]).length} exercises`, ""],
    ["import", "📥", "Import data", "Arrow, Strong, Hevy, CSV", ""],
    ["install", "📲", "Install app", isStandalone() ? "Installed ✓" : "Add to home screen", ""],
  ];
  $("#view").innerHTML = `
    <div class="profile-top">${dogtagHTML(myCardData())}</div>
    <div class="xp-row"><span class="lvl">Lv ${lv.lvl}</span><div class="xp"><div style="width:${Math.round(lv.pct * 100)}%"></div></div><span class="small muted">${lv.xp.toLocaleString()} XP</span></div>
    <div class="card"><div class="row"><h2 style="margin:0">Showcase</h2><span class="spacer"></span><button class="btn small" id="editShow">Edit</button></div>
      <div class="showcase">${[0, 1, 2].map((i) => show[i] ? `<div class="badge on big"><span>${show[i].icon}</span><small>${esc(show[i].name)}</small><em>${esc(show[i].desc)}</em></div>` : `<div class="badge empty"><span>＋</span><small>Empty</small></div>`).join("")}</div></div>
    <div class="tile-grid">${tiles.map(([id, icon, title, sub, extra]) => `<button class="ptile" data-sheet="${id}">
      <span class="ptile-ic">${icon}</span><b>${title}</b><span class="ptile-sub">${sub}</span>${extra}</button>`).join("")}</div>
    <div class="row" style="justify-content:center;margin:6px 0 4px"><button class="btn ghost small danger" id="resetBtn">Delete all data on this device</button></div>
    <p class="small muted" style="text-align:center">Lift Log · free and open source</p>`;
  wireDogtag($("#view"));
  $("#editShow").onclick = editShowcase;
  const sheets = { edit: sheetEdit, look: sheetAppearance, bw: sheetBodyweight, badges: sheetBadges, routines: sheetRoutines, library: sheetLibrary, data: sheetData, import: sheetImport, install: sheetInstall };
  $$("[data-sheet]").forEach((b) => (b.onclick = () => sheets[b.dataset.sheet]()));
  $("#resetBtn").onclick = () => {
    if (!confirm("Delete ALL workouts, rest days, routines and friends on this device? Download a backup first if unsure.")) return;
    const keep = S.sync, look = S.appearance; S = blank(); S.sync = { ...keep, provider: "local" }; S.appearance = look; Sync.signOut(); invalidate(); save(); render(); obDraft = null; showOnboarding(0);
  };
}

function sheetEdit() {
  const p = S.profile;
  openModal(`<h2>Edit profile</h2>
    <div class="avatar-edit">${avatarHTML(72)}
      <div class="avatar-actions"><label class="btn small">📷 Upload photo<input type="file" id="avatarFile" accept="image/*" hidden></label>
        ${p.avatarImg || p.avatarPreset ? `<button class="btn small ghost" id="avatarClear">Use initial</button>` : ""}</div></div>
    <div class="avatar-grid">${Object.entries(AVATARS).map(([id, a]) => `<button class="av-pick ${p.avatarPreset === id && !p.avatarImg ? "on" : ""}" data-av="${id}" title="${a.name}">${avatarSVG(id)}</button>`).join("")}</div>
    <div class="form">
      <label class="full">Name<input type="text" id="pName" value="${esc(p.name)}" placeholder="Your name"></label>
      <label>Height (cm)<input type="number" id="pHeight" value="${esc(p.height)}"></label>
      <label>Goal<select id="pGoal">${["Build muscle", "Get stronger", "Lose fat", "Stay fit"].map((g) => `<option ${g === p.goal ? "selected" : ""}>${g}</option>`).join("")}</select></label>
      <label>Workouts per week<input type="number" id="pTarget" value="${esc(p.weeklyTarget)}" min="1" max="7"></label>
      <label>Rest, big lifts (sec)<input type="number" id="pRestC" value="${esc(p.restCompound)}" step="15"></label>
      <label>Rest, small lifts (sec)<input type="number" id="pRestI" value="${esc(p.restIsolation)}" step="15"></label>
      <label class="full">Spotify playlist link<input type="text" id="pPlaylist" value="${esc(p.playlist)}" placeholder="https://open.spotify.com/playlist/…"></label>
    </div>
    <button class="btn primary block" id="saveProfile" style="margin-top:14px">Save</button>`, (sh) => {
    const keepForm = () => Object.assign(p, { name: $("#pName", sh).value.trim(), height: $("#pHeight", sh).value, goal: $("#pGoal", sh).value,
      weeklyTarget: +$("#pTarget", sh).value || 5, restCompound: +$("#pRestC", sh).value || 120, restIsolation: +$("#pRestI", sh).value || 75, playlist: $("#pPlaylist", sh).value.trim() });
    $$(".av-pick", sh).forEach((bt) => (bt.onclick = () => { keepForm(); p.avatarPreset = bt.dataset.av; p.avatarImg = ""; save(); sheetEdit(); }));
    const clr = $("#avatarClear", sh); if (clr) clr.onclick = () => { keepForm(); p.avatarPreset = ""; p.avatarImg = ""; save(); sheetEdit(); };
    $("#avatarFile", sh).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { keepForm(); p.avatarImg = await resizeImage(f, 192); p.avatarPreset = ""; save(); sheetEdit(); toast("Photo set"); } catch (err) { toast("Couldn't read that image"); }
    };
    $("#saveProfile", sh).onclick = () => {
      keepForm(); save(); closeModal(); render();
      toast(p.playlist && !spotifyEmbed(p.playlist) ? "Saved, but that doesn't look like a Spotify link" : "Profile saved");
    };
  });
}

function sheetAppearance() {
  const a = S.appearance, mode = document.documentElement.dataset.mode;
  openModal(`<h2>Appearance</h2>
    <div class="lbl">Mode</div><div class="seg full">${[["system", "Auto"], ["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([k, l]) => `<button data-mode="${k}" class="${a.mode === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="lbl">Colour theme</div>
    <div class="theme-grid">${Object.entries(THEMES).map(([id, t]) => `<button class="theme-sw ${a.theme === id ? "on" : ""}" data-theme="${id}"><i style="background:${themePreview(id, mode)}"></i>${t.name}</button>`).join("")}</div>
    <div class="lbl">Background style</div><div class="seg full">${[["solid", "Solid"], ["tint", "Tinted"], ["glow", "Glow"]].map(([k, l]) => `<button data-style="${k}" class="${a.style === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <p class="small muted" style="margin-top:12px">Solid keeps backgrounds neutral grey. Tinted adds a soft hint of the theme colour. Glow adds a gentle fade at the top of the screen. All themes use soft contrast for comfortable reading, and the dark modes avoid pure black.</p>`, (sh) => {
    const set = (k, v) => { a[k] = v; applyTheme(a); save(); render(); sheetAppearance(); };
    $$("[data-mode]", sh).forEach((b) => (b.onclick = () => set("mode", b.dataset.mode)));
    $$("[data-theme]", sh).forEach((b) => (b.onclick = () => set("theme", b.dataset.theme)));
    $$("[data-style]", sh).forEach((b) => (b.onclick = () => set("style", b.dataset.style)));
  });
}

function sheetBodyweight() {
  const w = [...S.weights].sort((x, y) => x.date.localeCompare(y.date));
  openModal(`<h2>Bodyweight</h2>
    <div class="row"><input type="number" id="bwIn" step="0.1" placeholder="kg" style="max-width:110px"><input type="date" id="bwDate" value="${today()}" style="max-width:170px"><button class="btn primary" id="bwAdd">Add</button></div>
    <div id="bwChart" style="margin-top:12px"></div>
    ${w.length ? `<p class="small muted">Latest ${w.at(-1).kg} kg${w.length > 1 ? ` · ${w.at(-1).kg - w[0].kg >= 0 ? "+" : ""}${round1(w.at(-1).kg - w[0].kg)} kg since ${fmtShort(w[0].date)}` : ""}</p>
      <details><summary>All entries</summary><table class="data">${[...w].reverse().map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${x.kg} kg</td><td style="text-align:right"><button class="ib x" data-del="${x.date}" aria-label="Delete">✕</button></td></tr>`).join("")}</table></details>`
      : `<p class="small muted">Weigh in once a week, at the same time of day, to see the trend.</p>`}`, (sh) => {
    if (w.length) lineChart($("#bwChart", sh), w.map((x) => ({ date: x.date, v: x.kg })), " kg", { h: 170 });
    $("#bwAdd", sh).onclick = () => {
      const kg = num($("#bwIn", sh).value), d = $("#bwDate", sh).value || today(); if (!kg) return;
      S.weights = S.weights.filter((x) => x.date !== d); S.deleted.wt = S.deleted.wt.filter((x) => x !== d); S.weights.push({ date: d, kg }); save(); render(); sheetBodyweight();
    };
    $$("[data-del]", sh).forEach((b) => (b.onclick = () => { const d = b.dataset.del; S.weights = S.weights.filter((x) => x.date !== d); S.deleted.wt.push(d); save(); render(); sheetBodyweight(); }));
  });
}

function sheetBadges() {
  const ids = new Set(earnedBadges().map((x) => x.id)), cats = [...new Set(BADGES.map((x) => x.cat))];
  openModal(`<h2>Badges <span class="muted small">${ids.size}/${BADGES.length}</span></h2>
    ${cats.map((c) => `<h3 class="cat">${c} <span class="muted small">${BADGES.filter((x) => x.cat === c && ids.has(x.id)).length}/${BADGES.filter((x) => x.cat === c).length}</span></h3>
      <div class="badge-grid">${BADGES.filter((x) => x.cat === c).map((x) => `<div class="badge ${ids.has(x.id) ? "on" : ""}"><span>${x.icon}</span><small>${esc(x.name)}</small><em>${esc(x.desc)}</em></div>`).join("")}</div>`).join("")}
    <button class="btn block" id="toShow" style="margin-top:14px">Pin badges to my showcase</button>`, (sh) => { $("#toShow", sh).onclick = editShowcase; });
}

function sheetRoutines() {
  openModal(`<h2>Routines</h2><p class="small muted">The routine for today's weekday is suggested on Home.</p>
    <div class="rlist">${S.routines.map((r, i) => `<button class="rrow" data-ri="${i}">
      <span class="dayp ${r.day >= 0 ? "" : "off"}">${r.day >= 0 ? DAYS[r.day] : "—"}</span>
      <div class="rmeta"><b>${esc(r.name)}</b><span class="small muted">${r.exercises.length} exercises · ${esc(r.exercises.slice(0, 3).join(", "))}${r.exercises.length > 3 ? "…" : ""}</span></div>
      <span class="chev">›</span></button>`).join("")}</div>
    ${S.routines.length ? "" : `<p class="small muted">No routines yet.</p>`}
    <div class="row" style="margin-top:10px"><button class="btn" id="addRoutine" style="flex:1">+ New routine</button><button class="btn" id="useTpl" style="flex:1">📚 Templates</button></div>`, (sh) => {
    $$(".rrow", sh).forEach((bt) => (bt.onclick = () => editRoutine(+bt.dataset.ri)));
    $("#useTpl", sh).onclick = chooseTemplate;
    $("#addRoutine", sh).onclick = () => editRoutine(-1);
  });
}

function sheetData() {
  const driveReady = Sync.available(), driveOn = Sync.on(), ss = S.sync || {};
  const fmtT = (t) => (t ? new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never");
  openModal(`<h2>Data & backup</h2>
    <div class="status-list">
      <div><span>💾 Saved on this device</span><b>${S.updatedAt ? fmtT(S.updatedAt) : "—"}</b></div>
      <div><span>⬇️ Last backup file</span><b>${fmtT(S.lastBackup)}</b></div>
      ${driveOn ? `<div><span>☁️ Last Google Drive sync</span><b class="${ss.error ? "warn" : ""}">${ss.error ? "⚠️ " + esc(ss.error) : fmtT(ss.lastSync)}</b></div>` : ""}
    </div>
    <div class="row wrap" style="margin:12px 0 4px"><button class="btn primary" id="exportBtn">⬇ Back up now</button>
      ${driveOn ? `<button class="btn" id="syncNow">☁️ Sync now</button>` : ""}
      <label class="btn">Restore backup<input type="file" id="restoreFile" accept=".json" hidden></label></div>
    <p class="small muted">Every change is saved on your phone instantly. A backup file or Drive sync protects you if you lose the phone or clear the browser.</p>
    <div class="lbl">Where to keep your data</div>
    <div class="opt-row">
      <button class="opt ${!driveOn ? "on" : ""}" data-store="local"><span>📱</span><b>This device</b><small>Works offline. Back up by hand.</small></button>
      <button class="opt ${driveOn ? "on" : ""}" data-store="drive" ${driveReady ? "" : "disabled"}><span>☁️</span><b>Google Drive</b><small>${driveReady ? "Auto-saves to your own Drive and keeps working offline. Also lets friends see your live card." : "Not set up yet (see README)"}</small></button>
    </div>
    <p class="small muted" id="persistNote"></p>`, (sh) => {
    $("#exportBtn", sh).onclick = () => {
      S.lastBackup = Date.now(); save();
      const blob = new Blob([JSON.stringify({ ...S, timer: null, draft: null, exportedAt: new Date().toISOString() }, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `liftlog-backup-${today()}.json`; a.click();
      toast("Backup downloaded"); render(); setTimeout(sheetData, 200);
    };
    const sn = $("#syncNow", sh); if (sn) sn.onclick = async () => { await Sync.run(true); render(); sheetData(); };
    $("#restoreFile", sh).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d.version || !Array.isArray(d.workouts)) throw new Error("bad");
        if (!confirm("Replace ALL data on this device with this backup?")) return;
        const keepSync = S.sync; S = migrate(d); S.sync = keepSync; delete S.exportedAt; invalidate(); save(); applyTheme(S.appearance); closeModal(); toast("Backup restored"); render();
      } catch (err) { toast("That isn't a Lift Log backup"); }
    };
    $$(".opt", sh).forEach((bt) => (bt.onclick = async () => {
      const want = bt.dataset.store;
      if (want === "drive" && !Sync.on()) { S.sync.provider = "drive"; save(); await Sync.run(true); render(); sheetData(); }
      if (want === "local" && Sync.on()) {
        if (!confirm("Stop syncing to Google Drive? Your data stays on this device, and the Drive copy is kept.")) return;
        S.sync.provider = "local"; Sync.signOut(); save(); render(); sheetData();
      }
    }));
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((ok) => {
      const el = $("#persistNote", sh); if (el) el.textContent = ok ? "🔒 Your browser has agreed not to clear Lift Log's storage on its own." : "Tip: install the app (Profile → Install app) so your browser is less likely to clear its storage.";
    });
  });
}

function sheetImport() {
  openModal(`<h2>Import data</h2>
    <p class="small ink2">Bring in your history from another app or a spreadsheet. The file type is detected automatically, and importing the same file twice won't create duplicates.</p>
    <div class="imp-list">
      <div><b>Arrow</b><span>JSON export (email their support)</span></div>
      <div><b>Strong</b><span>Settings → Export data (CSV)</span></div>
      <div><b>Hevy</b><span>Settings → Export data (CSV)</span></div>
      <div><b>Spreadsheet</b><span>CSV with date, exercise, weight, reps</span></div>
      <div><b>Lift Log</b><span>A backup file, merged into this device</span></div>
    </div>
    <label class="btn primary block" style="text-align:center;margin-top:12px">Choose file…<input type="file" id="impFile" accept=".json,.csv,text/csv,application/json" hidden></label>
    <button class="btn ghost small" id="tplBtn" style="margin-top:8px">⬇ Download a CSV template</button>
    <p class="small muted" id="impMsg"></p>`, (sh) => {
    $("#impFile", sh).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const res = importAny(await f.text(), f.name); invalidate(); save();
        $("#impMsg", sh).textContent = `✓ ${res.source}: added ${res.workouts} workouts${res.rest ? ` and ${res.rest} rest days` : ""}.`;
        toast(`Imported from ${res.source}`); render();
      } catch (err) { console.error(err); $("#impMsg", sh).textContent = "⚠️ " + err.message; }
    };
    $("#tplBtn", sh).onclick = () => {
      const csv = "date,workout,exercise,weight,reps,unit\n2026-11-19,Push A,Barbell Bench Press,50,8,kg\n2026-11-19,Push A,Barbell Bench Press,50,7,kg\n2026-11-19,Push A,Dumbbell Lateral Raise,6,12,kg\n";
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "liftlog-template.csv"; a.click();
    };
  });
}

let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function sheetInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openModal(`<h2>Install Lift Log</h2>
    ${isStandalone() ? `<p>✓ You're using the installed app.</p>` : installEvt ? `<button class="btn primary block" id="doInstall">📲 Install now</button>` :
      ios ? `<ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>.</li></ol>`
          : `<ol class="steps"><li>Open the browser menu (<b>⋮</b>).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li></ol>`}
    <p class="small ink2">Once installed, Lift Log gets its own icon, opens full screen with no address bar, works offline, and shows up in your app switcher like any other app.</p>`, (sh) => {
    const b = $("#doInstall", sh); if (b) b.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeModal(); render(); };
  });
}

function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
}
function resizeImage(file, size) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = rej; img.src = url;
  });
}
function editShowcase() {
  const earned = earnedBadges();
  let pick = showcaseBadges().map((x) => x.id);
  const draw = (sh) => {
    $(".pick-grid", sh).innerHTML = earned.map((x) => `<button class="badge on ${pick.includes(x.id) ? "picked" : ""}" data-id="${x.id}"><span>${x.icon}</span><small>${esc(x.name)}</small></button>`).join("") || `<p class="muted">Earn a badge first!</p>`;
    $(".pick-count", sh).textContent = `${pick.length}/3 pinned`;
    $$("[data-id]", sh).forEach((bt) => (bt.onclick = () => {
      const id = bt.dataset.id;
      pick = pick.includes(id) ? pick.filter((x) => x !== id) : pick.length < 3 ? [...pick, id] : (toast("You can pin 3. Unpin one first"), pick);
      draw(sh);
    }));
  };
  openModal(`<h2>Pin up to 3 badges</h2><p class="small muted pick-count"></p><div class="badge-grid pick-grid"></div>
    <button class="btn primary block" id="saveShow" style="margin-top:12px">Save showcase</button>`, (sh) => {
    draw(sh);
    $("#saveShow", sh).onclick = () => { S.showcase = pick; save(); closeModal(); render(); };
  });
}
function editRoutine(i, resume) {
  const r = resume || (i >= 0 ? JSON.parse(JSON.stringify(S.routines[i])) : { name: "New routine", day: -1, exercises: [] });
  const draw = (sh) => {
    $(".r-days", sh).innerHTML = [-1, 1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="dayp ${r.day === d ? "on" : ""}" data-d="${d}">${d < 0 ? "Any" : DAYS[d]}</button>`).join("");
    $(".r-ex", sh).innerHTML = r.exercises.map((ex, j) => { const m = musclesFor(ex);
      return `<div class="r-item"><span class="grip">${j + 1}</span><div class="r-name">${esc(ex)}<small>${m.p.map((k) => MUSCLES[k]).join(", ")}</small></div>
        <button class="ib" data-up="${j}" ${j === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="ib" data-down="${j}" ${j === r.exercises.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button><button class="ib x" data-rm="${j}" aria-label="Remove">✕</button></div>`; }).join("") || `<p class="small muted">No exercises yet. Add some below.</p>`;
    $$("[data-d]", sh).forEach((b) => (b.onclick = () => { r.day = +b.dataset.d; draw(sh); }));
    $$("[data-up]", sh).forEach((b) => (b.onclick = () => { const j = +b.dataset.up; [r.exercises[j - 1], r.exercises[j]] = [r.exercises[j], r.exercises[j - 1]]; draw(sh); }));
    $$("[data-down]", sh).forEach((b) => (b.onclick = () => { const j = +b.dataset.down; [r.exercises[j + 1], r.exercises[j]] = [r.exercises[j], r.exercises[j + 1]]; draw(sh); }));
    $$("[data-rm]", sh).forEach((b) => (b.onclick = () => { r.exercises.splice(+b.dataset.rm, 1); draw(sh); }));
  };
  openModal(`<h2>${i >= 0 ? "Edit routine" : "New routine"}</h2>
    <label class="lbl">Name<input type="text" class="r-title" value="${esc(r.name)}"></label>
    <div class="lbl">Day</div><div class="r-days"></div>
    <div class="lbl">Exercises</div><div class="r-ex"></div>
    <div class="row" style="margin-top:8px"><input type="text" class="r-add" list="exList2" placeholder="Search or type an exercise…"><button class="btn" id="rAddBtn">Add</button></div>
    <datalist id="exList2">${allExerciseNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="row" style="margin-top:14px"><button class="btn primary" id="rSave" style="flex:1">Save routine</button>${i >= 0 ? `<button class="btn danger" id="rDel">Delete</button>` : ""}</div>`, (sh) => {
    draw(sh);
    const add = () => { const v = $(".r-add", sh).value.trim(); if (!v) return; r.exercises.push(v); $(".r-add", sh).value = ""; draw(sh);
      if (!knownExercise(v)) { const snapshot = JSON.parse(JSON.stringify(r)); tagExercise(v, () => editRoutine(i, snapshot)); } };
    $("#rAddBtn", sh).onclick = add;
    $(".r-add", sh).addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    $("#rSave", sh).onclick = () => {
      r.name = $(".r-title", sh).value.trim() || "Routine";
      if (i >= 0) S.routines[i] = r; else S.routines.push(r);
      save(); render(); sheetRoutines(); toast("Routine saved");
    };
    const del = $("#rDel", sh); if (del) del.onclick = () => { if (confirm(`Delete ${r.name}?`)) { S.routines.splice(i, 1); save(); sheetRoutines(); } };
  });
}


// ---------- Arrow import ----------
function importArrow(json) {
  const data = json.data || json;
  if (!Array.isArray(data.WorkoutInfo) || !Array.isArray(data.PersonalExercise)) throw new Error("not arrow");
  const off = data.User && typeof data.User.timeUTCoffset === "number" ? data.User.timeUTCoffset : -new Date().getTimezoneOffset() / 60;
  const shift = (iso) => new Date(new Date(iso).getTime() + off * 3600e3);
  const local = (iso) => shift(iso).toISOString().slice(0, 10);
  const hhmm = (iso) => shift(iso).toISOString().slice(11, 16);
  const u = data.User || {};
  if (!S.profile.name && u.fullName) S.profile.name = u.fullName;
  if (!S.profile.height && u.height) S.profile.height = u.height;

  const setsBy = {};
  for (const p of data.PersonalExercise) {
    if (p.reps == null && p.weight == null) continue;
    let w = +p.weight || 0, r = +p.reps || 0;
    if (!isBW(p.exercise) && r >= 40 && w > 0 && w < r && w <= 15) [w, r] = [r, w]; // obvious weight/reps swap
    if (isBW(p.exercise)) w = 0; // Arrow stores bodyweight here
    const o = { ex: p.exercise.trim(), w, r, o: p.order ?? 0, n: p.sets ?? 0 };
    if (UNILATERAL.test(o.ex)) o.u = 1;
    (setsBy[p.workoutID] ||= []).push(o);
  }
  let nW = 0, nR = 0;
  const existing = new Set(S.workouts.map((w) => w.id));
  for (const w of data.WorkoutInfo) {
    const prog = (w.program || "").trim();
    if (prog === "Rest") {
      const ts = w.workoutDay || w.datePlanned; if (!ts) continue;
      const d = local(ts);
      if (d <= today() && !S.restDays.includes(d)) { S.restDays.push(d); nR++; }
      continue;
    }
    if (!w.date) continue;
    const id = "arrow-" + (w.workoutID || w.id);
    if (existing.has(id)) continue;
    const sets = (setsBy[w.workoutID] || []).sort((a, b) => a.o - b.o || a.n - b.n).map(({ ex, w, r, u }) => (u ? { ex, w, r, u } : { ex, w, r }));
    const secs = +w.time || +w.activityTime || 0;
    S.workouts.push({ id, date: local(w.date), name: prog && prog !== "-none-" ? prog : sets.length ? "Workout" : "Activity", sets, source: "arrow",
      start: w.startDate ? hhmm(w.startDate) : undefined, dur: secs && secs < 6 * 3600 ? Math.round(secs / 60) : undefined });
    nW++;
  }
  S.restDays.sort();
  return { workouts: nW, rest: nR };
}

// ---------- Generic import (Arrow, Strong, Hevy, CSV, Lift Log backup) ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0];
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
function parseAnyDate(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${pad(+m[4])}:${m[5]}` : undefined };
  m = s.match(/^(\d{1,2})\s+(\w{3})\w*\s+(\d{4}),?\s*(\d{1,2}):(\d{2})?/); // Hevy: "28 Mar 2024, 10:15"
  if (m) { const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`); if (!isNaN(d)) return { date: ymd(d), time: m[4] ? `${pad(+m[4])}:${m[5] || "00"}` : undefined }; }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 11/19/2026 (US) or 19/11/2026
  if (m) { const a = +m[1], b = +m[2]; const [mo, da] = a > 12 ? [b, a] : [a, b]; return { date: `${m[3]}-${pad(mo)}-${pad(da)}` }; }
  const d = new Date(s); return isNaN(d) ? null : { date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function strHash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function addImported(source, groups) {
  // groups: Map key -> {date, name, start, dur, sets:[{ex,w,r}]}
  const existing = new Set(S.workouts.map((w) => w.id)); let n = 0;
  for (const [key, g] of groups) {
    const id = "imp-" + strHash(source + key);
    if (existing.has(id) || S.deleted.w.includes(id)) continue;
    g.sets.forEach((x) => { if (isBW(x.ex) && !x.w) x.w = 0; if (UNILATERAL.test(x.ex)) x.u = 1; });
    S.workouts.push({ id, date: g.date, name: g.name || "Workout", sets: g.sets, start: g.start, dur: g.dur, source });
    n++;
  }
  return n;
}
function importAny(text, filename = "") {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    const j = JSON.parse(t);
    const d = j.data || j;
    if (Array.isArray(d.WorkoutInfo)) { const r = importArrow(j); return { source: "Arrow", ...r }; }
    if (j.version && Array.isArray(j.workouts)) {
      const before = S.workouts.length;
      const merged = Sync.merge({ ...S }, { ...j, updatedAt: 0 }); // keep this device's profile/settings
      Object.assign(S, merged);
      return { source: "Lift Log backup", workouts: S.workouts.length - before, rest: 0 };
    }
    throw new Error("This JSON file isn't from a supported app.");
  }
  const rows = parseCSV(text); if (!rows.length) throw new Error("The file is empty.");
  const cols = Object.keys(rows[0]);
  const has = (...k) => k.every((x) => cols.includes(x));
  const groups = new Map(); let source;
  const push = (key, base, set) => { if (!groups.has(key)) groups.set(key, { ...base, sets: [] }); if (set.r > 0 || set.w > 0) groups.get(key).sets.push(set); };
  const lbs = (v) => Math.round(v * 0.45359237 * 10) / 10;
  if (has("exercise name", "set order", "date")) {               // Strong
    source = "Strong";
    for (const r of rows) {
      const dt = parseAnyDate(r["date"]); if (!dt) continue;
      const durTxt = r["duration"] || ""; const hm = durTxt.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
      const dur = hm && (hm[1] || hm[2]) ? (+hm[1] || 0) * 60 + (+hm[2] || 0) : undefined;
      let w = num(r["weight"]) || 0; if ((r["weight unit"] || "").toLowerCase().startsWith("lb")) w = lbs(w);
      push(r["date"] + r["workout name"], { date: dt.date, start: dt.time, name: r["workout name"], dur }, { ex: r["exercise name"], w, r: num(r["reps"]) || 0 });
    }
  } else if (has("exercise_title", "start_time")) {                // Hevy
    source = "Hevy";
    for (const r of rows) {
      const dt = parseAnyDate(r["start_time"]); if (!dt) continue;
      const en = parseAnyDate(r["end_time"]);
      let dur; if (dt.time && en && en.time) { const [a1, a2] = dt.time.split(":").map(Number), [b1, b2] = en.time.split(":").map(Number); dur = (b1 * 60 + b2 - (a1 * 60 + a2) + 1440) % 1440 || undefined; }
      if ((r["set_type"] || "").toLowerCase() === "warmup") continue;
      const w = r["weight_kg"] !== undefined ? num(r["weight_kg"]) || 0 : lbs(num(r["weight_lbs"]) || 0);
      push(r["start_time"] + r["title"], { date: dt.date, start: dt.time, name: r["title"], dur }, { ex: r["exercise_title"], w, r: num(r["reps"]) || 0 });
    }
  } else if (cols.includes("date") && cols.includes("exercise") && cols.includes("reps")) { // generic CSV
    source = "CSV";
    for (const r of rows) {
      const dt = parseAnyDate(r["date"]); if (!dt) continue;
      let w = num(r["weight"] ?? r["weight_kg"] ?? r["kg"]) || 0;
      if ((r["unit"] || "").toLowerCase().startsWith("lb")) w = lbs(w);
      const name = r["workout"] || r["workout name"] || "Workout";
      push(dt.date + name, { date: dt.date, start: dt.time, name }, { ex: r["exercise"], w, r: num(r["reps"]) || 0 });
    }
  } else throw new Error("Couldn't recognise this CSV. Use the template, or columns named date, exercise, weight, reps.");
  return { source, workouts: addImported(source, groups), rest: 0 };
}

// ---------- AI coach summary ----------
function coachSummary() {
  const from = addDays(today(), -27), p = S.profile, st = streaks();
  const ws = liftSessions().filter((w) => w.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const ms = muscleSets(from, today());
  const bw = S.weights.length ? [...S.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1).kg + " kg" : "not logged";
  const lines = [
    `My training summary (last 4 weeks, ${fmtShort(from)} to ${fmtShort(today())})`,
    `Goal: ${p.goal}. Height: ${p.height || "?"} cm. Bodyweight: ${bw}. Weekly target: ${p.weeklyTarget} workouts.`,
    `Workouts: ${ws.length}. Current streak: ${st.cur} days (rest days count).`, "", "Sessions:",
    ...ws.map((w) => { const per = {}; w.sets.forEach((s) => (per[s.ex] ||= []).push(fmtSet(s.ex, s)));
      return `- ${w.date} ${w.name}${w.dur ? ` (${w.dur} min)` : ""}: ` + Object.entries(per).map(([e, ss]) => `${e} ${ss.join(", ")}`).join("; "); }),
    "", "Sets per muscle (4 weeks, helper muscles count half; my weekly targets ×4 in brackets):",
    Object.keys(MUSCLES).map((k) => `${MUSCLES[k]} ${round1(ms[k])} (${WEEKLY_TARGET[k] * 4})`).join(", "),
    "", "Automatic notes:", ...coachFlags().map((f) => `- ${f.ex}: ${f.text}`),
    "", "Weights are kg, sets written as weight×reps. Based on this, what should I change in my training?",
  ];
  return lines.join("\n");
}

// ---------- FRIENDS ----------
function publicCard() {
  // the live card friends can read (only summary stats, never your full log)
  const d = myCardData(), wk = weekStart(today());
  const weekS = liftSessions().filter((w) => w.date >= wk);
  const last = [...liftSessions()].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const ms = muscleSets(wk, addDays(wk, 6));
  const lvl = (k) => { const r = ms[k] / WEEKLY_TARGET[k]; return ms[k] === 0 ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : r < 1 ? 4 : 5; };
  return { ...d, wk: weekS.length, wks: wk, wv: Math.round(weekS.reduce((a, w) => a + w.sets.reduce((b, s) => b + setVol(s), 0), 0)),
    last: last ? { d: last.date, n: last.name } : null, ms: Object.keys(MUSCLES).map(lvl).join(""),
    prs: allPRs().slice(0, 3).map((x) => [x.ex, x.text, x.date]), upd: Date.now() };
}
const friendWeek = (f) => (f.wks === weekStart(today()) ? f.wk || 0 : 0);
let friendsRefreshed = 0;
function renderFriends() {
  const me = { ...publicCard(), me: true };
  const fr = S.friends || [];
  const board = [me, ...fr].sort((a, b) => friendWeek(b) - friendWeek(a) || (b.st || 0) - (a.st || 0));
  const live = Sync.on() && S.sync.pubId;
  $("#view").innerHTML = `
    <div class="card">
      <div class="row"><div><h2 style="margin:0">Your friends</h2><div class="small muted">${fr.length ? `${fr.length} friend${fr.length > 1 ? "s" : ""}` : "Add friends by sharing cards"}</div></div><span class="spacer"></span>
        <button class="btn small" id="showQR">QR code</button><button class="btn small primary" id="shareCard">📤 Share</button></div>
      <p class="small ${live ? "ok-note" : "muted"}" style="margin:10px 0 0">${live ? "🟢 Your card is live. Friends see your stats update after each sync."
        : Sync.available() ? "Turn on Google Drive in Profile → Data & backup so friends see your stats update live. Right now they get a snapshot."
        : "Friends see a snapshot of your stats from when you shared. Live updates need Google Drive sync (see README)."}</p>
    </div>
    <div class="card"><div class="row"><h2 style="margin:0">This week</h2><span class="spacer"></span><span class="small muted">workouts · streak</span></div>
      <div class="board">${board.map((f, i) => `<div class="brow ${f.me ? "me" : ""}"><span class="rank">${i + 1}</span>${avatarHTML(34, f.me ? S.profile : { n: f.n, av: f.av })}
        <div class="bname"><b>${esc(f.me ? "You" : f.n)}</b><span class="small muted">${f.last ? `${esc(f.last.n)} · ${relDay(f.last.d)}` : "—"}</span></div>
        <span class="bwk">${friendWeek(f)}</span><span class="bst">🔥${f.st || 0}</span></div>`).join("")}</div></div>
    ${fr.length ? fr.map((f, i) => `<button class="card fcard" data-fi="${i}">
      <div class="row">${avatarHTML(48, { n: f.n, av: f.av })}<div style="flex:1;min-width:0"><b>${esc(f.n)}</b>
        <div class="small muted">Lv ${f.lv} · ${f.wo} workouts · ${f.t}t lifted</div>
        <div class="small ${f.p ? "ok-note" : "muted"}">${f.p ? "🟢 live" : "📸 snapshot"} · updated ${f.upd ? timeAgo(f.upd) : fmtShort(f.at || f.added)}</div></div>
        ${f.ms ? `<div class="fmini">${figureSVG(FIGURE_FRONT, (k) => +f.ms[Object.keys(MUSCLES).indexOf(k)] || 0, "")}</div>` : ""}</div></button>`).join("")
      : `<div class="card empty-friends"><div style="font-size:40px">🤝</div><b>No friends yet</b><p class="small muted">Tap <b>Share</b> and send your link, or let a friend scan your QR code. When they open it, they can add you. Ask them to send theirs back so you can add them too.</p></div>`}`;
  $("#shareCard").onclick = shareMyCard;
  $("#showQR").onclick = () => openModal(`<h2>Scan to add me</h2><div class="big-qr">${qrSVG(shareURL()) || "QR code unavailable"}</div><p class="small muted" style="text-align:center">Open the phone camera and point it at the code.</p>`);
  $$(".fcard").forEach((b) => (b.onclick = () => openFriend(+b.dataset.fi)));
  if (Date.now() - friendsRefreshed > 5 * 60e3 && fr.some((f) => f.p)) {
    friendsRefreshed = Date.now();
    Sync.refreshFriends().then((n) => { if (n && tab === "friends") renderFriends(); });
  }
}
function relDay(d) { const n = Math.round((parseYmd(today()) - parseYmd(d)) / 864e5); return n === 0 ? "today" : n === 1 ? "yesterday" : n < 7 ? `${n} days ago` : fmtShort(d); }
function openFriend(i) {
  const f = S.friends[i], me = myCardData();
  const rows = [["Current streak", me.st, f.st], ["Best streak", me.bs, f.bs], ["Workouts", me.wo, f.wo], ["Lifted (t)", me.t, f.t],
    ["Squat (kg)", round1(me.sq || 0), round1(f.sq || 0)], ["Bench (kg)", round1(me.bp || 0), round1(f.bp || 0)], ["Pull-ups", me.pu || 0, f.pu || 0]];
  const lv = (k) => (f.ms ? +f.ms[Object.keys(MUSCLES).indexOf(k)] || 0 : 0);
  openModal(`<h2>${esc(f.n)}</h2>${dogtagHTML(f, false)}
    ${f.ms ? `<h3>Muscles this week</h3><div class="body-wrap small-fig">${figureSVG(FIGURE_FRONT, lv, "")}${figureSVG(FIGURE_BACK, lv, "")}</div>` : ""}
    ${f.prs && f.prs.length ? `<h3>Recent PRs</h3>${f.prs.map(([ex, txt, d]) => `<div class="pr-row"><span>${esc(ex)}</span><span class="spacer"></span><b>${esc(txt)}</b><span class="small muted" style="width:52px;text-align:right">${fmtShort(d)}</span></div>`).join("")}` : ""}
    <h3>You vs ${esc(f.n.split(" ")[0])}</h3>
    <table class="data vs"><tr><th></th><th>You</th><th>${esc(f.n.split(" ")[0])}</th></tr>
    ${rows.map(([l, a, b]) => `<tr><td>${l}</td><td class="${a > b ? "win" : ""}">${a}</td><td class="${b > a ? "win" : ""}">${b}</td></tr>`).join("")}</table>
    <p class="small muted">${f.p ? "Live card: updates when they sync." : "Snapshot from " + fmtDate(f.at || f.added) + ". Ask them to send a new link to update."}</p>
    <button class="btn danger" id="rmFriend">Remove friend</button>`, (sh) => {
    wireDogtag(sh);
    $("#rmFriend", sh).onclick = () => { if (confirm(`Remove ${f.n}?`)) { S.friends.splice(i, 1); save(); closeModal(); render(); } };
  });
}

// ---------- status chip (backup / sync) ----------
let syncState = "";
function statusChip(s) {
  if (s) syncState = s;
  const el = $("#statusChip"); if (!el) return;
  let icon, label, cls;
  if (Sync.on()) {
    const st = syncState || (S.sync.error ? (S.sync.needsTap ? "tap" : "error") : "ok");
    [icon, label, cls] = { ok: ["☁️", S.sync.lastSync ? "✓" : "", "ok"], pending: ["☁️", "…", "busy"], syncing: ["☁️", "↻", "busy"], tap: ["☁️", "!", "warn"], error: ["☁️", "⚠", "warn"] }[st] || ["☁️", "", "ok"];
    el.title = st === "tap" ? "Tap to sign in to Google again" : st === "error" ? S.sync.error : `Synced ${S.sync.lastSync ? timeAgo(S.sync.lastSync) : "never"}`;
  } else {
    const days = S.lastBackup ? (Date.now() - S.lastBackup) / 864e5 : Infinity;
    icon = "💾"; label = S.lastBackup ? (days < 1 ? "✓" : Math.floor(days) + "d") : "!"; cls = days <= 7 ? "ok" : "warn";
    el.title = S.lastBackup ? `Last backup ${timeAgo(S.lastBackup)}` : "Not backed up yet";
  }
  el.innerHTML = `${icon}<span>${label}</span>`; el.className = "status-chip " + cls;
}

// ---------- ONBOARDING ----------
let obStep = 0, obDraft = null;
function needsOnboarding() { return !S.onboarded; }
function finishOnboarding() { S.onboarded = true; save(); const o = $("#onboard"); if (o) o.remove(); document.body.classList.remove("ob-open"); tab = "home"; render(); }
function showOnboarding(step = 0) {
  obStep = step; obDraft ||= { ...S.profile };
  let o = $("#onboard");
  if (!o) { o = document.createElement("div"); o.id = "onboard"; o.className = "onboard"; document.body.appendChild(o); document.body.classList.add("ob-open"); }
  const steps = [obWelcome, obProfile, obLook, obGoal, obFriends];
  o.innerHTML = `${obArt(step)}<div class="ob-inner">${steps[step]()}</div>`;
  wireOb(o, step);
}
const obDots = (i) => `<div class="ob-dots">${[1, 2, 3, 4].map((n) => `<i class="${n === i ? "on" : n < i ? "done" : ""}"></i>`).join("")}</div>`;
const obNav = (i, nextLabel = "Next") => `<div class="ob-nav">${i > 1 ? `<button class="btn ghost" data-ob="back">Back</button>` : `<span></span>`}
  <button class="btn primary" data-ob="next">${nextLabel}</button></div>`;
function obArt(step) {
  // soft, slow-moving colour blobs + a faint dot grid; the welcome screen also gets a ring of avatars
  return `<div class="ob-art ${step === 0 ? "welcome" : ""}" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><div class="dots"></div></div>`;
}
function obWelcome() {
  const g = Sync.available();
  const ring = ["bear", "fox", "robot", "panda", "owl", "lion", "rocket", "shark"];
  return `<div class="ob-hero"><div class="ob-orbit">${ring.map((id, i) => `<span class="orb" style="--a:${i * 45}deg;--d:${(i % 3) * 0.7}s">${avatarSVG(id)}</span>`).join("")}<img src="icon.svg" alt="" class="ob-logo"></div><h1>Lift Log</h1><p class="muted">Your workouts, streaks and progress, free with no ads.</p></div>
    <div class="ob-choices">
      <button class="ob-choice" data-ob="google" ${g ? "" : "disabled"}>
        <span class="ob-ic">☁️</span><div><b>Continue with Google</b><small>${g ? "Your data syncs to your own Google Drive, so it's safe if you change phones, and friends can see your live card." : "Google sign-in isn't set up on this copy of the app yet."}</small></div></button>
      <button class="ob-choice" data-ob="local">
        <span class="ob-ic">📱</span><div><b>Use on this device only</b><small>Everything stays on this phone and works offline. You can turn on Google sync later, and it's a good idea to download a backup now and then.</small></div></button>
    </div>
    <button class="btn ghost small" data-ob="restore">I have a backup or export file</button>
    <p class="ob-msg small"></p>`;
}
function obProfile() {
  const p = obDraft;
  return `${obDots(1)}<button class="ob-skip" data-ob="skip">Skip setup</button>
    <h2>Make it yours</h2><p class="muted small">This is how you'll appear on your card and to friends.</p>
    <div class="ob-av">${avatarHTML(96, p)}</div>
    <input type="text" id="obName" class="ob-input" placeholder="Your name" value="${esc(p.name || "")}" maxlength="30">
    <div class="avatar-grid" style="margin-top:14px">${Object.entries(AVATARS).map(([id, a]) => `<button class="av-pick ${p.avatarPreset === id && !p.avatarImg ? "on" : ""}" data-av="${id}" title="${a.name}">${avatarSVG(id)}</button>`).join("")}</div>
    <label class="btn small" style="margin-top:6px">📷 Upload a photo<input type="file" id="obPhoto" accept="image/*" hidden></label>
    ${obNav(1)}`;
}
function obLook() {
  const a = S.appearance, mode = document.documentElement.dataset.mode;
  return `${obDots(2)}<button class="ob-skip" data-ob="skip">Skip setup</button>
    <h2>Pick a look</h2><p class="muted small">You can change this any time with the 🌙 button or in Profile.</p>
    <div class="seg full" style="margin:12px 0">${[["system", "Auto"], ["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([k, l]) => `<button data-mode="${k}" class="${a.mode === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="theme-grid">${Object.entries(THEMES).map(([id, t]) => `<button class="theme-sw ${a.theme === id ? "on" : ""}" data-theme="${id}"><i style="background:${themePreview(id, mode)}"></i>${t.name}</button>`).join("")}</div>
    <div class="seg full" style="margin-top:12px">${[["solid", "Solid"], ["tint", "Tinted"], ["glow", "Glow"]].map(([k, l]) => `<button data-style="${k}" class="${a.style === k ? "on" : ""}">${l}</button>`).join("")}</div>
    ${obNav(2)}`;
}
function obGoal() {
  const p = obDraft, goals = [["Build muscle", "💪"], ["Get stronger", "🏋️"], ["Lose fat", "🔥"], ["Stay fit", "🧘"]];
  return `${obDots(3)}<button class="ob-skip" data-ob="skip">Skip setup</button>
    <h2>Your goal</h2><p class="muted small">This sets your weekly target and the badges you'll chase first.</p>
    <div class="goal-grid">${goals.map(([g, i]) => `<button class="goal ${p.goal === g ? "on" : ""}" data-goal="${g}"><span>${i}</span>${g}</button>`).join("")}</div>
    <div class="lbl" style="margin-top:16px">Workouts per week: <b id="obTv">${p.weeklyTarget || 4}</b></div>
    <input type="range" id="obT" min="1" max="7" value="${p.weeklyTarget || 4}" class="ob-range">
    ${obNav(3)}`;
}
function obFriends() {
  return `${obDots(4)}
    <h2>Train with friends</h2><p class="muted small">Share your card and compare streaks, workouts and PRs on a weekly leaderboard.</p>
    <div class="ob-card">${dogtagHTML({ ...myCardData(), n: obDraft.name || "Lifter" }, true)}</div>
    <button class="btn block" data-ob="share">📤 Share my card now</button>
    <p class="small muted" style="text-align:center;margin-top:8px">Got a friend's link? Just open it, and the app will offer to add them.</p>
    ${obNav(4, "Let's go 💪")}`;
}
function obCommit() {
  const n = $("#obName"); if (n) obDraft.name = n.value.trim();
  Object.assign(S.profile, { name: obDraft.name, avatarPreset: obDraft.avatarPreset, avatarImg: obDraft.avatarImg, goal: obDraft.goal, weeklyTarget: obDraft.weeklyTarget });
  save();
}
function wireOb(o, step) {
  const on = (sel, fn) => $$(sel, o).forEach((b) => b.addEventListener("click", fn));
  on("[data-ob=next]", () => { obCommit(); step >= 4 ? finishOnboarding() : showOnboarding(step + 1); });
  on("[data-ob=back]", () => { obCommit(); showOnboarding(step - 1); });
  on("[data-ob=skip]", () => { obCommit(); finishOnboarding(); toast("You can finish setting up in Profile"); });
  on("[data-ob=local]", () => { S.sync.provider = "local"; save(); showOnboarding(1); });
  on("[data-ob=google]", async () => {
    const msg = $(".ob-msg", o); msg.textContent = "Connecting to Google…";
    S.sync.provider = "drive"; save();
    await Sync.run(true);
    if (S.sync.error) { msg.textContent = "⚠️ " + S.sync.error + ". You can try again or use this device only."; S.sync.provider = "local"; save(); return; }
    applyTheme(S.appearance); obDraft = { ...S.profile };
    if (S.profile.name && S.workouts.length) { toast(`Welcome back, ${S.profile.name.split(" ")[0]} 👋`); finishOnboarding(); }
    else showOnboarding(1);
  });
  on("[data-ob=restore]", () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,.csv";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const text = await f.text(), j = text.trim().startsWith("{") ? JSON.parse(text) : null;
        if (j && j.version && Array.isArray(j.workouts)) { const keep = S.sync; S = migrate(j); S.sync = keep; S.onboarded = true; invalidate(); save(); applyTheme(S.appearance); toast("Backup restored"); finishOnboarding(); return; }
        const r = importAny(text, f.name); invalidate(); save(); toast(`Imported ${r.workouts} workouts from ${r.source}`); obDraft = { ...S.profile }; showOnboarding(1);
      } catch (e) { $(".ob-msg", o).textContent = "⚠️ " + e.message; }
    };
    inp.click();
  });
  on("[data-ob=share]", shareMyCard);
  on(".av-pick", (e) => { obCommit(); obDraft.avatarPreset = e.currentTarget.dataset.av; obDraft.avatarImg = ""; showOnboarding(step); });
  const ph = $("#obPhoto", o); if (ph) ph.onchange = async () => { try { obCommit(); obDraft.avatarImg = await resizeImage(ph.files[0], 192); obDraft.avatarPreset = ""; showOnboarding(step); } catch (e) { toast("Couldn't read that image"); } };
  const nm = $("#obName", o); if (nm) nm.addEventListener("input", () => { obDraft.name = nm.value; const av = $(".ob-av", o); if (!obDraft.avatarImg && !obDraft.avatarPreset) av.innerHTML = avatarHTML(96, obDraft); });
  const setA = (k, v) => { S.appearance[k] = v; applyTheme(S.appearance); save(); showOnboarding(step); };
  on("[data-mode]", (e) => setA("mode", e.currentTarget.dataset.mode));
  on("[data-theme]", (e) => setA("theme", e.currentTarget.dataset.theme));
  on("[data-style]", (e) => setA("style", e.currentTarget.dataset.style));
  on("[data-goal]", (e) => { obDraft.goal = e.currentTarget.dataset.goal; $$("[data-goal]", o).forEach((b) => b.classList.toggle("on", b === e.currentTarget)); });
  const rg = $("#obT", o); if (rg) rg.oninput = () => { obDraft.weeklyTarget = +rg.value; $("#obTv", o).textContent = rg.value; };
  wireDogtag(o);
}

// ---------- boot ----------
Sync.onStatus((s) => { statusChip(s); if (s === "ok" && tab === "profile") renderProfile(); });
$("#statusChip").onclick = () => { if (Sync.on() && (syncState === "tap" || S.sync.error)) Sync.run(true); else sheetData(); };
$("#modeBtn").onclick = () => { S.appearance.mode = document.documentElement.dataset.mode === "dark" ? "light" : "dark"; applyTheme(S.appearance); save(); render(); };
if (darkMQ) darkMQ.addEventListener("change", () => { if (S.appearance.mode === "system") { applyTheme(S.appearance); render(); } });
applyTheme(S.appearance);
render();
if (needsOnboarding()) showOnboarding(0);
checkFriendLink();
window.addEventListener("hashchange", checkFriendLink);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if (Sync.on()) Sync.run(false); // pull changes from other devices if still signed in
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
