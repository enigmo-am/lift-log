// Built-in avatars (original flat illustrations). Each returns SVG markup for a 64×64 viewBox.
const AVATARS = {
  kettle: { name: "Kettlebell", bg: "#2563eb", svg: `
    <path d="M22 26c0-9 4-13 10-13s10 4 10 13" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
    <circle cx="32" cy="38" r="15" fill="#1e293b"/>
    <circle cx="27" cy="36" r="2.4" fill="#fff"/><circle cx="37" cy="36" r="2.4" fill="#fff"/>
    <path d="M27 43q5 4 10 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  dumbbell: { name: "Dumbbell", bg: "#f97316", svg: `
    <rect x="12" y="22" width="8" height="20" rx="2" fill="#1f2937"/><rect x="44" y="22" width="8" height="20" rx="2" fill="#1f2937"/>
    <rect x="7" y="26" width="5" height="12" rx="1.5" fill="#374151"/><rect x="52" y="26" width="5" height="12" rx="1.5" fill="#374151"/>
    <rect x="20" y="28" width="24" height="8" rx="3" fill="#e5e7eb"/>
    <circle cx="28" cy="32" r="1.6" fill="#1f2937"/><circle cx="36" cy="32" r="1.6" fill="#1f2937"/>` },
  bear: { name: "Bear", bg: "#a16207", svg: `
    <circle cx="19" cy="20" r="7" fill="#78350f"/><circle cx="45" cy="20" r="7" fill="#78350f"/>
    <circle cx="32" cy="35" r="17" fill="#92400e"/><ellipse cx="32" cy="41" rx="8" ry="6" fill="#fde68a"/>
    <circle cx="25" cy="31" r="2.3" fill="#111"/><circle cx="39" cy="31" r="2.3" fill="#111"/><ellipse cx="32" cy="38.5" rx="2.6" ry="2" fill="#111"/>` },
  fox: { name: "Fox", bg: "#0d9488", svg: `
    <path d="M14 14l10 12h16l10-12-2 22-16 16-16-16z" fill="#ea580c"/>
    <path d="M22 38l10 14 10-14-10 4z" fill="#fff7ed"/>
    <circle cx="25" cy="32" r="2.2" fill="#111"/><circle cx="39" cy="32" r="2.2" fill="#111"/><circle cx="32" cy="45" r="2" fill="#111"/>` },
  owl: { name: "Owl", bg: "#7c3aed", svg: `
    <path d="M16 18l6 6h20l6-6v26q0 10-16 10T16 44z" fill="#4c1d95"/>
    <circle cx="25" cy="31" r="7" fill="#fff"/><circle cx="39" cy="31" r="7" fill="#fff"/>
    <circle cx="25" cy="31" r="3" fill="#111"/><circle cx="39" cy="31" r="3" fill="#111"/><path d="M29 38l3 4 3-4z" fill="#f59e0b"/>` },
  shark: { name: "Shark", bg: "#0ea5e9", svg: `
    <path d="M26 24l8-14 6 14z" fill="#334155"/><ellipse cx="32" cy="36" rx="20" ry="15" fill="#475569"/>
    <path d="M14 40q18 14 36 0q-18 6-36 0z" fill="#f1f5f9"/>
    <path d="M20 41l3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3" stroke="#fff" stroke-width="1.5" fill="none"/>
    <circle cx="25" cy="32" r="2.4" fill="#111"/><circle cx="39" cy="32" r="2.4" fill="#111"/>` },
  robot: { name: "Robot", bg: "#16a34a", svg: `
    <line x1="32" y1="9" x2="32" y2="17" stroke="#e5e7eb" stroke-width="3"/><circle cx="32" cy="9" r="3" fill="#facc15"/>
    <rect x="15" y="17" width="34" height="30" rx="8" fill="#e5e7eb"/><rect x="20" y="24" width="24" height="11" rx="5" fill="#111827"/>
    <circle cx="27" cy="29.5" r="2.5" fill="#22d3ee"/><circle cx="37" cy="29.5" r="2.5" fill="#22d3ee"/><rect x="25" y="39" width="14" height="3" rx="1.5" fill="#9ca3af"/>` },
  flame: { name: "Flame", bg: "#dc2626", svg: `
    <path d="M32 9c3 9 14 13 14 27a14 14 0 0 1-28 0c0-7 4-10 6-14 1 5 3 7 5 7-1-8 0-14 3-20z" fill="#fbbf24"/>
    <path d="M32 30c2 5 7 7 7 13a7 7 0 0 1-14 0c0-4 3-6 4-9 0 3 1 4 3 4z" fill="#fff7ed"/>
    <circle cx="28" cy="40" r="1.6" fill="#7c2d12"/><circle cx="36" cy="40" r="1.6" fill="#7c2d12"/>` },
  rocket: { name: "Rocket", bg: "#1e3a8a", svg: `
    <circle cx="12" cy="14" r="1.2" fill="#fff"/><circle cx="50" cy="20" r="1" fill="#fff"/><circle cx="46" cy="50" r="1.2" fill="#fff"/>
    <path d="M32 8c8 6 10 16 9 28H23c-1-12 1-22 9-28z" fill="#f8fafc"/><circle cx="32" cy="24" r="4.5" fill="#38bdf8" stroke="#1e3a8a" stroke-width="2"/>
    <path d="M23 30l-7 10 8-2zM41 30l7 10-8-2z" fill="#ef4444"/><path d="M27 38h10l-2 10-3-4-3 4z" fill="#f59e0b"/>` },
  mountain: { name: "Summit", bg: "#0891b2", svg: `
    <circle cx="46" cy="18" r="5" fill="#fde047"/>
    <path d="M6 50l18-26 8 10 8-14 18 30z" fill="#164e63"/><path d="M24 24l5 7-3 2-2-3-3 3-2-1zM40 20l5 9-3-1-2 2-2-2-2 1z" fill="#f0f9ff"/>
    <path d="M38 20v-8l6 3-6 2" fill="#ef4444" stroke="#f0f9ff" stroke-width="1"/>` },
  lion: { name: "Lion", bg: "#ca8a04", svg: `
    <circle cx="32" cy="34" r="20" fill="#9a3412"/><circle cx="32" cy="35" r="13" fill="#fbbf24"/>
    <circle cx="27" cy="32" r="2" fill="#111"/><circle cx="37" cy="32" r="2" fill="#111"/>
    <path d="M29 38h6l-3 3z" fill="#7c2d12"/><path d="M28 43q4 3 8 0" stroke="#7c2d12" stroke-width="1.8" fill="none" stroke-linecap="round"/>` },
  panda: { name: "Panda", bg: "#db2777", svg: `
    <circle cx="18" cy="20" r="7" fill="#111"/><circle cx="46" cy="20" r="7" fill="#111"/><circle cx="32" cy="35" r="18" fill="#fff"/>
    <ellipse cx="25" cy="33" rx="5" ry="6" fill="#111" transform="rotate(-20 25 33)"/><ellipse cx="39" cy="33" rx="5" ry="6" fill="#111" transform="rotate(20 39 33)"/>
    <circle cx="25" cy="33" r="1.8" fill="#fff"/><circle cx="39" cy="33" r="1.8" fill="#fff"/><ellipse cx="32" cy="42" rx="3" ry="2" fill="#111"/>` },
};
let _avc = 0;
function avatarSVG(id) {
  const a = AVATARS[id]; if (!a) return "";
  const cid = "avc" + ++_avc;
  return `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><clipPath id="${cid}"><circle cx="32" cy="32" r="32"/></clipPath></defs>
    <g clip-path="url(#${cid})"><rect width="64" height="64" fill="${a.bg}"/>${a.svg}</g></svg>`;
}
