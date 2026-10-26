"use client";

import { taxipressTown, type TaxipressLineEntry, type TaxipressQueueView } from "@peebee/shared";
import { Check, ChevronRight, Clock, Minus, Plus, Ticket } from "lucide-react";
import { DriverAvatar } from "../../../../../components/taxipress/DriverAvatar";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, errorMessage } from "../../../../../lib/api";
import { useRegisterNavBack, useRegisterNavPrimaryAction } from "../../../../../lib/nav-primary-action";
import { taxipressOptions, useTaxipress } from "../../../../../lib/taxipress";
import { clock, emptyDraft, minutesFromNow, readDraft, saveDraft, seatsFor, ugx, type TaxipressDraft } from "../../../../../lib/taxipress-draft";

const REFRESH_MS = 10_000;
const MAX_PASSENGERS = 18;

export default function Page() {
  return <Suspense fallback={null}><BookLine /></Suspense>;
}

/** TaxiPress step 2: the line (boarding taxi shown but not bookable, the next few bookable), who is travelling. */
function BookLine() {
  const { routeId } = useParams<{ routeId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const taxipress = useTaxipress();
  const [queue, setQueue] = useState<TaxipressQueueView | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [draft, setDraftState] = useState<TaxipressDraft>(() => emptyDraft(routeId));
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = readDraft(routeId);
    const taxi = params.get("taxi");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the draft lives in sessionStorage, readable only after mount
    setDraftState({ ...(saved ?? emptyDraft(routeId)), ...(taxi ? { queueId: taxi } : {}) });
    setRestored(true);
  }, [routeId, params]);

  const setDraft = (patch: Partial<TaxipressDraft>) => setDraftState((d) => { const next = { ...d, ...patch }; saveDraft(next); return next; });

  useEffect(() => {
    let live = true;
    api.getTaxipressQueue(routeId)
      .then((q) => { if (live) { setQueue(q); setError(""); } })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    const id = window.setTimeout(() => setTick((t) => t + 1), REFRESH_MS);
    return () => { live = false; window.clearTimeout(id); };
  }, [routeId, tick]);

  const route = queue?.route ?? null;
  const boarding = queue?.line.find((v) => v.status === "boarding") ?? null;
  const bookable = (queue?.line ?? []).filter((v) => v.bookable ?? (v.status === "in_line" && !v.fullyBooked));
  const waiting = (queue?.line ?? []).filter((v) => v.status === "in_line" && !bookable.includes(v));
  const selected = bookable.find((v) => v.id === draft.queueId) ?? null;
  const maxLap = taxipress.maxLapChildren ?? 2;
  const details = true;
  const seats = details ? seatsFor(draft.adults, draft.children, maxLap) : draft.adults;
  const fare = route?.farePerSeat ?? 0;
  const childPct = taxipress.childSeatFarePercent ?? 100;
  const childSeats = details ? Math.max(0, draft.children - maxLap) : 0;
  const total = Math.round(fare * draft.adults + fare * childSeats * childPct / 100);
  const fits = selected ? seats <= selected.seatsLeft : false;
  const someoneOk = !draft.forSomeoneElse || (draft.travellerName.trim().length >= 2 && /^[+0-9 ()-]{7,20}$/.test(draft.travellerPhone.trim()));
  const ready = restored && selected && fits && someoneOk && seats >= 1;


  const forOthers = details && taxipressOptions(taxipress).forOthers;
  const justMe = draft.adults === 1 && draft.children === 0 && !draft.forSomeoneElse;
  const passengerPanel = selected ? (
    <div aria-label="Who is travelling" className="mt-4 space-y-3 border-t border-[var(--border-faint)] pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Who is travelling?</h2>
        <span className="text-xs text-ink-500">{justMe ? "Just you · 1 seat" : `${seats} seat${seats === 1 ? "" : "s"} · ${ugx(total)}`}</span>
      </div>
      {forOthers && (
        <div role="radiogroup" aria-label="Booking for" className="grid grid-cols-2 gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] p-1">
          {([[false, "Me"], [true, "Someone else"]] as const).map(([value, text]) => (
            <button key={text} type="button" role="radio" aria-checked={draft.forSomeoneElse === value} onClick={() => setDraft({ forSomeoneElse: value })}
              className={`min-h-11 rounded-xl text-sm font-bold ${draft.forSomeoneElse === value ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"}`}>
              {text}
            </button>
          ))}
        </div>
      )}
      {draft.forSomeoneElse && (
        <div className="space-y-2">
          <Field label="Passenger name" value={draft.travellerName} autoComplete="name" onChange={(travellerName) => setDraft({ travellerName })} />
          <Field label="Passenger phone" value={draft.travellerPhone} type="tel" autoComplete="tel" onChange={(travellerPhone) => setDraft({ travellerPhone })} />
          <Field label="Emergency contact (optional)" value={draft.emergencyPhone} type="tel" onChange={(emergencyPhone) => setDraft({ emergencyPhone })} />
        </div>
      )}
      <Stepper label="Adults" note="Age 13 and above" value={draft.adults} min={1} max={MAX_PASSENGERS - draft.children} onChange={(adults) => setDraft({ adults })} />
      <Stepper label="Children" note="Under 12" value={draft.children} min={0} max={MAX_PASSENGERS - draft.adults} onChange={(children) => setDraft({ children })} />
      {(draft.children > 0 || draft.adults > 1) && (
        <p className="text-xs text-ink-500">
          {maxLap > 0 ? `Up to ${maxLap} child${maxLap === 1 ? "" : "ren"} ride on a lap free. ` : ""}
          {`Each child beyond that needs a seat${childPct < 100 ? ` at ${childPct}% of the fare` : ""}.`}
        </p>
      )}
      {!fits && <p role="alert" className="text-xs font-semibold text-[rgb(var(--color-red,200_40_40))]">{selected.plate} has {selected.seatsLeft} seat{selected.seatsLeft === 1 ? "" : "s"} left. Choose fewer passengers or another taxi.</p>}
    </div>
  ) : null;

  useRegisterNavBack(true, () => router.push("/ride/taxipress"));
  useRegisterNavPrimaryAction({
    tone: "gold",
    icon: Ticket,
    label: justMe ? "Continue" : `Continue · ${seats} seat${seats === 1 ? "" : "s"}`,
    detail: selected ? `${ugx(total)} · ${selected.plate}` : "Choose a taxi",
    disabled: !ready,
    onClick: () => { if (ready) router.push(`/ride/taxipress/book/${routeId}/${selected!.id}`); },
  });

  return (
    <main className="space-y-4 px-4 pb-8 pt-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Step 2 of 3{route ? ` · ${taxipressTown(route.fromName)} → ${taxipressTown(route.toName)}` : ""}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Book a seat</h1>
        <p className="mt-1 text-sm text-ink-500">Now {clock(new Date().toISOString())}. You get the next free seat. Tap a taxi for its profile.</p>
      </header>
      {error && <p role="alert" className="text-sm font-semibold text-[rgb(var(--color-red,200_40_40))]">{error}</p>}
      {queue && queue.line.length === 0 && <p className="text-sm text-ink-500" role="status">No taxi is in the line yet. Check again in a moment.</p>}

      {boarding && (
        <section aria-label="Boarding now" className="rounded-[24px] bg-[rgb(var(--color-black-700))] p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-green-400 ring-4 ring-green-400/25" aria-hidden />
            <DriverAvatar name={boarding.driverName} photoUrl={boarding.driverPhotoUrl} dark />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xl font-bold tracking-wider">{boarding.plate}</span>
              <span className="block truncate text-sm text-white/65">{boarding.driverName ?? "Driver"} · Commuter ({boarding.seatsTotal})</span>
            </span>
            <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-xs font-bold text-[rgb(10_10_10)]">Boarding now</span>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-white/70">
            <Clock className="h-4 w-4" aria-hidden />
            {boarding.departsAt && <><b className="text-white">~{clock(boarding.departsAt)}</b> · leaving in ~{minutesFromNow(boarding.departsAt)} min ·</>}
            {" "}{boarding.seatsTaken}/{boarding.seatsTotal} · not bookable
          </p>
        </section>
      )}
      {queue && queue.line.length > 0 && !boarding && (
        <p aria-label="Boarding now" className="flex items-center gap-2 rounded-2xl bg-[rgb(var(--color-black-700))] px-4 py-2.5 text-sm text-white/75">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/40" aria-hidden />
          No taxi boarding right now
        </p>
      )}

      <ol className="space-y-3">
        {bookable.map((van, i) => (
          <TaxiCard key={van.id} van={van} rank={i + 1} routeId={routeId} selected={van.id === draft.queueId} onSelect={() => setDraft({ queueId: van.id })}>
            {van.id === draft.queueId ? passengerPanel : null}
          </TaxiCard>
        ))}
      </ol>
      {waiting.length > 0 && <p className="px-1 text-xs text-ink-500">{waiting.length} more taxi{waiting.length === 1 ? "" : "s"} waiting. They open for booking as the line moves.</p>}

    </main>
  );
}

function TaxiCard({ van, rank, routeId, selected, onSelect, children }: { van: TaxipressLineEntry; rank: number; routeId: string; selected: boolean; onSelect: () => void; children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <li className={`home-card border-2 bg-[rgb(var(--surface-card))] p-4 ${selected ? "border-gold" : "border-[var(--border-faint)]"}`}>
      <button type="button" onClick={() => router.push(`/ride/taxipress/taxi/${van.id}?route=${routeId}`)} className="flex w-full items-center gap-3 text-left" aria-label={`${van.plate} profile`}>
        <DriverAvatar name={van.driverName} photoUrl={van.driverPhotoUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-xl font-bold tracking-wider text-ink">{van.plate}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${rank === 1 ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink-500"}`}>{rank === 1 ? "Next" : rank === 2 ? "Waiting" : "Later"}</span>
          </span>
          <span className="block truncate text-sm text-ink-500">{van.driverName ?? "Driver"} · {van.seatLayout === "18" ? "Highroof" : "Commuter"} ({van.seatsTotal})</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-500">
        <span className="flex min-w-0 items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          {van.departsAt ? <span className="truncate"><b className="text-ink">~{clock(van.departsAt)}</b> · departs in ~{minutesFromNow(van.departsAt)} min</span> : <span>Leaves when full</span>}
        </span>
        <span className="shrink-0 rounded-full bg-green/10 px-2.5 py-1 text-xs font-semibold text-green">{van.seatsLeft} left</span>
      </div>
      <button type="button" aria-pressed={selected} onClick={onSelect} className={`mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold ${selected ? "bg-gold text-ink-gold" : "border border-gold text-ink"}`}>
        {selected ? <><Check className="h-5 w-5" aria-hidden /> Selected</> : <><Ticket className="h-5 w-5" aria-hidden /> Book a seat</>}
      </button>
      {children}
    </li>
  );
}

function Stepper({ label, note, value, min, max, onChange }: { label: string; note: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-bold text-ink">{label}</span>
        <span className="block text-xs text-ink-500">{note}</span>
      </span>
      <span className="flex items-center gap-2">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden /></button>
        <span className="w-7 text-center text-lg font-bold text-ink" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden /></button>
      </span>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="field-box block">
      <span className="block text-[11px] font-semibold text-ink-500">{label}</span>
      <input type={type} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-ink outline-none" />
    </label>
  );
}
