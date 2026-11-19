"use strict";
// Lift Log v2: a free, offline workout logger. All data stays in this browser (localStorage).

const KEY = "liftlog.v1";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_ROUTINES = [
  { name: "Push A", day: 1, exercises: ["Incline Dumbbell Press", "Dumbbell Shoulder Press", "Chest Fly Machine", "Dumbbell Lateral Raise", "EZ Bar Skull Crusher", "Cable Tricep Pushdown"] },
  { name: "Pull A", day: 2, exercises: ["Pull Ups", "Seated Row Machine", "Cable Lat Pulldown", "Cable Face Pull", "Incline Dumbbell Curl", "Dumbbell Hammer Curl"] },
  { name: "Legs + Core A", day: 3, exercises: ["Barbell Squat", "Back Extension", "Inclined Leg Press Machine", "Seated Leg Extension Machine", "Calf Raise Machine", "Hanging Leg Raise", "Ab Crunch Machine"] },
  { name: "Push B", day: 4, exercises: ["Barbell Bench Press", "Chest Fly Machine", "Dumbbell Lateral Raise", "Push Ups", "Dumbbell Lying Triceps Extension", "Dumbbell Kickback"] },
  { name: "Pull B", day: 5, exercises: ["Pull Ups", "Dumbbell Row (Chest Supported)", "Rear Delt Fly", "Dumbbell Shrug", "Dumbbell Spider Curl", "Dumbbell Bicep Curl", "Dumbbell Wrist Curl"] },
  { name: "Legs + Core B", day: 6, exercises: ["Dumbbell Bulgarian Split Squat", "Seated Leg Curl Machine", "Inclined Leg Press Machine", "Calf Raise Machine", "Planks", "Side Plank"] },
];

// ---------- state ----------
function blankProfile() {
  return { name: "", avatar: "", avatarPreset: "", avatarImg: "", height: "", goal: "Build muscle", weeklyTarget: 5,
    restCompound: 120, restIsolation: 75, playlist: "", memberId: Math.random().toString(36).slice(2, 8).toUpperCase() };
}
function blank() {
  return { version: 3, profile: blankProfile(), weights: [], workouts: [], restDays: [], routines: JSON.parse(JSON.stringify(DEFAULT_ROUTINES)),
    draft: null, timer: null, uni: {}, showcase: [], friends: [], deleted: { w: [], r: [], wt: [] },
    sync: { provider: "local", lastSync: null, fileId: null, error: "" }, updatedAt: 0 };
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
  out.version = 3;
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
    b: showcaseBadges().map((x) => x.id), since: first.slice(0, 7), at: today() };
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
  syncBadge();
  hideTip();
  ({ home: renderHome, history: renderHistory, progress: renderProgress, stats: renderStats, profile: renderProfile })[tab]();
  renderTimer();
}

// ---------- HOME ----------
function greeting() { const h = new Date().getHours(); return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function routineForToday() { const d = new Date().getDay(); return S.routines.find((r) => r.day === d) || S.routines[0]; }
let homeRoutine = null;

function renderHome() {
  if (S.draft) return renderLogger();
  const st = streaks(), lv = levelInfo(), p = S.profile;
  const r = homeRoutine != null && S.routines[homeRoutine] ? S.routines[homeRoutine] : routineForToday();
  const wk = weekStart(today());
  const weekSessions = liftSessions().filter((w) => w.date >= wk);
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
      ${ring(weekSessions.length, target, "this week")}</div>
    <div class="weekstrip">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(wk, i), cls = lifted.has(d) ? "done" : rest.has(d) ? "rest" : d === today() ? "today" : d < today() ? "miss" : "";
      return `<div class="wd ${cls}"><span>${"MTWTFSS"[i]}</span><i>${lifted.has(d) ? "✓" : rest.has(d) ? "z" : ""}</i></div>`;
    }).join("")}</div>
  </div>`;

  html += `<div class="card">
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
  $("#restBtn").onclick = () => { if (!S.restDays.includes(today())) S.restDays.push(today()); save(); toast("Rest day logged. Streak safe 🔥"); render(); };
  const mf = $("#moreFlags"); if (mf) mf.onclick = () => { tab = "progress"; render(); };
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
  };
  $("#discardBtn").onclick = () => { if (confirm("Discard this workout?")) { S.draft = null; S.timer = null; save(); render(); } };
  $("#finishBtn").onclick = finishWorkout;
}
function allExerciseNames() {
  const s = new Set(Object.keys(EXERCISE_MUSCLES));
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
function renderHistory() {
  const items = [...S.workouts.map((w) => ({ type: "w", date: w.date, w })), ...S.restDays.map((d) => ({ type: "r", date: d }))]
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { $("#view").innerHTML = `<div class="card">Nothing logged yet. Import your Arrow history in Profile, or log today's workout.</div>`; return; }
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
  $("#view").innerHTML = html;
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

// ---------- PROGRESS ----------
let progEx = null, progMetric = "top";
function renderProgress() {
  const map = sessionsByExercise();
  const names = Object.keys(map).sort((a, b) => map[b].length - map[a].length);
  if (!names.length) { $("#view").innerHTML = `<div class="card">No exercise history yet.</div>`; return; }
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

  $("#view").innerHTML = `
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
      <div class="small muted" style="margin-top:6px">Works: ${[...m.p.map((k) => MUSCLES[k]), ...m.s.map((k) => MUSCLES[k].toLowerCase())].join(", ") || "not mapped yet"}</div>
    </div></div></div>
  <div class="card"><h2>Coach notes</h2><div id="flags"></div></div>`;
  $("#exSel").onchange = (e) => { progEx = e.target.value; renderProgress(); };
  $$(".seg button").forEach((b) => (b.onclick = () => { progMetric = b.dataset.m; renderProgress(); }));
  lineChart($("#chartBox"), list.map((x) => ({ date: x.date, v: x[progMetric], tip: x.sets.map((s) => fmtSet(progEx, s)).join(", ") })), unit, { prs: true });
  const f = coachFlags();
  $("#flags").innerHTML = f.length ? f.map((x) => `<div class="flag ${x.kind}"><span class="ic">${x.kind === "good" ? "▲" : "!"}</span><div><b>${esc(x.ex)}</b><br><span class="ink2">${esc(x.text)}</span></div></div>`).join("")
    : `<p class="muted small">Nothing to flag in the last 3 weeks. Keep logging.</p>`;
}

// ---------- charts ----------
function lineChart(box, pts, unit, opt = {}) {
  const W = 360, H = opt.h || 200, L = 38, R = 10, T = 12, B = 24;
  if (!pts.length) { box.innerHTML = `<p class="small muted">No data yet.</p>`; return; }
  if (pts.length === 1) pts = [pts[0], pts[0]];
  const t0 = parseYmd(pts[0].date).getTime(), t1 = parseYmd(pts[pts.length - 1].date).getTime();
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pv = (hi - lo) * 0.15 || hi * 0.1 || 1; lo = opt.zero ? 0 : Math.max(0, lo - pv); hi += pv;
  const x = (d) => L + ((parseYmd(d).getTime() - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = niceTicks(lo, hi, 4);
  let runMax = -Infinity;
  const pr = pts.map((p) => { const isPr = opt.prs && p.v > runMax; runMax = Math.max(runMax, p.v); return isPr; });
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = opt.area ? `<path class="area" d="${path}L${x(pts.at(-1).date)},${y(lo)}L${x(pts[0].date)},${y(lo)}Z"/>` : "";
  const xt = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
  const tk = (v) => (v >= 1000 ? round1(v / 1000) + "k" : round1(v));
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${tk(t)}</text>`).join("")}
    ${xt.map((p, i) => `<text class="axis" x="${x(p.date)}" y="${H - 7}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}">${fmtShort(p.date)}</text>`).join("")}
    ${area}<path class="line" d="${path}"/>
    ${pts.length <= 60 ? pts.map((p, i) => `<circle class="${pr[i] ? "pr" : "dot"}" cx="${x(p.date)}" cy="${y(p.v)}" r="${pr[i] ? 5 : 4}"/>`).join("") : ""}
    <line class="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <rect class="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg>`;
  const svg = $("svg", box), cross = $(".cross", box), hit = $(".hit", box);
  const move = (ev) => {
    const bb = svg.getBoundingClientRect(), cx = ((ev.clientX - bb.left) / bb.width) * W;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(x(p.date) - cx); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi];
    cross.setAttribute("x1", x(p.date)); cross.setAttribute("x2", x(p.date)); cross.setAttribute("visibility", "visible");
    showTip(ev.clientX, ev.clientY, `<b>${opt.label ? opt.label(p) : fmtDate(p.date)}</b><br>${unit === " kg" && p.v >= 1000 ? fmtKg(p.v) : round1(p.v) + unit}${pr[bi] ? " · new best" : ""}${p.tip ? "<br>" + esc(p.tip) : ""}`);
  };
  hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
}
function barChart(box, data, opt = {}) {
  // data: [{label, v, tip}]
  const W = 360, H = opt.h || 150, L = 26, B = 22, T = 10, n = data.length;
  const max = Math.max(opt.min || 1, ...data.map((d) => d.v));
  const ticks = niceTicks(0, max, 3), top = Math.max(max, ticks.at(-1));
  const bw = (W - L) / n, gap = Math.min(8, bw * 0.25);
  const y = (v) => T + (1 - v / top) * (H - T - B);
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 5}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? round1(t / 1000) + "k" : round1(t)}</text>`).join("")}
    ${data.map((d, i) => { const x0 = L + i * bw + gap / 2, x1 = L + (i + 1) * bw - gap / 2, yy = y(d.v), r = Math.min(4, (x1 - x0) / 2, y(0) - yy);
      return d.v > 0 ? `<path d="M${x0},${y(0)} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x1 - r} Q${x1},${yy} ${x1},${yy + r} V${y(0)} Z" class="bar${d.hl ? " hl" : ""}"/>` : ""; }).join("")}
    ${data.map((d, i) => (opt.every ? i % opt.every === 0 || i === n - 1 : true) ? `<text class="axis" x="${i === n - 1 && opt.every ? W : L + i * bw + bw / 2}" y="${H - 6}" text-anchor="${i === n - 1 && opt.every ? "end" : "middle"}">${esc(d.label)}</text>` : "").join("")}
    ${data.map((d, i) => `<rect x="${L + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-i="${i}" class="hitb"/>`).join("")}
  </svg>`;
  $$(".hitb", box).forEach((r) => {
    const f = (ev) => { const d = data[+r.dataset.i]; showTip(ev.clientX, ev.clientY, d.tip); };
    r.addEventListener("pointerenter", f); r.addEventListener("pointerdown", f); r.addEventListener("pointerleave", hideTip);
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

  $("#view").innerHTML = `
  <div class="card">
    <h2>Muscle map</h2>
      <div class="seg">${Object.entries(periods).map(([k, v]) => `<button data-p="${k}" class="${k === statPeriod ? "on" : ""}">${v[0]}</button>`).join("")}</div>
    <div class="body-wrap">${figureSVG(FIGURE_FRONT, lvl, "Front")}${figureSVG(FIGURE_BACK, lvl, "Back")}</div>
    <div class="legend"><span>Sets vs target:</span><span><i class="sw l0"></i>none</span><span><i class="sw l2"></i>&lt;50%</span>
      <span><i class="sw l3"></i>50–75%</span><span><i class="sw l4"></i>75–99%</span><span><i class="sw l5"></i>hit target</span></div>
    <p class="small muted">Tap a muscle for details. Main muscle worked = 1 set, helper muscle = ½ set.</p>
  </div>
  <div class="card"><h2>Sets per muscle · ${plabel.toLowerCase()}</h2>
    <div class="bars">${order.map((k) => `<div class="b"><span>${MUSCLES[k]}</span>
      <div class="track"><div class="fill" style="width:${(ms[k] / maxV) * 100}%"></div><div class="target" style="left:${(tgt(k) / maxV) * 100}%"></div></div>
      <span class="v">${round1(ms[k])}/${tgt(k)}</span></div>`).join("")}</div>
    <p class="small muted">Dark tick = target. Least-trained muscles are on top.</p></div>
  <div class="card"><h2>Muscle balance</h2><p class="small muted" style="margin-top:-4px">Last 4 weeks vs target. The dashed line is 100%, so a lopsided shape means some groups are getting more than others.</p><div id="radar"></div></div>
  <div class="card"><h2>Where your sets go</h2><p class="small muted" style="margin-top:-4px">Share of all sets, last 4 weeks</p>
    <div class="bars dist">${Object.keys(GROUPS).map((g) => [g, groupSum(g, m4) / totalSets4]).sort((a, b) => b[1] - a[1]).map(([g, f]) =>
      `<div class="b"><span>${g}</span><div class="track"><div class="fill" style="width:${f * 100}%"></div></div><span class="v">${Math.round(f * 100)}%</span></div>`).join("")}</div></div>
  <div class="card"><h2>Weekly volume</h2><div id="volChart"></div></div>
  <div class="card"><h2>Workouts per week</h2><div id="wkChart"></div></div>
  <div class="card"><h2>Consistency</h2>
    <div class="hero" style="margin-bottom:12px"><div class="stat"><div class="num">🔥 ${st.cur}</div><div class="lbl">current streak</div></div>
      <div class="stat"><div class="num">${st.best}</div><div class="lbl">longest streak</div></div></div>
    <div class="cal" id="cal"></div>
    <div class="legend"><span><i class="sw l0"></i>no log</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--s2)"></i>rest day</span>
      <span><i class="sw l2"></i>light</span><span><i class="sw l3"></i>medium</span><span><i class="sw l4"></i>big session</span></div></div>
  <div class="card"><h2>Favourite training days</h2><div id="dowChart"></div></div>
  <div class="card"><h2>When you train</h2><div id="todChart"></div>${avgDur ? `<p class="small muted">Average session: <b>${avgDur} min</b> (last ${durs.length})</p>` : ""}</div>
  <div class="card"><h2>Ask an AI coach 🤖</h2><p class="small ink2">Copies a summary of your last 4 weeks (workouts, top sets, sets per muscle, coach notes). Paste it into Claude, Gemini or ChatGPT and ask for advice.</p>
    <button class="btn" id="copyCoach">📋 Copy my summary</button></div>
  <div class="card"><h2>All time</h2><div class="hero">
    <div class="stat"><div class="num">${t.sessions}</div><div class="lbl">workouts</div></div>
    <div class="stat"><div class="num">${t.sets.toLocaleString()}</div><div class="lbl">sets</div></div>
    <div class="stat"><div class="num">${(t.vol / 1000).toFixed(1)}t</div><div class="lbl">lifted</div></div>
    <div class="stat"><div class="num">${allPRs().length}</div><div class="lbl">PRs</div></div></div></div>`;

  $$("[data-p]").forEach((b) => (b.onclick = () => { statPeriod = b.dataset.p; renderStats(); }));
  $("#copyCoach").onclick = async () => { const txt = coachSummary(); try { await navigator.clipboard.writeText(txt); toast("Summary copied. Paste it into your AI chat"); } catch (e) { openModal(`<h2>Your summary</h2><textarea style="min-height:300px">${esc(txt)}</textarea>`); } };
  $$(".body-wrap .m").forEach((el) => {
    const f = (ev) => { const k = el.dataset.m; showTip(ev.clientX, ev.clientY, `<b>${MUSCLES[k]}</b><br>${round1(ms[k])} of ${tgt(k)} sets`); };
    el.addEventListener("pointerenter", f); el.addEventListener("pointerdown", f); el.addEventListener("pointerleave", hideTip);
  });
  radarChart($("#radar"), Object.keys(GROUPS).map((g) => { const v = groupSum(g, m4) / groupTgt(g); return { label: g, v, tip: `<b>${g}</b><br>${round1(groupSum(g, m4))} sets · ${Math.round(v * 100)}% of target` }; }));

  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(wk, -7 * i), we = addDays(ws, 6), ss = liftSessions().filter((w) => w.date >= ws && w.date <= we);
    weeks.push({ ws, c: ss.length, vol: ss.reduce((a, w) => a + w.sets.reduce((b, s) => b + setVol(s), 0), 0), sets: ss.reduce((a, w) => a + w.sets.length, 0) });
  }
  lineChart($("#volChart"), weeks.map((w) => ({ date: w.ws, v: w.vol, tip: `${w.c} workouts · ${w.sets} sets` })), " kg", { area: true, zero: true, h: 170, label: (p) => "Week of " + fmtShort(p.date) });
  barChart($("#wkChart"), weeks.map((w, i) => ({ label: fmtShort(w.ws), v: w.c, hl: i === 11, tip: `<b>Week of ${fmtShort(w.ws)}</b><br>${w.c} workout${w.c === 1 ? "" : "s"}` })), { every: 3, min: +S.profile.weeklyTarget || 5 });
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ label: DAYS[d], v: liftSessions().filter((w) => parseYmd(w.date).getDay() === d).length }));
  dow.forEach((d) => (d.tip = `<b>${d.label}</b><br>${d.v} workouts`));
  barChart($("#dowChart"), dow, {});
  const slots = [["Early", 5, 9], ["Morning", 9, 12], ["Afternoon", 12, 17], ["Evening", 17, 21], ["Night", 21, 29]];
  const hrs = S.workouts.filter((w) => w.start).map((w) => { const h = +w.start.slice(0, 2); return h < 5 ? h + 24 : h; });
  barChart($("#todChart"), slots.map(([l, a, b]) => { const v = hrs.filter((h) => h >= a && h < b).length; return { label: l, v, tip: `<b>${l}</b> (${a % 24}:00–${b % 24}:00)<br>${v} workouts` }; }), {});
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

// ---------- PROFILE ----------
const openSecs = new Set(["edit"]);
function sec(id, title, extra, body) {
  return `<details class="card acc" data-sec="${id}" ${openSecs.has(id) ? "open" : ""}><summary><span>${title}</span><span class="acc-x">${extra || ""}</span></summary><div class="acc-body">${body}</div></details>`;
}
function renderProfile() {
  const p = S.profile, b = badgeStats(), earned = earnedBadges(), earnedIds = new Set(earned.map((x) => x.id));
  const w = [...S.weights].sort((a, c) => a.date.localeCompare(c.date));
  const show = showcaseBadges();
  const cats = [...new Set(BADGES.map((x) => x.cat))];
  const daysSinceBackup = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;

  const editBody = `
    <div class="avatar-edit">${avatarHTML(72)}
      <div class="avatar-actions">
        <label class="btn small">📷 Upload photo<input type="file" id="avatarFile" accept="image/*" hidden></label>
        ${p.avatarImg || p.avatarPreset ? `<button class="btn small ghost" id="avatarClear">Use initial</button>` : ""}
      </div></div>
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
    <button class="btn primary" id="saveProfile" style="margin-top:12px">Save profile</button>`;

  const bwBody = `
    <div class="row"><input type="number" id="bwIn" step="0.1" placeholder="kg" style="max-width:110px"><input type="date" id="bwDate" value="${today()}" style="max-width:170px"><button class="btn" id="bwAdd">Add</button></div>
    <div id="bwChart" style="margin-top:10px"></div>
    ${w.length ? `<p class="small muted">Latest ${w.at(-1).kg} kg${w.length > 1 ? ` · ${w.at(-1).kg - w[0].kg >= 0 ? "+" : ""}${round1(w.at(-1).kg - w[0].kg)} kg since ${fmtShort(w[0].date)}` : ""}</p>` : `<p class="small muted">Weigh in once a week, at the same time of day, to see the trend.</p>`}`;

  const badgeBody = cats.map((c) => `<h3 class="cat">${c} <span class="muted small">${BADGES.filter((x) => x.cat === c && earnedIds.has(x.id)).length}/${BADGES.filter((x) => x.cat === c).length}</span></h3>
    <div class="badge-grid">${BADGES.filter((x) => x.cat === c).map((x) => `<div class="badge ${earnedIds.has(x.id) ? "on" : ""}"><span>${x.icon}</span><small>${esc(x.name)}</small><em>${esc(x.desc)}</em></div>`).join("")}</div>`).join("");

  const friends = S.friends || [];
  const friendBody = `${friends.length ? friends.map((f, i) => `<button class="friend" data-fi="${i}">${avatarHTML(40, { n: f.n, av: f.av })}
      <div><b>${esc(f.n)}</b><div class="small muted">Lv ${f.lv} · 🔥 ${f.st} · ${f.wo} workouts</div></div><span class="spacer"></span><span class="small muted">${fmtShort(f.at || f.added)}</span></button>`).join("")
    : `<p class="small muted">No friends yet. Share your card, and when a friend opens your link or scans your QR code, they can add you. Ask them to send theirs back.</p>`}
    <button class="btn" id="shareCard2" style="margin-top:8px">📤 Share my card</button>`;

  const routineBody = `<div class="rlist">${S.routines.map((r, i) => `<button class="rrow" data-ri="${i}">
      <span class="dayp ${r.day >= 0 ? "" : "off"}">${r.day >= 0 ? DAYS[r.day] : "—"}</span>
      <div class="rmeta"><b>${esc(r.name)}</b><span class="small muted">${r.exercises.length} exercises · ${esc(r.exercises.slice(0, 3).join(", "))}${r.exercises.length > 3 ? "…" : ""}</span></div>
      <span class="chev">›</span></button>`).join("")}</div>
    <button class="btn" id="addRoutine" style="margin-top:8px">+ New routine</button>`;

  const driveReady = Sync.available(), driveOn = Sync.on(), ss = S.sync || {};
  const syncBody = `
    <div class="opt-row">
      <button class="opt ${!driveOn ? "on" : ""}" data-store="local"><span>📱</span><b>This device</b><small>Works offline. Back up by hand.</small></button>
      <button class="opt ${driveOn ? "on" : ""}" data-store="drive" ${driveReady ? "" : "disabled"}><span>☁️</span><b>Google Drive</b><small>${driveReady ? "Auto-saves to your own Drive. Still works offline." : "Not set up yet (see README)"}</small></button>
    </div>
    ${driveOn ? `<div class="sync-status ${ss.error ? "err" : ""}">${ss.error ? `⚠️ ${esc(ss.error)}` : ss.lastSync ? `✓ Synced ${timeAgo(ss.lastSync)}` : "Not synced yet"}</div>
      <div class="row wrap"><button class="btn primary" id="syncNow">Sync now</button></div>` : ""}
    <p class="small muted" id="persistNote"></p>
    <hr>
    <h3>Backup</h3>
    <p class="small ink2">${daysSinceBackup == null ? "You haven't downloaded a backup yet." : `Last backup ${daysSinceBackup === 0 ? "today" : daysSinceBackup + " days ago"}.`}</p>
    <div class="row wrap"><button class="btn" id="exportBtn">⬇ Download backup</button><label class="btn">Restore backup<input type="file" id="restoreFile" accept=".json" hidden></label></div>
    <hr>
    <h3>Import from Arrow</h3>
    <p class="small ink2">Pick the <code>…arrow-export.json</code> file. Importing twice won't create duplicates.</p>
    <input type="file" id="arrowFile" accept=".json,application/json">`;

  $("#view").innerHTML = `
    <div class="profile-top">${dogtagHTML(myCardData())}
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="shareCard">📤 Share my card</button></div></div>
    <div class="card"><div class="row"><h2 style="margin:0">Showcase</h2><span class="spacer"></span><button class="btn small" id="editShow">Edit</button></div>
      <div class="showcase">${[0, 1, 2].map((i) => show[i] ? `<div class="badge on big"><span>${show[i].icon}</span><small>${esc(show[i].name)}</small><em>${esc(show[i].desc)}</em></div>` : `<div class="badge empty"><span>＋</span><small>Empty</small></div>`).join("")}</div>
      <p class="small muted">${earned.length} of ${BADGES.length} badges unlocked. Pinned badges appear on the back of your card.</p></div>
    ${sec("edit", "Edit profile", "", editBody)}
    ${sec("bw", "Bodyweight", w.length ? w.at(-1).kg + " kg" : "", bwBody)}
    ${sec("badges", "All badges", `${earned.length}/${BADGES.length}`, badgeBody)}
    ${sec("friends", "Friends", friends.length || "", friendBody)}
    ${sec("routines", "Routines", S.routines.length, routineBody)}
    ${sec("data", "Data & sync", driveOn ? "☁️ Drive" : "📱 Device", syncBody)}
    ${sec("danger", "Danger zone", "", `<button class="btn danger" id="resetBtn">Delete all data on this device</button>`)}
    <p class="small muted" style="text-align:center">Lift Log · free and open source</p>`;

  wireDogtag($("#view"));
  $$("details.acc").forEach((d) => d.addEventListener("toggle", () => { d.open ? openSecs.add(d.dataset.sec) : openSecs.delete(d.dataset.sec); if (d.open && d.dataset.sec === "bw") drawBw(); }));
  $("#shareCard").onclick = shareMyCard; $("#shareCard2").onclick = shareMyCard;
  $("#editShow").onclick = editShowcase;

  // profile + avatar
  $("#saveProfile").onclick = () => {
    Object.assign(p, { name: $("#pName").value.trim(), height: $("#pHeight").value, goal: $("#pGoal").value,
      weeklyTarget: +$("#pTarget").value || 5, restCompound: +$("#pRestC").value || 120, restIsolation: +$("#pRestI").value || 75, playlist: $("#pPlaylist").value.trim() });
    toast(p.playlist && !spotifyEmbed(p.playlist) ? "Saved, but that doesn't look like a Spotify link" : "Profile saved");
    save(); render();
  };
  $$(".av-pick").forEach((bt) => (bt.onclick = () => { p.avatarPreset = bt.dataset.av; p.avatarImg = ""; save(); renderProfile(); }));
  const clr = $("#avatarClear"); if (clr) clr.onclick = () => { p.avatarPreset = ""; p.avatarImg = ""; save(); renderProfile(); };
  $("#avatarFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { p.avatarImg = await resizeImage(f, 192); p.avatarPreset = ""; save(); renderProfile(); toast("Photo set"); }
    catch (err) { toast("Couldn't read that image"); }
  };

  // bodyweight
  $("#bwAdd").onclick = () => {
    const kg = num($("#bwIn").value), d = $("#bwDate").value || today(); if (!kg) return;
    S.weights = S.weights.filter((x) => x.date !== d); S.weights.push({ date: d, kg }); save(); renderProfile();
  };
  function drawBw() { if (w.length && $("#bwChart")) lineChart($("#bwChart"), w.map((x) => ({ date: x.date, v: x.kg })), " kg", { h: 170 }); }
  if (openSecs.has("bw")) drawBw();

  // friends
  $$(".friend").forEach((bt) => (bt.onclick = () => openFriend(+bt.dataset.fi)));

  // routines
  $$(".rrow").forEach((bt) => (bt.onclick = () => editRoutine(+bt.dataset.ri)));
  $("#addRoutine").onclick = () => editRoutine(-1);

  // data & sync
  $$(".opt").forEach((bt) => (bt.onclick = async () => {
    const want = bt.dataset.store;
    if (want === "drive" && !Sync.on()) { S.sync.provider = "drive"; save(); await Sync.run(true); renderProfile(); }
    if (want === "local" && Sync.on()) {
      if (!confirm("Stop syncing to Google Drive? Your data stays on this device, and the Drive copy is kept.")) return;
      S.sync.provider = "local"; Sync.signOut(); save(); renderProfile();
    }
  }));
  const sn = $("#syncNow"); if (sn) sn.onclick = async () => { await Sync.run(true); renderProfile(); };
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((ok) => {
    const el = $("#persistNote"); if (el) el.textContent = ok ? "🔒 This browser has agreed not to clear Lift Log's storage on its own." : "Tip: add Lift Log to your home screen so your browser is less likely to clear its storage.";
  });
  $("#exportBtn").onclick = () => {
    S.lastBackup = Date.now(); save();
    const blob = new Blob([JSON.stringify({ ...S, timer: null, draft: null, exportedAt: new Date().toISOString() }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `liftlog-backup-${today()}.json`; a.click();
    setTimeout(renderProfile, 300);
  };
  $("#restoreFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.version || !Array.isArray(d.workouts)) throw new Error("bad");
      if (!confirm("Replace the data on this device with this backup?")) return;
      const keepSync = S.sync; S = migrate(d); S.sync = keepSync; delete S.exportedAt; invalidate(); save(); toast("Backup restored"); render();
    } catch (err) { toast("That isn't a Lift Log backup"); }
  };
  $("#arrowFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const res = importArrow(JSON.parse(await f.text())); invalidate(); save(); toast(`Imported ${res.workouts} workouts and ${res.rest} rest days`); tab = "home"; render(); }
    catch (err) { console.error(err); toast("That doesn't look like an Arrow export"); }
  };
  $("#resetBtn").onclick = () => {
    if (!confirm("Delete ALL workouts, rest days, routines and friends on this device? Download a backup first if unsure.")) return;
    const keep = S.sync; S = blank(); S.sync = { ...keep, provider: "local" }; Sync.signOut(); invalidate(); save(); render();
  };
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
function openFriend(i) {
  const f = S.friends[i], me = myCardData();
  const rows = [["Current streak", me.st, f.st], ["Best streak", me.bs, f.bs], ["Workouts", me.wo, f.wo], ["Lifted (t)", me.t, f.t],
    ["Squat (kg)", round1(me.sq || 0), round1(f.sq || 0)], ["Bench (kg)", round1(me.bp || 0), round1(f.bp || 0)], ["Pull-ups", me.pu || 0, f.pu || 0]];
  openModal(`<h2>${esc(f.n)}</h2>${dogtagHTML(f, false)}
    <table class="data vs"><tr><th></th><th>You</th><th>${esc(f.n.split(" ")[0])}</th></tr>
    ${rows.map(([l, a, b]) => `<tr><td>${l}</td><td class="${a > b ? "win" : ""}">${a}</td><td class="${b > a ? "win" : ""}">${b}</td></tr>`).join("")}</table>
    <p class="small muted">Their stats are from ${fmtDate(f.at || f.added)}. Ask them to send a new link to update.</p>
    <button class="btn danger" id="rmFriend">Remove friend</button>`, (sh) => {
    wireDogtag(sh);
    $("#rmFriend", sh).onclick = () => { if (confirm(`Remove ${f.n}?`)) { S.friends.splice(i, 1); save(); closeModal(); renderProfile(); } };
  });
}
function editRoutine(i) {
  const r = i >= 0 ? JSON.parse(JSON.stringify(S.routines[i])) : { name: "New routine", day: -1, exercises: [] };
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
    const add = () => { const v = $(".r-add", sh).value.trim(); if (!v) return; r.exercises.push(v); $(".r-add", sh).value = ""; draw(sh); };
    $("#rAddBtn", sh).onclick = add;
    $(".r-add", sh).addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    $("#rSave", sh).onclick = () => {
      r.name = $(".r-title", sh).value.trim() || "Routine";
      if (i >= 0) S.routines[i] = r; else S.routines.push(r);
      save(); closeModal(); renderProfile(); toast("Routine saved");
    };
    const del = $("#rDel", sh); if (del) del.onclick = () => { if (confirm(`Delete ${r.name}?`)) { S.routines.splice(i, 1); save(); closeModal(); renderProfile(); } };
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

// ---------- sync badge ----------
let syncState = "";
function syncBadge(s) {
  if (s) syncState = s;
  const el = $("#syncBadge"); if (!el) return;
  if (!Sync.on()) { el.hidden = true; return; }
  el.hidden = false;
  const st = syncState || (S.sync.error ? (S.sync.needsTap ? "tap" : "error") : "ok");
  const map = { ok: ["☁️✓", "Synced"], pending: ["☁️…", "Saving…"], syncing: ["☁️↻", "Syncing…"], tap: ["☁️!", "Tap to sign in and sync"], error: ["☁️⚠", S.sync.error || "Sync error"] };
  const [icon, title] = map[st] || map.ok;
  el.textContent = icon; el.title = title; el.className = "sync-badge " + st;
}

// ---------- boot ----------
Sync.onStatus((s) => syncBadge(s));
$("#syncBadge").onclick = () => Sync.run(true);
render();
checkFriendLink();
window.addEventListener("hashchange", checkFriendLink);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if (Sync.on()) Sync.run(false); // pull changes from other devices if still signed in
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
