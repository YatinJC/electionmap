"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import ElectionPanel from "@/components/ElectionPanel";
import { Election } from "@/types/elections";
import MapLegend from "@/components/MapLegend";
import type { HoverInfo } from "@/components/ElectionMap";

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

const electionCache = new Map<string, Election[]>();

async function fetchElections(info: HoverInfo): Promise<Election[]> {
  const cacheKey = `${info.stateId}:${info.countyId ?? ""}:${info.districtId ?? ""}`;
  const cached = electionCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ stateId: info.stateId });
  if (info.countyId) params.set("countyId", info.countyId);
  if (info.districtId) params.set("districtId", info.districtId);

  const res = await fetch(`/api/elections?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const elections = data.elections as Election[];
  electionCache.set(cacheKey, elections);
  return elections;
}

export default function Home() {
  const [statesWithElections, setStatesWithElections] = useState<Set<string>>(new Set());
  const [countiesWithElections, setCountiesWithElections] = useState<Set<string>>(new Set());
  const [districtsWithElections, setDistrictsWithElections] = useState<Set<string>>(new Set());
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [mapZoom, setMapZoom] = useState(5);

  const [hoveredElections, setHoveredElections] = useState<Election[]>([]);
  const [hoveredRegionName, setHoveredRegionName] = useState("");

  const [lockedElections, setLockedElections] = useState<Election[]>([]);
  const [lockedRegionName, setLockedRegionName] = useState("");
  const [lockedRegionKey, setLockedRegionKey] = useState<string | null>(null);

  const isLocked = lockedRegionKey !== null;
  const displayElections = isLocked ? lockedElections : hoveredElections;
  const displayRegionName = isLocked ? lockedRegionName : hoveredRegionName;

  useEffect(() => {
    fetch("/api/regions/summary")
      .then((r) => r.json())
      .then((data) => {
        setStatesWithElections(new Set(data.statesWithElections));
        setCountiesWithElections(new Set(data.countiesWithElections));
        setDistrictsWithElections(new Set(data.districtsWithElections ?? []));
        setSummaryLoaded(true);
      })
      .catch(() => setSummaryLoaded(true));
  }, []);

  const handleHoverRegion = useCallback(async (info: HoverInfo) => {
    const elections = await fetchElections(info);
    setHoveredElections(elections);
    setHoveredRegionName(info.regionName);
  }, []);

  const handleClearHover = useCallback(() => {
    setHoveredElections([]);
    setHoveredRegionName("");
  }, []);

  const handleClickRegion = useCallback(
    async (info: HoverInfo, regionKey: string) => {
      if (lockedRegionKey === regionKey) {
        setLockedElections([]);
        setLockedRegionName("");
        setLockedRegionKey(null);
      } else {
        const elections = await fetchElections(info);
        setLockedElections(elections);
        setLockedRegionName(info.regionName);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleUnlock();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUnlock]);

  return (
    <div className="h-full flex flex-col">
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

      <div className="flex-1 flex relative overflow-hidden min-h-0">
        <div className="flex-1 relative h-full">
          {summaryLoaded && (
            <ElectionMap
              statesWithElections={statesWithElections}
              countiesWithElections={countiesWithElections}
              districtsWithElections={districtsWithElections}
              onHoverRegion={handleHoverRegion}
              onClearHover={handleClearHover}
              onClickRegion={handleClickRegion}
              lockedRegionKey={lockedRegionKey}
              onZoomChange={setMapZoom}
            />
          )}

          <MapLegend showDetailLayers={mapZoom >= 7} />
        </div>

        <div className="hidden sm:flex sm:flex-col w-96 h-full bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 z-10">
          <ElectionPanel
            elections={displayElections}
            regionName={displayRegionName}
            isLocked={isLocked}
            onUnlock={handleUnlock}
          />
        </div>

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
