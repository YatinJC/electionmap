"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
} from "react-leaflet";
import type L from "leaflet";
import type { Layer, LeafletMouseEvent, PathOptions } from "leaflet";
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
}

export interface HoverInfo {
  stateId: string;
  countyId: string | null;
  districtId: string | null;
  regionName: string;
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
}

// ── Style helpers ─────────────────────────────────────────────────

function stateStyle(_id: string, hasElections: boolean, isHovered: boolean, isLocked: boolean): PathOptions {
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

function countyStyle(_id: string, hasElections: boolean, isHovered: boolean, isLocked: boolean): PathOptions {
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

function districtStyle(_id: string, hasElections: boolean, isActive: boolean): PathOptions {
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

// ── Imperative style updater ──────────────────────────────────────
// Instead of re-rendering the entire GeoJSON via key changes,
// we imperatively update styles on individual Leaflet layers.

function useLayerStyleUpdater(
  layerRef: React.RefObject<L.GeoJSON | null>,
  styleFn: (feature: GeoFeature) => PathOptions
) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer((l: Layer) => {
      const geoLayer = l as L.GeoJSON & { feature: GeoFeature };
      if (geoLayer.feature) {
        (l as L.Path).setStyle(styleFn(geoLayer.feature));
      }
    });
  });
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
}: ElectionMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [zoom, setZoomInternal] = useState(5);
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const [hoveredCountyId, setHoveredCountyId] = useState<string | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null);

  // Refs to GeoJSON layers for imperative style updates
  const stateLayerRef = useRef<L.GeoJSON | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const districtLayerRef = useRef<L.GeoJSON | null>(null);

  // Debounce timer for hover events
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setZoom = useCallback((z: number) => {
    setZoomInternal(z);
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

  // ── Load geo data ─────────────────────────────────────���─────────

  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetch("/geo/states-10m.json").then((r) => r.json()),
      fetch("/geo/counties-10m.json").then((r) => r.json()),
      fetch("/geo/districts-10m.json").then((r) => r.json()),
    ]).then(([statesTopo, countiesTopo, districtsTopo]: [Topology, Topology, Topology]) => {
      const statesGeo = topojson.feature(statesTopo, statesTopo.objects.states);
      const countiesGeo = topojson.feature(countiesTopo, countiesTopo.objects.counties);
      const districtsObj = Object.values(districtsTopo.objects)[0];
      const districtsGeo = topojson.feature(districtsTopo, districtsObj);
      setMapData({
        states: (statesGeo as unknown as { features: GeoFeature[] }).features,
        counties: (countiesGeo as unknown as { features: GeoFeature[] }).features,
        districts: (districtsGeo as unknown as { features: GeoFeature[] }).features,
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

  // Cache last district lookup to avoid recomputing for nearby points
  const lastDistrictLookup = useRef<{ lat: number; lng: number; result: string | null }>({ lat: 0, lng: 0, result: null });

  const findDistrict = useCallback(
    (lat: number, lng: number, stateFips: string): string | null => {
      // Skip if point hasn't moved significantly (within ~0.01 degrees ≈ 1km)
      const last = lastDistrictLookup.current;
      if (Math.abs(lat - last.lat) < 0.01 && Math.abs(lng - last.lng) < 0.01) {
        return last.result;
      }

      const candidates = districtsByState.get(stateFips);
      if (!candidates) return null;
      const pt = turfPoint([lng, lat]);
      let result: string | null = null;
      for (const d of candidates) {
        try {
          if (booleanPointInPolygon(pt, d as Feature<Polygon | MultiPolygon>)) {
            result = d.properties.GEOID;
            break;
          }
        } catch { /* skip invalid geometries */ }
      }
      lastDistrictLookup.current = { lat, lng, result };
      return result;
    },
    [districtsByState]
  );

  // ── Imperative style updates (no re-render!) ────────────────────

  useLayerStyleUpdater(stateLayerRef, (f) => {
    const id = String(f.id);
    return stateStyle(id, statesWithElections.has(id), hoveredStateId === id, lockedStateId === id);
  });

  useLayerStyleUpdater(countyLayerRef, (f) => {
    const id = String(f.id);
    return countyStyle(id, countiesWithElections.has(id), hoveredCountyId === id, lockedCountyId === id);
  });

  useLayerStyleUpdater(districtLayerRef, (f) => {
    const id = f.properties.GEOID;
    return districtStyle(id, districtsWithElections.has(id), activeDistrictId === id);
  });

  // ── Hover handlers (debounced) ──────────────────────────────────

  const handleStateHover = useCallback(
    (id: string, name: string, _e: LeafletMouseEvent) => {
      if (lockedRegionKey || showCounties) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setHoveredStateId(id);
        setActiveDistrictId(null);
        onHoverRegion({ stateId: id, countyId: null, districtId: null, regionName: name });
      }, 30);
    },
    [showCounties, lockedRegionKey, onHoverRegion]
  );

  const handleCountyHover = useCallback(
    (id: string, name: string, e: LeafletMouseEvent) => {
      if (lockedRegionKey) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        const stateId = id.substring(0, 2);
        setHoveredCountyId(id);
        setHoveredStateId(stateId);
        const { lat, lng } = e.latlng;
        const districtId = findDistrict(lat, lng, stateId);
        setActiveDistrictId(districtId);
        onHoverRegion({ stateId, countyId: id, districtId, regionName: name });
      }, 30);
    },
    [lockedRegionKey, onHoverRegion, findDistrict]
  );

  const handleLeave = useCallback(() => {
    if (lockedRegionKey) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredStateId(null);
    setHoveredCountyId(null);
    setActiveDistrictId(null);
    onClearHover();
  }, [lockedRegionKey, onClearHover]);

  // ── Click handlers ──────────────────────────────────────────────

  const handleStateClick = useCallback(
    (id: string, name: string, _e: LeafletMouseEvent) => {
      if (showCounties) return;
      setHoveredStateId(null);
      setHoveredCountyId(null);
      setActiveDistrictId(null);
      onClickRegion({ stateId: id, countyId: null, districtId: null, regionName: name }, `state:${id}`);
    },
    [showCounties, onClickRegion]
  );

  const handleCountyClick = useCallback(
    (id: string, name: string, e: LeafletMouseEvent) => {
      setHoveredStateId(null);
      setHoveredCountyId(null);
      const stateId = id.substring(0, 2);
      const { lat, lng } = e.latlng;
      const districtId = findDistrict(lat, lng, stateId);
      setActiveDistrictId(districtId);
      onClickRegion({ stateId, countyId: id, districtId, regionName: name }, `county:${id}`);
    },
    [onClickRegion, findDistrict]
  );

  // ── Event binders (stable — no deps that change on hover) ──────

  const onEachState = useCallback(
    (feature: Feature, layer: Layer) => {
      const f = feature as GeoFeature;
      layer.on({
        mouseover: (e: LeafletMouseEvent) => handleStateHover(String(f.id), f.properties.name, e),
        mouseout: () => handleLeave(),
        click: (e: LeafletMouseEvent) => handleStateClick(String(f.id), f.properties.name, e),
      });
    },
    [handleStateHover, handleLeave, handleStateClick]
  );

  const onEachCounty = useCallback(
    (feature: Feature, layer: Layer) => {
      const f = feature as GeoFeature;
      layer.on({
        mouseover: (e: LeafletMouseEvent) => handleCountyHover(String(f.id), f.properties.name, e),
        mouseout: () => handleLeave(),
        click: (e: LeafletMouseEvent) => handleCountyClick(String(f.id), f.properties.name, e),
      });
    },
    [handleCountyHover, handleLeave, handleCountyClick]
  );

  // ── Initial style functions (used only on first render) ─────────

  const initialStateStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      return stateStyle(id, statesWithElections.has(id), false, lockedStateId === id);
    },
    [statesWithElections, lockedStateId]
  );

  const initialCountyStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      return countyStyle(id, countiesWithElections.has(id), false, lockedCountyId === id);
    },
    [countiesWithElections, lockedCountyId]
  );

  const initialDistrictStyle = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const f = feature as GeoFeature;
      return districtStyle(f.properties.GEOID, districtsWithElections.has(f.properties.GEOID), false);
    },
    [districtsWithElections]
  );

  // ── GeoJSON data objects (stable references) ────────────────────

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
