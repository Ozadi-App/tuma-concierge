"use client";

import type { WorkJob } from "@peebee/shared";
import { Navigation } from "lucide-react";
import dynamic from "next/dynamic";
import { cardClass } from "./WorkUI";
import { parseWorkDate } from "./work-utils";

const WorkTrackingMap = dynamic(() => import("./WorkTrackingMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[rgb(var(--surface-muted))]" aria-hidden />,
});

/** A position older than this is treated as "not live" and hidden. */
const STALE_AFTER_MS = 10 * 60_000;

export function isTrackable(job: WorkJob, trackingEnabled: boolean | undefined, now = Date.now()): boolean {
  if (!trackingEnabled || !job.providerLocation) return false;
  if (job.status !== "booked" && job.status !== "in_progress") return false;
  const at = parseWorkDate(job.providerLocation.updatedAt);
  return !!at && now - at.getTime() <= STALE_AFTER_MS;
}

function minutesAgo(iso: string | null): string {
  const at = parseWorkDate(iso);
  if (!at) return "";
  const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
  return mins < 1 ? "just now" : mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
}

export function WorkTracking({ job }: { job: WorkJob }) {
  const loc = job.providerLocation;
  if (!loc) return null;
  const destination = job.lat != null && job.lng != null ? { lat: job.lat, lng: job.lng } : null;
  return (
    <section className={`${cardClass} space-y-3`} aria-labelledby="track-heading">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-gold" aria-hidden />
        <h2 id="track-heading" className="text-sm font-bold">
          {job.status === "in_progress" ? "Your provider is at the job" : job.arrivedAt ? "Your provider has arrived" : "Your provider is on the way"}
        </h2>
      </div>
      <div className="h-56 overflow-hidden rounded-2xl" role="img" aria-label="Map showing your provider's position">
        <WorkTrackingMap provider={{ lat: loc.lat, lng: loc.lng }} destination={destination} />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-ink-500">
        <span>Updated {minutesAgo(loc.updatedAt)}</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center font-bold text-gold underline"
        >
          Open in Maps
        </a>
      </div>
    </section>
  );
}
