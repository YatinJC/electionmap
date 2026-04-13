"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import ElectionPanel from "@/components/ElectionPanel";
import { Election } from "@/types/elections";
import MapLegend from "@/components/MapLegend";
import { LEVEL_COLORS } from "@/lib/constants";
import LocationSearch from "@/components/LocationSearch";
import type { HoverInfo, FlyToTarget } from "@/components/ElectionMap";

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

async function fetchElections(
  info: HoverInfo,
  months: number,
  levels: string[]
): Promise<Election[]> {
  const levelsKey = levels.join(",");
  const cacheKey = `${months}:${levelsKey}:${info.stateId}:${info.countyId ?? ""}:${info.districtId ?? ""}:${info.sldUpperId ?? ""}:${info.sldLowerId ?? ""}`;
  const cached = electionCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ stateId: info.stateId, months: String(months) });
  if (info.countyId) params.set("countyId", info.countyId);
  if (info.districtId) params.set("districtId", info.districtId);
  if (info.sldUpperId) params.set("sldUpperId", info.sldUpperId);
  if (info.sldLowerId) params.set("sldLowerId", info.sldLowerId);
  if (levels.length > 0 && levels.length < ALL_LEVELS.length) {
    params.set("levels", levelsKey);
  }

  const res = await fetch(`/api/elections?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const elections = data.elections as Election[];
  electionCache.set(cacheKey, elections);
  return elections;
}

const TIME_WINDOW_OPTIONS = [
  { value: 1, label: "1 month" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "1 year" },
  { value: 24, label: "2 years" },
];

const ALL_LEVELS = ["federal", "state", "county", "municipal", "special_district"];

const LEVEL_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  county: "County",
  municipal: "Municipal",
  special_district: "Special",
};

export default function Home() {
  const [months, setMonths] = useState(12);
  const [activeLevels, setActiveLevels] = useState<string[]>([...ALL_LEVELS]);
  const [statesWithElections, setStatesWithElections] = useState<Set<string>>(new Set());
  const [countiesWithElections, setCountiesWithElections] = useState<Set<string>>(new Set());
  const [districtsWithElections, setDistrictsWithElections] = useState<Set<string>>(new Set());
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [mapZoom, setMapZoom] = useState(5);

  const [hoveredElections, setHoveredElections] = useState<Election[]>([]);
  const [hoveredRegionName, setHoveredRegionName] = useState("");

  const [lockedElections, setLockedElections] = useState<Election[]>([]);
  const [lockedRegionName, setLockedRegionName] = useState("");
  const [lockedRegionKey, setLockedRegionKey] = useState<string | null>(null);

  const isLocked = lockedRegionKey !== null;
  const displayElections = isLocked ? lockedElections : hoveredElections;
  const displayRegionName = isLocked ? lockedRegionName : hoveredRegionName;

  const toggleLevel = useCallback((level: string) => {
    setActiveLevels((prev) => {
      if (prev.includes(level)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level];
    });
  }, []);

  // Fetch region summary — re-fetch when filters change
  const levelsParam = activeLevels.length < ALL_LEVELS.length ? activeLevels.join(",") : "";

  useEffect(() => {
    setSummaryLoaded(false);
    electionCache.clear();
    setLockedElections([]);
    setLockedRegionName("");
    setLockedRegionKey(null);
    setHoveredElections([]);
    setHoveredRegionName("");

    const params = new URLSearchParams({ months: String(months) });
    if (levelsParam) params.set("levels", levelsParam);

    fetch(`/api/regions/summary?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setStatesWithElections(new Set(data.statesWithElections));
        setCountiesWithElections(new Set(data.countiesWithElections));
        setDistrictsWithElections(new Set(data.districtsWithElections ?? []));
        setSummaryLoaded(true);
      })
      .catch(() => setSummaryLoaded(true));
  }, [months, levelsParam]);

  const handleHoverRegion = useCallback(async (info: HoverInfo) => {
    const elections = await fetchElections(info, months, activeLevels);
    setHoveredElections(elections);
    setHoveredRegionName(info.regionName);
  }, [months, activeLevels]);

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
        const elections = await fetchElections(info, months, activeLevels);
        setLockedElections(elections);
        setLockedRegionName(info.regionName);
        setLockedRegionKey(regionKey);
      }
    },
    [lockedRegionKey, months, activeLevels]
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
        <p className="text-slate-400 text-sm hidden lg:block">
          Every Election, Everywhere
        </p>
        <div className="flex items-center gap-3">
          {/* Location search */}
          <LocationSearch onFlyTo={setFlyTo} />

          {/* Level filter toggles */}
          <div className="flex items-center gap-1 hidden sm:flex">
            {ALL_LEVELS.map((level) => {
              const isActive = activeLevels.includes(level);
              const color = LEVEL_COLORS[level];
              return (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-all border"
                  style={{
                    backgroundColor: isActive ? color + "22" : "transparent",
                    borderColor: isActive ? color + "44" : "#334155",
                    color: isActive ? color : "#475569",
                    opacity: isActive ? 1 : 0.5,
                  }}
                  title={`${isActive ? "Hide" : "Show"} ${LEVEL_LABELS[level]} elections`}
                >
                  {LEVEL_LABELS[level]}
                </button>
              );
            })}
          </div>

          {/* Time window selector */}
          <div className="flex items-center gap-2">
            <select
              id="time-window"
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value, 10))}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-slate-500 cursor-pointer"
            >
              {TIME_WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
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
              flyTo={flyTo}
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
