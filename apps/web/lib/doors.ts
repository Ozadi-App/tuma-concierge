"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { DEFAULT_DOORS, DOOR_IDS, DOOR_SLUG, doorFromSlug, doorPath, isDoorId, type Door, type DoorId } from "./door-ids";
export { DEFAULT_DOORS, DOOR_IDS, DOOR_SLUG, doorFromSlug, doorPath, isDoorId };
export type { Door, DoorId };

/** Validate whatever the admin endpoint returned. Never throws, never adds a door. */
export function normalizeDoors(input: unknown): Door[] {
  const raw = Array.isArray(input) ? input : Array.isArray((input as { doors?: unknown })?.doors) ? (input as { doors: unknown[] }).doors : null;
  if (!raw) return DEFAULT_DOORS;
  const seen = new Set<DoorId>();
  const out: Door[] = [];
  for (const r of raw) {
    const o = r as Partial<Door>;
    if (!isDoorId(o?.id) || seen.has(o.id)) continue;
    seen.add(o.id);
    const base = DEFAULT_DOORS.find((d) => d.id === o.id)!;
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 18) : base.label;
    const altLabel = typeof o.altLabel === "string" ? o.altLabel.trim().slice(0, 20) : base.altLabel;
    const labelSeconds = Number.isFinite(o.labelSeconds) ? Math.min(30, Math.max(2, Math.round(o.labelSeconds as number))) : base.labelSeconds;
    out.push({ id: o.id, label, order: Number.isFinite(o.order) ? Number(o.order) : base.order, enabled: o.enabled !== false, altLabel, labelSeconds });
  }
  for (const d of DEFAULT_DOORS) if (!seen.has(d.id)) out.push(d);
  const live = out.filter((d) => d.enabled).sort((a, b) => a.order - b.order);
  return live.length ? live : DEFAULT_DOORS;
}

/** Whether Peebee Hire is switched on. Off keeps the fifth door's name fixed on "Work". Flag: NEXT_PUBLIC_HIRE_ENABLED=1, or `hireEnabled` in the doors JSON. */
export function readHire(input: unknown): boolean {
  const v = (input as { hireEnabled?: unknown } | null)?.hireEnabled;
  if (typeof v === "boolean") return v;
  return process.env.NEXT_PUBLIC_HIRE_ENABLED === "1";
}

const HireContext = createContext<boolean>(false);
export const HireProvider = HireContext.Provider;
export const useHireOn = () => useContext(HireContext);

const DoorsContext = createContext<Door[]>(DEFAULT_DOORS);
export const DoorsProvider = DoorsContext.Provider;
export const useDoors = () => useContext(DoorsContext);

/** Loads the admin's door config once per session; falls back silently. */
export function useRemoteDoors(): { doors: Door[]; hire: boolean } {
  const [doors, setDoors] = useState<Door[]>(DEFAULT_DOORS);
  const [hire, setHire] = useState<boolean>(() => readHire(null));
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_DOORS_URL;
    if (!url) return;
    let alive = true;
    try {
      const cached = sessionStorage.getItem("peebee-doors");
      if (cached) {
        const c = JSON.parse(cached);
        setDoors(normalizeDoors(c));
        setHire(readHire(c));
      }
    } catch {}
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!alive) return;
        setDoors(normalizeDoors(j));
        setHire(readHire(j));
        try {
          sessionStorage.setItem("peebee-doors", JSON.stringify(j));
        } catch {}
      })
      .catch(() => {})
      .finally(() => clearTimeout(t));
    return () => {
      alive = false;
      ctl.abort();
    };
  }, []);
  return { doors, hire };
}
