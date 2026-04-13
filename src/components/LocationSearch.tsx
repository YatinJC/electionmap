"use client";

import { useState, useCallback, useRef } from "react";
import type { FlyToTarget } from "./ElectionMap";

interface LocationSearchProps {
  onFlyTo: (target: FlyToTarget) => void;
}

export default function LocationSearch({ onFlyTo }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      // Use Nominatim (OpenStreetMap) for geocoding — free, no key required
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { "User-Agent": "ElectionMap/1.0" } }
      );
      const data = await res.json();

      if (!data || data.length === 0) {
        setError("Location not found");
        setLoading(false);
        return;
      }

      const { lat, lon } = data[0];
      onFlyTo({ lat: parseFloat(lat), lng: parseFloat(lon), zoom: 10 });
      setQuery("");
      inputRef.current?.blur();
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, onFlyTo]);

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 12 });
        setLoading(false);
      },
      () => {
        setError("Location access denied");
        setLoading(false);
      },
      { timeout: 5000 }
    );
  }, [onFlyTo]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Address or city"
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded pl-2 pr-7 py-1 w-36 sm:w-44 focus:outline-none focus:border-slate-500 placeholder-slate-600"
        />
        {/* Search icon button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          title="Search"
        >
          {loading ? (
            <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin">
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="4" />
              <path d="M9 9l3.5 3.5" />
            </svg>
          )}
        </button>
      </div>

      {/* My location button */}
      <button
        onClick={handleMyLocation}
        disabled={loading}
        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        title="Use my location"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="3" />
          <path d="M7 1v2M7 11v2M1 7h2M11 7h2" />
        </svg>
      </button>

      {error && (
        <span className="text-red-400 text-[10px]">{error}</span>
      )}
    </div>
  );
}
