"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMapEvents,
} from "react-leaflet";
import type { Layer, LeafletMouseEvent, PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import { Election } from "@/types/elections";
import {
  statesWithElections,
  countiesWithElections,
  getElectionsForState,
  getElectionsForCounty,
} from "@/data/mock-elections";
import { LEVEL_COLORS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────

interface GeoFeature extends Feature<Geometry> {
  id?: string | number;
  properties: { name: string };
}

interface MapData {
  states: GeoFeature[];
  counties: GeoFeature[];
}

interface ElectionMapProps {
  onHoverElections: (elections: Election[], regionName: string) => void;
  onClearHover: () => void;
  onClickRegion: (elections: Election[], regionName: string, regionKey: string) => void;
  lockedRegionKey: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────

function getHighestLevelColor(elections: Election[]): string {
  const priority: Election["level"][] = [
    "federal",
    "state",
    "county",
    "municipal",
    "special_district",
  ];
  for (const level of priority) {
    if (elections.some((e) => e.level === level)) {
      return LEVEL_COLORS[level];
    }
  }
  return LEVEL_COLORS.county;
}

// ── Zoom tracker ──────────────────────────────────────────────────

function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

// ── Highlight style helper ────────────────────────────────────────

function activeStyle(elections: Election[], isLocked: boolean): PathOptions {
  const color = getHighestLevelColor(elections);
  return {
    fillColor: color,
    fillOpacity: isLocked ? 0.35 : 0.25,
    color: isLocked ? "#ffffff" : color,
    weight: isLocked ? 3 : 2.5,
    opacity: isLocked ? 1 : 0.9,
  };
}

// ── State layer ───────────────────────────────────────────────────

function StateLayer({
  features,
  hoveredStateId,
  lockedStateId,
  onHover,
  onLeave,
  onClick,
}: {
  features: GeoFeature[];
  hoveredStateId: string | null;
  lockedStateId: string | null;
  onHover: (id: string, name: string, e: LeafletMouseEvent) => void;
  onLeave: () => void;
  onClick: (id: string, name: string) => void;
}) {
  const stateStyle = useCallback(
    (feature?: GeoFeature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      const hasElections = statesWithElections.has(id);
      const isLocked = lockedStateId === id;
      const isHovered = hoveredStateId === id;

      if ((isLocked || isHovered) && hasElections) {
        const elections = getElectionsForState(id);
        return activeStyle(elections, isLocked);
      }

      return {
        fillColor: hasElections ? "#1e40af" : "transparent",
        fillOpacity: hasElections ? 0.08 : 0,
        color: hasElections ? "#3b82f6" : "#334155",
        weight: hasElections ? 1.2 : 0.5,
        opacity: hasElections ? 0.5 : 0.2,
      };
    },
    [hoveredStateId, lockedStateId]
  );

  const onEachState = useCallback(
    (feature: GeoFeature, layer: Layer) => {
      layer.on({
        mouseover: (e: LeafletMouseEvent) => {
          onHover(String(feature.id), feature.properties.name, e);
        },
        mouseout: () => onLeave(),
        click: () => onClick(String(feature.id), feature.properties.name),
      });
    },
    [onHover, onLeave, onClick]
  );

  return (
    <GeoJSON
      key={`states-${hoveredStateId}-${lockedStateId}`}
      data={{ type: "FeatureCollection", features } as FeatureCollection}
      style={(feature) => stateStyle(feature as GeoFeature)}
      onEachFeature={(feature, layer) =>
        onEachState(feature as GeoFeature, layer)
      }
    />
  );
}

// ── County layer ──────────────────────────────────────────────────

function CountyLayer({
  features,
  hoveredCountyId,
  lockedCountyId,
  onHover,
  onLeave,
  onClick,
}: {
  features: GeoFeature[];
  hoveredCountyId: string | null;
  lockedCountyId: string | null;
  onHover: (id: string, name: string, e: LeafletMouseEvent) => void;
  onLeave: () => void;
  onClick: (id: string, name: string) => void;
}) {
  const countyStyle = useCallback(
    (feature?: GeoFeature): PathOptions => {
      if (!feature) return {};
      const id = String(feature.id);
      const hasElections = countiesWithElections.has(id);
      const isLocked = lockedCountyId === id;
      const isHovered = hoveredCountyId === id;

      if ((isLocked || isHovered) && hasElections) {
        const elections = getElectionsForCounty(id);
        return activeStyle(elections, isLocked);
      }

      if (isLocked || isHovered) {
        return {
          fillColor: "#475569",
          fillOpacity: 0.15,
          color: "#64748b",
          weight: 1.5,
          opacity: 0.6,
        };
      }

      return {
        fillColor: hasElections ? "#1e40af" : "transparent",
        fillOpacity: hasElections ? 0.12 : 0,
        color: hasElections ? "#60a5fa" : "#1e293b",
        weight: hasElections ? 1 : 0.3,
        opacity: hasElections ? 0.4 : 0.15,
      };
    },
    [hoveredCountyId, lockedCountyId]
  );

  const onEachCounty = useCallback(
    (feature: GeoFeature, layer: Layer) => {
      layer.on({
        mouseover: (e: LeafletMouseEvent) => {
          onHover(String(feature.id), feature.properties.name, e);
        },
        mouseout: () => onLeave(),
        click: () => onClick(String(feature.id), feature.properties.name),
      });
    },
    [onHover, onLeave, onClick]
  );

  return (
    <GeoJSON
      key={`counties-${hoveredCountyId}-${lockedCountyId}`}
      data={{ type: "FeatureCollection", features } as FeatureCollection}
      style={(feature) => countyStyle(feature as GeoFeature)}
      onEachFeature={(feature, layer) =>
        onEachCounty(feature as GeoFeature, layer)
      }
    />
  );
}

// ── Main component ────────────────────────────────────────────────

export default function ElectionMap({
  onHoverElections,
  onClearHover,
  onClickRegion,
  lockedRegionKey,
}: ElectionMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [zoom, setZoom] = useState(5);
  const [hoveredStateId, setHoveredStateId] = useState<string | null>(null);
  const [hoveredCountyId, setHoveredCountyId] = useState<string | null>(null);

  // Show counties at zoom >= 7
  const showCounties = zoom >= 7;

  // Derive locked IDs from the parent's lockedRegionKey
  // Keys are "state:XX" or "county:XXXXX"
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
    ]).then(([statesTopo, countiesTopo]: [Topology, Topology]) => {
      const statesGeo = topojson.feature(statesTopo, statesTopo.objects.states);
      const countiesGeo = topojson.feature(
        countiesTopo,
        countiesTopo.objects.counties
      );
      setMapData({
        states: (statesGeo as unknown as { features: GeoFeature[] }).features,
        counties: (countiesGeo as unknown as { features: GeoFeature[] })
          .features,
      });
    });
  }, []);

  // ── Hover handlers (skip if locked) ─────────────────────────────

  const handleStateHover = useCallback(
    (id: string, name: string, _e: LeafletMouseEvent) => {
      if (lockedRegionKey || showCounties) return;
      setHoveredStateId(id);
      const elections = getElectionsForState(id);
      if (elections.length > 0) {
        onHoverElections(elections, name);
      } else {
        onClearHover();
      }
    },
    [showCounties, lockedRegionKey, onHoverElections, onClearHover]
  );

  const handleCountyHover = useCallback(
    (id: string, name: string, _e: LeafletMouseEvent) => {
      if (lockedRegionKey) return;
      setHoveredCountyId(id);
      const stateId = id.substring(0, 2);
      const stateElections = getElectionsForState(stateId);
      const countyElections = getElectionsForCounty(id);
      const allElections = [...countyElections, ...stateElections];
      setHoveredStateId(stateId);
      if (allElections.length > 0) {
        onHoverElections(allElections, name);
      } else {
        onClearHover();
      }
    },
    [lockedRegionKey, onHoverElections, onClearHover]
  );

  const handleLeave = useCallback(() => {
    if (lockedRegionKey) return;
    setHoveredStateId(null);
    setHoveredCountyId(null);
    onClearHover();
  }, [lockedRegionKey, onClearHover]);

  // ── Click handlers ──────────────────────────────────────────────

  const handleStateClick = useCallback(
    (id: string, name: string) => {
      if (showCounties) return;
      setHoveredStateId(null);
      setHoveredCountyId(null);
      const elections = getElectionsForState(id);
      onClickRegion(elections, name, `state:${id}`);
    },
    [showCounties, onClickRegion]
  );

  const handleCountyClick = useCallback(
    (id: string, name: string) => {
      setHoveredStateId(null);
      setHoveredCountyId(null);
      const stateId = id.substring(0, 2);
      const stateElections = getElectionsForState(stateId);
      const countyElections = getElectionsForCounty(id);
      const allElections = [...countyElections, ...stateElections];
      onClickRegion(allElections, name, `county:${id}`);
    },
    [onClickRegion]
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
        hoveredStateId={hoveredStateId}
        lockedStateId={lockedStateId}
        onHover={handleStateHover}
        onLeave={handleLeave}
        onClick={handleStateClick}
      />

      {showCounties && (
        <CountyLayer
          features={mapData.counties}
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
