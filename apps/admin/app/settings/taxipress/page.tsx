"use client";

import { hasPermission, type TaxipressAdminRoute, type TaxipressRelayRoute, type TaxipressSettings } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { Switch } from "../../../components/ui/Switch";
import { Select } from "../../../components/ui/Select";
import { Badge, ErrorNote, Field, inputCls, ugx } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type Tab = "settings" | "routes";
const digits = (v: string) => v.replace(/[^\d]/g, "");
const decimal = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const smallBtn = "min-h-9 rounded-full px-3 text-xs font-bold";

function MigrationNotice() {
  return (
    <p className="rounded-2xl bg-gold/15 p-3 text-xs text-ink">
      Taxipress needs database migration <b>0123_taxipress.sql</b> (and the relay migrations before it). Apply it, then come back. Nothing is offered to customers until it is.
    </p>
  );
}

export default function TaxipressPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.adminRole ?? null, "settings.manage");
  const [tab, setTab] = useState<Tab>("settings");

  if (!user) return <SettingsPageShell title="Taxipress" loading>{null}</SettingsPageShell>;

  return (
    <SettingsPageShell title="Taxipress" loading={false}>
      {!canManage ? (
        <p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            Seats on the next taxi along a fixed route. Routes are set up in{" "}
            <Link href="/settings/relay" className="font-bold text-gold underline-offset-2 hover:underline">Relay delivery</Link>{" "}
            (stage names, locations and stops), then run here in each direction with a fare per seat. Taxipress and its routes start switched off.
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {([["settings", "Settings"], ["routes", "Routes"]] as [Tab, string][]).map(([id, text]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`${smallBtn} shrink-0 ${tab === id ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>{text}</button>
            ))}
          </div>
          {tab === "settings" ? <SettingsTab /> : <RoutesTab />}
        </>
      )}
    </SettingsPageShell>
  );
}

function SettingsTab() {
  const [s, setS] = useState<TaxipressSettings | null>(null);
  const [notAllowed, setNotAllowed] = useState("");
  const [num, setNum] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback((next: TaxipressSettings) => {
    setS(next);
    setNotAllowed(next.parcelNotAllowed.join("\n"));
    setNum({
      commissionDigitalPercent: String(next.commissionDigitalPercent), commissionCashPercent: String(next.commissionCashPercent),
      commissionFlatUgx: String(next.commissionFlatUgx), maxOwedUgx: String(next.maxOwedUgx), seatChoiceFeeUgx: String(next.seatChoiceFeeUgx),
      returnDiscountPercent: String(next.returnDiscountPercent), maxSeatsPerBooking: String(next.maxSeatsPerBooking),
      maxParcels14: String(next.maxParcels14), maxParcels18: String(next.maxParcels18),
    });
  }, []);

  useEffect(() => {
    api.adminGetTaxipressSettings()
      .then((res) => { load(res.settings); setReady(res.ready); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;
  if (!s) return <ErrorNote message={error} />;

  const set = <K extends keyof TaxipressSettings>(key: K, value: TaxipressSettings[K]) => setS((cur) => (cur ? { ...cur, [key]: value } : cur));
  const field = (key: string, whole: boolean) => (
    <input inputMode={whole ? "numeric" : "decimal"} required value={num[key] ?? ""} onChange={(e) => setNum((n) => ({ ...n, [key]: whole ? digits(e.target.value) : decimal(e.target.value) }))} className={inputCls} />
  );
  const choice = <T extends string>(value: T, current: T, text: string, hint: string, pick: (v: T) => void) => (
    <button key={value} type="button" onClick={() => pick(value)} aria-pressed={current === value} className={`rounded-2xl px-3 py-2.5 text-left transition ${current === value ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}>
      <span className="block text-sm font-bold">{text}</span>
      <span className="block text-xs opacity-80">{hint}</span>
    </button>
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const n = (key: string) => Number(num[key] ?? 0);
      const res = await api.adminUpdateTaxipressSettings({
        enabled: s.enabled, departureRule: s.departureRule, sellFreeSeatsOnRoad: s.sellFreeSeatsOnRoad,
        commissionType: s.commissionType, commissionDigitalPercent: n("commissionDigitalPercent"), commissionCashPercent: n("commissionCashPercent"),
        commissionFlatUgx: n("commissionFlatUgx"), blockWhenOwing: s.blockWhenOwing, maxOwedUgx: n("maxOwedUgx"), cashEnabled: s.cashEnabled,
        seatChoiceFeeUgx: n("seatChoiceFeeUgx"), returnDiscountPercent: n("returnDiscountPercent"), maxSeatsPerBooking: n("maxSeatsPerBooking"),
        parcelAcceptRule: s.parcelAcceptRule, maxParcels14: n("maxParcels14"), maxParcels18: n("maxParcels18"), parcelFitText: s.parcelFitText,
        parcelNotAllowed: notAllowed.split("\n").map((x) => x.trim()).filter(Boolean),
      });
      load(res.settings);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!ready && <MigrationNotice />}
      <section className="home-card space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <Switch checked={s.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          Taxipress is on
        </label>
        <p className="text-xs text-ink-500">Off hides it from customers entirely. It also stays hidden while no route is running.</p>
      </section>

      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">When a taxi may leave</p>
        <div className="grid gap-2">
          {choice("full_only", s.departureRule, "Only when every seat is booked", "The driver can tap On Road only once the taxi is fully booked.", (v) => set("departureRule", v))}
          {choice("driver_choice", s.departureRule, "When the driver decides", "The driver may leave with free seats.", (v) => set("departureRule", v))}
          {choice("after_wait", s.departureRule, "After a wait", "The driver may leave with free seats once the wait has passed.", (v) => set("departureRule", v))}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <Switch checked={s.sellFreeSeatsOnRoad} onChange={(e) => set("sellFreeSeatsOnRoad", e.target.checked)} />
          Sell free seats on a taxi that is already on the road
        </label>
      </section>

      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">Seats and fares</p>
        <p className="text-xs text-ink-500">The fare per seat is set on each route. Mid-route fares are a per-route switch.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Most seats in one booking">{field("maxSeatsPerBooking", true)}</Field>
          <Field label="Choose-your-seat fee (UGX)">{field("seatChoiceFeeUgx", true)}</Field>
          <Field label="Return trip discount (%)">{field("returnDiscountPercent", false)}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <Switch checked={s.cashEnabled} onChange={(e) => set("cashEnabled", e.target.checked)} />
          Passengers may pay cash to the driver
        </label>
      </section>

      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">Peebee&apos;s commission on a seat</p>
        <div className="grid grid-cols-2 gap-2">
          {choice("percent", s.commissionType, "A percentage", "Digital and cash can differ.", (v) => set("commissionType", v))}
          {choice("flat", s.commissionType, "A flat amount", "The same for every seat.", (v) => set("commissionType", v))}
        </div>
        {s.commissionType === "percent" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Digital payments (%)">{field("commissionDigitalPercent", false)}</Field>
            <Field label="Cash payments (%)">{field("commissionCashPercent", false)}</Field>
          </div>
        ) : (
          <Field label="Per seat (UGX)">{field("commissionFlatUgx", true)}</Field>
        )}
        <p className="text-xs text-ink-500">On cash the commission is taken from the driver&apos;s wallet, which may go negative and is netted against their next digital payout.</p>
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <Switch checked={s.blockWhenOwing} onChange={(e) => set("blockWhenOwing", e.target.checked)} />
          Block a driver from joining the line when they owe too much
        </label>
        <Field label="Owing more than (UGX)">{field("maxOwedUgx", true)}</Field>
      </section>

      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">Parcels in a taxi</p>
        <p className="text-xs text-ink-500">A parcel is a parcel: if it fits, it goes. Taxipress taxis take no relay parcels until the numbers below are set.</p>
        <div className="grid gap-2">
          {choice("boarding_now", s.parcelAcceptRule, "Only the taxi that is boarding now", "Other taxis in the line do not take parcels yet.", (v) => set("parcelAcceptRule", v))}
          {choice("any_in_line", s.parcelAcceptRule, "Any taxi in the line", "A parcel may go in whichever taxi the rider reaches.", (v) => set("parcelAcceptRule", v))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Most parcels, 14-seater">{field("maxParcels14", true)}</Field>
          <Field label="Most parcels, 18-seater">{field("maxParcels18", true)}</Field>
        </div>
        <Field label="“Does it fit?” line" hint="Shown to customers and drivers.">
          <input value={s.parcelFitText} maxLength={200} onChange={(e) => set("parcelFitText", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Not allowed (one per line)">
          <textarea rows={4} value={notAllowed} onChange={(e) => setNotAllowed(e.target.value)} className={inputCls} />
        </Field>
      </section>
      <SettingsSaveBar busy={busy} error={error} saved={saved} />
    </form>
  );
}

function RoutesTab() {
  const [routes, setRoutes] = useState<TaxipressAdminRoute[]>([]);
  const [relay, setRelay] = useState<TaxipressRelayRoute[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState({ relayRouteId: "", direction: "a_to_b" as "a_to_b" | "b_to_a", fare: "" });
  const [busy, setBusy] = useState<string | null>(null);

  // Bumping the version reloads the list after any change.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true;
    api.adminListTaxipressRoutes()
      .then((res) => {
        if (!live) return;
        setRoutes(res.routes);
        setRelay(res.relayRoutes);
        setReady(res.ready);
      })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [version]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try { await action(); refresh(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(null); }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;
  const chosen = relay.find((r) => r.id === adding.relayRouteId);

  return (
    <div className="space-y-4">
      {!ready && <MigrationNotice />}
      <ErrorNote message={error} />
      {ready && routes.length === 0 && <p className="text-sm text-ink-500">No Taxipress routes yet.</p>}
      {routes.map((r) => (
        <section key={r.id} className="home-card space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{r.fromName} → {r.toName}</p>
              <p className="text-xs text-ink-500">{r.directionLabel} · {ugx(r.farePerSeat)} per seat</p>
            </div>
            <Badge tone={r.active && r.relayActive ? "good" : r.active ? "warn" : "neutral"}>{r.active ? (r.relayActive ? "Running" : "Relay route off") : "Off"}</Badge>
          </div>
          <FareEditor route={r} busy={busy === r.id} onSave={(fare) => run(r.id, () => api.adminUpdateTaxipressRoute(r.id, { farePerSeat: fare }))} />
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <Switch checked={r.stopPricingEnabled} disabled={busy === r.id} onChange={(e) => run(r.id, () => api.adminUpdateTaxipressRoute(r.id, { stopPricingEnabled: e.target.checked }))} />
            Cheaper fares for boarding mid-route
          </label>
          <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => api.adminUpdateTaxipressRoute(r.id, { active: !r.active }))} className={`${smallBtn} ${r.active ? "bg-gold/15 text-ink" : "bg-gold text-ink-gold"}`}>
            {r.active ? "Switch off" : "Switch on"}
          </button>
        </section>
      ))}

      {ready && (
        <section className="home-card space-y-3">
          <p className="text-sm font-bold text-ink">Add a route</p>
          {relay.length === 0 ? (
            <p className="text-xs text-ink-500">Set up the route first in <Link href="/settings/relay" className="font-bold text-gold">Relay delivery → Matatu routes</Link>.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("add", () => api.adminCreateTaxipressRoute({ relayRouteId: adding.relayRouteId, direction: adding.direction, farePerSeat: Number(adding.fare) })
                  .then(() => setAdding({ relayRouteId: "", direction: "a_to_b", fare: "" })));
              }}
            >
              <Field label="Route">
                <Select value={adding.relayRouteId} onValueChange={(v) => setAdding((a) => ({ ...a, relayRouteId: v }))} aria-label="Route" sizing="stretch" className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-sm">
                  <option value="">Choose a route</option>
                  {relay.map((rr) => <option key={rr.id} value={rr.id}>{rr.name}</option>)}
                </Select>
              </Field>
              <Field label="Direction">
                <Select value={adding.direction} onValueChange={(v) => setAdding((a) => ({ ...a, direction: v as "a_to_b" | "b_to_a" }))} aria-label="Direction" sizing="stretch" className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-sm">
                  <option value="a_to_b">{chosen ? `${chosen.stageAName} → ${chosen.stageBName}` : "Stage A → Stage B"}</option>
                  <option value="b_to_a">{chosen ? `${chosen.stageBName} → ${chosen.stageAName}` : "Stage B → Stage A"}</option>
                </Select>
              </Field>
              <Field label="Fare per seat (UGX)">
                <input inputMode="numeric" required value={adding.fare} onChange={(e) => setAdding((a) => ({ ...a, fare: digits(e.target.value) }))} className={inputCls} />
              </Field>
              <button type="submit" disabled={busy === "add" || !adding.relayRouteId || !adding.fare} className={`${smallBtn} bg-gold text-ink-gold disabled:opacity-50`}>Add route (starts off)</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function FareEditor({ route, busy, onSave }: { route: TaxipressAdminRoute; busy: boolean; onSave: (fare: number) => void }) {
  const [fare, setFare] = useState(String(route.farePerSeat));
  const changed = fare !== "" && Number(fare) !== route.farePerSeat;
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label="Fare per seat (UGX)">
          <input inputMode="numeric" value={fare} onChange={(e) => setFare(digits(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <button type="button" disabled={!changed || busy} onClick={() => onSave(Number(fare))} className={`${smallBtn} bg-gold text-ink-gold disabled:opacity-50`}>Save</button>
    </div>
  );
}
