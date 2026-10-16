"use client";

import type { RelayMerchantOrder, RelayTrack } from "@peebee/shared";
import { ArrowLeft, ChevronDown, ChevronRight, Fuel, RotateCcw, Truck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelayTimeline, formatWhen, heldAtStation } from "../../components/RelayTimeline";
import { api, errorMessage } from "../../lib/api";

const REFRESH_MS = 20_000;
const errorBox = "rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300";

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<RelayMerchantOrder[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [track, setTrack] = useState<RelayTrack | null>(null);
  const [trackError, setTrackError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const openRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders((await api.listMerchantRelayOrders()).orders);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrack = useCallback(async (id: string) => {
    try {
      const res = await api.trackRelayOrder(id);
      if (openRef.current !== id) return;
      setTrack(res);
      setTrackError("");
    } catch (err) {
      if (openRef.current === id) setTrackError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    openRef.current = openId;
    setTrack(null);
    setTrackError("");
    if (!openId) return;
    void loadTrack(openId);
    const timer = window.setInterval(() => void loadTrack(openId), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [openId, loadTrack]);

  return (
    <div className="space-y-5 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to overview"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Deliveries</h1>
          <p className="truncate text-sm text-ink-500">Follow store orders sent by matatu</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && <p className={errorBox}>{error}</p>}
      {orders && orders.length === 0 && <p className="home-card text-sm text-ink-500">No relayed deliveries yet.</p>}

      {orders?.map((o) => {
        const open = openId === o.id;
        const shown = open && track?.order.id === o.id ? track : null;
        return (
          <article key={o.id} className="home-card space-y-3">
            <button type="button" onClick={() => setOpenId(open ? null : o.id)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <Truck className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  {o.customer_name ?? "Customer"}
                  {o.destination_area ? ` · ${o.destination_area}` : ""}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {o.store_name} · {o.stage} · {formatWhen(o.created_at)}
                </span>
              </span>
              {open ? <ChevronDown className="h-5 w-5 shrink-0 text-ink-500" /> : <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" />}
            </button>
            {open && (
              <div className="border-t border-[var(--border-faint)] pt-3">
                {trackError && <p className={errorBox}>{trackError}</p>}
                {!shown && !trackError && <p className="text-sm text-ink-500">Loading…</p>}
                {shown && (
                  <div className="space-y-3">
                    {heldAtStation(shown.relay) && (
                      <p className="flex items-center gap-2 text-sm font-semibold text-gold">
                        <Fuel className="h-4 w-4 shrink-0" aria-hidden /> Held at {shown.relay.station?.name ?? "the station"}
                      </p>
                    )}
                    <RelayTimeline track={shown} />
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
