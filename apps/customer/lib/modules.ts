"use client";

import { isModuleOn, isPracticeMode, type ModuleAvailability, type ModuleWorld } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

let cached: { at: number; value: ModuleAvailability } | null = null;
let inflight: Promise<ModuleAvailability | null> | null = null;

function load(): Promise<ModuleAvailability | null> {
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.value);
  inflight ??= api
    .getSettings()
    .then((res) => {
      const available = res.settings.modules?.available;
      if (available) cached = { at: Date.now(), value: available };
      return available ?? null;
    })
    // Offline or not loaded yet: everything reads as on, so a slow load never hides a card.
    .catch(() => cached?.value ?? null)
    .finally(() => { inflight = null; });
  return inflight;
}

/** The world this device is in: Practice only when the person switched it on. */
function currentWorld(): ModuleWorld {
  return isPracticeMode() ? "practice" : "live";
}

/** Keeps only the items whose module (if they name one) is on. Items without a module always stay. */
export function filterByModule<T extends { module?: string }>(items: readonly T[], on: (key: string) => boolean): T[] {
  return items.filter((item) => !item.module || on(item.module));
}

/**
 * Admin's Services switches as the customer app sees them: `on("ride.car")` is false while Peebee Car, or the Ride
 * cluster above it, is switched off for this world. Unknown modules read as on.
 */
export function useModules(): (key: string) => boolean {
  const [available, setAvailable] = useState<ModuleAvailability | null>(cached?.value ?? null);
  useEffect(() => {
    let live = true;
    void load().then((v) => { if (live) setAvailable(v); });
    return () => { live = false; };
  }, []);
  const world = currentWorld();
  return (key) => isModuleOn(key, world, available);
}
