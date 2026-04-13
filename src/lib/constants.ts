// ── Card section header colors ────────────────────────────────────
// Used for "What is this?", "Why it matters", "Candidates" headings.
// These are fixed across all cards.
export const SECTION_COLORS = {
  whatIsThis: "#38bdf8",     // sky-400
  whyItMatters: "#fbbf24",   // amber-300
  candidates: "#34d399",     // emerald-400
};

// ── Election level badge colors ──────────────────────────────────
// Used on the labeled badges in each card. Chosen to NOT overlap
// with section header colors or map colors.
export const LEVEL_COLORS: Record<string, string> = {
  federal: "#a78bfa",        // violet-400
  state: "#fb923c",          // orange-400
  county: "#2dd4bf",         // teal-400
  municipal: "#c084fc",      // purple-400
  special_district: "#f472b6", // pink-400
};

// ── Map color system ─────────────────────────────────────────────
// Single hue (cyan), varied by intensity. No overlap with badges.
export const MAP_COLORS = {
  active: "#06b6d4",         // cyan-500 — regions with elections
  activeFill: "#083344",
  inactive: "#1e293b",       // regions without elections
  hover: "#22d3ee",          // cyan-400 — hovered
  hoverFill: "#0e4558",
  locked: "#ffffff",         // locked/pinned
  lockedFill: "#164e63",
};
