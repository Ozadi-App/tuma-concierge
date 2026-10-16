"use client";

import type { RelayLegStatus, RelayTrack } from "@peebee/shared";
import { Bike, Bus, Fuel } from "lucide-react";
import type { ReactNode } from "react";

const legStatus: Record<RelayLegStatus, string> = {
  waiting: "Waiting",
  open: "Finding a rider",
  assigned: "Assigned",
  in_transit: "On the way",
  arrived: "Arrived",
  done: "Done",
};

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-UG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Step = { key: string; icon: ReactNode; title: string; detail: string; status: string; done: boolean; active: boolean };

/** Whether a station-drop parcel is sitting at the station right now. */
export function heldAtStation(relay: RelayTrack["relay"]) {
  return relay.dropMode === "station" && !!relay.heldAt && !relay.releasedAt;
}

/** The whole relay journey: each leg, the station stop, and the order's event log. */
export function RelayTimeline({ track, showEvents = true }: { track: RelayTrack; showEvents?: boolean }) {
  const { relay, events } = track;
  const legs = [...relay.legs].sort((a, b) => a.leg - b.leg);
  const steps: Step[] = [];
  const iconClass = "h-4 w-4";

  for (const leg of legs) {
    const boda = leg.kind === "boda";
    const who = boda ? "Boda" : `Matatu${leg.vehiclePlate ? ` ${leg.vehiclePlate}` : ""}`;
    steps.push({
      key: leg.id,
      icon: boda ? <Bike className={iconClass} aria-hidden /> : <Bus className={iconClass} aria-hidden />,
      title: `${who}: ${leg.fromName ?? "?"} → ${leg.toName ?? "?"}`,
      detail: [leg.providerName, leg.handedOverAt ? `Handed over ${formatWhen(leg.handedOverAt)}` : leg.startedAt ? `Started ${formatWhen(leg.startedAt)}` : ""]
        .filter(Boolean)
        .join(" · "),
      status: legStatus[leg.status],
      done: leg.status === "done",
      active: leg.status === "assigned" || leg.status === "in_transit" || leg.status === "arrived",
    });
    if (leg.leg === 2 && relay.dropMode === "station") {
      const released = relay.releasedAt
        ? `${relay.releasedTo === "customer" ? "Collected by customer" : "Given to rider"} ${formatWhen(relay.releasedAt)}`
        : "";
      steps.push({
        key: "station",
        icon: <Fuel className={iconClass} aria-hidden />,
        title: `Station: ${relay.station?.name ?? leg.toName ?? "petrol station"}`,
        detail: [relay.heldAt ? `Received ${formatWhen(relay.heldAt)}` : "", released].filter(Boolean).join(" · "),
        status: relay.releasedAt ? "Done" : relay.heldAt ? "Holding" : "Waiting",
        done: !!relay.releasedAt,
        active: heldAtStation(relay),
      });
    }
  }
  if (relay.dropMode === "station" && !legs.some((l) => l.leg === 3)) {
    steps.push({
      key: "last",
      icon: <Bike className={iconClass} aria-hidden />,
      title: relay.lastMile === "collect" ? "Customer collects at the station" : "Customer chooses door or collection",
      detail: "",
      status: relay.releasedAt ? "Done" : "Waiting",
      done: !!relay.releasedAt,
      active: false,
    });
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-0">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-[var(--border-faint)]" aria-hidden />}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                step.done ? "bg-gold text-ink-gold" : step.active ? "bg-gold/15 text-gold" : "bg-[rgb(var(--surface))] text-ink-500"
              }`}
            >
              {step.icon}
            </span>
            <span className="min-w-0 flex-1 pt-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{step.title}</span>
                <span className={`shrink-0 text-xs font-bold ${step.active ? "text-gold" : "text-ink-500"}`}>{step.status}</span>
              </span>
              {step.detail && <span className="block text-xs text-ink-500">{step.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
      {showEvents && events.length > 0 && (
        <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Log</h3>
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className="flex justify-between gap-3 text-xs">
                <span className="min-w-0 text-ink">{e.note || e.stage}</span>
                <span className="shrink-0 text-ink-500">{formatWhen(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
