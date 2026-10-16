"use client";

import type { OrderRow, RideStop } from "@peebee/shared";
import { Check, Navigation } from "lucide-react";
import { useTranslate } from "../lib/i18n";

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** The ordered route of a multi-stop ride: pickup, each stop with its progress, destination. */
export function RideStopsPanel({ order, stops }: { order: OrderRow; stops: RideStop[] }) {
  const t = useTranslate();
  const nextIndex = stops.findIndex((s) => s.status !== "done");
  const aboard = order.stage === "PickedUp" || order.stage === "Handover" || order.stage === "Settle";
  const rows = [
    { key: "pickup", label: t("stop_pickup"), place: order.pickup_area ?? order.pickup_address, done: aboard, current: false, lat: null as number | null, lng: null as number | null },
    ...stops.map((stop, index) => ({
      key: `stop-${stop.position}`,
      label: t("stop_label", { n: stop.position }),
      place: stop.area ?? stop.address,
      done: stop.status === "done",
      current: aboard && index === nextIndex,
      arrived: stop.status === "arrived",
      lat: stop.lat,
      lng: stop.lng,
    })),
    {
      key: "destination",
      label: t("stop_destination"),
      place: order.destination_area ?? order.destination_address,
      done: order.stage === "Handover" || order.stage === "Settle",
      current: order.stage === "PickedUp" && nextIndex === -1,
      lat: order.destination_lat,
      lng: order.destination_lng,
    },
  ];
  return (
    <section className="rounded-2xl border border-gold/25 bg-gold/10 p-4" aria-label={t("stops_title")}>
      <h2 className="font-bold text-ink">{t("stops_title")} · {stops.length === 1 ? t("stops_one") : t("stops_count", { count: stops.length })}</h2>
      <ol className="mt-3 space-y-0">
        {rows.map((row, index) => (
          <li key={row.key} className="relative flex items-center gap-3 py-2">
            {index < rows.length - 1 && <span className="absolute left-[11px] top-8 h-[calc(100%-1rem)] w-0.5 bg-gold/30" aria-hidden />}
            <span
              className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                row.done ? "bg-green text-white" : row.current ? "bg-gold text-ink-gold" : "border border-gold/50 bg-[rgb(var(--surface))] text-ink"
              }`}
              aria-hidden
            >
              {row.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : row.key === "pickup" ? "A" : row.key === "destination" ? "B" : index}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">
                {row.label}
                {row.done && <span className="sr-only"> · {t("stop_done")}</span>}
                {row.current && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-ink-gold">{"arrived" in row && row.arrived ? t("stop_waiting", { n: index }) : t("stop_next")}</span>}
              </span>
              {row.place && <span className="block truncate text-xs text-ink-500">{row.place}</span>}
            </span>
            {!row.done && row.lat != null && row.lng != null && row.key !== "pickup" && (
              <a
                href={directionsUrl(row.lat, row.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[rgb(var(--surface))] px-3 text-xs font-bold text-ink"
                aria-label={`${t("stop_navigate")} · ${row.label}`}
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden /> {t("stop_navigate")}
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
