"use client";

import { useMemo } from "react";
import type { DoorId } from "../lib/door-ids";
import { DOOR_CONTENT } from "../lib/content";
import { APP_FEATURES } from "../lib/features";
import { moduleOfFeatureId, moduleOfSub } from "../lib/module-map";
import { useWebModules } from "../lib/web-modules";

/** A door's content with the services and features whose module is switched off in Admin left out. */
export function useDoorContent(id: DoorId) {
  const modules = useWebModules();
  return useMemo(() => {
    const c = DOOR_CONTENT[id];
    const keep = (s: { door: DoorId; key: string }) => modules.on(moduleOfSub(s.door, s.key));
    return { ...c, items: c.items.filter(keep), features: c.features.filter(keep) };
  }, [id, modules]);
}

/** The account-menu features ("Also in the app"), without the ones whose module is switched off (Parcels, for example). */
export function useAppFeatures() {
  const modules = useWebModules();
  return useMemo(() => APP_FEATURES.filter((f) => { const key = moduleOfFeatureId(f.id); return !key || modules.on(key); }), [modules]);
}
