"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/** While a job is booked or in progress, shares this device's location with the customer every few seconds. Stops when you leave the page or switch it off. */
export function ShareLocation({ jobId, active }: { jobId: string; active: boolean }) {
  const [on, setOn] = useState(true);
  const [state, setState] = useState<"idle" | "sharing" | "denied" | "unavailable">("idle");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active || !on) { setState("idle"); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState("unavailable"); return; }
    setState("sharing");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 8000) return;
        lastSent.current = now;
        api.workShareLocation(jobId, pos.coords.latitude, pos.coords.longitude).catch(() => {});
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [jobId, active, on]);

  if (!active) return null;
  return (
    <section className="home-card flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <MapPin className={`h-5 w-5 shrink-0 ${state === "sharing" ? "text-green" : "text-ink-500"}`} aria-hidden />
        <p className="text-xs font-medium text-ink-500">
          {state === "sharing" ? "The customer can see where you are." : state === "denied" ? "Location is blocked. Allow it in your browser settings so the customer can follow you." : state === "unavailable" ? "Your location isn't available right now." : "Location sharing is off."}
        </p>
      </div>
      <button type="button" onClick={() => setOn((v) => !v)} className="shrink-0 rounded-full border border-[var(--border-faint)] px-3 py-1.5 text-xs font-black text-ink">{on ? "Stop" : "Share"}</button>
    </section>
  );
}
