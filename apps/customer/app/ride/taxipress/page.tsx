"use client";

import type { TaxipressBooking, TaxipressQueueView } from "@peebee/shared";
import { Bus, ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";
import { useTaxipress } from "../../../lib/taxipress";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;
const REFRESH_MS = 10_000;

/** Taxipress home: pick a way, see the taxis in the line, book a seat. */
export default function TaxipressPage() {
  const taxipress = useTaxipress();
  const [picked, setPicked] = useState<string | null>(null);
  const routeId = taxipress.routes.find((r) => r.id === picked)?.id ?? taxipress.routes[0]?.id ?? null;

  const [queue, setQueue] = useState<TaxipressQueueView | null>(null);
  const [bookings, setBookings] = useState<TaxipressBooking[]>([]);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!routeId) return;
    let live = true;
    api.getTaxipressQueue(routeId)
      .then((q) => { if (live) { setQueue(q); setError(""); } })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    const id = window.setTimeout(() => setTick((t) => t + 1), REFRESH_MS);
    return () => { live = false; window.clearTimeout(id); };
  }, [routeId, tick]);

  useEffect(() => {
    let live = true;
    api.getMyTaxipressBookings()
      .then((res) => { if (live) setBookings(res.bookings.filter((b) => b.status === "booked" || b.status === "boarded")); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const current = queue?.route && queue.route.id === routeId ? queue : null;

  return (
    <main className="space-y-5 px-4 pb-8 pt-4">
      <Link href="/ride" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Ride
      </Link>
      <section className="home-card border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold"><Bus size={22} strokeWidth={1.8} aria-hidden /></span>
        <h1 className="mt-3 text-2xl font-bold">Taxipress</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">Book a seat on the next taxi, or on a later one in the line. A taxi leaves when every seat is booked.</p>
      </section>

      {bookings.length > 0 && (
        <section aria-label="Your seats" className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-ink">Your seats</h2>
          {bookings.map((b) => (
            <Link key={b.id} href={`/ride/taxipress/ticket/${b.id}`} className="ride-link-tile flex items-center justify-between gap-3 rounded-2xl p-3">
              <span className="flex min-w-0 items-center gap-3">
                <Ticket className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{b.route.fromName} → {b.route.toName}</span>
                  <span className="block text-[11px] text-ink-500">{b.seats} seat{b.seats === 1 ? "" : "s"} · {b.taxi.plate} · {b.paymentStatus === "unpaid" ? "Payment due" : b.paymentStatus === "pay_driver" ? "Pay the driver" : "Paid"}</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            </Link>
          ))}
        </section>
      )}

      {!taxipress.enabled ? (
        <p className="text-sm text-ink-500" role="status">Taxipress isn&apos;t running right now.</p>
      ) : (
        <section aria-label="Taxis in the line" className="space-y-3">
          {taxipress.routes.length > 1 && (
            <div role="group" aria-label="Which way" className="grid gap-2">
              {taxipress.routes.map((r) => (
                <button key={r.id} type="button" aria-pressed={routeId === r.id} onClick={() => setPicked(r.id)} className={`min-h-11 rounded-2xl px-3 text-left text-sm font-bold ${routeId === r.id ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>
                  {r.fromName} → {r.toName}
                </button>
              ))}
            </div>
          )}
          {error && <p role="alert" className="text-xs font-semibold text-[rgb(var(--color-red,200_40_40))]">{error}</p>}
          {current && (
            <>
              <p className="px-1 text-xs text-ink-500">{current.route!.fromName} → {current.route!.toName} · {ugx(current.route!.farePerSeat)} per seat</p>
              {current.line.length === 0 ? (
                <p className="text-sm text-ink-500" role="status">No taxi is in the line yet. Check again in a moment.</p>
              ) : (
                <ol className="space-y-2">
                  {current.line.map((van) => (
                    <li key={van.id}>
                      <Link
                        href={van.fullyBooked ? "#" : `/ride/taxipress/book/${routeId}/${van.id}`}
                        aria-disabled={van.fullyBooked}
                        className={`ride-link-tile flex items-center justify-between gap-3 rounded-2xl p-3 ${van.fullyBooked ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink">
                            {van.status === "boarding" ? "Boarding now" : van.position === 1 ? "Next" : `${van.position}${van.position === 2 ? "nd" : van.position === 3 ? "rd" : "th"} in line`} · {van.plate}
                          </span>
                          <span className="block text-[11px] text-ink-500">{van.driverName ?? "Driver"} · {van.seatsTotal}-seater</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-gold">{van.fullyBooked ? "Fully booked" : `${van.seatsLeft} seat${van.seatsLeft === 1 ? "" : "s"} left`}</span>
                          {!van.fullyBooked && <span className="block text-[11px] font-semibold text-ink-500">Book</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {current.onRoad.length > 0 && <p className="px-1 text-[11px] text-ink-500">{current.onRoad.length} taxi{current.onRoad.length === 1 ? " is" : "s are"} already on the road.</p>}
            </>
          )}
        </section>
      )}
    </main>
  );
}
