"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";

export interface ClickPoint {
  lat: number;
  lng: number;
}

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
}

interface ElectionMapProps {
  onMapClick: (point: ClickPoint) => void;
  pin: ClickPoint | null;
  flyTo?: FlyToTarget | null;
}

function ClickHandler({ onMapClick }: { onMapClick: (p: ClickPoint) => void }) {
  useMapEvents({
    click: (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
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

export default function ElectionMap({ onMapClick, pin, flyTo }: ElectionMapProps) {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={5}
      minZoom={3}
      maxZoom={18}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <FlyToHandler target={flyTo} />
      {pin && (
        <>
          <CircleMarker
            center={[pin.lat, pin.lng]}
            radius={10}
            pathOptions={{
              color: "#22d3ee",
              weight: 2,
              fillColor: "#22d3ee",
              fillOpacity: 0.25,
            }}
          />
          <CircleMarker
            center={[pin.lat, pin.lng]}
            radius={3}
            pathOptions={{
              color: "#ffffff",
              weight: 0,
              fillColor: "#ffffff",
              fillOpacity: 1,
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
