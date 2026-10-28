"use client";

import { useEffect, useState } from "react";
import { isModuleOn, type ModuleAvailability, type ModuleSettings, type ModuleWorld } from "./modules.js";
import { isPracticeMode } from "./practice-runtime.js";

/** Keeps only the items whose module (if they name one) is on. Items without a module always stay. */
export function filterByModule<T extends { module?: string }>(items: readonly T[], on: (key: string) => boolean): T[] {
  return items.filter((item) => !item.module || on(item.module));
}

/**
 * Builds an app's `useModules` hook from its own settings call. `on("ride.car")` is false while Peebee Car, or the Ride
 * cluster above it, is switched off in Admin → Services for the world this device is in (Practice only when the person
 * switched it on). Before the first load, offline, or for an unknown module it reads as on, so a slow load never hides a tab.
 */
export function createUseModules(load: () => Promise<{ settings: { modules?: ModuleSettings } }>): () => (key: string) => boolean {
  let cached: { at: number; value: ModuleAvailability } | null = null;
  let inflight: Promise<ModuleAvailability | null> | null = null;

  const fetchAvailability = (): Promise<ModuleAvailability | null> => {
    if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.value);
    inflight ??= load()
      .then((res) => {
        const available = res.settings.modules?.available;
        if (available) cached = { at: Date.now(), value: available };
        return available ?? null;
      })
      .catch(() => cached?.value ?? null)
      .finally(() => { inflight = null; });
    return inflight;
  };

  return function useModules() {
    const [available, setAvailable] = useState<ModuleAvailability | null>(cached?.value ?? null);
    useEffect(() => {
      let live = true;
      void fetchAvailability().then((v) => { if (live) setAvailable(v); });
      return () => { live = false; };
    }, []);
    const world: ModuleWorld = isPracticeMode() ? "practice" : "live";
    return (key) => isModuleOn(key, world, available);
  };
}
