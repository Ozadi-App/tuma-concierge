"use client";

import type { GuestTrack, GuestTrackStatus } from "@peebee/shared";
import { ChevronRight, MapPin, MapPinned, Search, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderKindIcon } from "../../components/OrderKindIcon";
import { api, errorMessage } from "../../lib/api";
import { tidyCode } from "../../lib/guest";
import { loadTrackedOrders, orderKind, ORDER_KIND_LABEL, type TrackedOrder } from "../../lib/order-feed";
import { stageLabel, stageProgressPct } from "../../lib/order-display";

const CODE_STATUS: Record<GuestTrackStatus, string> = {
  received: "Order received. The delivery is being arranged.",
  preparing: "A rider is collecting the order.",
  on_the_way: "On its way.",
  arrived: "The rider has arrived.",
  delivered: "Delivered.",
  cancelled: "This order was cancelled.",
};

/** Follow an order by its tracking code (guest orders have one): any signed-in user can, whatever the public-status switch says. */
function TrackByCode() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<GuestTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try { setResult(await api.guestTrack(code)); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <section className="home-card space-y-3 !rounded-3xl" aria-label="Track with a code">
      <form onSubmit={lookup} className="space-y-2">
        <label htmlFor="track-code" className="block text-sm font-bold text-ink">Have a tracking code?</label>
        <div className="flex gap-2">
          <input id="track-code" value={code} onChange={(e) => setCode(tidyCode(e.target.value))} placeholder="PB-XXXXXXXX" autoCapitalize="characters" autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-xl px-3 text-base tracking-wider" />
          <button type="submit" disabled={busy || code.length < 11} aria-label="Find order" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold disabled:opacity-50"><Search className="h-5 w-5" aria-hidden /></button>
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Order {result.trackingCode}</p>
          {result.item && <p className="font-bold text-ink">{result.item}</p>}
          {result.status && <p className="text-sm text-ink">{CODE_STATUS[result.status]}</p>}
          {result.orderId && <Link href={`/orders/${result.orderId}`} className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 text-sm font-bold text-ink-gold">Open order</Link>}
        </div>
      )}
    </section>
  );
}

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

      <TrackByCode />

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
