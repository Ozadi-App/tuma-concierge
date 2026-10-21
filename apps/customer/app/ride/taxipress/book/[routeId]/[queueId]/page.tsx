"use client";

import type { TaxipressLineEntry, TaxipressQueueView } from "@peebee/shared";
import { ChevronLeft, Minus, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../../../../lib/api";
import { useTaxipress } from "../../../../../../lib/taxipress";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

/** Choose seats and how to pay on one taxi in the line. */
export default function BookTaxiPage() {
  const { routeId, queueId } = useParams<{ routeId: string; queueId: string }>();
  const router = useRouter();
  const taxipress = useTaxipress();
  const [queue, setQueue] = useState<TaxipressQueueView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [seats, setSeats] = useState(1);
  const [payment, setPayment] = useState<"app" | "cash">("app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api.getTaxipressQueue(routeId)
      .then((q) => { if (live) setQueue(q); })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [routeId]);

  const van: TaxipressLineEntry | undefined = queue?.line.find((v) => v.id === queueId);
  const fare = queue?.route?.farePerSeat ?? 0;
  const most = Math.max(1, Math.min(taxipress.maxSeatsPerBooking, van?.seatsLeft ?? 1));
  const count = Math.min(seats, most);
  const total = fare * count;

  async function book() {
    if (!van) return;
    setBusy(true);
    setError("");
    try {
      const { booking, order } = await api.bookTaxipressSeats({ queueId: van.id, seats: count, payment });
      if (payment === "cash") {
        // Cash is confirmed on the order straight away; the passenger pays the driver at boarding.
        await api.fundOrder(order.id, { paymentMethod: "cash" });
        router.push(`/ride/taxipress/ticket/${booking.id}`);
      } else {
        router.push(`/orders/${order.id}/pay`);
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5 px-4 pb-8 pt-4">
      <Link href="/ride/taxipress" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Taxipress
      </Link>
      {!loaded ? null : !van || !queue?.route ? (
        <section className="home-card space-y-2 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
          <h1 className="text-lg font-bold">That taxi isn&apos;t available</h1>
          <p className="text-sm text-ink-500">It may have left or been booked full. Choose another taxi in the line.</p>
          <Link href="/ride/taxipress" className="inline-flex min-h-11 items-center font-bold text-gold">See the line</Link>
        </section>
      ) : (
        <>
          <section className="home-card space-y-1 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{queue.route.directionLabel}</p>
            <h1 className="text-xl font-bold">{queue.route.fromName} → {queue.route.toName}</h1>
            <p className="text-sm text-ink-500">{van.plate} · {van.driverName ?? "Driver"} · {van.status === "boarding" ? "Boarding now" : `${van.position === 1 ? "Next" : `${van.position}th`} in line`}</p>
            <p className="text-sm font-semibold text-gold">{van.seatsLeft} seat{van.seatsLeft === 1 ? "" : "s"} left</p>
          </section>

          <section className="home-card flex items-center justify-between gap-3 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4">
            <div>
              <p className="text-sm font-bold text-ink">Seats</p>
              <p className="text-[11px] text-ink-500">{ugx(fare)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer seats" disabled={count <= 1} onClick={() => setSeats(count - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden /></button>
              <span className="w-8 text-center text-lg font-bold text-ink" aria-live="polite">{count}</span>
              <button type="button" aria-label="More seats" disabled={count >= most} onClick={() => setSeats(count + 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden /></button>
            </div>
          </section>

          <section aria-label="How you will pay" className="space-y-2">
            <h2 className="px-1 text-sm font-bold text-ink">How will you pay?</h2>
            <div role="group" className="grid gap-2">
              <button type="button" aria-pressed={payment === "app"} onClick={() => setPayment("app")} className={`rounded-2xl px-3 py-3 text-left ${payment === "app" ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>
                <span className="block text-sm font-bold">Pay in the app</span>
                <span className="block text-xs opacity-80">Wallet or Mobile Money on the next screen. Pay within {taxipress.payWithinMinutes} minutes to keep your seats.</span>
              </button>
              {taxipress.cashEnabled && (
                <button type="button" aria-pressed={payment === "cash"} onClick={() => setPayment("cash")} className={`rounded-2xl px-3 py-3 text-left ${payment === "cash" ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>
                  <span className="block text-sm font-bold">Pay cash to the driver</span>
                  <span className="block text-xs opacity-80">Hand the driver {ugx(total)} when you board.</span>
                </button>
              )}
            </div>
          </section>

          <section className="home-card space-y-1 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">{count} seat{count === 1 ? "" : "s"} × {ugx(fare)}</span><span className="font-bold text-ink">{ugx(total)}</span></div>
            <p className="flex items-start gap-2 pt-1 text-xs text-ink-500"><Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />The taxi leaves when every seat is booked, so your time may change.</p>
          </section>

          {error && <p role="alert" className="text-sm font-semibold text-[rgb(var(--color-red,200_40_40))]">{error}</p>}
          <button type="button" disabled={busy} onClick={book} className="min-h-12 w-full rounded-full bg-gold font-bold text-ink-gold disabled:opacity-50">
            {busy ? "Please wait…" : `${payment === "cash" ? "Book" : "Book and pay"} · ${ugx(total)}`}
          </button>
        </>
      )}
    </main>
  );
}
