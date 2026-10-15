"use client";

import type { ListSummary } from "@peebee/shared";
import { ChevronRight, ListChecks, MapPinned, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderKindIcon } from "../../../components/OrderKindIcon";
import { loadOrderFeed } from "../../../lib/order-feed";
import { formatDateTime } from "../../../lib/order-display";

export default function OrderHistoryPage() {
  const [past, setPast] = useState<ListSummary[]>([]);
  const [inProgress, setInProgress] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadOrderFeed()
      .then((feed) => { if (!cancelled) { setPast(feed.past); setInProgress(feed.inProgress.length); setState("ready"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Orders</h1>
          <p className="mt-0.5 text-sm text-ink-500">Everything you&apos;ve ordered before</p>
        </div>
        <Link href="/orders" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-faint)] px-3 py-2 text-xs font-bold text-ink">
          <ListChecks className="h-4 w-4 text-gold" strokeWidth={2} aria-hidden />
          Lists
        </Link>
      </div>

      {inProgress > 0 && (
        <Link href="/track" className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3">
          <MapPinned className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.9} aria-hidden />
          <span className="flex-1 text-sm font-semibold text-ink">{inProgress} order{inProgress === 1 ? "" : "s"} on the way</span>
          <span className="text-xs font-bold text-ink">Track</span>
          <ChevronRight className="h-4 w-4 text-ink-500/60" strokeWidth={1.75} aria-hidden />
        </Link>
      )}

      {state === "loading" && (
        <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((i) => <div key={i} className="home-card h-[70px] animate-pulse !rounded-2xl" />)}
        </div>
      )}

      {state === "error" && <p className="py-10 text-center text-sm text-ink-500">Couldn&apos;t load your orders right now.</p>}

      {state === "ready" && past.length === 0 && (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/15 text-gold">
            <Package className="h-8 w-8" strokeWidth={1.7} aria-hidden />
          </span>
          <p className="mt-4 text-base font-bold text-ink">No past orders yet</p>
          <p className="mt-1 text-sm text-ink-500">Orders you&apos;ve received will appear here, so you can look back or order again.</p>
        </div>
      )}

      {past.length > 0 && (
        <ul className="space-y-2.5">
          {past.map((list) => (
            <li key={list.id}>
              <Link href={`/orders/${list.orderId}`} className="home-card flex items-center gap-3 !rounded-2xl !px-3 !py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <OrderKindIcon kind="list" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{list.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">
                    {formatDateTime(list.updatedAt)} · {list.itemCount} item{list.itemCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs font-semibold text-ink-500">Delivered</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
