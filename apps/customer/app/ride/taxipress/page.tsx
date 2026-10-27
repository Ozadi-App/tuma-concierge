"use client";

import { taxipressTown, type TaxipressConfig } from "@peebee/shared";
import { ArrowRight, ArrowUpDown, ChevronDown, ChevronLeft, ChevronUp, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useTaxipress } from "../../../lib/taxipress";
import { journey, ugx } from "../../../lib/taxipress-draft";

type Route = TaxipressConfig["routes"][number];

/** TaxiPress step 1: pick a route (swap it to travel the other way, open it to see its stops). */
export default function TaxipressPage() {
  const taxipress = useTaxipress();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [swapped, setSwapped] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [active, setActive] = useState(0);

  // One card per route pair: the reverse direction is reached with the swap button.
  // The reverse is the same relay route the other way, or else a route between the same two stages the other way.
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const reverseOf = (r: Route) => (r.reverseId ? taxipress.routes.find((x) => x.id === r.reverseId) : undefined)
    ?? taxipress.routes.find((x) => x.id !== r.id && same(x.fromName, r.toName) && same(x.toName, r.fromName));
  const cards: Route[] = [];
  for (const r of taxipress.routes) {
    const rev = reverseOf(r);
    if (rev && cards.some((c) => c.id === rev.id)) continue;
    cards.push(r);
  }
  const shown = (r: Route) => (swapped[r.id] ? reverseOf(r) ?? r : r);
  const ids = cards.map((c) => shown(c).id).join(",");

  useEffect(() => {
    let live = true;
    for (const id of ids.split(",").filter(Boolean)) {
      api.getTaxipressQueue(id).then((q) => { if (live) setCounts((c) => ({ ...c, [id]: q.line.length })); }).catch(() => {});
    }
    return () => { live = false; };
  }, [ids]);

  useEffect(() => {
    let live = true;
    api.getMyTaxipressBookings()
      .then((res) => { if (live) setActive(res.bookings.filter((b) => b.status === "booked" || b.status === "boarded").length); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <main className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/ride" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-500">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Ride
        </Link>
        <Link href="/ride/taxipress/tickets" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-gold">
          <Ticket className="h-4 w-4" aria-hidden /> My tickets{active > 0 ? ` (${active})` : ""}
        </Link>
      </div>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">TaxiPress · Step 1 of 3</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Select a route</h1>
        <p className="mt-1 text-sm text-ink-500">Swap to travel the other way. Tap a route to see its stops.</p>
      </header>

      {!taxipress.enabled ? (
        <p className="text-sm text-ink-500" role="status">TaxiPress isn&apos;t running right now.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const r = shown(card);
            const stops = r.stops ?? [];
            const isOpen = open === card.id;
            const n = counts[r.id];
            return (
              <li key={card.id} className="overflow-hidden rounded-[28px] bg-[rgb(var(--color-black-700))] text-white shadow-sm">
                {/* Tapping anywhere on the card opens (or closes) its stops; the buttons inside do their own thing. */}
                <div className="relative cursor-pointer p-4" onClick={() => setOpen(isOpen ? null : card.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black leading-tight">{taxipressTown(r.fromName)} → {taxipressTown(r.toName)}</h2>
                      {n != null && <p className="mt-1 text-sm text-white/70">{n === 0 ? "No taxi in the line yet" : `${n} taxi${n === 1 ? "" : "s"} in the line`}</p>}
                    </div>
                    {reverseOf(card) && (
                      <button type="button" aria-label={`Swap to ${taxipressTown(r.toName)} → ${taxipressTown(r.fromName)}`} onClick={(e) => { e.stopPropagation(); setSwapped((s) => ({ ...s, [card.id]: !s[card.id] })); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                        <ArrowUpDown className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[rgb(10_10_10)]">{ugx(r.farePerSeat)} / seat</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/ride/taxipress/book/${r.id}`); }} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-gold">
                      Select <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {/* Every route opens to its stops, start to end (just the two stages when none are set). */}
                  <button type="button" aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : card.id); }} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-white/80">
                    {isOpen ? "Hide stops" : stops.length > 0 ? `Show ${stops.length + 2} stops` : "Show stops"} {isOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
                {isOpen && (
                  <div className="bg-[rgb(var(--surface-card))] p-4 text-ink">
                    <ol className="space-y-0">
                      {journey(r.fromName, stops, r.toName).map((s, i, all) => (
                        <li key={`${s}-${i}`} className="relative flex items-center gap-3 py-1.5 pl-1">
                          {i < all.length - 1 && <span className="absolute left-[11px] top-1/2 h-full w-0.5 bg-gold/60" aria-hidden />}
                          <span className={`relative h-4 w-4 shrink-0 rounded-full border-2 border-gold ${i === all.length - 1 ? "bg-gold" : "bg-[rgb(var(--surface-card))]"}`} aria-hidden />
                          <span className="text-[15px] font-semibold">{s}{i === 0 ? " · start stage" : i === all.length - 1 ? " · end stage" : ""}</span>
                        </li>
                      ))}
                    </ol>
                    <Link href={`/ride/taxipress/book/${r.id}`} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gold text-lg font-bold text-ink-gold">
                      Select route <ArrowRight className="h-5 w-5" aria-hidden />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
