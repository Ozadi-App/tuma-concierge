"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { jawgTileUrl, useJawgStyle } from "../../lib/mapStyle";
import { OSM_TILES, loadMapTiles, type Tiles } from "../../lib/map-tiles";
import { destinationIcon, pickupIcon } from "../maps/map-icons";

type Point = { lat: number; lng: number };

function Fit({ points }: { points: Point[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** A small read-only map: the provider (dot) and, when known, the job address (pin). */
export default function WorkTrackingMap({ provider, destination }: { provider: Point; destination: Point | null }) {
  const [tiles, setTiles] = useState<Tiles>(OSM_TILES);
  const [ready, setReady] = useState(false);
  const jawgStyle = useJawgStyle(tiles.jawg?.adminLightStyle ?? "normal");
  const tileUrl = tiles.jawg ? jawgTileUrl(jawgStyle, tiles.jawg.accessToken) : tiles.url;

  useEffect(() => {
    let cancelled = false;
    loadMapTiles()
      .then((t) => !cancelled && setTiles(t))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <div className="h-full w-full bg-[rgb(var(--surface-muted))]" aria-hidden />;
  return (
    <MapContainer center={[provider.lat, provider.lng]} zoom={15} zoomControl={false} className={`peebee-map h-full w-full${tiles.jawg ? " peebee-map-native" : ""}`}>
      <TileLayer key={tileUrl} url={tileUrl} attribution={tiles.attribution} />
      <Fit points={destination ? [provider, destination] : [provider]} />
      <Marker position={[provider.lat, provider.lng]} icon={pickupIcon} interactive={false} />
      {destination ? <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} interactive={false} /> : null}
    </MapContainer>
  );
}
