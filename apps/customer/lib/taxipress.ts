"use client";

import { TAXIPRESS_DEFAULT_LUGGAGE_PRICES, type TaxipressConfig } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api } from "./api";

const NONE: TaxipressConfig = {
  enabled: false, routes: [], cashEnabled: false, seatChoiceFeeUgx: 0, returnDiscountPercent: 0, maxSeatsPerBooking: 1, payWithinMinutes: 10, parcelFitText: "", parcelNotAllowed: [],
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
    // Offline or not signed in: show nothing rather than a broken card (not cached, so the next screen retries).
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

/**
 * Step 3 options: on with Fly Express defaults unless staff explicitly switched one off.
 * A missing or failed config never hides them.
 */
export function taxipressOptions(cfg: TaxipressConfig) {
  const prices = { ...TAXIPRESS_DEFAULT_LUGGAGE_PRICES, ...(cfg.luggagePrices ?? {}) };
  return {
    luggage: cfg.luggageEnabled !== false,
    prices,
    assistance: cfg.assistanceEnabled !== false,
    language: cfg.languageEnabled !== false,
    forOthers: cfg.bookForOthersEnabled !== false,
  };
}
