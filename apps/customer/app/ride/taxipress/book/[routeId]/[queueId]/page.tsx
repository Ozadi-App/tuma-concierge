"use client";

import { TAXIPRESS_LUGGAGE_LABELS, TAXIPRESS_LUGGAGE_TYPES, type TaxipressAssistance, type TaxipressLanguage, type TaxipressLuggageType, type TaxipressQueueView } from "@peebee/shared";
import { Accessibility, ArrowRight, Armchair, Ban, Box, Briefcase, Bus, Gem, HandHelping, Luggage, Minus, Package, Plus, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../../../../lib/api";
import { useRegisterNavBack, useRegisterNavPrimaryAction } from "../../../../../../lib/nav-primary-action";
import { taxipressOptions, useTaxipress } from "../../../../../../lib/taxipress";
import { clearDraft, clock, emptyDraft, readDraft, saveDraft, seatsFor, setPayReturn, ugx, type TaxipressDraft } from "../../../../../../lib/taxipress-draft";

const LUGGAGE_ICON: Record<TaxipressLuggageType, typeof Luggage> = { personal: Briefcase, standard: Luggage, large: Box, excess: Package, fragile: Gem, commercial: ShoppingBag };
const ASSISTANCE: Array<{ id: TaxipressAssistance; label: string; icon: typeof Ban }> = [
  { id: "none", label: "None required", icon: Ban },
  { id: "boarding", label: "Boarding help", icon: HandHelping },
  { id: "priority", label: "Priority seating", icon: Armchair },
  { id: "mobility", label: "Mobility support", icon: Accessibility },
];
const LANGUAGES: Array<{ id: TaxipressLanguage; label: string }> = [{ id: "en", label: "English" }, { id: "lg", label: "Luganda" }, { id: "sw", label: "Swahili" }];

/** TaxiPress step 3 (optional): luggage, assistance and language, then book and hand over to the checkout. */
export default function OptionsPage() {
  const { routeId, queueId } = useParams<{ routeId: string; queueId: string }>();
  const router = useRouter();
  const taxipress = useTaxipress();
  const [queue, setQueue] = useState<TaxipressQueueView | null>(null);
  const [draft, setDraftState] = useState<TaxipressDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the draft lives in sessionStorage, readable only after mount
  useEffect(() => { setDraftState({ ...(readDraft(routeId) ?? emptyDraft(routeId)), queueId }); }, [routeId, queueId]);
  useEffect(() => {
    let live = true;
    api.getTaxipressQueue(routeId).then((q) => { if (live) setQueue(q); }).catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, [routeId]);
  const setDraft = (patch: Partial<TaxipressDraft>) => setDraftState((d) => { const next = { ...(d ?? emptyDraft(routeId, queueId)), ...patch }; saveDraft(next); return next; });

  const van = queue?.line.find((v) => v.id === queueId) ?? null;
  const route = queue?.route ?? null;
  const details = true;
  const maxLap = taxipress.maxLapChildren ?? 2;
  const d = draft ?? emptyDraft(routeId, queueId);
  const fare = route?.farePerSeat ?? 0;
  const childSeats = details ? Math.max(0, d.children - maxLap) : 0;
  const seats = details ? seatsFor(d.adults, d.children, maxLap) : d.adults;
  const ride = Math.round(fare * d.adults + fare * childSeats * (taxipress.childSeatFarePercent ?? 100) / 100);
  const opts = taxipressOptions(taxipress);
  const prices = opts.prices;
  const luggageOn = details && opts.luggage;
  const luggageAmount = luggageOn ? TAXIPRESS_LUGGAGE_TYPES.reduce((sum, t) => sum + (prices[t] ?? 0) * (d.luggage[t] ?? 0), 0) : 0;
  const total = ride + luggageAmount;
  const chosen = luggageAmount > 0 || TAXIPRESS_LUGGAGE_TYPES.some((t) => (d.luggage[t] ?? 0) > 0)
    || (opts.assistance && !!d.assistance && d.assistance !== "none")
    || (opts.language && !!d.language);
  const party = d.children > 0 ? `${d.adults}+${d.children}` : `${d.adults}`;

  async function book(withOptions: boolean) {
    if (!van || busy) return;
    setBusy(true);
    setError("");
    try {
      const { booking, order } = await api.bookTaxipressSeats({
        queueId: van.id,
        ...(details ? {
          adults: d.adults, children: d.children,
          ...(withOptions ? {
            luggage: luggageOn ? d.luggage : undefined,
            assistance: opts.assistance ? d.assistance : undefined,
            language: opts.language ? d.language : undefined,
          } : {}),
          ...(d.forSomeoneElse ? { forSomeoneElse: true, travellerName: d.travellerName.trim(), travellerPhone: d.travellerPhone.trim(), emergencyPhone: d.emergencyPhone.trim() || null } : {}),
        } : { seats }),
      });
      clearDraft();
      const ticket = `/ride/taxipress/ticket/${booking.id}`;
      if (booking.paymentStatus !== "unpaid") { router.push(ticket); return; }
      // The shared checkout takes it from here (wallet, Mobile Money or cash) and comes back to the ticket.
      setPayReturn(order.id, ticket);
      router.push(`/orders/${order.id}/pay`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  useRegisterNavBack(true, () => router.push(`/ride/taxipress/book/${routeId}`));
  // v5 sticky bar: Back + one action. Continue once an option is chosen, otherwise Skip (never the module nav).
  useRegisterNavPrimaryAction(chosen ? {
    tone: "gold",
    icon: ArrowRight,
    label: busy ? "Booking…" : `Continue · ${ugx(total)}`,
    sublabel: "to payment",
    busy,
    disabled: busy || !draft || !van,
    onClick: () => void book(true),
  } : {
    tone: "gold",
    icon: X,
    label: busy ? "Booking…" : `Skip · ${ugx(ride)}`,
    sublabel: "no options, to payment",
    busy,
    disabled: busy || !draft || !van,
    onClick: () => void book(false),
  });

  if (queue && (!van || !route)) {
    return (
      <main className="space-y-3 px-4 pb-8 pt-4">
        <h1 className="text-xl font-bold text-ink">That taxi isn&apos;t available</h1>
        <p className="text-sm text-ink-500">It may have started boarding, left or been booked full. Choose another taxi.</p>
        <Link href={`/ride/taxipress/book/${routeId}`} className="inline-flex min-h-11 items-center font-bold text-gold">See the line</Link>
      </main>
    );
  }

  return (
    <main className="space-y-5 px-4 pb-32 pt-4">
      <header className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Step 3 of 3 · Optional</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Make it yours</h1>
        </div>
        {route && van && (
          <div className="flex items-center gap-2 rounded-full bg-[rgb(var(--color-black-700))] px-4 py-3 text-white" aria-label="Your booking so far">
            <Bus className="h-4 w-4 shrink-0 text-gold" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">
              {route.fromName} → {route.toName} · <span className="font-mono">{van.plate}</span>{van.departsAt ? ` · ~${clock(van.departsAt)}` : ""} · {party}
            </span>
            <span className="shrink-0 text-sm font-bold text-gold">{ride.toLocaleString("en-UG")}</span>
          </div>
        )}
      </header>

      {luggageOn && (
        <section aria-label="Luggage" className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-base font-bold text-ink">Luggage</h2>
            {luggageAmount > 0 && <span className="text-sm text-ink-500">+ {ugx(luggageAmount)}</span>}
          </div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {TAXIPRESS_LUGGAGE_TYPES.map((t) => {
              const n = d.luggage[t] ?? 0;
              const price = prices[t];
              const Icon = LUGGAGE_ICON[t];
              return (
                <div key={t} className={`flex w-[8.25rem] shrink-0 snap-start flex-col rounded-[22px] border p-3 ${n > 0 ? "border-gold bg-gold/15" : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))]"}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span className="mt-2 text-sm font-bold text-ink">{TAXIPRESS_LUGGAGE_LABELS[t].name}</span>
                  <span className="mt-auto pt-3 text-xs text-ink-500">{price == null ? TAXIPRESS_LUGGAGE_LABELS[t].note : price === 0 ? "Free" : `${TAXIPRESS_LUGGAGE_LABELS[t].note.replace("Up to ", "≤")} · ${price.toLocaleString("en-UG")}`}</span>
                  <span className="mt-2 flex items-center justify-between rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-0.5">
                    <button type="button" aria-label={`Fewer ${TAXIPRESS_LUGGAGE_LABELS[t].name}`} disabled={n <= 0} onClick={() => setDraft({ luggage: { ...d.luggage, [t]: n - 1 } })} className="flex h-9 w-9 items-center justify-center rounded-full text-ink disabled:opacity-30"><Minus className="h-4 w-4" aria-hidden /></button>
                    <span className="text-sm font-bold text-ink">{n}</span>
                    <button type="button" aria-label={`More ${TAXIPRESS_LUGGAGE_LABELS[t].name}`} disabled={n >= 10} onClick={() => setDraft({ luggage: { ...d.luggage, [t]: n + 1 } })} className="flex h-9 w-9 items-center justify-center rounded-full text-ink disabled:opacity-30"><Plus className="h-4 w-4" aria-hidden /></button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {details && opts.assistance && (
        <section aria-label="Assistance" className="space-y-2">
          <h2 className="px-1 text-base font-bold text-ink">Assistance</h2>
          <div className="grid grid-cols-2 gap-2">
            {ASSISTANCE.map(({ id, label, icon: Icon }) => {
              const on = d.assistance === id;
              return (
                <button key={id} type="button" aria-pressed={on} onClick={() => setDraft({ assistance: id })} className={`flex min-h-14 items-center gap-2.5 rounded-2xl border px-3 text-left text-sm font-bold ${on ? "border-transparent bg-[rgb(var(--color-black-700))] text-gold" : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink"}`}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden /> <span className="min-w-0">{label}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {details && opts.language && (
        <section aria-label="Preferred language" className="space-y-2">
          <h2 className="px-1 text-base font-bold text-ink">Preferred language</h2>
          <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] p-1">
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={d.language === l.id} onClick={() => setDraft({ language: d.language === l.id ? null : l.id })} className={`min-h-11 rounded-xl text-sm font-bold ${d.language === l.id ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"}`}>
                {l.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-[rgb(var(--color-red,200_40_40))]">{error}</p>}
    </main>
  );
}
