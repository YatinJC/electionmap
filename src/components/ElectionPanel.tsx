"use client";

import { Election } from "@/types/elections";
import { LEVEL_COLORS, SECTION_COLORS } from "@/lib/constants";

const LEVEL_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  municipal: "Municipal",
  special_district: "Special District",
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  federal: "U.S. Senate, U.S. House",
  state: "Governor, state legislature, commissions",
  county: "County commission, DA, sheriff",
  municipal: "City council, mayor",
  special_district: "School board, water district, utilities",
};

function LevelBadge({ level }: { level: Election["level"] }) {
  const color = LEVEL_COLORS[level] || "#6b7280";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}
    >
      {LEVEL_LABELS[level] || level}
    </span>
  );
}

function ElectionCard({ election }: { election: Election }) {
  return (
    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 space-y-3 transition-all duration-200 hover:border-slate-600/80 hover:bg-slate-800/80">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white text-sm leading-tight">{election.office}</h3>
        <LevelBadge level={election.level} />
      </div>

      <p className="text-slate-500 text-xs">
        {election.district} &middot; {new Date(election.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <div className="space-y-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: SECTION_COLORS.whatIsThis }}>What is this?</h4>
          <p className="text-slate-300 text-sm leading-relaxed">{election.description}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: SECTION_COLORS.whyItMatters }}>Why it matters</h4>
          <p className="text-slate-200 text-sm leading-relaxed">{election.whyItMatters}</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: SECTION_COLORS.candidates }}>Candidates</h4>
        <div className="space-y-1.5">
          {election.candidates.map((candidate, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                backgroundColor:
                  candidate.party === "Democratic" ? "#3b82f6" :
                  candidate.party === "Republican" ? "#ef4444" :
                  "#6b7280"
              }} />
              <span className="text-white">{candidate.name}</span>
              <span className="text-slate-500 text-xs">({candidate.party})</span>
              {candidate.incumbent && (
                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Incumbent</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ElectionPanelProps {
  elections: Election[];
  regionName: string;
  isLocked: boolean;
  onUnlock: () => void;
}

export default function ElectionPanel({ elections, regionName, isLocked, onUnlock }: ElectionPanelProps) {
  if (elections.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="space-y-5 max-w-xs">
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-lg font-bold text-white mb-1.5">Explore the map</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Hover over any area to see every election happening there. Click to pin the view while you read.
              </p>
            </div>

            {/* How to use */}
            <div className="text-left space-y-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-widest">How to use</p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 mt-px">1.</span>
                  <span><span className="text-slate-300">Hover</span> to preview elections in any area</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 mt-px">2.</span>
                  <span><span className="text-slate-300">Click</span> to pin and scroll through details</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 mt-px">3.</span>
                  <span><span className="text-slate-300">Zoom in</span> to see county and district boundaries</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-slate-500 mt-px">4.</span>
                  <span><span className="text-slate-300">Esc</span> or click again to unlock</span>
                </div>
              </div>
            </div>

            {/* Election levels guide */}
            <div className="text-left space-y-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-widest">Election levels</p>
              <div className="space-y-2">
                {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                  <div key={level} className="flex items-start gap-2.5">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: color, opacity: 0.8 }}
                    />
                    <div>
                      <span className="text-slate-300 text-xs font-medium capitalize">
                        {level.replace("_", " ")}
                      </span>
                      <p className="text-slate-500 text-[11px] leading-tight">
                        {LEVEL_DESCRIPTIONS[level]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What the cards mean */}
            <div className="text-left space-y-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-widest">Each election shows</p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <span className="font-bold mt-px" style={{ color: SECTION_COLORS.whatIsThis }}>&bull;</span>
                  <span><span style={{ color: SECTION_COLORS.whatIsThis }}>What is this?</span> &mdash; what the office does</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold mt-px" style={{ color: SECTION_COLORS.whyItMatters }}>&bull;</span>
                  <span><span style={{ color: SECTION_COLORS.whyItMatters }}>Why it matters</span> &mdash; how it affects your life</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold mt-px" style={{ color: SECTION_COLORS.candidates }}>&bull;</span>
                  <span><span style={{ color: SECTION_COLORS.candidates }}>Candidates</span> &mdash; who is running</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group elections by level
  const byLevel: Record<string, Election[]> = {};
  for (const e of elections) {
    (byLevel[e.level] ??= []).push(e);
  }

  const levelOrder: Election["level"][] = ["federal", "state", "county", "municipal", "special_district"];
  const activeLevels = levelOrder.filter((l) => byLevel[l]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white text-lg">{regionName}</h2>
          {isLocked && (
            <button
              onClick={onUnlock}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded transition-colors"
              title="Unlock (Esc)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="5.5" width="8" height="5" rx="1" />
                <path d="M4 5.5V4a2 2 0 014 0v1.5" />
              </svg>
              Pinned
            </button>
          )}
        </div>
        <p className="text-slate-400 text-sm">
          {elections.length} election{elections.length !== 1 ? "s" : ""} across {activeLevels.length} level{activeLevels.length !== 1 ? "s" : ""} of government
        </p>
      </div>

      {/* Election cards grouped by level */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {levelOrder.map((level) => {
          const group = byLevel[level];
          if (!group) return null;
          const color = LEVEL_COLORS[level];
          return (
            <div key={level}>
              {/* Level section header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                  {LEVEL_LABELS[level]}
                </h3>
                <div className="flex-1 h-px" style={{ backgroundColor: color + "22" }} />
              </div>
              <div className="space-y-3">
                {group.map((election) => (
                  <ElectionCard key={election.id} election={election} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
