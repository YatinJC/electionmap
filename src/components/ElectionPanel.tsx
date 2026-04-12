"use client";

import { Election } from "@/types/elections";
import { LEVEL_COLORS } from "@/lib/constants";

function LevelBadge({ level }: { level: Election["level"] }) {
  const color = LEVEL_COLORS[level] || "#6b7280";
  const labels: Record<string, string> = {
    federal: "Federal",
    state: "State",
    county: "County",
    municipal: "Municipal",
    special_district: "Special District",
  };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: color + "22", color, border: `1px solid ${color}44` }}
    >
      {labels[level] || level}
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
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">What is this?</h4>
          <p className="text-slate-300 text-sm leading-relaxed">{election.description}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Why it matters</h4>
          <p className="text-slate-200 text-sm leading-relaxed">{election.whyItMatters}</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Candidates</h4>
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
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Explore the map</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Hover over any region to see elections happening there. Zoom in to reveal county-level races.
            </p>
          </div>
          <div className="space-y-1.5 text-left max-w-xs mx-auto pt-2">
            <p className="text-xs text-slate-600 uppercase font-semibold tracking-wide mb-2">Election levels</p>
            {Object.entries(LEVEL_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2.5 text-sm">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.8 }} />
                <span className="text-slate-400 capitalize">{level.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Group elections by level for a clean hierarchy
  const byLevel: Record<string, Election[]> = {};
  for (const e of elections) {
    (byLevel[e.level] ??= []).push(e);
  }

  const levelOrder: Election["level"][] = ["federal", "state", "county", "municipal", "special_district"];

  return (
    <div className="h-full flex flex-col">
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
          {elections.length} election{elections.length !== 1 ? "s" : ""} in this area
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {levelOrder.map((level) => {
          const group = byLevel[level];
          if (!group) return null;
          return group.map((election) => (
            <ElectionCard key={election.id} election={election} />
          ));
        })}
      </div>
    </div>
  );
}
