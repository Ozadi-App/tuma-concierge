"use client";

import { ApiError, hasPermission, type RelayAdminOrder, type RelayDropMode, type RelayOperator, type RelayRoute, type RelaySettings, type RelayStation } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { Badge, ErrorNote, Field, inputCls, label, ugx, when } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type Tab = "settings" | "routes" | "stations" | "operators" | "orders";
const digits = (v: string) => v.replace(/[^\d]/g, "");
const decimal = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const coord = (v: string) => v.replace(/[^\d.-]/g, "").replace(/(?!^)-/g, "").replace(/(\..*)\./g, "$1");
const smallBtn = "min-h-9 rounded-full px-3 text-xs font-bold";

/** Errors the relay endpoints return with a plain message (503s would otherwise read as "something went wrong"). */
function relayError(err: unknown) {
  if (err instanceof ApiError && err.code === "stations_unavailable") return "Petrol-station drops need database migration 0105.";
  if (err instanceof ApiError && err.code === "relay_unavailable") return "Relay delivery needs database migration 0102.";
  if (err instanceof ApiError && err.code === "location_required") return "Set this station's map location first.";
  return errorMessage(err);
}

export default function RelayDeliveryPage() {
  const { user } = useAuth();
  const role = user?.adminRole ?? null;
  const canSettings = hasPermission(role, "settings.manage");
  const canOperators = hasPermission(role, "riders.view");
  const canVerify = hasPermission(role, "riders.verify");
  const canOrders = hasPermission(role, "orders.view");

  const tabs = ([
    ["settings", "Settings", canSettings],
    ["routes", "Matatu routes", canSettings],
    ["stations", "Stations", canSettings],
    ["operators", "Operators", canOperators],
    ["orders", "Orders", canOrders],
  ] as [Tab, string, boolean][]).filter(([, , show]) => show);

  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab && tabs.some(([id]) => id === tab) ? tab : (tabs[0]?.[0] ?? null);

  if (!user) return <SettingsPageShell title="Relay delivery" loading>{null}</SettingsPageShell>;

  return (
    <SettingsPageShell title="Relay delivery" loading={false}>
      {tabs.length === 0 ? (
        <p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            Long parcels go boda → matatu → boda: a rider takes the parcel to a matatu stage, an approved matatu operator carries it along a
            route, and a second rider delivers it to the door. Station routes leave it at a petrol station near the customer instead.
          </p>
          {tabs.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`${smallBtn} shrink-0 ${active === id ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          {active === "settings" && <SettingsTab />}
          {active === "routes" && <RoutesTab />}
          {active === "stations" && <StationsTab />}
          {active === "operators" && <OperatorsTab canVerify={canVerify} />}
          {active === "orders" && <OrdersTab />}
        </>
      )}
    </SettingsPageShell>
  );
}

function MigrationNotice() {
  return (
    <p className="rounded-xl bg-gold/15 px-3 py-2 text-sm text-ink">
      Relay delivery needs database migration 0102. Until it is applied, relay stays off and nothing here can be saved.
    </p>
  );
}

function StationsNotice() {
  return (
    <p className="rounded-xl bg-gold/15 px-3 py-2 text-sm text-ink">
      Petrol-station drops need database migration 0105. Until it is applied, every route hands over at the stage.
    </p>
  );
}

function SettingsTab() {
  const [enabled, setEnabled] = useState(false);
  const [minDistance, setMinDistance] = useState("");
  const [maxAccess, setMaxAccess] = useState("");
  const [radius, setRadius] = useState("");
  const [perLeg, setPerLeg] = useState(true);
  const [choice, setChoice] = useState<"order" | "arrival">("order");
  const [stationKm, setStationKm] = useState("");
  const [ready, setReady] = useState(true);
  const [stationsReady, setStationsReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load(s: RelaySettings) {
    setEnabled(s.enabled);
    setMinDistance(String(s.minDistanceKm));
    setMaxAccess(String(s.maxAccessKm));
    setRadius(String(s.lastMileRadiusKm));
    setPerLeg(s.releasePerLeg);
    setChoice(s.lastMileChoice ?? "order");
    setStationKm(String(s.stationMaxKm ?? 10));
  }

  useEffect(() => {
    api
      .adminGetRelaySettings()
      .then((res) => {
        load(res.settings);
        setReady(res.ready);
        setStationsReady(res.stationsReady !== false);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api.adminUpdateRelaySettings({
        enabled,
        minDistanceKm: Number(minDistance),
        maxAccessKm: Number(maxAccess),
        lastMileRadiusKm: Number(radius),
        releasePerLeg: perLeg,
        lastMileChoice: choice,
        stationMaxKm: Number(stationKm),
      });
      load(res.settings);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!ready && <MigrationNotice />}
      {ready && !stationsReady && <StationsNotice />}
      <section className="home-card space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-gold" />
          Relay delivery is on
        </label>
        <p className="text-xs text-ink-500">Off means every parcel goes the whole way by boda, however long.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relay parcels longer than (km)">
            <input inputMode="decimal" required value={minDistance} disabled={!enabled} onChange={(e) => setMinDistance(decimal(e.target.value))} className={`${inputCls} disabled:opacity-50`} />
          </Field>
          <Field label="Max distance from pickup/door to a stage (km)">
            <input inputMode="decimal" required value={maxAccess} disabled={!enabled} onChange={(e) => setMaxAccess(decimal(e.target.value))} className={`${inputCls} disabled:opacity-50`} />
          </Field>
          <div className="col-span-2">
            <Field label="Notify riders within (km)" hint="Riders this close to the drop-off stage are told when the matatu is near, so one is ready for the last leg.">
              <input inputMode="decimal" required value={radius} disabled={!enabled} onChange={(e) => setRadius(decimal(e.target.value))} className={`${inputCls} disabled:opacity-50`} />
            </Field>
          </div>
        </div>
      </section>
      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">When each leg is paid</p>
        <div className="grid gap-2">
          {([
            [true, "Pay each leg at its handoff", "A rider or operator is paid as soon as the next one confirms they received the parcel."],
            [false, "Pay all legs when the order settles", "Everyone on the relay is paid together once the order is delivered and settled."],
          ] as [boolean, string, string][]).map(([value, title, hint]) => (
            <button
              key={title}
              type="button"
              onClick={() => setPerLeg(value)}
              aria-pressed={perLeg === value}
              className={`rounded-2xl px-3 py-2.5 text-left transition ${perLeg === value ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}
            >
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-xs opacity-80">{hint}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="home-card space-y-3">
        <p className="text-sm font-bold text-ink">Petrol-station drops</p>
        <p className="text-xs text-ink-500">For routes that drop at a station: the matatu leaves the parcel there, then a rider brings it or the customer collects it.</p>
        <Field label="Drop station within (km) of the customer">
          <input inputMode="decimal" required value={stationKm} onChange={(e) => setStationKm(decimal(e.target.value))} className={inputCls} />
        </Field>
        <p className="text-xs font-bold text-ink-500">Customer chooses door or collection</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["order", "When ordering"],
            ["arrival", "When it reaches the station"],
          ] as ["order" | "arrival", string][]).map(([value, title]) => (
            <button
              key={value}
              type="button"
              onClick={() => setChoice(value)}
              aria-pressed={choice === value}
              className={`rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${choice === value ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}
            >
              {title}
            </button>
          ))}
        </div>
      </section>
      <SettingsSaveBar busy={busy} error={error} saved={saved} />
    </form>
  );
}

type RouteForm = {
  name: string;
  stageAName: string;
  stageALat: string;
  stageALng: string;
  stageBName: string;
  stageBLat: string;
  stageBLng: string;
  parcelFare: string;
  active: boolean;
  dropMode: RelayDropMode;
};

const EMPTY_ROUTE: RouteForm = { name: "", stageAName: "", stageALat: "", stageALng: "", stageBName: "", stageBLat: "", stageBLng: "", parcelFare: "", active: true, dropMode: "stage" };

function toForm(r: RelayRoute): RouteForm {
  return {
    name: r.name,
    stageAName: r.stage_a_name,
    stageALat: String(r.stage_a_lat),
    stageALng: String(r.stage_a_lng),
    stageBName: r.stage_b_name,
    stageBLat: String(r.stage_b_lat),
    stageBLng: String(r.stage_b_lng),
    parcelFare: String(r.parcel_fare),
    active: r.active === 1,
    dropMode: r.drop_mode ?? "stage",
  };
}

function RoutesTab() {
  const [routes, setRoutes] = useState<RelayRoute[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<RouteForm>(EMPTY_ROUTE);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.adminListRelayRoutes();
      setRoutes(res.routes);
      setReady(res.ready);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  function startEdit(r: RelayRoute | null) {
    setEditing(r ? r.id : "new");
    setForm(r ? toForm(r) : EMPTY_ROUTE);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nums = [form.stageALat, form.stageALng, form.stageBLat, form.stageBLng].map(Number);
    if (nums.some((n) => !Number.isFinite(n)) || Math.abs(nums[0]!) > 90 || Math.abs(nums[2]!) > 90 || Math.abs(nums[1]!) > 180 || Math.abs(nums[3]!) > 180) {
      setError("Enter a valid latitude and longitude for both stages.");
      return;
    }
    const input = {
      name: form.name.trim(),
      stageAName: form.stageAName.trim(),
      stageALat: nums[0]!,
      stageALng: nums[1]!,
      stageBName: form.stageBName.trim(),
      stageBLat: nums[2]!,
      stageBLng: nums[3]!,
      parcelFare: Number(form.parcelFare),
      active: form.active,
      dropMode: form.dropMode,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") await api.adminCreateRelayRoute(input);
      else if (editing) await api.adminUpdateRelayRoute(editing, input);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(relayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: RelayRoute) {
    try {
      await api.adminUpdateRelayRoute(r.id, { active: r.active !== 1 });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const set = (key: keyof RouteForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="space-y-4">
      {!ready && <MigrationNotice />}
      {editing === null && <ErrorNote message={error} />}
      {editing === null ? (
        <button type="button" disabled={!ready} onClick={() => startEdit(null)} className="min-h-11 w-full rounded-[20px] bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">
          Add a matatu route
        </button>
      ) : (
        <form onSubmit={onSubmit} className="home-card space-y-3">
          <p className="text-sm font-bold text-ink">{editing === "new" ? "New matatu route" : "Edit route"}</p>
          <Field label="Route name">
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Kampala – Jinja" className={inputCls} />
          </Field>
          {(["A", "B"] as const).map((s) => (
            <div key={s} className="space-y-2 border-t border-[var(--border-faint)] pt-3">
              <Field label={`Stage ${s} name`}>
                <input required value={form[`stage${s}Name`]} onChange={(e) => set(`stage${s}Name`, e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input required inputMode="decimal" value={form[`stage${s}Lat`]} onChange={(e) => set(`stage${s}Lat`, coord(e.target.value))} placeholder="0.3136" className={inputCls} />
                </Field>
                <Field label="Longitude">
                  <input required inputMode="decimal" value={form[`stage${s}Lng`]} onChange={(e) => set(`stage${s}Lng`, coord(e.target.value))} placeholder="32.5811" className={inputCls} />
                </Field>
              </div>
            </div>
          ))}
          <div className="border-t border-[var(--border-faint)] pt-3">
            <Field label="Parcel fare (UGX)" hint="What the matatu operator is paid to carry one parcel between the two stages.">
              <input required inputMode="numeric" value={form.parcelFare} onChange={(e) => set("parcelFare", digits(e.target.value))} className={inputCls} />
            </Field>
          </div>
          <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
            <p className="text-xs font-bold text-ink-500">At the far end</p>
            {([
              ["stage", "Hand to a rider at the stage"],
              ["station", "Drop at the petrol station nearest the customer"],
            ] as [RelayDropMode, string][]).map(([value, title]) => (
              <button
                key={value}
                type="button"
                onClick={() => set("dropMode", value)}
                aria-pressed={form.dropMode === value}
                className={`block w-full rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${form.dropMode === value ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}
              >
                {title}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-gold" />
            Route is active
          </label>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} disabled={busy} className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">
              {busy ? "Saving…" : "Save route"}
            </button>
          </div>
        </form>
      )}

      {routes.length === 0 ? (
        <p className="text-sm text-ink-500">No matatu routes yet.</p>
      ) : (
        <div className="home-card overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="text-xs text-ink-500">
              <tr className="border-b border-[var(--border-faint)]">
                <th className="px-3 py-2 font-semibold">Route</th>
                <th className="px-3 py-2 font-semibold">Stages</th>
                <th className="px-3 py-2 font-semibold">Drop</th>
                <th className="px-3 py-2 font-semibold">Parcel fare</th>
                <th className="px-3 py-2 font-semibold">Operators</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-faint)]">
              {routes.map((r) => (
                <tr key={r.id} className="text-ink">
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-3 py-2 text-xs text-ink-500">{r.stage_a_name} ↔ {r.stage_b_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.drop_mode === "station" ? "Petrol station" : "Stage"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{ugx(r.parcel_fare)}</td>
                  <td className="px-3 py-2">{r.operators ?? 0}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => toggleActive(r)} title={r.active === 1 ? "Turn off" : "Turn on"}>
                      <Badge tone={r.active === 1 ? "good" : "neutral"}>{r.active === 1 ? "active" : "off"}</Badge>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => startEdit(r)} className={`${smallBtn} bg-gold/15 text-ink`}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StationsTab() {
  const [stations, setStations] = useState<RelayStation[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.adminListRelayStations();
      setStations(res.stations);
      setReady(res.ready);
      setError(null);
    } catch (err) {
      setError(relayError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  async function toggle(s: RelayStation) {
    setBusyId(s.id);
    setError(null);
    try {
      await api.adminSetRelayStation(s.id, s.relay_drop !== 1);
      await refresh();
    } catch (err) {
      setError(`${s.name}: ${relayError(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="space-y-2">
      {!ready && <StationsNotice />}
      <p className="text-xs text-ink-500">Stations that accept relay parcels. A station-drop route leaves each parcel at the nearest open one.</p>
      <ErrorNote message={error} />
      {ready && stations.length === 0 && <p className="text-sm text-ink-500">No Peebee Gas stations yet.</p>}
      <ul className="space-y-2">
        {stations.map((s) => {
          const on = s.relay_drop === 1;
          return (
            <li key={s.id} className="home-card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {s.station_name} · {s.name}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {s.address ?? "No address"}
                  {s.lat == null || s.lng == null ? " · no map location" : ""} · holding {s.holding} parcel{s.holding === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => toggle(s)}
                aria-pressed={on}
                className={`${smallBtn} shrink-0 disabled:opacity-50 ${on ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink"}`}
              >
                {on ? "Accepting" : "Off"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OperatorsTab({ canVerify }: { canVerify: boolean }) {
  const [operators, setOperators] = useState<RelayOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.adminListRelayOperators();
      setOperators(res.operators);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  async function setStatus(userId: string, status: "approved" | "suspended") {
    setBusyId(userId);
    try {
      await api.adminSetRelayOperatorStatus(userId, status);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="space-y-2">
      <ErrorNote message={error} />
      {operators.length === 0 && <p className="text-sm text-ink-500">No matatu operators have applied yet.</p>}
      <ul className="space-y-2">
        {operators.map((o) => (
          <li key={o.user_id} className="home-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {o.name ?? "Operator"} <span className="font-normal text-ink-500">· {o.vehicle_plate}</span>
              </p>
              <Badge>{o.status}</Badge>
            </div>
            <p className="text-xs text-ink-500">
              {o.route_name ?? "No route"} · {o.phone ?? o.account_phone ?? "no phone"} · {o.parcels ?? 0} parcels · applied {when(o.created_at)}
            </p>
            {canVerify && (
              <div className="flex gap-2">
                {o.status !== "approved" && (
                  <button type="button" disabled={busyId === o.user_id} className={`${smallBtn} bg-gold text-ink-gold disabled:opacity-50`} onClick={() => setStatus(o.user_id, "approved")}>
                    Approve
                  </button>
                )}
                {o.status !== "suspended" && (
                  <button type="button" disabled={busyId === o.user_id} className={`${smallBtn} bg-gold/15 text-ink disabled:opacity-50`} onClick={() => setStatus(o.user_id, "suspended")}>
                    Suspend
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<RelayAdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminListRelayOrders()
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>;

  return (
    <div className="space-y-2">
      <ErrorNote message={error} />
      {orders.length === 0 && <p className="text-sm text-ink-500">No relayed orders yet.</p>}
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="home-card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/orders/${o.id}`} className="text-sm font-semibold text-ink underline-offset-2 hover:underline">
                Order {o.id.slice(0, 8)}
              </Link>
              <span className="text-xs text-ink-500">
                {label(o.stage)} · {when(o.createdAt)}
                {o.environment !== "live" ? ` · ${o.environment}` : ""}
              </span>
            </div>
            <ol className="space-y-1.5">
              {o.legs.map((l) => (
                <li key={l.leg} className="rounded-xl bg-[rgb(var(--surface-muted))] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">
                      {l.leg}. {l.kind === "matatu" ? "Matatu" : "Boda"} · {l.fromName} → {l.toName}
                    </p>
                    <Badge>{l.status}</Badge>
                  </div>
                  <p className="text-[11px] text-ink-500">
                    {l.providerName ?? "No provider yet"} · fee {ugx(l.fee)} · handed over {when(l.handedOverAt)} · paid {l.paidAmount == null ? "—" : `${ugx(l.paidAmount)}${l.paidAt ? ` on ${when(l.paidAt)}` : ""}`}
                  </p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  );
}
