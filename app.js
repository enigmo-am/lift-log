"use strict";
// Lift Log: a small, free, offline workout logger. All data stays in this browser (localStorage).

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
let S = load();
function blank() {
  return { version: 1, name: "", workouts: [], restDays: [], routines: DEFAULT_ROUTINES, draft: null, unit: "kg" };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version) return Object.assign(blank(), s); } catch (e) {}
  return blank();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save — storage full or blocked"); }
}

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
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
const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + Math.min(r, 12) / 30) : 0);
function fmtSet(name, s) { return isBW(name) && !s.w ? `${s.r}` : `${round1(s.w)}×${s.r}`; }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
function weekStart(s) { const d = parseYmd(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return ymd(d); } // Monday

// ---------- derived data ----------
function sessionsByExercise() {
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
        volume: sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0),
        reps: Math.max(...sets.map((s) => s.r || 0)),
        totalReps: sets.reduce((a, s) => a + (s.r || 0), 0),
      });
    }
  }
  return map;
}
function lastSession(ex) { const l = sessionsByExercise()[ex]; return l ? l[l.length - 1] : null; }

function activeDays() {
  const set = new Set(S.restDays);
  for (const w of S.workouts) set.add(w.date);
  return set;
}
function streaks() {
  const days = activeDays();
  let cur = 0, d = today();
  if (!days.has(d)) d = addDays(d, -1); // today not logged yet: streak still alive
  while (days.has(d)) { cur++; d = addDays(d, -1); }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = null;
  for (const x of sorted) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
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

function coachFlags() {
  const flags = [];
  const t = today();
  for (const [ex, list] of Object.entries(sessionsByExercise())) {
    if (list.length < 2) continue;
    const bw = isBW(ex);
    const score = (x) => (bw ? x.reps : x.e1rm);
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
    if (score(last) > bestBefore && daysAgo <= 7) {
      flags.push({ kind: "good", ex, text: bw ? `New best: ${last.reps} reps` : `New best: ${round1(last.top)} kg × ${last.topReps}` });
      continue;
    }
    const cutoff = addDays(t, -35);
    const recent = list.filter((x) => x.date >= cutoff), older = list.filter((x) => x.date < cutoff);
    if (recent.length >= 3 && older.length && Math.max(...recent.map(score)) <= Math.max(...older.map(score)))
      flags.push({ kind: "warn", ex, text: `No new best in 5 weeks (${recent.length} sessions). Try a deload or a different rep range.` });
  }
  return flags.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "warn" ? -1 : 1));
}

// ---------- routing ----------
let tab = "today";
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const st = streaks();
  $("#streakBadge").innerHTML = `<span class="fl">🔥</span> ${st.cur}`;
  hideTip();
  ({ today: renderToday, history: renderHistory, progress: renderProgress, stats: renderStats, settings: renderSettings })[tab]();
}

// ---------- TODAY ----------
function routineForToday() {
  const d = new Date().getDay();
  return S.routines.find((r) => r.day === d) || S.routines[0];
}
function newDraft(routine) {
  return {
    date: today(), name: routine ? routine.name : "Workout",
    exercises: (routine ? routine.exercises : []).map((ex) => {
      const last = lastSession(ex);
      const n = last ? Math.max(3, Math.min(last.sets.length, 5)) : 3;
      return { ex, sets: Array.from({ length: n }, () => ({ w: "", r: "" })) };
    }),
  };
}
function renderToday() {
  const st = streaks();
  const v = $("#view");
  const totalSessions = S.workouts.filter((w) => (w.sets || []).length).length;
  const wkFrom = weekStart(today());
  const thisWeek = S.workouts.filter((w) => w.date >= wkFrom && (w.sets || []).length).length;
  let html = `
  <div class="card hero">
    <div class="stat"><div class="num">${st.cur}</div><div class="lbl">🔥 day streak</div></div>
    <div class="stat"><div class="num">${st.best}</div><div class="lbl">longest streak</div></div>
    <div class="stat"><div class="num">${thisWeek}</div><div class="lbl">sessions this week</div></div>
    <div class="stat"><div class="num">${totalSessions}</div><div class="lbl">total sessions</div></div>
  </div>`;

  if (!S.draft) {
    const r = routineForToday();
    html += `<div class="card">
      <h2>${st.loggedToday ? "Logged today ✓" : "Start today's workout"}</h2>
      <div class="row wrap" style="margin-bottom:10px">
        <select id="routineSel">${S.routines.map((x, i) => `<option value="${i}" ${x === r ? "selected" : ""}>${esc(x.name)} (${DAYS[x.day] ?? "-"})</option>`).join("")}
          <option value="-1">Empty workout</option></select>
      </div>
      <div class="row"><button class="btn primary" id="startBtn" style="flex:1">Start workout</button>
      <button class="btn" id="restBtn" ${st.loggedToday ? "disabled" : ""}>Rest day</button></div>
      <p class="small muted" style="margin:10px 0 0">Rest days keep your streak going, just like in Arrow.</p>
    </div>`;
    v.innerHTML = html;
    $("#startBtn").onclick = () => { const i = +$("#routineSel").value; S.draft = newDraft(S.routines[i]); save(); render(); };
    $("#restBtn").onclick = () => { if (!S.restDays.includes(today())) S.restDays.push(today()); save(); toast("Rest day logged. Streak safe 🔥"); render(); };
    return;
  }

  const D = S.draft;
  html += `<div class="card"><div class="row"><h2 style="margin:0">${esc(D.name)}</h2><span class="spacer"></span>
    <input type="date" id="draftDate" value="${D.date}" style="width:auto"></div>`;
  D.exercises.forEach((e, ei) => {
    const last = lastSession(e.ex);
    const bw = isBW(e.ex);
    html += `<div class="ex" data-ei="${ei}">
      <div class="ex-head"><span class="ex-name">${esc(e.ex)}</span><span class="spacer"></span>
        <button class="btn ghost small" data-act="rmex">Remove</button></div>
      <div class="last">${last ? `Last (${fmtShort(last.date)}): ${last.sets.map((s) => fmtSet(e.ex, s)).join(", ")}` : "First time, no history yet"}</div>
      <div class="set-head"><span>Set</span><span>${bw ? "Extra kg" : "kg"}</span><span>Reps</span><span></span></div>
      ${e.sets.map((s, si) => {
        const ls = last && last.sets[Math.min(si, last.sets.length - 1)];
        return `<div class="set" data-si="${si}"><span class="n">${si + 1}</span>
          <input type="number" inputmode="decimal" step="0.5" data-f="w" value="${s.w}" placeholder="${ls && ls.w ? round1(ls.w) : bw ? "0" : ""}">
          <input type="number" inputmode="numeric" data-f="r" value="${s.r}" placeholder="${ls ? ls.r : ""}">
          <button class="x" data-act="rmset" aria-label="Remove set">×</button></div>`;
      }).join("")}
      <button class="btn ghost small" data-act="addset">+ Add set</button>
    </div>`;
  });
  html += `<div class="row" style="margin-top:12px">
      <input type="text" id="addExName" list="exList" placeholder="Add exercise…">
      <button class="btn" id="addExBtn">Add</button></div>
    <datalist id="exList">${allExerciseNames().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <p class="small muted">Leave kg empty to reuse the grey number from last time. Sets without reps are skipped.</p>
    <div class="row" style="margin-top:8px"><button class="btn primary" id="finishBtn" style="flex:1">Finish workout</button>
    <button class="btn danger" id="discardBtn">Discard</button></div></div>`;
  v.innerHTML = html;

  $("#draftDate").onchange = (e) => { D.date = e.target.value || today(); save(); };
  v.querySelectorAll(".set input").forEach((inp) => inp.addEventListener("input", (e) => {
    const ei = +e.target.closest(".ex").dataset.ei, si = +e.target.closest(".set").dataset.si;
    D.exercises[ei].sets[si][e.target.dataset.f] = e.target.value; save();
  }));
  v.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => {
    const exEl = e.target.closest(".ex"), ei = +exEl.dataset.ei, act = e.target.dataset.act;
    if (act === "addset") D.exercises[ei].sets.push({ w: "", r: "" });
    if (act === "rmset") D.exercises[ei].sets.splice(+e.target.closest(".set").dataset.si, 1);
    if (act === "rmex") D.exercises.splice(ei, 1);
    save(); render();
  }));
  $("#addExBtn").onclick = () => {
    const n = $("#addExName").value.trim(); if (!n) return;
    D.exercises.push({ ex: n, sets: [{ w: "", r: "" }, { w: "", r: "" }, { w: "", r: "" }] }); save(); render();
  };
  $("#discardBtn").onclick = () => { if (confirm("Discard this workout?")) { S.draft = null; save(); render(); } };
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
      sets.push({ ex: e.ex, w, r });
    });
  });
  if (!sets.length) { toast("Add reps to at least one set first"); return; }
  S.workouts.push({ id: "w" + Date.now(), date: D.date, name: D.name, sets });
  S.draft = null; save();
  // count PRs
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

// ---------- HISTORY ----------
function renderHistory() {
  const items = [
    ...S.workouts.map((w) => ({ type: "w", date: w.date, w })),
    ...S.restDays.map((d) => ({ type: "r", date: d })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) { $("#view").innerHTML = `<div class="card">Nothing logged yet. Import your Arrow history in Settings, or log today's workout.</div>`; return; }
  let html = "";
  for (const it of items.slice(0, 300)) {
    if (it.type === "r") { html += `<div class="card row"><span>${fmtDate(it.date)}</span><span class="spacer"></span><span class="pill">Rest day</span></div>`; continue; }
    const w = it.w, per = {};
    (w.sets || []).forEach((s) => (per[s.ex] ||= []).push(s));
    const vol = (w.sets || []).reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0);
    html += `<div class="card sess" data-id="${w.id}">
      <div class="row"><div><div style="font-weight:600">${esc(w.name)}</div><div class="small muted">${fmtDate(w.date)}</div></div>
      <span class="spacer"></span><div class="small ink2" style="text-align:right">${(w.sets || []).length} sets<br>${Math.round(vol).toLocaleString()} kg</div></div>
      <div class="sess-detail" hidden>
        ${Object.entries(per).map(([ex, ss]) => `<div><b>${esc(ex)}</b>: ${ss.map((s) => fmtSet(ex, s)).join(", ")}</div>`).join("") || "<div>Cardio / activity</div>"}
        <button class="btn small danger" data-del="${w.id}" style="margin-top:8px">Delete session</button>
      </div></div>`;
  }
  $("#view").innerHTML = html;
  document.querySelectorAll(".sess").forEach((c) => c.addEventListener("click", (e) => {
    if (e.target.dataset.del) {
      if (confirm("Delete this session?")) { S.workouts = S.workouts.filter((w) => w.id !== e.target.dataset.del); save(); render(); }
      return;
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
  if (!progEx || !map[progEx]) progEx = names[0];
  const bw = isBW(progEx);
  const metrics = bw ? [["reps", "Best reps"], ["totalReps", "Total reps"]] : [["top", "Top weight"], ["e1rm", "Est. 1RM"], ["volume", "Volume"]];
  if (!metrics.find((m) => m[0] === progMetric)) progMetric = metrics[0][0];
  const list = map[progEx];
  const vals = list.map((x) => x[progMetric]);
  const first = vals[0], last = vals[vals.length - 1], best = Math.max(...vals);
  const unit = progMetric === "reps" || progMetric === "totalReps" ? " reps" : " kg";
  const change = first ? Math.round(((last - first) / first) * 100) : 0;

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
      <table class="data"><tr><th>Date</th><th>Sets</th><th>${metrics.find((m) => m[0] === progMetric)[1]}</th></tr>
      ${[...list].reverse().map((x) => `<tr><td>${fmtShort(x.date)}</td><td>${x.sets.map((s) => fmtSet(progEx, s)).join(", ")}</td><td>${round1(x[progMetric])}</td></tr>`).join("")}</table>
    </details>
  </div>
  <div class="card"><h2>Coach notes</h2><div id="flags"></div></div>`;
  $("#exSel").onchange = (e) => { progEx = e.target.value; renderProgress(); };
  document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { progMetric = b.dataset.m; renderProgress(); }));
  lineChart($("#chartBox"), list.map((x) => ({ date: x.date, v: x[progMetric], sets: x.sets })), unit, progEx);
  renderFlags($("#flags"));
}
function renderFlags(el) {
  const f = coachFlags();
  el.innerHTML = f.length ? f.map((x) => `<div class="flag ${x.kind}"><span class="ic">${x.kind === "good" ? "▲" : "!"}</span><div><b>${esc(x.ex)}</b><br><span class="ink2">${esc(x.text)}</span></div></div>`).join("")
    : `<p class="muted small">Nothing to flag in the last 3 weeks. Keep logging.</p>`;
}

function lineChart(box, pts, unit, ex) {
  const W = 360, H = 200, L = 34, R = 10, T = 12, B = 24;
  if (pts.length === 1) pts = [pts[0], pts[0]];
  const t0 = parseYmd(pts[0].date).getTime(), t1 = parseYmd(pts[pts.length - 1].date).getTime() || t0 + 1;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const padv = (hi - lo) * 0.15 || hi * 0.1 || 1; lo = Math.max(0, lo - padv); hi += padv;
  const x = (d) => L + ((parseYmd(d).getTime() - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = niceTicks(lo, hi, 4);
  let runMax = -Infinity;
  const pr = pts.map((p) => { const isPr = p.v > runMax; runMax = Math.max(runMax, p.v); return isPr; });
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const xt = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ex)} progress">
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${round1(t)}</text>`).join("")}
    ${xt.map((p, i) => `<text class="axis" x="${x(p.date)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}">${fmtShort(p.date)}</text>`).join("")}
    <path class="line" d="${path}"/>
    ${pts.map((p, i) => `<circle class="${pr[i] ? "pr" : "dot"}" cx="${x(p.date)}" cy="${y(p.v)}" r="${pr[i] ? 5 : 4}"/>`).join("")}
    <line class="cross" id="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <rect id="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
  </svg>`;
  const svg = $("svg", box), cross = $("#cross", box);
  const move = (ev) => {
    const pt = svg.getBoundingClientRect(), cx = ((ev.clientX - pt.left) / pt.width) * W;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(x(p.date) - cx); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi];
    cross.setAttribute("x1", x(p.date)); cross.setAttribute("x2", x(p.date)); cross.setAttribute("visibility", "visible");
    showTip(ev.clientX, ev.clientY, `<b>${fmtDate(p.date)}</b><br>${round1(p.v)}${unit}${pr[bi] ? " · new best" : ""}<br>${p.sets.map((s) => fmtSet(ex, s)).join(", ")}`);
  };
  const out = () => { cross.setAttribute("visibility", "hidden"); hideTip(); };
  $("#hit", box).addEventListener("pointermove", move);
  $("#hit", box).addEventListener("pointerdown", move);
  $("#hit", box).addEventListener("pointerleave", out);
}
function niceTicks(lo, hi, n) {
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}
function showTip(cx, cy, html) {
  const t = $("#tooltip"); t.innerHTML = html; t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = cx + 12, top = cy - r.height - 12;
  if (left + r.width > innerWidth - 8) left = cx - r.width - 12;
  if (top < 8) top = cy + 16;
  t.style.left = left + "px"; t.style.top = top + "px";
}
function hideTip() { const t = $("#tooltip"); if (t) t.hidden = true; }

// ---------- STATS ----------
let statWeek = 0; // 0 = this week, 1 = last week ...
function renderStats() {
  const from = addDays(weekStart(today()), -7 * statWeek), to = addDays(from, 6);
  const ms = muscleSets(from, to);
  const lvl = (k) => { const r = ms[k] / WEEKLY_TARGET[k]; return ms[k] === 0 ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : r < 1 ? 4 : 5; };
  const body = (shapes, label) => `<svg viewBox="0 0 100 222">${BODY_BASE}${shapes.map(([k, el]) =>
    el.replace(/^<(\w+)/, `<$1 class="m l${lvl(k)}" data-m="${k}"`)).join("")}<text x="50" y="220">${label}</text></svg>`;
  const st = streaks();
  const allSets = S.workouts.reduce((a, w) => a + (w.sets || []).length, 0);
  const allVol = S.workouts.reduce((a, w) => a + (w.sets || []).reduce((b, s) => b + (s.w || 0) * (s.r || 0), 0), 0);
  const order = Object.keys(MUSCLES).sort((a, b) => ms[a] / WEEKLY_TARGET[a] - ms[b] / WEEKLY_TARGET[b]);
  const maxV = Math.max(...Object.keys(MUSCLES).map((k) => Math.max(ms[k], WEEKLY_TARGET[k])));

  $("#view").innerHTML = `
  <div class="card">
    <div class="row"><h2 style="margin:0">Muscles trained</h2><span class="spacer"></span>
      <button class="btn small" id="wkPrev">‹</button>
      <span class="small ink2" style="min-width:110px;text-align:center">${statWeek === 0 ? "This week" : statWeek === 1 ? "Last week" : fmtShort(from) + " – " + fmtShort(to)}</span>
      <button class="btn small" id="wkNext" ${statWeek === 0 ? "disabled" : ""}>›</button></div>
    <div class="body-wrap" style="margin-top:10px">${body(BODY_FRONT, "Front")}${body(BODY_BACK, "Back")}</div>
    <div class="legend"><span>Sets vs weekly target:</span>
      <span><i style="background:var(--s0)"></i>none</span><span><i style="background:var(--s2)"></i>&lt;50%</span>
      <span><i style="background:var(--s3)"></i>50–75%</span><span><i style="background:var(--s4)"></i>75–99%</span><span><i style="background:var(--s5)"></i>hit target</span></div>
    <p class="small muted">Tap a muscle for details. Main muscle worked = 1 set, helper muscle = ½ set.</p>
  </div>
  <div class="card"><h2>Sets per muscle</h2>
    <div class="bars">${order.map((k) => `<div class="b"><span>${MUSCLES[k]}</span>
      <div class="track"><div class="fill" style="width:${(ms[k] / maxV) * 100}%"></div><div class="target" style="left:${(WEEKLY_TARGET[k] / maxV) * 100}%"></div></div>
      <span class="v">${round1(ms[k])}/${WEEKLY_TARGET[k]}</span></div>`).join("")}</div>
    <p class="small muted">Dark tick = weekly target. Sorted with the least-trained muscles on top.</p>
  </div>
  <div class="card"><h2>Consistency</h2>
    <div class="hero" style="margin-bottom:12px">
      <div class="stat"><div class="num">🔥 ${st.cur}</div><div class="lbl">current streak</div></div>
      <div class="stat"><div class="num">${st.best}</div><div class="lbl">longest streak</div></div>
    </div>
    <div class="cal" id="cal"></div>
    <div class="legend"><span><i style="background:var(--s0)"></i>no log</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--s2)"></i>rest day</span>
      <span><i style="background:var(--s2)"></i>light</span><span><i style="background:var(--s3)"></i>medium</span><span><i style="background:var(--s4)"></i>big session</span></div>
  </div>
  <div class="card"><h2>Sessions per week</h2><div id="wkChart"></div></div>
  <div class="card"><h2>All time</h2><div class="hero">
    <div class="stat"><div class="num">${S.workouts.filter((w) => (w.sets || []).length).length}</div><div class="lbl">sessions</div></div>
    <div class="stat"><div class="num">${allSets.toLocaleString()}</div><div class="lbl">sets</div></div>
    <div class="stat"><div class="num">${(allVol / 1000).toFixed(1)}t</div><div class="lbl">lifted</div></div></div></div>`;

  $("#wkPrev").onclick = () => { statWeek++; renderStats(); };
  $("#wkNext").onclick = () => { statWeek = Math.max(0, statWeek - 1); renderStats(); };
  document.querySelectorAll(".m").forEach((el) => {
    const f = (ev) => { const k = el.dataset.m; showTip(ev.clientX, ev.clientY, `<b>${MUSCLES[k]}</b><br>${round1(ms[k])} of ${WEEKLY_TARGET[k]} sets`); };
    el.addEventListener("pointerenter", f); el.addEventListener("pointerdown", f); el.addEventListener("pointerleave", hideTip);
  });
  calendar($("#cal"));
  weeklyBars($("#wkChart"));
}
function calendar(el) {
  const weeks = 26, end = today();
  const start = addDays(weekStart(end), -7 * (weeks - 1));
  const vol = {}, rest = new Set(S.restDays);
  S.workouts.forEach((w) => (vol[w.date] = (vol[w.date] || 0) + Math.max(1, (w.sets || []).length)));
  let html = "";
  for (let d = start; d <= addDays(weekStart(end), 6); d = addDays(d, 1)) {
    const v = vol[d] || 0;
    const cls = d > end ? "future" : v ? (v < 12 ? "l1" : v < 20 ? "l2" : "l3") : rest.has(d) ? "rest" : "";
    html += `<div class="${cls}" data-d="${d}" data-v="${v}"></div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll("div[data-d]").forEach((c) => {
    const f = (ev) => { const d = c.dataset.d, v = +c.dataset.v; showTip(ev.clientX, ev.clientY, `<b>${fmtDate(d)}</b><br>${v ? v + " sets" : rest.has(d) ? "Rest day" : "Nothing logged"}`); };
    c.addEventListener("pointerenter", f); c.addEventListener("pointerdown", f); c.addEventListener("pointerleave", hideTip);
  });
  el.scrollLeft = el.scrollWidth;
}
function weeklyBars(el) {
  const n = 12, cur = weekStart(today()), data = [];
  for (let i = n - 1; i >= 0; i--) {
    const ws = addDays(cur, -7 * i), we = addDays(ws, 6);
    data.push({ ws, c: S.workouts.filter((w) => w.date >= ws && w.date <= we && (w.sets || []).length).length });
  }
  const W = 360, H = 140, L = 22, B = 22, T = 10, max = Math.max(6, ...data.map((d) => d.c));
  const bw = (W - L) / n;
  const y = (v) => T + (1 - v / max) * (H - T - B);
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">
    ${[0, 2, 4, 6].filter((t) => t <= max).map((t) => `<line class="grid" x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
    ${data.map((d, i) => d.c ? `<path d="M${L + i * bw + 3},${y(0)} V${y(d.c) + 4} q0,-4 4,-4 H${L + (i + 1) * bw - 7} q4,0 4,4 V${y(0)} Z" fill="var(--accent)" data-i="${i}"/>` : "").join("")}
    ${data.map((d, i) => (i % 3 === 0 || i === n - 1) ? `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${fmtShort(d.ws)}</text>` : "").join("")}
    ${data.map((d, i) => `<rect x="${L + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-i="${i}" class="hitb"/>`).join("")}
  </svg>`;
  el.querySelectorAll(".hitb").forEach((r) => {
    const f = (ev) => { const d = data[+r.dataset.i]; showTip(ev.clientX, ev.clientY, `<b>Week of ${fmtShort(d.ws)}</b><br>${d.c} session${d.c === 1 ? "" : "s"}`); };
    r.addEventListener("pointerenter", f); r.addEventListener("pointerdown", f); r.addEventListener("pointerleave", hideTip);
  });
}

// ---------- SETTINGS ----------
function renderSettings() {
  $("#view").innerHTML = `
  <div class="card"><h2>Import from Arrow</h2>
    <p class="small ink2">Choose the <code>…arrow-export.json</code> file Arrow sent you. Your workouts, sets and rest days are added and your streak is rebuilt. Importing the same file twice won't create duplicates.</p>
    <input type="file" id="arrowFile" accept=".json,application/json"></div>
  <div class="card"><h2>Backup</h2>
    <p class="small ink2">Your data lives only on this device. Download a backup now and then. You can restore it here or on a new phone.</p>
    <div class="row wrap"><button class="btn primary" id="exportBtn">Download backup</button>
    <label class="btn">Restore backup<input type="file" id="restoreFile" accept=".json" hidden></label></div></div>
  <div class="card"><h2>Routines</h2>
    <p class="small muted">One exercise per line. The routine for each weekday is suggested on the Today tab.</p>
    <div id="routines"></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addRoutine">+ Add routine</button><button class="btn primary" id="saveRoutines">Save routines</button></div></div>
  <div class="card"><h2>Danger zone</h2><button class="btn danger" id="resetBtn">Delete all data on this device</button></div>
  <p class="small muted" style="text-align:center">Lift Log · free and open source · data stays on your device</p>`;

  const rbox = $("#routines");
  rbox.innerHTML = S.routines.map((r, i) => `<div class="card" style="padding:10px" data-ri="${i}">
    <div class="row"><input type="text" data-k="name" value="${esc(r.name)}">
    <select data-k="day" style="width:90px">${["-", ...DAYS].map((d, j) => `<option value="${j - 1}" ${r.day === j - 1 ? "selected" : ""}>${d}</option>`).join("")}</select>
    <button class="btn small danger" data-rm="${i}">✕</button></div>
    <textarea data-k="exercises" style="margin-top:6px">${esc(r.exercises.join("\n"))}</textarea></div>`).join("");
  rbox.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { readRoutines(); S.routines.splice(+b.dataset.rm, 1); save(); renderSettings(); }));
  $("#addRoutine").onclick = () => { readRoutines(); S.routines.push({ name: "New routine", day: -1, exercises: [] }); save(); renderSettings(); };
  $("#saveRoutines").onclick = () => { readRoutines(); save(); toast("Routines saved"); };

  $("#arrowFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const res = importArrow(JSON.parse(await f.text())); save(); toast(`Imported ${res.workouts} sessions and ${res.rest} rest days`); tab = "today"; render(); }
    catch (err) { console.error(err); toast("That doesn't look like an Arrow export"); }
  };
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ ...S, exportedAt: new Date().toISOString() }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `liftlog-backup-${today()}.json`; a.click();
  };
  $("#restoreFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.version || !Array.isArray(d.workouts)) throw new Error("bad");
      if (!confirm("Replace the data on this device with this backup?")) return;
      S = Object.assign(blank(), d); delete S.exportedAt; save(); toast("Backup restored"); render();
    } catch (err) { toast("That isn't a Lift Log backup"); }
  };
  $("#resetBtn").onclick = () => {
    if (confirm("Delete ALL workouts, rest days and routines on this device? Download a backup first if unsure.")) { S = blank(); save(); render(); }
  };
}
function readRoutines() {
  document.querySelectorAll("[data-ri]").forEach((el) => {
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
  const local = (iso) => { const d = new Date(new Date(iso).getTime() + off * 3600e3); return d.toISOString().slice(0, 10); };

  const setsBy = {};
  for (const p of data.PersonalExercise) {
    if (p.reps == null && p.weight == null) continue;
    let w = +p.weight || 0, r = +p.reps || 0;
    if (!isBW(p.exercise) && r >= 40 && w > 0 && w < r && w <= 15) [w, r] = [r, w]; // obvious weight/reps swap
    if (isBW(p.exercise)) w = 0; // Arrow stores bodyweight here
    (setsBy[p.workoutID] ||= []).push({ ex: p.exercise.trim(), w, r, o: p.order ?? 0, n: p.sets ?? 0, t: p.date });
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
    if (!w.date) continue; // planned, not done
    const id = "arrow-" + (w.workoutID || w.id);
    if (existing.has(id)) continue;
    const sets = (setsBy[w.workoutID] || []).sort((a, b) => a.o - b.o || a.n - b.n).map(({ ex, w, r }) => ({ ex, w, r }));
    S.workouts.push({ id, date: local(w.date), name: prog && prog !== "-none-" ? prog : sets.length ? "Workout" : "Activity", sets, source: "arrow" });
    nW++;
  }
  S.restDays.sort();
  return { workouts: nW, rest: nR };
}

// ---------- boot ----------
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
