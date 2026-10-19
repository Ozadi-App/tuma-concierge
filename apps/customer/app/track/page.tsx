"use client";

import { ChevronRight, MapPin, MapPinned, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderKindIcon } from "../../components/OrderKindIcon";
import { loadTrackedOrders, orderKind, ORDER_KIND_LABEL, type TrackedOrder } from "../../lib/order-feed";
import { stageLabel, stageProgressPct } from "../../lib/order-display";

export default function TrackPage() {
  const [tracked, setTracked] = useState<TrackedOrder[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadTrackedOrders()
      .then((rows) => { if (!cancelled) { setTracked(rows); setState("ready"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Track</h1>
        <p className="mt-0.5 text-sm text-ink-500">Parcels, marketplace buys and deliveries on the way</p>
      </div>

      {state === "loading" && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          {[0, 1].map((i) => <div key={i} className="home-card h-32 animate-pulse !rounded-3xl" />)}
        </div>
      )}

      {state === "error" && <p className="py-10 text-center text-sm text-ink-500">Couldn&apos;t load your deliveries. Pull down to try again.</p>}

      {state === "ready" && tracked.length === 0 && (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/15 text-gold">
            <MapPinned className="h-8 w-8" strokeWidth={1.7} aria-hidden />
          </span>
          <p className="mt-4 text-base font-bold text-ink">Nothing on the way</p>
          <p className="mt-1 text-sm text-ink-500">Send a parcel or buy from the marketplace and you can follow it here, step by step.</p>
          <Link href="/stores" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-gold px-5 text-sm font-bold text-ink-gold">Browse the marketplace</Link>
        </div>
      )}

      {tracked.length > 0 && (
        <ul className="space-y-3">
          {tracked.map(({ list, order }) => {
            const kind = orderKind(order);
            const stage = order?.stage ?? "Create";
            const pct = stageProgressPct(stage);
            const label = stageLabel(stage, order?.type, !!order?.is_ride);
            const destination = order?.destination_area ?? order?.destination_address ?? list.area;
            return (
              <li key={list.id}>
                <Link href={`/orders/${list.orderId}`} className="home-card block space-y-3 !rounded-3xl">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                      <OrderKindIcon kind={kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500">{ORDER_KIND_LABEL[kind]}</span>
                      <span className="block truncate text-[15px] font-bold text-ink">{list.title}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold text-ink">{label}</span>
                      <span className="text-xs font-semibold tabular-nums text-ink-500">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${list.title}: ${label}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-gold-400/70 to-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {(destination || order?.rider_name) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      {destination && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden /><span className="truncate">To {destination}</span></span>}
                      {order?.rider_name && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />{order.rider_name}</span>}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
