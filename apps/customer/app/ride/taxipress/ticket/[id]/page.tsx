"use client";

import { receiptUrl, TAXIPRESS_LUGGAGE_LABELS, taxipressTown, type TaxipressBooking } from "@peebee/shared";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeQr } from "../../../../../components/CodeQr";
import { api, errorMessage } from "../../../../../lib/api";
import { setPayReturn } from "../../../../../lib/taxipress-draft";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;
const PAYMENT: Record<TaxipressBooking["paymentStatus"], string> = { unpaid: "Payment due", paid: "Paid", pay_driver: "Pay the driver", cancelled: "Cancelled" };

/** The ticket: show the code (or QR) to the driver when you board. */
export default function TaxipressTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<TaxipressBooking | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Back from a Mobile Money payment: settle it now so the ticket shows Paid without waiting.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    if (params.get("payment_return") !== "1" || !orderId) return;
    let live = true;
    api.getOrder(orderId)
      .then(async (detail) => {
        const pending = detail.payments.find((p) => p.type === "collection" && ["pending", "unknown"].includes(p.status));
        if (pending) await api.refreshPayment(pending.id);
      })
      .catch(() => {})
      .finally(() => {
        if (!live) return;
        window.history.replaceState(null, "", window.location.pathname);
        setTick((t) => t + 1);
      });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    api.getTaxipressBooking(id)
      .then((res) => { if (live) setBooking(res.booking); })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoaded(true); });
    const timer = window.setTimeout(() => setTick((t) => t + 1), 10_000);
    return () => { live = false; window.clearTimeout(timer); };
  }, [id, tick]);

  const cancelled = booking?.paymentStatus === "cancelled" || booking?.status === "cancelled" || booking?.status === "no_show";
  const taxi = booking?.taxi;

  async function cancel() {
    if (!booking) return;
    setBusy(true);
    setError("");
    try {
      await api.cancelTaxipressBooking(booking.id);
      setConfirming(false);
      setTick((t) => t + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5 px-4 pb-8 pt-4">
      <Link href="/ride/taxipress/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> My tickets
      </Link>
      {!loaded ? null : !booking || !taxi ? (
        <p className="text-sm text-ink-500" role="alert">{error || "That ticket wasn't found."}</p>
      ) : (
        <>
          <section className="home-card space-y-4 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{booking.route.directionLabel}</p>
            <h1 className="text-xl font-bold">{taxipressTown(booking.route.fromName)} → {taxipressTown(booking.route.toName)}</h1>
            {cancelled ? (
              <p className="text-sm font-semibold text-ink-500" role="status">{outcomeText(booking)}</p>
            ) : booking.status === "boarded" || booking.status === "completed" ? (
              <p className="text-sm font-bold text-green" role="status">{booking.status === "completed" ? "Trip complete. Thank you for travelling with Taxipress." : "You're on board. Have a good trip."}</p>
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
            <Row label="Seats" value={seatsText(booking)} />
            {booking.details?.forSomeoneElse && booking.details.travellerName && <Row label="Passenger" value={`${booking.details.travellerName}${booking.details.travellerPhone ? ` · ${booking.details.travellerPhone}` : ""}`} />}
            {booking.details?.emergencyPhone && <Row label="Emergency contact" value={booking.details.emergencyPhone} />}
            {luggageText(booking) && <Row label="Luggage" value={luggageText(booking)!} />}
            {booking.details?.assistance && booking.details.assistance !== "none" && <Row label="Assistance" value={{ boarding: "Boarding help", priority: "Priority seating", mobility: "Mobility support" }[booking.details.assistance]} />}
            {booking.details?.language && <Row label="Language" value={({ en: "English", lg: "Luganda", sw: "Swahili" } as Record<string, string>)[booking.details.language] ?? booking.details.language.toUpperCase()} />}
            <Row label="Total" value={ugx(booking.amount)} />
            <Row label="Payment" value={booking.status === "boarded" || booking.status === "completed" ? "Settled" : PAYMENT[booking.paymentStatus]} />
            {!cancelled && booking.status === "booked" && (
              <Row label="Place in the line" value={taxi.status === "boarding" ? "Boarding now" : taxi.status === "on_road" ? "On the road" : taxi.position ? `${taxi.position}${taxi.position === 1 ? "st" : taxi.position === 2 ? "nd" : taxi.position === 3 ? "rd" : "th"}` : "—"} />
            )}
          </section>

          {booking.receiptRef && (
            <section className="home-card space-y-2 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 text-center">
              <p className="text-sm font-bold text-ink">Your receipt</p>
              <div className="flex justify-center"><CodeQr value={receiptUrl(booking.receiptRef)} size={150} /></div>
              <p className="text-xs text-ink-500">Scan it with any phone camera to check it is a genuine Peebee receipt.</p>
              <Link href={`/receipt/${encodeURIComponent(booking.receiptRef)}`} className="text-sm font-semibold text-gold underline-offset-2 hover:underline">Open the receipt</Link>
            </section>
          )}

          {booking.paymentStatus === "unpaid" && !cancelled && booking.status === "booked" && booking.paymentMethod === "app" && (
            <Link href={`/orders/${booking.orderId}/pay`} onClick={() => setPayReturn(booking.orderId, `/ride/taxipress/ticket/${booking.id}`)} className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold font-bold text-ink-gold">Pay now</Link>
          )}
          {!cancelled && booking.status === "booked" && taxi.driverPhone && (
            <a href={`tel:${taxi.driverPhone}`} className="flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--border-faint)] font-bold text-ink">Call the driver</a>
          )}
          {booking.status === "booked" && booking.cancel.allowed && (
            confirming ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border-faint)] p-4 text-center text-sm" role="alert">
                <p className="font-semibold text-ink">{cancelQuote(booking)}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] font-bold text-ink">Keep my seat</button>
                  <button type="button" disabled={busy} onClick={cancel} className="min-h-11 flex-1 rounded-full bg-gold font-bold text-ink-gold disabled:opacity-60">{busy ? "Cancelling…" : "Yes, cancel"}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--border-faint)] font-bold text-ink">Cancel booking</button>
            )
          )}
          {error && booking.status === "booked" && <p className="text-center text-sm text-ink-500" role="alert">{error}</p>}
          <Link href={`/orders/${booking.orderId}`} className="block text-center text-sm font-semibold text-ink-500 underline-offset-2 hover:underline">Order details and chat</Link>
        </>
      )}
    </main>
  );
}

function outcomeText(b: TaxipressBooking) {
  const o = b.outcome;
  const refund = o && o.refunded > 0 ? ` ${ugx(o.refunded)} went back to your wallet.` : "";
  const kept = o && o.fee > 0 ? ` ${ugx(o.fee)} was kept.` : "";
  if (o?.kind === "taxi_removed") return `This taxi left the line, so your booking was cancelled.${refund || " You weren't charged."}`;
  if (o?.kind === "no_show" || b.status === "no_show") return `You weren't at the stage when the taxi left, so the seats were released.${refund}${kept}`;
  return `This booking was cancelled and the seats were given back.${refund}${kept}`;
}

function cancelQuote(b: TaxipressBooking) {
  if (b.cancel.refund <= 0) return "Cancel this booking and give the seats back?";
  if (b.cancel.fee <= 0) return `Cancel and get ${ugx(b.cancel.refund)} back to your wallet?`;
  return `Cancelling now keeps ${ugx(b.cancel.fee)}. You'll get ${ugx(b.cancel.refund)} back to your wallet.`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

function seatsText(b: TaxipressBooking) {
  const d = b.details;
  if (!d || d.children === 0) return String(b.seats);
  const lap = d.children - d.childSeats;
  return `${b.seats} · ${d.adults} adult${d.adults === 1 ? "" : "s"}, ${d.children} child${d.children === 1 ? "" : "ren"}${lap > 0 ? ` (${lap} on lap)` : ""}`;
}

function luggageText(b: TaxipressBooking) {
  const items = Object.entries(b.details?.luggage ?? {}).filter(([, n]) => (n ?? 0) > 0);
  if (items.length === 0) return null;
  return items.map(([t, n]) => `${n} ${TAXIPRESS_LUGGAGE_LABELS[t as keyof typeof TAXIPRESS_LUGGAGE_LABELS].name.toLowerCase()}`).join(", ");
}
