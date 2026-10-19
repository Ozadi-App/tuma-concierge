"use client";

import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, Polyline, useMap } from "react-leaflet";
import { fetchDrivingRoute } from "../../lib/navTiles";
import { stopIcon } from "./map-icons";

type Point = { lat: number; lng: number };
export type MapStop = Point & { done?: boolean };

/**
 * A ride's route through its stops: one road route per leg (pickup → stop 1
 * → … → destination), drawn as a single gold line, with numbered markers.
 * A leg the routing service can't answer is drawn straight so the line never
 * has gaps.
 */
export function MultiStopRoute({ pickup, destination, stops, bottomInset = 0, topInset = 40 }: { pickup: Point; destination: Point; stops: MapStop[]; bottomInset?: number; topInset?: number }) {
  const map = useMap();
  const points = [pickup, ...stops, destination];
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(">");
  const [line, setLine] = useState<{ key: string; coords: [number, number][] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let live = true;
    const legs = points.slice(1).map((to, i) =>
      fetchDrivingRoute(points[i], to, controller.signal)
        .then((r) => (r?.coordinates?.length ? r.coordinates : null))
        .catch(() => null)
        .then((coords) => coords ?? ([[points[i].lat, points[i].lng], [to.lat, to.lng]] as [number, number][])),
    );
    void Promise.all(legs)
      .then((all) => live && setLine({ key, coords: all.flat() as [number, number][] }))
      .finally(() => window.clearTimeout(timeout));
    return () => { live = false; controller.abort(); window.clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const coords = line?.key === key ? line.coords : (points.map((p) => [p.lat, p.lng]) as [number, number][]);
  useEffect(() => {
    map.fitBounds(L.latLngBounds(coords), { paddingTopLeft: [40, topInset], paddingBottomRight: [40, bottomInset + 30], maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, line?.key, bottomInset, topInset]);

  return (
    <>
      <Polyline positions={coords} interactive={false} pathOptions={{ color: "#FDFBF7", weight: 9, opacity: 0.95 }} />
      <Polyline positions={coords} interactive={false} pathOptions={{ color: "#C9A227", weight: 5, opacity: 1, dashArray: line?.key === key ? undefined : "2 10" }} />
      {stops.map((s, i) => (
        <Marker key={`${i}-${s.lat}-${s.lng}`} position={[s.lat, s.lng]} icon={stopIcon(i + 1, s.done)} interactive={false} />
      ))}
    </>
  );
}
