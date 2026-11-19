"use strict";
// Colour themes. Every theme is generated from one hue + saturation, with soft, low-glare values:
// light mode is never pure white-on-black, dark mode is never pure black.
const THEMES = {
  classic:  { name: "Classic",  h: 221, s: 70 },
  ocean:    { name: "Ocean",    h: 194, s: 58 },
  forest:   { name: "Forest",   h: 152, s: 34 },
  sunset:   { name: "Sunset",   h: 22,  s: 58 },
  lavender: { name: "Lavender", h: 258, s: 40 },
  sakura:   { name: "Sakura",   h: 342, s: 42 },
  sand:     { name: "Sand",     h: 38,  s: 34 },
  graphite: { name: "Graphite", h: 215, s: 12 },
};
// style: "solid" = neutral greys + coloured accent, "tint" = backgrounds lightly tinted with the theme hue,
// "glow" = tinted + a soft colour fade at the top of the screen.
function themeVars(id, mode, style) {
  const t = THEMES[id] || THEMES.classic, h = t.h, s = t.s;
  const ts = style === "solid" ? 0 : 1;               // background tint strength
  const hsl = (hh, ss, ll, a) => `hsl(${hh} ${Math.max(0, ss)}% ${ll}%${a != null ? ` / ${a}` : ""})`;
  if (mode === "dark") return {
    "--bg": hsl(h, 6 + 10 * ts, 8), "--card": hsl(h, 6 + 9 * ts, 11.5), "--line": hsl(h, 6 + 6 * ts, 19),
    "--ink": hsl(h, 8, 92), "--ink2": hsl(h, 7, 72), "--muted": hsl(h, 6, 54),
    "--accent": hsl(h, Math.min(s + 5, 70), 64), "--accent-ink": hsl(h, 30, 10),
    "--s0": hsl(h, 6 + 6 * ts, 17), "--s1": hsl(h, s * 0.55, 24), "--s2": hsl(h, s * 0.7, 34), "--s3": hsl(h, s * 0.8, 46),
    "--s4": hsl(h, s * 0.9, 62), "--s5": hsl(h, Math.min(s + 10, 80), 80),
    "--skin": hsl(h, 6, 26), "--glow": hsl(h, s, 45, 0.22), "--good": "#4ade80", "--warn": "#fbbf24",
  };
  return {
    "--bg": hsl(h, 8 + 22 * ts, 96.5), "--card": hsl(h, 20 * ts, 99.5), "--line": hsl(h, 10 + 10 * ts, 89),
    "--ink": hsl(h, 14, 12), "--ink2": hsl(h, 9, 34), "--muted": hsl(h, 6, 54),
    "--accent": hsl(h, s, s < 20 ? 38 : 45), "--accent-ink": "#ffffff",
    "--s0": hsl(h, 10 + 14 * ts, 92.5), "--s1": hsl(h, s * 0.8, 84), "--s2": hsl(h, s * 0.8, 71), "--s3": hsl(h, s * 0.8, 57),
    "--s4": hsl(h, s * 0.85, 43), "--s5": hsl(h, s * 0.9, 30),
    "--skin": hsl(h, 8, 84), "--glow": hsl(h, s, 70, 0.35), "--good": "#15803d", "--warn": "#b45309",
  };
}
const darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function currentMode(a) { return a.mode === "system" ? (darkMQ && darkMQ.matches ? "dark" : "light") : a.mode; }
function applyTheme(a) {
  a = Object.assign({ mode: "system", theme: "classic", style: "tint" }, a || {});
  const mode = currentMode(a), root = document.documentElement;
  Object.entries(themeVars(a.theme, mode, a.style)).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.mode = mode; root.dataset.style = a.style;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim();
}
function themePreview(id, mode) {
  const v = themeVars(id, mode, "glow");
  return `linear-gradient(135deg, ${v["--accent"]} 0 45%, ${v["--s1"]} 45% 70%, ${v["--bg"]} 70%)`;
}
// apply as early as possible to avoid a flash of the wrong theme
try { applyTheme((JSON.parse(localStorage.getItem("liftlog.v1")) || {}).appearance); } catch (e) { applyTheme(); }
