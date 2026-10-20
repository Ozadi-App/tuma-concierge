"use client";

import dynamic from "next/dynamic";
import { MapPinned } from "lucide-react";
import { useEffect, useState } from "react";
import type { HomeMapProps } from "../home/HomeMap";

const HomeMap = dynamic(() => import("../home/HomeMap"), { ssr: false, loading: () => <MapPlaceholder /> });

type NetworkInformation = { effectiveType?: string; saveData?: boolean };

/** Low-data phones (Save-Data on, or a 2G connection) get a still backdrop
 * and a "Show map" button instead of downloading Leaflet and map tiles. */
function prefersLowData(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !!conn && (conn.saveData === true || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g");
}

function MapPlaceholder({ children }: { children?: React.ReactNode }) {
  return (
    <div className="ride-map-placeholder relative h-full w-full" aria-hidden={!children}>
      {children}
    </div>
  );
}

/**
 * The Ride home's live map. It never blocks the sheet: the page paints with a
 * themed backdrop, and the map library only loads once the browser is idle
 * (or on demand when the connection is slow / Save-Data is on).
 */
export function RideLiveMap(props: HomeMapProps) {
  const [state, setState] = useState<"waiting" | "low-data" | "load">("waiting");

  useEffect(() => {
    if (prefersLowData()) {
      setState("low-data");
      return;
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setState("load"), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setState("load"), 300);
    return () => window.clearTimeout(t);
  }, []);

  if (state === "load") return <HomeMap {...props} />;
  return (
    <MapPlaceholder>
      {state === "low-data" && (
        <button
          type="button"
          onClick={() => setState("load")}
          className="absolute left-1/2 top-[22%] flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full glass-panel px-4 text-sm font-bold text-ink shadow-[var(--shadow-float-capsule)]"
        >
          <MapPinned className="h-4 w-4" aria-hidden /> Show map
          <span className="text-xs font-semibold text-ink-500">· saves data when off</span>
        </button>
      )}
    </MapPlaceholder>
  );
}
