"use client";

import { ArrowRight, Bus, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTaxipress } from "../../../lib/taxipress";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

/** Taxipress home: the routes that are running and what a seat costs. Seat booking is added in later releases. */
export default function TaxipressPage() {
  const taxipress = useTaxipress();

  return (
    <main className="space-y-5 px-4 pb-8 pt-4">
      <Link href="/ride" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Ride
      </Link>
      <section className="home-card border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold"><Bus size={22} strokeWidth={1.8} aria-hidden /></span>
        <h1 className="mt-3 text-2xl font-bold">Taxipress</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">Book a seat on the next taxi, or on a later one in the line. Taxis leave when every seat is booked.</p>
      </section>

      {!taxipress.enabled ? (
        <p className="text-sm text-ink-500" role="status">Taxipress isn&apos;t running right now.</p>
      ) : (
        <section aria-label="Taxipress routes" className="space-y-2">
          {taxipress.routes.map((route) => (
            <div key={route.id} className="ride-link-tile flex items-center justify-between gap-3 rounded-2xl p-3">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{route.fromName} <ArrowRight className="inline h-3.5 w-3.5" aria-hidden /> {route.toName}</span>
                <span className="block text-[11px] text-ink-500">{route.directionLabel}</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-gold">{ugx(route.farePerSeat)}<span className="text-[11px] font-semibold text-ink-500"> / seat</span></span>
            </div>
          ))}
          <p className="px-1 pt-2 text-xs text-ink-500">Seat booking is opening soon.</p>
        </section>
      )}
    </main>
  );
}
