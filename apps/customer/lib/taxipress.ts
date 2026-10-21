"use client";

import type { TaxipressConfig } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

const NONE: TaxipressConfig = {
  enabled: false, routes: [], cashEnabled: false, seatChoiceFeeUgx: 0, returnDiscountPercent: 0, maxSeatsPerBooking: 1, parcelFitText: "", parcelNotAllowed: [],
};
let cached: { at: number; value: TaxipressConfig } | null = null;
let inflight: Promise<TaxipressConfig> | null = null;

function load(): Promise<TaxipressConfig> {
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.value);
  inflight ??= api
    .getTaxipressConfig()
    .then((cfg) => {
      cached = { at: Date.now(), value: cfg };
      return cfg;
    })
    // Offline or not signed in: show nothing rather than a broken card.
    .catch(() => NONE)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Taxipress as customers can use it right now: off unless staff switched it on and a route is running. */
export function useTaxipress(): TaxipressConfig {
  const [value, setValue] = useState<TaxipressConfig>(cached?.value ?? NONE);
  useEffect(() => {
    let live = true;
    void load().then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, []);
  return value;
}
