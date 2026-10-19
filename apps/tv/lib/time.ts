"use client";

import { useEffect, useRef, useState } from "react";

/** The TV's clock is not the server's. Every poll tells us how far apart they are, so countdowns agree with the phones. */
export function useServerClock(serverNow: string | undefined): () => number {
  const offset = useRef(0);
  useEffect(() => {
    if (!serverNow) return;
    const server = Date.parse(serverNow);
    if (Number.isFinite(server)) offset.current = server - Date.now();
  }, [serverNow]);
  return () => Date.now() + offset.current;
}

/** Seconds left until `endsAt` on the server's clock, ticking four times a second so it never looks stuck. */
export function useCountdown(endsAt: string | null | undefined, now: () => number): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const end = Date.parse(endsAt);
    const tick = () => setLeft(Math.max(0, Math.ceil((end - now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
    // `now` reads a ref, so it is stable enough to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return left;
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
