"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type L from "leaflet";
import type { Layer, LeafletMouseEvent, PathOptions, Path } from "leaflet";
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from "geojson";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import { MAP_COLORS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────

interface GeoFeature extends Feature<Geometry> {
  id?: string | number;
  properties: Record<string, string>;
}

interface MapData {
  states: GeoFeature[];
  counties: GeoFeature[];
  districts: GeoFeature[];
  sldUpper: GeoFeature[];
  sldLower: GeoFeature[];
}

export interface HoverInfo {
  stateId: string;
  countyId: string | null;
  districtId: string | null;
  sldUpperId: string | null;
  sldLowerId: string | null;
  regionName: string;
}

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
}

interface ElectionMapProps {
  statesWithElections: Set<string>;
  countiesWithElections: Set<string>;
  districtsWithElections: Set<string>;
  onHoverRegion: (info: HoverInfo) => void;
  onClearHover: () => void;
  onClickRegion: (info: HoverInfo, regionKey: string) => void;
  lockedRegionKey: string | null;
  onZoomChange?: (zoom: number) => void;
  flyTo?: FlyToTarget | null;
}

// ── Style helpers ─────────────────────────────────────────────────

function getStateStyle(hasElections: boolean, isHovered: boolean, isLocked: boolean): PathOptions {
  if (isLocked) {
    return { fillColor: MAP_COLORS.lockedFill, fillOpacity: 0.4, color: MAP_COLORS.locked, weight: 2.5, opacity: 0.9 };
  }
  if (isHovered && hasElections) {
    return { fillColor: MAP_COLORS.hoverFill, fillOpacity: 0.25, color: MAP_COLORS.hover, weight: 2, opacity: 0.8 };
  }
  return {
    fillColor: hasElections ? MAP_COLORS.activeFill : "transparent",
    fillOpacity: hasElections ? 0.06 : 0,
    color: hasElections ? MAP_COLORS.active : MAP_COLORS.inactive,
    weight: hasElections ? 1 : 0.5,
    opacity: hasElections ? 0.4 : 0.15,
  };
}

function getCountyStyle(hasElections: boolean, isHovered: boolean, isLocked: boolean): PathOptions {
  if (isLocked) {
    return { fillColor: MAP_COLORS.lockedFill, fillOpacity: 0.45, color: MAP_COLORS.locked, weight: 2.5, opacity: 1 };
  }
  if (isHovered && hasElections) {
    return { fillColor: MAP_COLORS.hoverFill, fillOpacity: 0.3, color: MAP_COLORS.hover, weight: 2, opacity: 0.9 };
  }
  if (isHovered) {
    return { fillColor: "#1e293b", fillOpacity: 0.15, color: "#475569", weight: 1.5, opacity: 0.5 };
  }
  return {
    fillColor: hasElections ? MAP_COLORS.activeFill : "transparent",
    fillOpacity: hasElections ? 0.08 : 0,
    color: hasElections ? MAP_COLORS.active : MAP_COLORS.inactive,
    weight: hasElections ? 0.8 : 0.3,
    opacity: hasElections ? 0.35 : 0.1,
  };
}

function getDistrictStyle(hasElections: boolean, isActive: boolean): PathOptions {
  if (isActive) {
    return { fillColor: MAP_COLORS.hoverFill, fillOpacity: 0.15, color: MAP_COLORS.hover, weight: 2, opacity: 0.7, dashArray: "8 4" };
  }
  return {
    fillColor: "transparent", fillOpacity: 0,
    color: hasElections ? MAP_COLORS.active : "#1e293b",
    weight: hasElections ? 0.7 : 0.3,
    opacity: hasElections ? 0.25 : 0.08,
    dashArray: "6 4",
  };
}

// ── Zoom tracker ──────────────────────────────────────────────────

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoomChange(e.target.getZoom()) });
  return null;
}

function FlyToHandler({ target }: { target: FlyToTarget | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

// ── Main component ────────────────────────────────────────────────

export default function ElectionMap({
  statesWithElections,
  countiesWithElections,
  districtsWithElections,
  onHoverRegion,
  onClearHover,
  onClickRegion,
  lockedRegionKey,
  onZoomChange: onZoomChangeExternal,
  flyTo: flyToTarget,
}: ElectionMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [zoom, setZoomInternal] = useState(5);
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const [hoveredCountyId, setHoveredCountyId] = useState<string | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null);

  // Refs for imperative layer access
  const stateLayerRef = useRef<L.GeoJSON | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);

  // Use refs for values that event handlers need to access without stale closures
  const lockedRegionKeyRef = useRef(lockedRegionKey);
  lockedRegionKeyRef.current = lockedRegionKey;
  const showCountiesRef = useRef(false);

  const setZoom = useCallback((z: number) => {
    setZoomInternal(z);
    showCountiesRef.current = z >= 7;
    onZoomChangeExternal?.(z);
  }, [onZoomChangeExternal]);

  const showCounties = zoom >= 7;
  const showDistricts = zoom >= 7;

  const lockedStateId =
    lockedRegionKey?.startsWith("state:") ? lockedRegionKey.slice(6) :
    lockedRegionKey?.startsWith("county:") ? lockedRegionKey.slice(7, 9) :
    null;
  const lockedCountyId =
    lockedRegionKey?.startsWith("county:") ? lockedRegionKey.slice(7) : null;

  // ── Load geo data ───────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetch("/geo/states-10m.json").then((r) => r.json()),
      fetch("/geo/counties-10m.json").then((r) => r.json()),
      fetch("/geo/districts-10m.json").then((r) => r.json()),
      fetch("/geo/sldu-10m.json").then((r) => r.json()),
      fetch("/geo/sldl-10m.json").then((r) => r.json()),
    ]).then(([statesTopo, countiesTopo, districtsTopo, slduTopo, sldlTopo]: Topology[]) => {
      const statesGeo = topojson.feature(statesTopo, statesTopo.objects.states);
      const countiesGeo = topojson.feature(countiesTopo, countiesTopo.objects.counties);
      const districtsObj = Object.values(districtsTopo.objects)[0];
      const districtsGeo = topojson.feature(districtsTopo, districtsObj);
      const slduObj = Object.values(slduTopo.objects)[0];
      const slduGeo = topojson.feature(slduTopo, slduObj);
      const sldlObj = Object.values(sldlTopo.objects)[0];
      const sldlGeo = topojson.feature(sldlTopo, sldlObj);
      setMapData({
        states: (statesGeo as unknown as { features: GeoFeature[] }).features,
        counties: (countiesGeo as unknown as { features: GeoFeature[] }).features,
        districts: (districtsGeo as unknown as { features: GeoFeature[] }).features,
        sldUpper: (slduGeo as unknown as { features: GeoFeature[] }).features,
        sldLower: (sldlGeo as unknown as { features: GeoFeature[] }).features,
      });
    });
  }, []);

  // ── District lookup ─────────────────────────────────────────────

  const districtsByState = useMemo(() => {
    if (!mapData) return new Map<string, GeoFeature[]>();
    const map = new Map<string, GeoFeature[]>();
    for (const d of mapData.districts) {
      const s = d.properties.STATEFP;
      const list = map.get(s) ?? [];
      list.push(d);
      map.set(s, list);
    }
    return map;
  }, [mapData]);

  // Spatial indexes — group features by state FIPS for faster lookup
  const countiesByState = useMemo(() => {
    if (!mapData) return new Map<string, GeoFeature[]>();
    const map = new Map<string, GeoFeature[]>();
    for (const c of mapData.counties) {
      const s = String(c.id).substring(0, 2);
      (map.get(s) ?? (map.set(s, []), map.get(s)!)).push(c);
    }
    return map;
  }, [mapData]);

  const sldUpperByState = useMemo(() => {
    if (!mapData) return new Map<string, GeoFeature[]>();
    const map = new Map<string, GeoFeature[]>();
    for (const f of mapData.sldUpper) {
      const s = f.properties.STATEFP;
      (map.get(s) ?? (map.set(s, []), map.get(s)!)).push(f);
    }
    return map;
  }, [mapData]);

  const sldLowerByState = useMemo(() => {
    if (!mapData) return new Map<string, GeoFeature[]>();
    const map = new Map<string, GeoFeature[]>();
    for (const f of mapData.sldLower) {
      const s = f.properties.STATEFP;
      (map.get(s) ?? (map.set(s, []), map.get(s)!)).push(f);
    }
    return map;
  }, [mapData]);

  // Cache for point-in-polygon lookups
  type LocationResult = { countyId: string | null; districtId: string | null; sldUpperId: string | null; sldLowerId: string | null };
  const lastLookup = useRef<{ lat: number; lng: number } & LocationResult>({ lat: 0, lng: 0, countyId: null, districtId: null, sldUpperId: null, sldLowerId: null });

  const findLocation = useCallback(
    (lat: number, lng: number, stateFips: string): LocationResult => {
      const last = lastLookup.current;
      if (Math.abs(lat - last.lat) < 0.005 && Math.abs(lng - last.lng) < 0.005) {
        return { countyId: last.countyId, districtId: last.districtId, sldUpperId: last.sldUpperId, sldLowerId: last.sldLowerId };
      }

      const pt = turfPoint([lng, lat]);
      let countyId: string | null = null;
      let districtId: string | null = null;
      let sldUpperId: string | null = null;
      let sldLowerId: string | null = null;

      const pip = (features: GeoFeature[] | undefined): string | null => {
        if (!features) return null;
        for (const f of features) {
          try {
            if (booleanPointInPolygon(pt, f as Feature<Polygon | MultiPolygon>)) {
              return f.properties.GEOID || String(f.id);
            }
          } catch { /* skip */ }
        }
        return null;
      };

      countyId = pip(countiesByState.get(stateFips));
      districtId = pip(districtsByState.get(stateFips));
      sldUpperId = pip(sldUpperByState.get(stateFips));
      sldLowerId = pip(sldLowerByState.get(stateFips));

      lastLookup.current = { lat, lng, countyId, districtId, sldUpperId, sldLowerId };
      return { countyId, districtId, sldUpperId, sldLowerId };
    },
    [countiesByState, districtsByState, sldUpperByState, sldLowerByState]
  );

  // ── Imperative style updates ────────────────────────────────────
  // Only update the specific layers that changed, not all layers every render.

  // Update only the two affected state layers on hover change
  const prevHoveredStateRef = useRef<string | null>(null);
  useEffect(() => {
    const layer = stateLayerRef.current;
    if (!layer) return;
    const prev = prevHoveredStateRef.current;
    const curr = hoveredStateId;
    if (prev === curr) return;
    prevHoveredStateRef.current = curr;

    layer.eachLayer((l: Layer) => {
      const gl = l as unknown as { feature: GeoFeature };
      if (!gl.feature) return;
      const id = String(gl.feature.id);
      if (id === prev || id === curr || id === lockedStateId) {
        (l as Path).setStyle(getStateStyle(statesWithElections.has(id), id === curr, id === lockedStateId));
      }
    });
  }, [hoveredStateId, lockedStateId, statesWithElections]);

  // Update only the two affected county layers on hover change
  const prevHoveredCountyRef = useRef<string | null>(null);
  useEffect(() => {
    const layer = countyLayerRef.current;
    if (!layer) return;
    const prev = prevHoveredCountyRef.current;
    const curr = hoveredCountyId;
    if (prev === curr) return;
    prevHoveredCountyRef.current = curr;

    layer.eachLayer((l: Layer) => {
      const gl = l as unknown as { feature: GeoFeature };
      if (!gl.feature) return;
      const id = String(gl.feature.id);
      if (id === prev || id === curr || id === lockedCountyId) {
        (l as Path).setStyle(getCountyStyle(countiesWithElections.has(id), id === curr, id === lockedCountyId));
      }
    });
  }, [hoveredCountyId, lockedCountyId, countiesWithElections]);

  // Update only the two affected district layers
  const prevActiveDistrictRef = useRef<string | null>(null);
  useEffect(() => {
    const layer = districtLayerRef.current;
    if (!layer) return;
    const prev = prevActiveDistrictRef.current;
    const curr = activeDistrictId;
    if (prev === curr) return;
    prevActiveDistrictRef.current = curr;

    layer.eachLayer((l: Layer) => {
      const gl = l as unknown as { feature: GeoFeature };
      if (!gl.feature) return;
      const id = gl.feature.properties.GEOID;
      if (id === prev || id === curr) {
        (l as Path).setStyle(getDistrictStyle(districtsWithElections.has(id), id === curr));
      }
    });
  }, [activeDistrictId, districtsWithElections]);

  // ── Event handlers via refs (no stale closures) ─────────────────
  // Use refs for callbacks so GeoJSON event bindings always access latest state.

  const onHoverRegionRef = useRef(onHoverRegion);
  onHoverRegionRef.current = onHoverRegion;
  const onClearHoverRef = useRef(onClearHover);
  onClearHoverRef.current = onClearHover;
  const onClickRegionRef = useRef(onClickRegion);
  onClickRegionRef.current = onClickRegion;
  const findLocationRef = useRef(findLocation);
  findLocationRef.current = findLocation;

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable event binders — these never change, so GeoJSON binds them once.
  // Both state and county handlers resolve the full location (county + district)
  // via point-in-polygon so the panel always shows exactly what affects that point.

  const onEachState = useCallback((feature: Feature, layer: Layer) => {
    const f = feature as GeoFeature;
    const id = String(f.id);
    const name = f.properties.name;

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        if (lockedRegionKeyRef.current || showCountiesRef.current) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
          const { lat, lng } = e.latlng;
          const loc = findLocationRef.current(lat, lng, id);
          setHoveredStateId(id);
          setHoveredCountyId(null);
          setActiveDistrictId(loc.districtId);
          onHoverRegionRef.current({ stateId: id, ...loc, regionName: name });
        }, 16);
      },
      mouseout: () => {
        if (lockedRegionKeyRef.current) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHoveredStateId(null);
        setHoveredCountyId(null);
        setActiveDistrictId(null);
        onClearHoverRef.current();
      },
      click: (e: LeafletMouseEvent) => {
        if (showCountiesRef.current) return;
        const { lat, lng } = e.latlng;
        const loc = findLocationRef.current(lat, lng, id);
        setHoveredStateId(null);
        setHoveredCountyId(null);
        setActiveDistrictId(null);
        onClickRegionRef.current({ stateId: id, ...loc, regionName: name }, `state:${id}`);
      },
    });
  }, []);

  const onEachCounty = useCallback((feature: Feature, layer: Layer) => {
    const f = feature as GeoFeature;
    const id = String(f.id);
    const name = f.properties.name;

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        if (lockedRegionKeyRef.current) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
          const stateId = id.substring(0, 2);
          const { lat, lng } = e.latlng;
          const loc = findLocationRef.current(lat, lng, stateId);
          setHoveredCountyId(id);
          setHoveredStateId(stateId);
          setActiveDistrictId(loc.districtId);
          onHoverRegionRef.current({ stateId, countyId: id, districtId: loc.districtId, sldUpperId: loc.sldUpperId, sldLowerId: loc.sldLowerId, regionName: name });
        }, 16);
      },
      mouseout: () => {
        if (lockedRegionKeyRef.current) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHoveredStateId(null);
        setHoveredCountyId(null);
        setActiveDistrictId(null);
        onClearHoverRef.current();
      },
      click: (e: LeafletMouseEvent) => {
        setHoveredStateId(null);
        setHoveredCountyId(null);
        const stateId = id.substring(0, 2);
        const { lat, lng } = e.latlng;
        const loc = findLocationRef.current(lat, lng, stateId);
        setActiveDistrictId(loc.districtId);
        onClickRegionRef.current({ stateId, countyId: id, districtId: loc.districtId, sldUpperId: loc.sldUpperId, sldLowerId: loc.sldLowerId, regionName: name }, `county:${id}`);
      },
    });
  }, []);

  // ── Initial style functions ─────────────────────────────────────

  const initialStateStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      return getStateStyle(statesWithElections.has(id), false, lockedStateId === id);
    },
    [statesWithElections, lockedStateId]
  );

  const initialCountyStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      return getCountyStyle(countiesWithElections.has(id), false, lockedCountyId === id);
    },
    [countiesWithElections, lockedCountyId]
  );

  const initialDistrictStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const f = feature as GeoFeature;
      return getDistrictStyle(districtsWithElections.has(f.properties.GEOID), false);
    },
    [districtsWithElections]
  );

  // ── Stable GeoJSON data ─────────────────────────────────────────

  const statesFC = useMemo(
    () => mapData ? { type: "FeatureCollection" as const, features: mapData.states } as FeatureCollection : null,
    [mapData]
  );
  const countiesFC = useMemo(
    () => mapData ? { type: "FeatureCollection" as const, features: mapData.counties } as FeatureCollection : null,
    [mapData]
  );
  const districtsFC = useMemo(
    () => mapData ? { type: "FeatureCollection" as const, features: mapData.districts } as FeatureCollection : null,
    [mapData]
  );

  if (!mounted || !mapData || !statesFC) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
      />
      <ZoomTracker onZoomChange={setZoom} />
      <FlyToHandler target={flyToTarget} />

      <GeoJSON
        ref={stateLayerRef}
        data={statesFC}
        style={initialStateStyle}
        onEachFeature={onEachState}
      />

      {showDistricts && districtsFC && (
        <GeoJSON
          ref={districtLayerRef}
          data={districtsFC}
          style={initialDistrictStyle}
          interactive={false}
        />
      )}

      {showCounties && countiesFC && (
        <GeoJSON
          ref={countyLayerRef}
          data={countiesFC}
          style={initialCountyStyle}
          onEachFeature={onEachCounty}
        />
      )}
    </MapContainer>
  );
}
