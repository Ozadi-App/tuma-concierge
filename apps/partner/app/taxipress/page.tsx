"use client";

import { Select } from "@peebee/shared/select";
import { ApiError, type TaxipressDriverView, type TaxipressLineEntry } from "@peebee/shared";
import { ArrowLeft, Bus, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";

const REFRESH_MS = 10_000;
const LOCATION_MS = 30_000;
const errorBox = "rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300";
const primary = "min-h-12 w-full rounded-full bg-gold font-bold text-ink-gold disabled:opacity-50";
const secondary = "min-h-12 w-full rounded-full border border-[var(--border-faint)] font-bold text-ink disabled:opacity-50";

/** The phone's position, or nothing when it is off or refused (the server says if a location is needed). */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 },
    );
  });
}

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

export default function TaxipressPage() {
  const [view, setView] = useState<TaxipressDriverView | null>(null);
  const [error, setError] = useState("");

  // Bumping the version reloads the screen after any action and on a timer while in a line.
  const [version, setVersion] = useState(0);
  const load = useCallback(async () => { setVersion((v) => v + 1); }, []);

  useEffect(() => {
    let live = true;
    api.getTaxipressTaxiMe()
      .then((next) => { if (live) { setView(next); setError(""); } })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, [version]);

  const inLine = !!view?.entry;
  useEffect(() => {
    if (!inLine) return;
    const id = window.setInterval(() => setVersion((v) => v + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [inLine]);

  // While in a line or on the road, the taxi's position goes up so passengers and parcels can follow it.
  const status = view?.entry?.status;
  useEffect(() => {
    if (!status) return;
    let live = true;
    const send = async () => {
      const at = await currentPosition();
      if (live && at) await api.taxipressSendLocation(at.lat, at.lng).catch(() => {});
    };
    void send();
    const id = window.setInterval(send, LOCATION_MS);
    return () => { live = false; window.clearInterval(id); };
  }, [status]);

  return (
    <div className="space-y-5 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Back to home" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-ink">Taxipress</h1>
          <p className="truncate text-sm text-ink-500">{view?.taxi ? `${view.taxi.plate} · ${view.taxi.seats} seats` : "Seats on your taxi, booked in the app"}</p>
        </div>
      </header>

      {error && <p className={errorBox}>{error}</p>}

      {!view ? null : !view.ready ? (
        <p className="home-card text-sm text-ink-500">Taxipress isn&apos;t set up yet.</p>
      ) : !view.taxi ? (
        <Apply view={view} onDone={load} />
      ) : view.taxi.status === "pending" ? (
        <section className="home-card space-y-1">
          <h2 className="font-bold text-ink">Waiting for approval</h2>
          <p className="text-sm text-ink-500">Peebee is checking {view.taxi.plate}. You will be able to join the line once it is approved.</p>
        </section>
      ) : view.taxi.status === "suspended" ? (
        <p className="home-card text-sm text-ink-500">Your taxi is suspended. Contact Peebee support.</p>
      ) : !view.taxi.passengersEnabled ? (
        <p className="home-card text-sm text-ink-500">Your taxi isn&apos;t set up to take passengers yet. It can still carry parcels.</p>
      ) : (
        <Board view={view} onChange={load} />
      )}
    </div>
  );
}

function Apply({ view, onDone }: { view: TaxipressDriverView; onDone: () => Promise<void> }) {
  const [routeId, setRouteId] = useState("");
  const [plate, setPlate] = useState("");
  const [layout, setLayout] = useState<"14" | "18">("14");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.applyTaxipressTaxi({ relayRouteId: routeId, plate, seatLayout: layout });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (view.applyRoutes.length === 0) return <p className="home-card text-sm text-ink-500">No Taxipress route is open for taxis yet.</p>;

  return (
    <form onSubmit={submit} className="home-card space-y-4">
      <p className="text-sm text-ink-500">Register your taxi once. When Peebee approves it you can join the line and take seats, and carry relay parcels.</p>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-ink-500">Route</span>
        <Select value={routeId} onValueChange={setRouteId} aria-label="Route" sizing="stretch" className="min-h-12 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm">
          <option value="">Choose your route</option>
          {view.applyRoutes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-ink-500">Number plate</span>
        <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="e.g. UAX 123K" autoCapitalize="characters" className="min-h-12 w-full rounded-xl border border-[var(--border-faint)] font-mono font-bold text-ink outline-none focus:ring-2 focus:ring-gold" />
      </label>
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-ink-500">Seats for passengers</span>
        <div className="grid grid-cols-2 gap-2">
          {(["14", "18"] as const).map((n) => (
            <button key={n} type="button" aria-pressed={layout === n} onClick={() => setLayout(n)} className={`min-h-12 rounded-xl font-bold ${layout === n ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>{n} seats</button>
          ))}
        </div>
      </div>
      {error && <p className={errorBox}>{error}</p>}
      <button type="submit" disabled={busy || !routeId || plate.trim().length < 3} className={primary}>{busy ? "Sending…" : "Apply"}</button>
    </form>
  );
}

function Board({ view, onChange }: { view: TaxipressDriverView; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [routeId, setRouteId] = useState(view.routes[0]?.id ?? "");
  const entry = view.entry;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  if (!entry) {
    const chosen = view.routes.find((r) => r.id === routeId) ?? view.routes[0];
    return (
      <section className="home-card space-y-4">
        {!view.enabled && <p className="text-sm text-ink-500">Taxipress isn&apos;t running right now.</p>}
        {view.owingBlocked && <p className={errorBox}>You owe Peebee too much to join the line. Top up your wallet first.</p>}
        {view.routes.length === 0 ? (
          <p className="text-sm text-ink-500">No route is running for your taxi right now.</p>
        ) : (
          <>
            <p className="text-sm text-ink-500">Join the line at your stage. Passengers can then book seats on your taxi.</p>
            <div className="grid gap-2">
              {view.routes.map((r) => (
                <button key={r.id} type="button" aria-pressed={chosen?.id === r.id} onClick={() => setRouteId(r.id)} className={`min-h-12 rounded-xl px-3 text-left text-sm font-bold ${chosen?.id === r.id ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>
                  {r.fromName} → {r.toName}
                </button>
              ))}
            </div>
            {error && <p className={errorBox}>{error}</p>}
            <button
              type="button"
              disabled={busy || !view.enabled || !chosen}
              onClick={() => run(async () => { const at = await currentPosition(); await api.taxipressJoinLine({ routeId: chosen!.id, ...(at ?? {}) }); })}
              className={primary}
            >
              {busy ? "Joining…" : `Join the line at ${chosen?.fromName ?? "the stage"}`}
            </button>
          </>
        )}
      </section>
    );
  }

  const route = view.routes.find((r) => r.id === entry.taxipressRouteId);
  const onRoad = entry.status === "on_road";
  const front = entry.position === 1;

  return (
    <div className="space-y-4">
      <section className="home-card space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{route ? `${route.fromName} → ${route.toName}` : "Your route"}</p>
        <h2 className="text-xl font-black text-ink">
          {onRoad ? "On the road" : entry.status === "boarding" ? "Boarding now" : front ? "You're next" : `${ordinal(entry.position ?? 0)} in the line`}
        </h2>
        <SeatCounter entry={entry} />
        {!onRoad && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Seats sold at the stage</p>
              <p className="text-[11px] text-ink-500">Passengers who paid you directly, not in the app.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" aria-label="One fewer walk-up seat" disabled={busy || entry.walkUpSeats <= 0} onClick={() => run(() => api.taxipressWalkUp(-1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden /></button>
              <span className="w-6 text-center font-bold text-ink" aria-live="polite">{entry.walkUpSeats}</span>
              <button type="button" aria-label="One more walk-up seat" disabled={busy || entry.fullyBooked} onClick={() => run(() => api.taxipressWalkUp(1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
        )}
        {error && <p className={errorBox}>{error}</p>}

        {entry.status === "in_line" && (
          <>
            <button type="button" disabled={busy || !front} onClick={() => run(() => api.taxipressStartBoarding())} className={primary}>Boarding now</button>
            {!front && <p className="text-xs text-ink-500">You can start boarding when you are at the front of the line.</p>}
          </>
        )}
        {entry.status === "boarding" && (
          <>
            <button type="button" disabled={busy || !view.canGoOnRoad} onClick={() => run(() => api.taxipressGoOnRoad())} className={primary}>On road</button>
            {!view.canGoOnRoad && view.onRoadReason && <p className="text-xs text-ink-500">{view.onRoadReason}</p>}
          </>
        )}
        {onRoad && <button type="button" disabled={busy} onClick={() => run(() => api.taxipressArrive())} className={primary}>Arrived</button>}
        {!onRoad && <button type="button" disabled={busy} onClick={() => run(() => api.taxipressLeaveLine())} className={secondary}>Leave the line</button>}
      </section>

      {!onRoad && view.line.length > 0 && (
        <section className="home-card space-y-2">
          <h3 className="flex items-center gap-2 font-bold text-ink"><Bus className="h-4 w-4 text-gold" aria-hidden /> The line</h3>
          <ol className="space-y-1.5">
            {view.line.map((e) => <LineRow key={e.id} entry={e} mine={e.id === entry.id} />)}
          </ol>
        </section>
      )}
    </div>
  );
}

function SeatCounter({ entry }: { entry: TaxipressLineEntry }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-ink">{entry.seatsTaken} of {entry.seatsTotal} seats booked</p>
        <p className="text-xs text-ink-500">{entry.fullyBooked ? "Fully booked" : `${entry.seatsLeft} free`}</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="presentation">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.round((entry.seatsTaken / Math.max(1, entry.seatsTotal)) * 100))}%` }} />
      </div>
    </div>
  );
}

function LineRow({ entry, mine }: { entry: TaxipressLineEntry; mine: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${mine ? "bg-gold/15" : "bg-[rgb(var(--surface-muted))]"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{entry.position}. {entry.plate}{mine ? " (you)" : ""}</span>
        <span className="block text-[11px] text-ink-500">{entry.status === "boarding" ? "Boarding now" : "In line"} · {entry.seatsTaken}/{entry.seatsTotal} seats</span>
      </span>
    </li>
  );
}
