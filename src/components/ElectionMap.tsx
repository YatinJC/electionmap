"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
} from "react-leaflet";
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

// ── Helpers ───────────────────────────────────────────────────────

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

// ── State layer ───────────────────────────────────────────────────

function StateLayer({
  features,
  statesWithElections,
  hoveredStateId,
  lockedStateId,
  onHover,
  onLeave,
  onClick,
}: {
  features: GeoFeature[];
  statesWithElections: Set<string>;
  hoveredStateId: string | null;
  lockedStateId: string | null;
  onHover: (id: string, name: string, e: LeafletMouseEvent) => void;
  onLeave: () => void;
  onClick: (id: string, name: string, e: LeafletMouseEvent) => void;
}) {
  const style = useCallback(
    (feature?: GeoFeature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      const has = statesWithElections.has(id);
      const isLocked = lockedStateId === id;
      const isHovered = hoveredStateId === id;

      if (isLocked) {
        return {
          fillColor: MAP_COLORS.lockedFill,
          fillOpacity: 0.4,
          color: MAP_COLORS.locked,
          weight: 2.5,
          opacity: 0.9,
        };
      }
      if (isHovered && has) {
        return {
          fillColor: MAP_COLORS.hoverFill,
          fillOpacity: 0.25,
          color: MAP_COLORS.hover,
          weight: 2,
          opacity: 0.8,
        };
      }
      return {
        fillColor: has ? MAP_COLORS.activeFill : "transparent",
        fillOpacity: has ? 0.06 : 0,
        color: has ? MAP_COLORS.active : MAP_COLORS.inactive,
        weight: has ? 1 : 0.5,
        opacity: has ? 0.4 : 0.15,
      };
    },
    [hoveredStateId, lockedStateId, statesWithElections]
  );

  const onEach = useCallback(
    (feature: GeoFeature, layer: Layer) => {
      layer.on({
        mouseover: (e: LeafletMouseEvent) => onHover(String(feature.id), feature.properties.name, e),
        mouseout: () => onLeave(),
        click: (e: LeafletMouseEvent) => onClick(String(feature.id), feature.properties.name, e),
      });
    },
    [onHover, onLeave, onClick]
  );

  return (
    <GeoJSON
      key={`s-${hoveredStateId}-${lockedStateId}`}
      data={{ type: "FeatureCollection", features } as FeatureCollection}
      style={(f) => style(f as GeoFeature)}
      onEachFeature={(f, l) => onEach(f as GeoFeature, l)}
    />
  );
}

// ── County layer (owns all zoomed-in interaction) ─────────────────

function CountyLayer({
  features,
  countiesWithElections,
  hoveredCountyId,
  lockedCountyId,
  onHover,
  onLeave,
  onClick,
}: {
  features: GeoFeature[];
  countiesWithElections: Set<string>;
  hoveredCountyId: string | null;
  lockedCountyId: string | null;
  onHover: (id: string, name: string, e: LeafletMouseEvent) => void;
  onLeave: () => void;
  onClick: (id: string, name: string, e: LeafletMouseEvent) => void;
}) {
  const style = useCallback(
    (feature?: GeoFeature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      const has = countiesWithElections.has(id);
      const isLocked = lockedCountyId === id;
      const isHovered = hoveredCountyId === id;

      if (isLocked) {
        return {
          fillColor: MAP_COLORS.lockedFill,
          fillOpacity: 0.45,
          color: MAP_COLORS.locked,
          weight: 2.5,
          opacity: 1,
        };
      }
      if (isHovered && has) {
        return {
          fillColor: MAP_COLORS.hoverFill,
          fillOpacity: 0.3,
          color: MAP_COLORS.hover,
          weight: 2,
          opacity: 0.9,
        };
      }
      if (isHovered) {
        return {
          fillColor: "#1e293b",
          fillOpacity: 0.15,
          color: "#475569",
          weight: 1.5,
          opacity: 0.5,
        };
      }
      return {
        fillColor: has ? MAP_COLORS.activeFill : "transparent",
        fillOpacity: has ? 0.08 : 0,
        color: has ? MAP_COLORS.active : MAP_COLORS.inactive,
        weight: has ? 0.8 : 0.3,
        opacity: has ? 0.35 : 0.1,
      };
    },
    [hoveredCountyId, lockedCountyId, countiesWithElections]
  );

  const onEach = useCallback(
    (feature: GeoFeature, layer: Layer) => {
      layer.on({
        mouseover: (e: LeafletMouseEvent) => onHover(String(feature.id), feature.properties.name, e),
        mouseout: () => onLeave(),
        click: (e: LeafletMouseEvent) => onClick(String(feature.id), feature.properties.name, e),
      });
    },
    [onHover, onLeave, onClick]
  );

  return (
    <GeoJSON
      key={`c-${hoveredCountyId}-${lockedCountyId}`}
      data={{ type: "FeatureCollection", features } as FeatureCollection}
      style={(f) => style(f as GeoFeature)}
      onEachFeature={(f, l) => onEach(f as GeoFeature, l)}
    />
  );
}

// ── District layer (visual only — dashed outlines, no interaction) ─

function DistrictLayer({
  features,
  districtsWithElections,
  activeDistrictId,
}: {
  features: GeoFeature[];
  districtsWithElections: Set<string>;
  activeDistrictId: string | null;
}) {
  const style = useCallback(
    (feature?: GeoFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.GEOID;
      const has = districtsWithElections.has(id);
      const isActive = activeDistrictId === id;

      if (isActive) {
        return {
          fillColor: MAP_COLORS.hoverFill,
          fillOpacity: 0.15,
          color: MAP_COLORS.hover,
          weight: 2,
          opacity: 0.7,
          dashArray: "8 4",
        };
      }
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        color: has ? MAP_COLORS.active : "#1e293b",
        weight: has ? 0.7 : 0.3,
        opacity: has ? 0.25 : 0.08,
        dashArray: "6 4",
      };
    },
    [activeDistrictId, districtsWithElections]
  );

  return (
    <GeoJSON
      key={`d-${activeDistrictId}`}
      data={{ type: "FeatureCollection", features } as FeatureCollection}
      style={(f) => style(f as GeoFeature)}
      interactive={false}
    />
  );
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
  const setZoom = useCallback((z: number) => {
    setZoomInternal(z);
    onZoomChangeExternal?.(z);
  }, [onZoomChangeExternal]);
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const [hoveredCountyId, setHoveredCountyId] = useState<string | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null);

  const showCounties = zoom >= 7;
  const showDistricts = zoom >= 7;

  const lockedStateId =
    lockedRegionKey?.startsWith("state:") ? lockedRegionKey.slice(6) :
    lockedRegionKey?.startsWith("county:") ? lockedRegionKey.slice(7, 9) :
    null;
  const lockedCountyId =
    lockedRegionKey?.startsWith("county:") ? lockedRegionKey.slice(7) : null;

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

  // Group districts by state for faster point-in-polygon lookup
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

  const findDistrict = useCallback(
    (lat: number, lng: number, stateFips: string): string | null => {
      const candidates = districtsByState.get(stateFips);
      if (!candidates) return null;
      const pt = turfPoint([lng, lat]);
      for (const d of candidates) {
        try {
          if (booleanPointInPolygon(pt, d as Feature<Polygon | MultiPolygon>)) {
            return d.properties.GEOID;
          }
        } catch {
          // skip invalid geometries
        }
      }
      return null;
    },
    [districtsByState]
  );

  // ── Hover ───────────────────────────────────────────────────────

  const handleStateHover = useCallback(
    (id: string, name: string, _e: LeafletMouseEvent) => {
      if (lockedRegionKey || showCounties) return;
      setHoveredStateId(id);
      setActiveDistrictId(null);
      onHoverRegion({ stateId: id, countyId: null, districtId: null, regionName: name });
    },
    [showCounties, lockedRegionKey, onHoverRegion]
  );

  const handleCountyHover = useCallback(
    (id: string, name: string, e: LeafletMouseEvent) => {
      if (lockedRegionKey) return;
      const stateId = id.substring(0, 2);
      setHoveredCountyId(id);
      setHoveredStateId(stateId);
      const { lat, lng } = e.latlng;
      const districtId = findDistrict(lat, lng, stateId);
      setActiveDistrictId(districtId);
      onHoverRegion({ stateId, countyId: id, districtId, regionName: name });
    },
    [lockedRegionKey, onHoverRegion, findDistrict]
  );

  const handleLeave = useCallback(() => {
    if (lockedRegionKey) return;
    setHoveredStateId(null);
    setHoveredCountyId(null);
    setActiveDistrictId(null);
    onClearHover();
  }, [lockedRegionKey, onClearHover]);

  // ── Click ───────────────────────────────────────────────────────

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

  if (!mounted || !mapData) {
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

      <StateLayer
        features={mapData.states}
        statesWithElections={statesWithElections}
        hoveredStateId={hoveredStateId}
        lockedStateId={lockedStateId}
        onHover={handleStateHover}
        onLeave={handleLeave}
        onClick={handleStateClick}
      />

      {showDistricts && (
        <DistrictLayer
          features={mapData.districts}
          districtsWithElections={districtsWithElections}
          activeDistrictId={activeDistrictId}
        />
      )}

      {showCounties && (
        <CountyLayer
          features={mapData.counties}
          countiesWithElections={countiesWithElections}
          hoveredCountyId={hoveredCountyId}
          lockedCountyId={lockedCountyId}
          onHover={handleCountyHover}
          onLeave={handleLeave}
          onClick={handleCountyClick}
        />
      )}
    </MapContainer>
  );
}
