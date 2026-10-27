"use client";

import { taxipressTown, type TaxipressBooking } from "@peebee/shared";
import { ChevronRight, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../../lib/api";
import { useRegisterNavBack } from "../../../../lib/nav-primary-action";
import { ordinal } from "../../../../lib/taxipress-draft";

const PAY: Record<TaxipressBooking["paymentStatus"], string> = { unpaid: "Payment due", paid: "Paid", pay_driver: "Pay the driver", cancelled: "Cancelled" };

/** Every TaxiPress ticket: active ones first, past ones on the second tab. */
export default function MyTicketsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<TaxipressBooking[] | null>(null);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [error, setError] = useState("");
  const [codeText, setCodeText] = useState("");
  useRegisterNavBack(true, () => router.push("/ride/taxipress"));

  useEffect(() => {
    let live = true;
    api.getMyTaxipressBookings().then((r) => { if (live) setBookings(r.bookings); }).catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, []);

  const isActive = (b: TaxipressBooking) => b.status === "booked" || b.status === "boarded";
  const list = (bookings ?? []).filter((b) => (tab === "active" ? isActive(b) : !isActive(b)));

  return (
    <main className="space-y-4 px-4 pb-8 pt-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">TaxiPress</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">My tickets</h1>
      </header>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] p-1">
        {(["active", "past"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 rounded-xl text-sm font-bold ${tab === t ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"}`}>
            {t === "active" ? "Active" : "Past"}
          </button>
        ))}
      </div>
      <form className="field-box flex items-center gap-2 rounded-2xl px-3" onSubmit={(e) => { e.preventDefault(); const code = codeText.trim(); if (code) router.push(`/ticket/${encodeURIComponent(code)}`); }}>
        <input value={codeText} onChange={(e) => setCodeText(e.target.value)} placeholder="Have a ticket code? TXP-XXXXXX" aria-label="Ticket code" autoCapitalize="characters" className="min-h-12 flex-1 text-sm" />
        <button type="submit" className="min-h-11 px-2 text-sm font-bold text-gold">Open</button>
      </form>
      {error && <p role="alert" className="text-sm text-ink-500">{error}</p>}
      {bookings && list.length === 0 && <p role="status" className="text-sm text-ink-500">{tab === "active" ? "No active tickets." : "No past tickets yet."}</p>}
      <ul className="space-y-2">
        {list.map((b) => (
          <li key={b.id}>
            <Link href={`/ride/taxipress/ticket/${b.id}`} className="home-card flex items-center gap-3 border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold"><Ticket className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-ink">{taxipressTown(b.route.fromName)} → {taxipressTown(b.route.toName)}</span>
                <span className="block truncate text-xs text-ink-500"><span className="font-mono">{b.taxi.plate}</span> · {b.sharedWithMe ? `Sent by ${b.sentBy ?? "a friend"}` : PAY[b.paymentStatus]}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-gold">{state(b)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function state(b: TaxipressBooking) {
  if (b.status === "completed") return "Completed";
  if (b.status === "boarded") return "On board";
  if (b.status === "cancelled") return "Cancelled";
  if (b.status === "no_show") return "Missed";
  if (b.taxi.status === "boarding") return "Boarding now";
  if (b.taxi.status === "on_road") return "On the road";
  return b.taxi.position ? `${ordinal(b.taxi.position)} in line` : "Booked";
}
