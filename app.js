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
  return { name: "", avatar: "", height: "", goal: "Build muscle", weeklyTarget: 5, restCompound: 120, restIsolation: 75, playlist: "" };
}
function blank() {
  return { version: 2, profile: blankProfile(), weights: [], workouts: [], restDays: [], routines: DEFAULT_ROUTINES, draft: null, timer: null, uni: {} };
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
  const out = Object.assign(blank(), s);
  out.profile = Object.assign(blankProfile(), s.profile || {});
  if (s.name && !out.profile.name) out.profile.name = s.name;
  out.version = 2;
  return out;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save. Storage is full or blocked."); }
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
function invalidate() { _cache = null; }
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
function badgeStats() {
  const t = totals(), st = streaks(), map = sessionsByExercise();
  const bw = +(S.weights.at(-1)?.kg) || 0;
  const top = (re) => Math.max(0, ...Object.entries(map).filter(([e]) => re.test(e)).flatMap(([, l]) => l.map((x) => x.top)));
  const pullReps = Math.max(0, ...Object.entries(map).filter(([e]) => /pull ?ups?\b|\bchin ?ups?\b/i.test(e)).flatMap(([, l]) => l.map((x) => x.reps)));
  let bestWeek = 0, allMuscles = false;
  const weeks = {};
  liftSessions().forEach((w) => { const k = weekStart(w.date); weeks[k] = (weeks[k] || 0) + 1; });
  bestWeek = Math.max(0, ...Object.values(weeks));
  for (const k of Object.keys(weeks)) { const ms = muscleSets(k, addDays(k, 6)); if (Object.values(ms).every((v) => v > 0)) allMuscles = true; }
  const hours = S.workouts.filter((w) => w.start).map((w) => +w.start.slice(0, 2));
  return { ...t, best: st.best, bw, squat: top(/barbell squat/i), bench: top(/bench press/i), pullReps, bestWeek, allMuscles,
    early: hours.some((h) => h < 8), late: hours.some((h) => h >= 21), prs: allPRs().length };
}
const BADGES = [
  ["🎯", "First rep", "Log your first workout", (b) => b.sessions >= 1],
  ["🏋️", "Regular", "10 workouts", (b) => b.sessions >= 10],
  ["🏆", "Committed", "50 workouts", (b) => b.sessions >= 50],
  ["👑", "Centurion", "100 workouts", (b) => b.sessions >= 100],
  ["🔥", "Week warrior", "7-day streak", (b) => b.best >= 7],
  ["⚡", "Month of grind", "30-day streak", (b) => b.best >= 30],
  ["🌋", "Unstoppable", "60-day streak", (b) => b.best >= 60],
  ["💯", "Hundred club", "100-day streak", (b) => b.best >= 100],
  ["💪", "Set machine", "500 sets", (b) => b.sets >= 500],
  ["🧱", "10 tonnes", "Lift 10,000 kg in total", (b) => b.vol >= 10000],
  ["🏗️", "50 tonnes", "Lift 50,000 kg in total", (b) => b.vol >= 50000],
  ["🚀", "100 tonnes", "Lift 100,000 kg in total", (b) => b.vol >= 100000],
  ["⭐", "PR hunter", "Set 25 personal bests", (b) => b.prs >= 25],
  ["🦵", "Bodyweight squat", "Squat your own bodyweight", (b) => b.bw > 0 && b.squat >= b.bw],
  ["🛡️", "Bodyweight bench", "Bench your own bodyweight", (b) => b.bw > 0 && b.bench >= b.bw],
  ["💥", "Triple digits", "Squat 100 kg", (b) => b.squat >= 100],
  ["🧗", "Pull-up pro", "10 pull-ups in one set", (b) => b.pullReps >= 10],
  ["📅", "Full week", "6 workouts in one week", (b) => b.bestWeek >= 6],
  ["🧩", "Complete", "Train every muscle in one week", (b) => b.allMuscles],
  ["🌅", "Early bird", "Start a workout before 8 am", (b) => b.early],
  ["🌙", "Night owl", "Start a workout after 9 pm", (b) => b.late],
];

// ---------- routing ----------
let tab = "home";
$$(".tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
function render() {
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#streakBadge").innerHTML = `🔥 ${streaks().cur}`;
  hideTip();
  ({ home: renderHome, history: renderHistory, progress: renderProgress, stats: renderStats, profile: renderProfile })[tab]();
  renderTimer();
}

// ---------- HOME ----------
function greeting() { const h = new Date().getHours(); return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function avatarHTML(size = 44) {
  const p = S.profile, ch = p.avatar || (p.name ? p.name.trim()[0].toUpperCase() : "🙂");
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.45}px">${esc(ch)}</div>`;
}
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
  const b = badgeStats(), earned = BADGES.filter((x) => x[3](b));
  const nextBadge = BADGES.find((x) => !x[3](b));

  let html = `
  <div class="card greet">
    <div class="row">${avatarHTML()}<div><div class="hello">${greeting()}${p.name ? ", " + esc(p.name.split(" ")[0]) : ""} 👋</div>
      <div class="small muted">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div></div>
      <span class="spacer"></span><div class="lvl" title="${lv.xp} XP">Lv ${lv.lvl}</div></div>
    <div class="xp"><div style="width:${Math.round(lv.pct * 100)}%"></div></div>
    <div class="small muted">${lv.toNext.toLocaleString()} XP to level ${lv.lvl + 1} · sets, workouts and PRs all earn XP</div>
  </div>

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
    <div class="badge-strip">${earned.slice(-6).reverse().map((x) => `<div class="badge on" title="${esc(x[2])}"><span>${x[0]}</span><small>${esc(x[1])}</small></div>`).join("")}</div>
    ${nextBadge ? `<div class="small muted">Next up: ${nextBadge[0]} <b>${esc(nextBadge[1])}</b>: ${esc(nextBadge[2])}</div>` : ""}</div>`;

  const embed = spotifyEmbed(p.playlist);
  html += embed
    ? `<div class="card"><div class="row"><h2 style="margin:0">Gym playlist 🎧</h2><span class="spacer"></span><a class="btn small" href="${esc(p.playlist)}" target="_blank" rel="noopener">Open in Spotify</a></div>
       <iframe class="spotify" src="${embed}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`
    : `<div class="card row"><span>🎧 Add your Spotify gym playlist in Profile to play it from here.</span></div>`;

  $("#view").innerHTML = html;
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
    if (t.dataset.del) { if (confirm("Delete this session?")) { S.workouts = S.workouts.filter((w) => w.id !== t.dataset.del); invalidate(); save(); render(); } return; }
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
  <div class="card"><h2>All time</h2><div class="hero">
    <div class="stat"><div class="num">${t.sessions}</div><div class="lbl">workouts</div></div>
    <div class="stat"><div class="num">${t.sets.toLocaleString()}</div><div class="lbl">sets</div></div>
    <div class="stat"><div class="num">${(t.vol / 1000).toFixed(1)}t</div><div class="lbl">lifted</div></div>
    <div class="stat"><div class="num">${allPRs().length}</div><div class="lbl">PRs</div></div></div></div>`;

  $$("[data-p]").forEach((b) => (b.onclick = () => { statPeriod = b.dataset.p; renderStats(); }));
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
function renderProfile() {
  const p = S.profile, lv = levelInfo(), b = badgeStats();
  const w = [...S.weights].sort((a, c) => a.date.localeCompare(c.date));
  $("#view").innerHTML = `
  <div class="card greet"><div class="row">${avatarHTML(56)}<div><div class="hello">${esc(p.name || "Your name")}</div>
    <div class="small muted">Level ${lv.lvl} · ${lv.xp.toLocaleString()} XP · ${esc(p.goal)}</div></div></div></div>

  <div class="card"><h2>Profile</h2>
    <div class="form">
      <label>Name<input type="text" id="pName" value="${esc(p.name)}" placeholder="Your name"></label>
      <label>Avatar (emoji or letter)<input type="text" id="pAvatar" value="${esc(p.avatar)}" maxlength="4" placeholder="💪"></label>
      <label>Height (cm)<input type="number" id="pHeight" value="${esc(p.height)}"></label>
      <label>Goal<select id="pGoal">${["Build muscle", "Get stronger", "Lose fat", "Stay fit"].map((g) => `<option ${g === p.goal ? "selected" : ""}>${g}</option>`).join("")}</select></label>
      <label>Workouts per week goal<input type="number" id="pTarget" value="${esc(p.weeklyTarget)}" min="1" max="7"></label>
      <label>Rest, big lifts (sec)<input type="number" id="pRestC" value="${esc(p.restCompound)}" step="15"></label>
      <label>Rest, small lifts (sec)<input type="number" id="pRestI" value="${esc(p.restIsolation)}" step="15"></label>
      <label class="full">Spotify playlist link<input type="text" id="pPlaylist" value="${esc(p.playlist)}" placeholder="https://open.spotify.com/playlist/…"></label>
    </div>
    <button class="btn primary" id="saveProfile" style="margin-top:10px">Save profile</button></div>

  <div class="card"><h2>Bodyweight</h2>
    <div class="row"><input type="number" id="bwIn" step="0.1" placeholder="kg" style="max-width:120px"><input type="date" id="bwDate" value="${today()}" style="max-width:170px"><button class="btn" id="bwAdd">Add</button></div>
    <div id="bwChart" style="margin-top:10px"></div>
    ${w.length ? `<p class="small muted">Latest ${w.at(-1).kg} kg${w.length > 1 ? ` · ${w.at(-1).kg - w[0].kg >= 0 ? "+" : ""}${round1(w.at(-1).kg - w[0].kg)} kg since ${fmtShort(w[0].date)}` : ""}</p>` : `<p class="small muted">Log your weight once a week, at the same time of day, to see the trend.</p>`}</div>

  <div class="card"><h2>Badges</h2><div class="badge-grid">${BADGES.map((x) => `<div class="badge ${x[3](b) ? "on" : ""}"><span>${x[0]}</span><small>${esc(x[1])}</small><em>${esc(x[2])}</em></div>`).join("")}</div></div>

  <div class="card"><h2>Import from Arrow</h2>
    <p class="small ink2">Choose the <code>…arrow-export.json</code> file Arrow sent you. Workouts, sets, rest days, start times and durations are added and your streak is rebuilt. Importing twice won't create duplicates.</p>
    <input type="file" id="arrowFile" accept=".json,application/json"></div>
  <div class="card"><h2>Backup</h2>
    <p class="small ink2">Your data lives only on this device. Download a backup every week or so. You can restore it here or on a new phone.</p>
    <div class="row wrap"><button class="btn primary" id="exportBtn">Download backup</button>
    <label class="btn">Restore backup<input type="file" id="restoreFile" accept=".json" hidden></label></div></div>
  <div class="card"><h2>Routines</h2><p class="small muted">One exercise per line. The routine for each weekday is suggested on Home.</p>
    <div id="routines"></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addRoutine">+ Add routine</button><button class="btn primary" id="saveRoutines">Save routines</button></div></div>
  <div class="card"><h2>Danger zone</h2><button class="btn danger" id="resetBtn">Delete all data on this device</button></div>
  <p class="small muted" style="text-align:center">Lift Log · free and open source · data stays on your device</p>`;

  $("#saveProfile").onclick = () => {
    Object.assign(p, { name: $("#pName").value.trim(), avatar: $("#pAvatar").value.trim(), height: $("#pHeight").value, goal: $("#pGoal").value,
      weeklyTarget: +$("#pTarget").value || 5, restCompound: +$("#pRestC").value || 120, restIsolation: +$("#pRestI").value || 75, playlist: $("#pPlaylist").value.trim() });
    if (p.playlist && !spotifyEmbed(p.playlist)) toast("Playlist saved, but that doesn't look like a Spotify link");
    else toast("Profile saved");
    save(); render();
  };
  $("#bwAdd").onclick = () => {
    const kg = num($("#bwIn").value), d = $("#bwDate").value || today(); if (!kg) return;
    S.weights = S.weights.filter((x) => x.date !== d); S.weights.push({ date: d, kg }); save(); renderProfile();
  };
  if (w.length) lineChart($("#bwChart"), w.map((x) => ({ date: x.date, v: x.kg })), " kg", { h: 170 });

  const rbox = $("#routines");
  rbox.innerHTML = S.routines.map((r, i) => `<div class="card inner" data-ri="${i}">
    <div class="row"><input type="text" data-k="name" value="${esc(r.name)}">
    <select data-k="day" style="width:90px">${["-", ...DAYS].map((d, j) => `<option value="${j - 1}" ${r.day === j - 1 ? "selected" : ""}>${d}</option>`).join("")}</select>
    <button class="btn small danger" data-rm="${i}">✕</button></div>
    <textarea data-k="exercises" style="margin-top:6px">${esc(r.exercises.join("\n"))}</textarea></div>`).join("");
  $$("[data-rm]", rbox).forEach((bt) => (bt.onclick = () => { readRoutines(); S.routines.splice(+bt.dataset.rm, 1); save(); renderProfile(); }));
  $("#addRoutine").onclick = () => { readRoutines(); S.routines.push({ name: "New routine", day: -1, exercises: [] }); save(); renderProfile(); };
  $("#saveRoutines").onclick = () => { readRoutines(); save(); toast("Routines saved"); };

  $("#arrowFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const res = importArrow(JSON.parse(await f.text())); invalidate(); save(); toast(`Imported ${res.workouts} workouts and ${res.rest} rest days`); tab = "home"; render(); }
    catch (err) { console.error(err); toast("That doesn't look like an Arrow export"); }
  };
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ ...S, timer: null, exportedAt: new Date().toISOString() }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `liftlog-backup-${today()}.json`; a.click();
  };
  $("#restoreFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.version || !Array.isArray(d.workouts)) throw new Error("bad");
      if (!confirm("Replace the data on this device with this backup?")) return;
      S = migrate(d); delete S.exportedAt; invalidate(); save(); toast("Backup restored"); render();
    } catch (err) { toast("That isn't a Lift Log backup"); }
  };
  $("#resetBtn").onclick = () => { if (confirm("Delete ALL workouts, rest days and routines on this device? Download a backup first if unsure.")) { S = blank(); invalidate(); save(); render(); } };
}
function readRoutines() {
  $$("[data-ri]").forEach((el) => {
    const r = S.routines[+el.dataset.ri];
    r.name = $("[data-k=name]", el).value.trim() || "Routine";
    r.day = +$("[data-k=day]", el).value;
    r.exercises = $("[data-k=exercises]", el).value.split("\n").map((s) => s.trim()).filter(Boolean);
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

// ---------- boot ----------
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
