"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { Place } from "../../lib/places";

/**
 * Stops between pickup and destination on the fare board's route card:
 * add (up to the admin's cap), move up/down, remove. Buttons rather than
 * drag handles so reordering works the same by touch, keyboard and screen
 * reader.
 */
export function RideStopsEditor({
  stops,
  maxStops,
  stopFee,
  onAdd,
  onMove,
  onRemove,
}: {
  stops: Place[];
  maxStops: number;
  stopFee: number | null;
  onAdd: () => void;
  onMove: (index: number, by: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  if (maxStops <= 0 && stops.length === 0) return null;
  const full = stops.length >= maxStops;
  return (
    <div className="space-y-1.5">
      {stops.length > 0 && (
        <ol className="space-y-1.5" aria-label="Stops on the way">
          {stops.map((stop, i) => (
            <li key={`${i}-${stop.lat}-${stop.lng}`} className="ride-stop-row flex items-center gap-2 rounded-xl py-1 pl-2.5 pr-1">
              <span className="ride-stop-chip__n flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold" aria-hidden>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-ink">{stop.label}</span>
                {stop.area && stop.area !== stop.label && <span className="block truncate text-[11px] text-ink-500">{stop.area}</span>}
              </span>
              <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move stop ${i + 1} earlier`} className="ride-icon-btn"><ArrowUp className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => onMove(i, 1)} disabled={i === stops.length - 1} aria-label={`Move stop ${i + 1} later`} className="ride-icon-btn"><ArrowDown className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => onRemove(i)} aria-label={`Remove stop ${i + 1}, ${stop.label}`} className="ride-icon-btn"><X className="h-4 w-4" aria-hidden /></button>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={full}
        className="ride-add-stop flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-[13px] font-bold text-ink disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        {full ? `Up to ${maxStops} stop${maxStops === 1 ? "" : "s"}` : "Add stop"}
        {!full && stopFee ? <span className="ml-auto text-[11px] font-semibold text-ink-500">+{stopFee.toLocaleString("en-UG")} each · Boda</span> : null}
      </button>
    </div>
  );
}
