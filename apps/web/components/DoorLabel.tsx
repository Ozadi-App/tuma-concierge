"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useHireOn, type Door } from "../lib/doors";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

/**
 * The fifth door's name. Work and Hire are two features on the same thing, so, as in the Peebee app, the label
 * swaps between them. Here the swap only runs once Hire is switched on (it is off by default) and never under
 * reduced motion; otherwise the label simply says "Work". The door id and the address (/work) never change.
 */
export function DoorLabel({ door }: { door: Door }) {
  const hire = useHireOn();
  const reduced = useReducedMotion();
  const swap = hire && !!door.altLabel && !reduced;
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    if (!swap) return;
    const t = setInterval(() => setAlt((a) => !a), (door.labelSeconds ?? 4) * 1000);
    return () => clearInterval(t);
  }, [swap, door.labelSeconds]);
  if (!swap) return <>{door.label}</>;
  const showAlt = alt;
  return (
    <span className="swap" role="img" aria-label={`${door.label} or ${door.altLabel}`}>
      <span aria-hidden data-on={!showAlt}>{door.label}</span>
      <span aria-hidden data-on={showAlt}>{door.altLabel}</span>
    </span>
  );
}
