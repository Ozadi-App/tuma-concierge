"use client";

import { ApiError, type RelayLegStatus, type RelayStationParcels, type RelayTrack } from "@peebee/shared";
import {
  AlertCircle,
  Bike,
  Bus,
  Camera,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  RefreshCw,
  Store,
  User,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeQr } from "../../components/CodeQr";
import { QrScanner } from "../../components/QrScanner";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type Journey = Omit<RelayTrack, "order"> & { order: { id: string; stage: string; destinationArea: string | null } };
type Held = RelayStationParcels["held"][number];

const REFRESH_MS = 15_000;

/** A typed or scanned value, reduced to its 6-digit code. */
function toCode(raw: string): string {
  const runs = raw.match(/\d+/g) ?? [];
  const exact = runs.find((r) => r.length === 6);
  if (exact) return exact;
  return raw.replace(/\D/g, "").slice(0, 6);
}

function isUnavailable(e: unknown) {
  return e instanceof ApiError && e.status === 503 && e.code === "relay_unavailable";
}

function when(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function shortId(orderId: string) {
  return `#${orderId.slice(-6).toUpperCase()}`;
}

function matatuLabel(status: RelayLegStatus) {
  if (status === "in_transit") return "On the way";
  if (status === "arrived" || status === "done") return "At the stage";
  return "Waiting for matatu";
}

function nextStep(p: Held) {
  if (p.last_mile === "collect") return "Customer will collect";
  if (p.last_mile === "pending") return "Waiting for customer to choose";
  return `Rider: ${p.rider_name ?? "being called"}`;
}

export default function ParcelsPage() {
  const router = useRouter();
  const { attendant, ready } = useAuth();
  const [data, setData] = useState<RelayStationParcels | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !attendant) router.replace("/login");
  }, [ready, attendant, router]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.gasRelayParcels();
      setData(res);
      setUnavailable(false);
      setLoadError(null);
    } catch (e) {
      if (isUnavailable(e)) setUnavailable(true);
      else setLoadError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !attendant) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready, attendant, load]);

  if (unavailable) {
    return (
      <div className="space-y-4">
        <Header refreshing={false} onRefresh={() => void load()} />
        <section className="home-card text-center text-sm font-semibold text-ink-500">
          Relay parcels aren't set up yet.
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <Header refreshing={refreshing} onRefresh={() => void load()} />

      {loadError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="grid gap-3">
        <CodeAction
          title="Receive from matatu"
          hint="Enter or scan the matatu operator's code."
          icon={<Bus className="h-5 w-5" />}
          confirmLabel="Receive parcel"
          doneLabel="Parcel received. Keep it in the shop."
          onSubmit={(code) => api.gasRelayReceive(code)}
          onDone={() => void load()}
        />
        <CodeAction
          title="Customer collecting"
          hint="Enter or scan the customer's code."
          icon={<User className="h-5 w-5" />}
          confirmLabel="Hand over"
          doneLabel="Handed to the customer."
          onSubmit={(code) => api.gasRelayRelease(code)}
          onDone={() => void load()}
        />
      </div>

      {!data && !loadError ? (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : data ? (
        <>
          <Section title="Coming by matatu" icon={<Bus className="h-4 w-4 text-gold" />} count={data.incoming.length} empty="Nothing on the way.">
            {data.incoming.map((p) => (
              <ParcelRow key={p.order_id} onOpen={() => setOpenId(p.order_id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">From {p.from_name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {[p.vehicle_plate, p.operator_name].filter(Boolean).join(" · ") || "Matatu not assigned"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.matatu_status === "in_transit" ? "bg-gold/15 text-gold" : p.matatu_status === "arrived" ? "bg-green/15 text-green" : "bg-[rgb(var(--surface-muted))] text-ink-500"}`}>
                  {matatuLabel(p.matatu_status)}
                </span>
              </ParcelRow>
            ))}
          </Section>

          <Section title="In the shop" icon={<Store className="h-4 w-4 text-gold" />} count={data.held.length} empty="No parcels in the shop.">
            {data.held.map((p) => (
              <div key={p.order_id} className="space-y-3 rounded-2xl border border-[var(--border-faint)] p-3">
                <button type="button" onClick={() => setOpenId(p.order_id)} className="flex w-full items-start gap-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                    {p.last_mile === "door" ? <Bike className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{p.customer_name ?? "Customer"} <span className="font-mono text-[11px] font-bold text-ink-500">{shortId(p.order_id)}</span></p>
                    {p.customer_phone && <p className="text-xs text-ink-500">{p.customer_phone}</p>}
                    <p className="mt-1 text-xs font-bold text-ink">{nextStep(p)}</p>
                    <p className="text-[11px] text-ink-500">In shop since {when(p.held_at)}</p>
                  </div>
                </button>
                {p.release_code && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl bg-gold/10 p-3 text-center">
                    <p className="text-xs font-bold text-ink-500">Show the rider this code</p>
                    <p className="font-mono text-4xl font-black tracking-[0.3em] text-ink">{p.release_code}</p>
                    <CodeQr value={p.release_code} size={180} />
                  </div>
                )}
              </div>
            ))}
          </Section>

          <Section title="Handed over" icon={<PackageCheck className="h-4 w-4 text-gold" />} count={data.recent.length} empty="Nothing handed over yet.">
            {data.recent.map((p) => (
              <ParcelRow key={p.order_id} onOpen={() => setOpenId(p.order_id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink">{p.customer_name ?? "Customer"} <span className="font-mono text-[11px] font-bold text-ink-500">{shortId(p.order_id)}</span></p>
                  <p className="text-xs text-ink-500">{p.released_to === "rider" ? "To rider" : "Collected by customer"} · {when(p.released_at)}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green" />
              </ParcelRow>
            ))}
          </Section>
        </>
      ) : null}

      {openId && <JourneySheet orderId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Header({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-gold">Relay</span>
        <h1 className="text-xl font-black text-ink">Parcels</h1>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink active:scale-95"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

function Section({ title, icon, count, empty, children }: { title: string; icon: React.ReactNode; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="home-card space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {count > 0 && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">{count}</span>}
      </div>
      {count === 0 ? <p className="text-xs text-ink-500">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function ParcelRow({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-faint)] p-3 text-left active:scale-[0.99]">
      {children}
    </button>
  );
}

function CodeAction({
  title,
  hint,
  icon,
  confirmLabel,
  doneLabel,
  onSubmit,
  onDone,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  confirmLabel: string;
  doneLabel: string;
  onSubmit: (code: string) => Promise<{ orderId: string }>;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);

  async function submit(value: string) {
    const c = toCode(value);
    if (c.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await onSubmit(c);
      setCode("");
      setDone(`${doneLabel} ${shortId(res.orderId)}`);
      onDone();
    } catch (e) {
      setError(isUnavailable(e) ? "Relay parcels aren't set up yet." : errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;
  // Stable, so the scanner's camera effect isn't restarted on every render.
  const handleScan = useCallback((raw: string) => {
    setScanning(false);
    const c = toCode(raw);
    setCode(c);
    void submitRef.current(c);
  }, []);
  const closeScanner = useCallback(() => setScanning(false), []);

  return (
    <section className="home-card space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-ink">{title}</h2>
          <p className="text-xs text-ink-500">{hint}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
        className="space-y-2"
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            if (error) setError(null);
            if (done) setDone(null);
          }}
          placeholder="6-digit code"
          aria-label={`${title} code`}
          className="min-h-13 w-full rounded-2xl text-center font-mono text-2xl font-black tracking-[0.4em] text-ink"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-sm font-bold text-ink active:scale-95"
          >
            <Camera className="h-4 w-4" />
            <span>Scan QR</span>
          </button>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-gold text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "Checking…" : confirmLabel}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {done && (
        <div className="flex items-center gap-2 rounded-2xl border border-green/30 bg-green/10 p-3 text-xs font-semibold text-green">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{done}</span>
        </div>
      )}

      {scanning && <QrScanner title={title} hideSample onScan={handleScan} onClose={closeScanner} />}
    </section>
  );
}

const LEG_STATUS: Record<RelayLegStatus, string> = {
  waiting: "Waiting",
  open: "Finding someone",
  assigned: "Assigned",
  in_transit: "On the way",
  arrived: "Arrived",
  done: "Done",
};

function JourneySheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .gasRelayParcel(orderId)
      .then((res) => { if (!cancelled) setJourney(res); })
      .catch((e) => { if (!cancelled) setError(isUnavailable(e) ? "Relay parcels aren't set up yet." : errorMessage(e)); });
    return () => { cancelled = true; };
  }, [orderId]);

  const relay = journey?.relay;
  const events = [...(journey?.events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Parcel journey"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[rgb(var(--surface-card))] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink sm:rounded-3xl"
      >
        <div className="flex items-center justify-between pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gold">Journey</span>
            <h2 className="text-lg font-black">
              Parcel <span className="font-mono">{shortId(orderId)}</span>
            </h2>
            {journey?.order.destinationArea && <p className="text-xs text-ink-500">To {journey.order.destinationArea}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-faint)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-600">{error}</p>
        ) : !journey || !relay ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="relative space-y-4 border-l-2 border-[var(--border-faint)] pl-4">
              {relay.legs.map((leg) => {
                const doneLeg = leg.status === "done" || !!leg.handedOverAt;
                return (
                  <li key={leg.id} className="relative">
                    <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ${doneLeg ? "bg-green" : leg.status === "waiting" ? "bg-[rgb(var(--surface-muted))] ring-2 ring-[var(--border-faint)]" : "bg-gold"}`} />
                    <p className="flex items-center gap-1.5 text-sm font-black">
                      {leg.kind === "matatu" ? <Bus className="h-4 w-4 text-gold" /> : <Bike className="h-4 w-4 text-gold" />}
                      {leg.fromName ?? "Pickup"} → {leg.toName ?? "Drop"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {[leg.kind === "matatu" ? "Matatu" : "Rider", leg.providerName, leg.vehiclePlate].filter(Boolean).join(" · ")} · {LEG_STATUS[leg.status]}
                    </p>
                    {(leg.startedAt || leg.handedOverAt) && (
                      <p className="text-[11px] text-ink-500">
                        {leg.startedAt && `Picked up ${when(leg.startedAt)}`}
                        {leg.startedAt && leg.handedOverAt && " · "}
                        {leg.handedOverAt && `Handed over ${when(leg.handedOverAt)}`}
                      </p>
                    )}
                  </li>
                );
              })}
              {relay.heldAt && (
                <li className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-green" />
                  <p className="flex items-center gap-1.5 text-sm font-black"><Store className="h-4 w-4 text-gold" /> In the shop</p>
                  <p className="text-[11px] text-ink-500">Since {when(relay.heldAt)}</p>
                </li>
              )}
              {relay.releasedAt && (
                <li className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-green" />
                  <p className="flex items-center gap-1.5 text-sm font-black"><PackageCheck className="h-4 w-4 text-gold" /> {relay.releasedTo === "rider" ? "Given to rider" : "Collected by customer"}</p>
                  <p className="text-[11px] text-ink-500">{when(relay.releasedAt)}</p>
                </li>
              )}
            </ol>

            {events.length > 0 && (
              <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Updates</h3>
                <ul className="space-y-2">
                  {events.map((ev, i) => (
                    <li key={`${ev.created_at}-${i}`} className="flex gap-2 text-xs">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                      <div>
                        <p className="font-semibold text-ink">{ev.note || ev.stage}</p>
                        <p className="text-[11px] text-ink-500">{when(ev.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
