"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import ElectionPanel from "@/components/ElectionPanel";
import { Election } from "@/types/elections";
import { LEVEL_COLORS } from "@/lib/constants";
import LocationSearch from "@/components/LocationSearch";
import type { ClickPoint, FlyToTarget } from "@/components/ElectionMap";

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
  const [totalElections, setTotalElections] = useState(0);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);

  const [pin, setPin] = useState<ClickPoint | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [regionName, setRegionName] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleLevel = useCallback((level: string) => {
    setActiveLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== level);
      }
      return [...prev, level];
    });
  }, []);

  const levelsParam = activeLevels.length < ALL_LEVELS.length ? activeLevels.join(",") : "";

  // Header counter
  useEffect(() => {
    const params = new URLSearchParams({ months: String(months) });
    if (levelsParam) params.set("levels", levelsParam);
    fetch(`/api/regions/summary?${params}`)
      .then((r) => r.json())
      .then((data) => setTotalElections(data.totalElections ?? 0))
      .catch(() => {});
  }, [months, levelsParam]);

  // Re-fetch elections at the pinned point whenever filters change
  useEffect(() => {
    if (!pin) return;
    const params = new URLSearchParams({
      lat: String(pin.lat),
      lng: String(pin.lng),
      months: String(months),
    });
    if (levelsParam) params.set("levels", levelsParam);

    setLoading(true);
    fetch(`/api/elections/at?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setElections(data.elections ?? []);
        setRegionName(data.regionName ?? "");
      })
      .catch(() => {
        setElections([]);
        setRegionName("");
      })
      .finally(() => setLoading(false));
  }, [pin, months, levelsParam]);

  const handleMapClick = useCallback((point: ClickPoint) => {
    setPin(point);
  }, []);

  const handleClear = useCallback(() => {
    setPin(null);
    setElections([]);
    setRegionName("");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClear();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClear]);

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
          {totalElections > 0 ? (
            <><span className="text-white font-semibold">{totalElections.toLocaleString()}</span> upcoming elections</>
          ) : (
            "Every Election, Everywhere"
          )}
        </p>
        <div className="flex items-center gap-3">
          <LocationSearch onFlyTo={setFlyTo} />

          <div className="hidden sm:flex items-center gap-1">
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
      </header>

      <div className="flex-1 flex relative overflow-hidden min-h-0">
        <div className="flex-1 relative h-full">
          <ElectionMap onMapClick={handleMapClick} pin={pin} flyTo={flyTo} />
        </div>

        <div className="hidden sm:flex sm:flex-col w-96 h-full bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 z-10">
          <ElectionPanel
            elections={elections}
            regionName={regionName}
            hasPin={pin !== null}
            loading={loading}
            onClear={handleClear}
          />
        </div>

        {pin && (
          <div className="sm:hidden absolute bottom-0 left-0 right-0 z-10 max-h-[60vh] overflow-y-auto bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 rounded-t-xl">
            <ElectionPanel
              elections={elections}
              regionName={regionName}
              hasPin={pin !== null}
              loading={loading}
              onClear={handleClear}
            />
          </div>
        )}
      </div>
    </div>
  );
}
