"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The website follows the same Admin → Services switches as the apps. It asks the platform which modules are on (Live
 * world only: the site is never practice) and hides what is off. Until the first answer, offline, or for a module it
 * does not know, everything reads as on, so a slow or failed load never empties the site.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";
const REFRESH_MS = 15_000;

export type ModuleNotice = { reason: "coming_soon" | "maintenance" | "unavailable"; message?: string; returnAt?: string };
type Available = Record<string, { live?: boolean }>;
type Loaded = { available: Available; notices: Record<string, ModuleNotice> };

export type WebModules = {
  ready: boolean;
  /** Is this module (and every module above it) on? */
  on: (key: string) => boolean;
  /** Why it is off, and what to tell people (the nearest notice Admin wrote, else a plain one). */
  notice: (key: string) => ModuleNotice;
};

const allOn: WebModules = { ready: false, on: () => true, notice: () => ({ reason: "unavailable" }) };
const Ctx = createContext<WebModules>(allOn);
export const useWebModules = () => useContext(Ctx);

/** A module's parent in the key ("ride.car.carpool" → "ride.car"); notices cascade down the same way. */
const parentKey = (key: string): string | null => (key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : null);

let cached: { at: number; value: Loaded } | null = null;

async function load(): Promise<Loaded | null> {
  if (cached && Date.now() - cached.at < REFRESH_MS) return cached.value;
  try {
    const res = await fetch(`${API_BASE}/v1/settings`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) return cached?.value ?? null;
    const body = (await res.json()) as { settings?: { modules?: { available?: Available; notices?: Record<string, ModuleNotice> } } };
    const modules = body.settings?.modules;
    if (!modules?.available) return cached?.value ?? null;
    cached = { at: Date.now(), value: { available: modules.available, notices: modules.notices ?? {} } };
    return cached.value;
  } catch {
    return cached?.value ?? null;
  }
}

export function WebModulesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(cached?.value ?? null);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void load().then((v) => { if (alive && v) setLoaded(v); }); };
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const value = useMemo<WebModules>(() => {
    if (!loaded) return allOn;
    return {
      ready: true,
      on: (key) => loaded.available[key]?.live ?? true,
      notice: (key) => {
        for (let k: string | null = key; k; k = parentKey(k)) {
          const n = loaded.notices[k];
          if (n) return n;
        }
        return { reason: "unavailable" };
      },
    };
  }, [loaded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
