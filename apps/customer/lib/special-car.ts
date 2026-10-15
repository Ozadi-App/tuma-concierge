"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

/** Which of the Luxury and Ambulance car services customers can use right now: on, and with at least one approved vehicle. */
export type SpecialCarServices = { luxury: boolean; ambulance: boolean };

const NONE: SpecialCarServices = { luxury: false, ambulance: false };
let cached: { at: number; value: SpecialCarServices } | null = null;
let inflight: Promise<SpecialCarServices> | null = null;

function load(): Promise<SpecialCarServices> {
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.value);
  inflight ??= api
    .getCarConfig()
    .then((cfg) => {
      const has = (group: "luxury" | "ambulance") => (cfg.categories ?? []).some((c) => c.service_group === group && Number(c.has_vehicles ?? 0) > 0);
      const value = { luxury: has("luxury"), ambulance: has("ambulance") };
      cached = { at: Date.now(), value };
      return value;
    })
    .catch(() => NONE)
    .finally(() => { inflight = null; });
  return inflight;
}

export function useSpecialCarServices(): SpecialCarServices {
  const [value, setValue] = useState<SpecialCarServices>(cached?.value ?? NONE);
  useEffect(() => {
    let live = true;
    void load().then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, []);
  return value;
}
