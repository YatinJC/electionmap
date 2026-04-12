"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import ElectionPanel from "@/components/ElectionPanel";
import { Election } from "@/types/elections";

const ElectionMap = dynamic(() => import("@/components/ElectionMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [hoveredElections, setHoveredElections] = useState<Election[]>([]);
  const [hoveredRegionName, setHoveredRegionName] = useState("");

  // Locked (clicked) state
  const [lockedElections, setLockedElections] = useState<Election[]>([]);
  const [lockedRegionName, setLockedRegionName] = useState("");
  const [lockedRegionKey, setLockedRegionKey] = useState<string | null>(null);

  const isLocked = lockedRegionKey !== null;

  // What the panel shows: locked state takes priority
  const displayElections = isLocked ? lockedElections : hoveredElections;
  const displayRegionName = isLocked ? lockedRegionName : hoveredRegionName;

  const handleHoverElections = useCallback(
    (elections: Election[], name: string) => {
      setHoveredElections(elections);
      setHoveredRegionName(name);
    },
    []
  );

  const handleClearHover = useCallback(() => {
    setHoveredElections([]);
    setHoveredRegionName("");
  }, []);

  const handleClickRegion = useCallback(
    (elections: Election[], name: string, regionKey: string) => {
      if (lockedRegionKey === regionKey) {
        // Clicking the same region unlocks
        setLockedElections([]);
        setLockedRegionName("");
        setLockedRegionKey(null);
      } else {
        setLockedElections(elections);
        setLockedRegionName(name);
        setLockedRegionKey(regionKey);
      }
    },
    [lockedRegionKey]
  );

  const handleUnlock = useCallback(() => {
    setLockedElections([]);
    setLockedRegionName("");
    setLockedRegionKey(null);
  }, []);

  // Escape key unlocks
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleUnlock();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUnlock]);

  return (
    <div className="h-full flex flex-col">
      {/* Header — game-style HUD bar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 px-5 py-2.5 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white tracking-tight">
            ElectionMap
          </h1>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono uppercase tracking-widest">
            Beta
          </span>
        </div>
        <p className="text-slate-400 text-sm hidden sm:block">
          Every Election, Everywhere
        </p>
        <p className="text-slate-500 text-xs hidden sm:block font-mono">
          {isLocked
            ? "Esc or click to unlock"
            : "Hover to explore \u00b7 Click to lock \u00b7 Scroll to zoom"}
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden min-h-0">
        {/* Map */}
        <div className="flex-1 relative h-full">
          <ElectionMap
            onHoverElections={handleHoverElections}
            onClearHover={handleClearHover}
            onClickRegion={handleClickRegion}
            lockedRegionKey={lockedRegionKey}
          />

          {/* Zoom hint overlay */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono">
              Zoom in to reveal county elections
            </div>
          </div>
        </div>

        {/* Side panel — HUD style */}
        <div className="hidden sm:flex sm:flex-col w-96 h-full bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 z-10">
          <ElectionPanel
            elections={displayElections}
            regionName={displayRegionName}
            isLocked={isLocked}
            onUnlock={handleUnlock}
          />
        </div>

        {/* Mobile: bottom panel */}
        {displayElections.length > 0 && (
          <div className="sm:hidden absolute bottom-0 left-0 right-0 z-10 max-h-[60vh] overflow-y-auto bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 rounded-t-xl">
            <ElectionPanel
              elections={displayElections}
              regionName={displayRegionName}
              isLocked={isLocked}
              onUnlock={handleUnlock}
            />
          </div>
        )}
      </div>
    </div>
  );
}
