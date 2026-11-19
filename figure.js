// Low-poly anatomical figure (front + back). Shapes are drawn for the figure's left half
// and mirrored across x = 100. Each shape: [muscleKey | null, points]. null = non-muscle (skin).

const FIG_W = 200, FIG_H = 362;

const HEAD = [
  [null, "88,6 112,6 119,20 117,38 109,49 91,49 83,38 81,20"],
  [null, "91,49 109,49 110,62 90,62"],
];

const FRONT_HALF = [
  ["traps", "90,52 90,62 73,68 81,60"],
  ["frontDelts", "73,68 85,64 81,78 77,99 69,95 70,80"],
  ["sideDelts", "73,68 70,80 69,95 63,103 58,91 61,76"],
  ["chest", "85,64 99,64 99,84 81,84 81,78"],
  ["chest", "81,84 99,84 99,109 90,113 80,107 77,99"],
  ["biceps", "63,103 69,95 77,101 75,122 69,139 59,133 56,117"],
  ["forearms", "56,134 63,137 56,179 50,175 49,155"],
  ["forearms", "63,137 69,140 66,161 61,181 56,179"],
  [null, "50,176 61,182 62,195 56,205 48,197"],
  ["abs", "90,114 99,112 99,127 89,127"],
  ["abs", "89,128 99,128 99,141 89,141"],
  ["abs", "89,142 99,142 99,155 89,155"],
  ["abs", "89,156 99,156 99,178 93,172"],
  ["obliques", "80,108 89,114 88,127 88,155 84,163 78,149 78,127"],
  [null, "84,164 88,156 93,173 99,179 99,190 86,186 79,175"],
  ["quads", "76,168 84,186 84,232 80,261 74,250 71,210"],
  ["quads", "84,186 95,192 92,240 86,261 81,261 85,232"],
  ["quads", "96,193 99,197 98,236 94,261 87,261 93,240"],
  [null, "74,262 98,262 97,277 76,277"],
  ["calves", "72,283 77,279 80,339 74,329 70,305"],
  [null, "77,279 86,279 86,339 80,339"],
  ["calves", "86,279 96,279 94,309 88,337 86,339"],
  [null, "78,341 92,341 95,355 71,355"],
];

const BACK_HALF = [
  ["traps", "91,53 99,53 99,104 92,94 84,78 74,68"],
  ["rearDelts", "74,68 84,78 78,86 68,97 64,86"],
  ["sideDelts", "74,68 64,86 68,97 63,103 58,91 62,76"],
  ["upperBack", "84,78 92,94 88,104 77,101 78,86"],
  ["triceps", "63,103 70,96 77,101 75,122 69,139 59,133 56,117"],
  ["forearms", "56,134 63,137 56,179 50,175 49,155"],
  ["forearms", "63,137 69,140 66,161 61,181 56,179"],
  [null, "50,176 61,182 62,195 56,205 48,197"],
  ["lats", "77,101 88,104 93,121 96,149 88,159 80,139 78,118"],
  ["lowerBack", "89,105 99,105 99,167 91,165 96,150 93,121"],
  ["obliques", "78,119 80,140 88,160 84,166 78,150"],
  ["glutes", "84,167 91,166 99,168 99,200 90,206 78,198 76,180"],
  ["hamstrings", "76,200 88,206 86,250 80,261 74,250 72,216"],
  ["hamstrings", "88,206 99,202 98,240 94,261 87,261 86,250"],
  [null, "74,262 98,262 97,277 76,277"],
  ["calves", "76,278 86,280 86,318 80,330 72,306"],
  ["calves", "86,280 97,278 96,302 90,326 86,318"],
  [null, "80,330 90,326 88,341 81,341"],
  [null, "78,341 92,341 95,355 71,355"],
];

function mirrorPts(pts) {
  return pts.split(" ").map((p) => { const [x, y] = p.split(",").map(Number); return `${FIG_W - x},${y}`; }).join(" ");
}
function buildShapes(half) {
  const out = [...HEAD];
  for (const [k, pts] of half) { out.push([k, pts]); out.push([k, mirrorPts(pts)]); }
  return out;
}
const FIGURE_FRONT = buildShapes(FRONT_HALF);
const FIGURE_BACK = buildShapes(BACK_HALF);

// levelFn(muscleKey) -> 0..5 ; returns an SVG string
function figureSVG(shapes, levelFn, label, cls = "") {
  return `<svg class="figure ${cls}" viewBox="0 0 ${FIG_W} ${FIG_H + 14}" role="img" aria-label="${label} muscle map">
    ${shapes.map(([k, pts]) => k
      ? `<polygon class="m l${levelFn(k)}" data-m="${k}" points="${pts}"/>`
      : `<polygon class="skin" points="${pts}"/>`).join("")}
    ${label ? `<text x="100" y="${FIG_H + 12}">${label}</text>` : ""}
  </svg>`;
}
