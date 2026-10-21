"use client";

import type { TaxipressBooking } from "@peebee/shared";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeQr } from "../../../../../components/CodeQr";
import { api, errorMessage } from "../../../../../lib/api";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;
const PAYMENT: Record<TaxipressBooking["paymentStatus"], string> = { unpaid: "Payment due", paid: "Paid", pay_driver: "Pay the driver", cancelled: "Cancelled" };

/** The ticket: show the code (or QR) to the driver when you board. */
export default function TaxipressTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<TaxipressBooking | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api.getTaxipressBooking(id)
      .then((res) => { if (live) setBooking(res.booking); })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoaded(true); });
    const timer = window.setTimeout(() => setTick((t) => t + 1), 10_000);
    return () => { live = false; window.clearTimeout(timer); };
  }, [id, tick]);

  const cancelled = booking?.paymentStatus === "cancelled";
  const taxi = booking?.taxi;

  return (
    <main className="space-y-5 px-4 pb-8 pt-4">
      <Link href="/ride/taxipress" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Taxipress
      </Link>
      {!loaded ? null : !booking || !taxi ? (
        <p className="text-sm text-ink-500" role="alert">{error || "That ticket wasn't found."}</p>
      ) : (
        <>
          <section className="home-card space-y-4 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{booking.route.directionLabel}</p>
            <h1 className="text-xl font-bold">{booking.route.fromName} → {booking.route.toName}</h1>
            {cancelled ? (
              <p className="text-sm font-semibold text-ink-500" role="status">This booking was cancelled and the seats were given back.</p>
            ) : (
              <>
                {booking.ticketCode && (
                  <div className="flex flex-col items-center gap-2">
                    <CodeQr value={booking.ticketCode} size={180} />
                    <p className="font-mono text-2xl font-bold tracking-widest text-ink">{booking.ticketCode}</p>
                    <p className="text-xs text-ink-500">Show this to the driver when you board.</p>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="home-card space-y-2 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 text-sm">
            <Row label="Taxi" value={`${taxi.plate} · ${taxi.seatLayout}-seater`} />
            <Row label="Driver" value={taxi.driverName ?? "—"} />
            <Row label="Seats" value={String(booking.seats)} />
            <Row label="Total" value={ugx(booking.amount)} />
            <Row label="Payment" value={PAYMENT[booking.paymentStatus]} />
            {!cancelled && (
              <Row label="Place in the line" value={taxi.status === "boarding" ? "Boarding now" : taxi.status === "on_road" ? "On the road" : taxi.position ? `${taxi.position}${taxi.position === 1 ? "st" : taxi.position === 2 ? "nd" : taxi.position === 3 ? "rd" : "th"}` : "—"} />
            )}
          </section>

          {booking.paymentStatus === "unpaid" && !cancelled && booking.paymentMethod === "app" && (
            <Link href={`/orders/${booking.orderId}/pay`} className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold font-bold text-ink-gold">Pay now</Link>
          )}
          {!cancelled && taxi.driverPhone && (
            <a href={`tel:${taxi.driverPhone}`} className="flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--border-faint)] font-bold text-ink">Call the driver</a>
          )}
          <Link href={`/orders/${booking.orderId}`} className="block text-center text-sm font-semibold text-ink-500 underline-offset-2 hover:underline">Order details and chat</Link>
        </>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}
