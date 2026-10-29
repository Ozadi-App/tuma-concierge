"use client";

import { hasPermission, OFFER_KINDS, OFFER_KIND_INFO, OFFER_SERVICES, OFFER_SERVICE_LABEL, type Offer, type OfferKind } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Card, Field, Grid, NumberField, Notice, Pill, SelectField, TextField, Toggle, WindowsEditor, ZonesEditor, inputClass, ugx, useOffersConfig } from "../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../components/SettingsPageShell";
import { toast } from "../../components/shell/Toaster";
import { adminRequest, requestErrorMessage } from "../../lib/admin-request";
import { useAuth } from "../../lib/auth-context";

type OfferForm = Omit<Offer, "id" | "budgetSpent" | "redemptions"> & { id?: string; budgetSpent?: number; redemptions?: number };

const BLANK: OfferForm = {
  name: "", description: "", code: null, kind: "promo_code", discountType: "percent", value: 10, maxDiscount: 0, minFare: 0, services: [], funder: "platform",
  autoApply: true, stackable: false, status: "draft", startsAt: null, endsAt: null, usageLimitTotal: 0, usageLimitPerUser: 0, budgetTotal: 0, priority: 0, conditions: {},
};

const KIND_DEFAULTS: Partial<Record<OfferKind, Partial<OfferForm>>> = {
  promo_code: { autoApply: false },
  first_ride: { discountType: "percent", value: 30, maxDiscount: 5000, usageLimitPerUser: 1 },
  nth_ride: { discountType: "percent", value: 50, maxDiscount: 5000, conditions: { nth: 5 } },
  referral: { discountType: "flat", value: 3000, usageLimitPerUser: 1 },
  time_window: { discountType: "percent", value: 15, conditions: { windows: [{ days: [1, 2, 3, 4, 5], from: "10:00", to: "15:00" }] } },
  route_zone: { discountType: "percent", value: 10, conditions: { zones: [{ lat: 0.0446, lng: 32.4435, radiusKm: 3, label: "Entebbe airport" }], zoneMatch: "either" } },
  vehicle_type: { discountType: "percent", value: 10, services: ["ride.car"], conditions: { carTiers: ["comfort"] } },
  loyalty_tier: { discountType: "percent", value: 10, conditions: { loyaltyTiers: ["gold"] } },
  bundle: { discountType: "percent", value: 20, autoApply: false, conditions: { packRides: 10, packPrice: 40000 } },
  flash: { discountType: "percent", value: 25, usageLimitTotal: 200, conditions: { windows: [{ days: [], from: "17:00", to: "19:00" }] } },
  cashback: { discountType: "percent", value: 10, maxDiscount: 3000 },
  free_ride: { discountType: "percent", value: 100, maxDiscount: 8000, usageLimitPerUser: 1 },
  birthday_event: { discountType: "percent", value: 30, maxDiscount: 8000, conditions: { birthday: true } },
  winback: { discountType: "percent", value: 25, usageLimitPerUser: 1, conditions: { inactiveDays: 30 } },
  group: { discountType: "percent", value: 15, conditions: { groups: ["student"] } },
};

function summary(o: Offer): string {
  if (o.kind === "free_ride") return o.maxDiscount > 0 ? `Free, up to ${ugx(o.maxDiscount)}` : "Free ride";
  const v = o.discountType === "percent" ? `${o.value}%` : ugx(o.value);
  return `${v} ${o.kind === "cashback" ? "cashback" : "off"}${o.maxDiscount > 0 && o.discountType === "percent" ? ` (max ${ugx(o.maxDiscount)})` : ""}`;
}

export default function OffersPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfferForm | null>(null);

  const [version, setVersion] = useState(0);
  const load = useCallback(async () => { setVersion((v) => v + 1); }, []);
  useEffect(() => {
    let alive = true;
    adminRequest<{ offers: Offer[]; available: boolean }>("/admin/offers")
      .then((res) => { if (alive) { setOffers(res.offers); setAvailable(res.available); } })
      .catch((err) => { if (alive) setError(requestErrorMessage(err)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [version]);

  async function setStatus(o: Offer, status: Offer["status"]) {
    try {
      await adminRequest(`/admin/offers/${o.id}/status`, { method: "POST", body: { status } });
      toast(status === "active" ? "Offer is live" : status === "paused" ? "Offer paused" : "Offer saved as draft");
      await load();
    } catch (err) {
      toast(requestErrorMessage(err), "error");
    }
  }

  if (!loading && !can) {
    return <SettingsPageShell title="Customer offers" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  }

  return (
    <SettingsPageShell title="Customer offers" description="Promo codes, automatic discounts, ride packs and cashback for rides and deliveries. Riders are looked after through the discount wallet." loading={loading}>
      {!available && <Notice tone="warn">Offers need migration 0147 applied to the database. Until then nothing here takes effect. See MIGRATIONS_TO_APPLY.md.</Notice>}
      {error && <Notice tone="warn">{error}</Notice>}

      {editing ? (
        <OfferEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-500">{offers.length} offer{offers.length === 1 ? "" : "s"} · {offers.filter((o) => o.status === "active").length} live</p>
            <button type="button" className="admin-btn-gold min-h-11 px-5 text-sm font-bold" onClick={() => setEditing({ ...BLANK })}>New offer</button>
          </div>

          {offers.length === 0 && (
            <Card title="No offers yet" hint="Start from a ready-made one — every offer type below can be switched on, edited or paused at any time.">
              <div className="flex flex-wrap gap-2">
                {OFFER_KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => setEditing({ ...BLANK, ...KIND_DEFAULTS[k], kind: k, name: OFFER_KIND_INFO[k].label })} className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-ink">
                    {OFFER_KIND_INFO[k].label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {offers.map((o) => (
              <section key={o.id} className="home-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold text-ink">{o.name}</h3>
                    <p className="text-xs text-ink-500">{OFFER_KIND_INFO[o.kind].label} · {summary(o)}{o.code ? ` · code ${o.code}` : ""}</p>
                  </div>
                  <Pill>{o.status}</Pill>
                </div>
                <p className="text-xs text-ink-500">
                  Used {o.redemptions}{o.usageLimitTotal > 0 ? ` of ${o.usageLimitTotal}` : ""} times · {ugx(o.budgetSpent)}{o.budgetTotal > 0 ? ` of ${ugx(o.budgetTotal)}` : ""} spent
                  {o.services.length > 0 ? ` · ${o.services.map((s) => OFFER_SERVICE_LABEL[s]).join(", ")}` : " · all services"}
                  {o.funder === "rider" ? " · rider-funded" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-ink" onClick={() => setEditing({ ...o })}>Edit</button>
                  {o.status !== "active" && <button type="button" className="rounded-full bg-gold px-3 py-2 text-xs font-bold text-ink" onClick={() => setStatus(o, "active")}>Make live</button>}
                  {o.status === "active" && <button type="button" className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-ink" onClick={() => setStatus(o, "paused")}>Pause</button>}
                  <button type="button" className="rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-ink" onClick={() => setEditing({ ...o, id: undefined, name: `${o.name} (copy)`, code: null, status: "draft" })}>Duplicate</button>
                </div>
              </section>
            ))}
          </div>

          <Calculator />
          <GeneralSettings />
        </>
      )}
    </SettingsPageShell>
  );
}

function OfferEditor({ initial, onCancel, onSaved }: { initial: OfferForm; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [o, setO] = useState<OfferForm>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grantTo, setGrantTo] = useState("");
  const [grantUses, setGrantUses] = useState(1);
  const set = (patch: Partial<OfferForm>) => setO((cur) => ({ ...cur, ...patch }));
  const setCond = (patch: Partial<Offer["conditions"]>) => setO((cur) => ({ ...cur, conditions: { ...cur.conditions, ...patch } }));
  const c = o.conditions;

  function changeKind(kind: OfferKind) {
    set({ ...KIND_DEFAULTS[kind], kind, conditions: { ...(KIND_DEFAULTS[kind]?.conditions ?? {}) }, code: kind === "promo_code" ? o.code : o.code });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { ...o, code: o.code?.trim() ? o.code.trim() : null };
      delete (body as Partial<OfferForm>).id;
      delete (body as Partial<OfferForm>).budgetSpent;
      delete (body as Partial<OfferForm>).redemptions;
      if (o.id) await adminRequest(`/admin/offers/${o.id}`, { method: "PATCH", body });
      else await adminRequest("/admin/offers", { method: "POST", body });
      toast("Offer saved");
      await onSaved();
    } catch (err) {
      setError(requestErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!o.id || !window.confirm("Delete this offer? It can only be deleted if nobody has used it.")) return;
    try {
      await adminRequest(`/admin/offers/${o.id}`, { method: "DELETE" });
      toast("Offer deleted");
      await onSaved();
    } catch (err) {
      setError(requestErrorMessage(err));
    }
  }

  async function grant() {
    if (!o.id) return;
    try {
      const res = await adminRequest<{ customer: { name: string } }>(`/admin/offers/${o.id}/grants`, { method: "POST", body: { customer: grantTo, uses: grantUses } });
      toast(`Gave ${res.customer.name} ${grantUses} use${grantUses === 1 ? "" : "s"}`);
      setGrantTo("");
    } catch (err) {
      setError(requestErrorMessage(err));
    }
  }

  const kindInfo = OFFER_KIND_INFO[o.kind];
  const toggleIn = <T extends string>(list: T[] | undefined, item: T) => ((list ?? []).includes(item) ? (list ?? []).filter((x) => x !== item) : [...(list ?? []), item]);

  return (
    <div className="space-y-4">
      <Card title={o.id ? "Edit offer" : "New offer"} hint={kindInfo.description}>
        <Grid>
          <TextField label="Name" value={o.name} onChange={(v) => set({ name: v })} maxLength={80} placeholder="Weekend 20% off" />
          <SelectField label="Type" value={o.kind} onChange={changeKind} options={OFFER_KINDS.map((k) => ({ value: k, label: OFFER_KIND_INFO[k].label }))} />
        </Grid>
        <TextField label="Short description (shown to customers)" value={o.description} onChange={(v) => set({ description: v })} maxLength={300} />
        {(o.kind === "promo_code" || !o.autoApply) && (
          <TextField label={o.kind === "promo_code" ? "Code" : "Code (optional)"} hint="Letters, numbers, dashes. Customers type it on the pay screen." value={o.code ?? ""} onChange={(v) => set({ code: v.toUpperCase().replace(/[^A-Z0-9_-]/g, "") || null })} maxLength={30} />
        )}
      </Card>

      <Card title="The saving">
        {o.kind === "free_ride" ? (
          <NumberField label="Free up to" suffix="UGX" value={o.maxDiscount} onChange={(v) => set({ maxDiscount: v })} hint="The ride is free up to this fare. 0 means any fare." />
        ) : (
          <Grid cols={3}>
            <SelectField label="Type" value={o.discountType} onChange={(v) => set({ discountType: v })} options={[{ value: "percent", label: "Percent of the fare" }, { value: "flat", label: "Fixed amount" }]} />
            <NumberField label="Value" suffix={o.discountType === "percent" ? "%" : "UGX"} value={o.value} onChange={(v) => set({ value: v })} max={o.discountType === "percent" ? 100 : undefined} />
            <NumberField label="At most" suffix="UGX" value={o.maxDiscount} onChange={(v) => set({ maxDiscount: v })} hint="0 = no cap" />
          </Grid>
        )}
        {o.kind === "cashback" && <Notice>Cashback is not taken off the fare. It is added to the customer&apos;s wallet credit after the ride is completed.</Notice>}
        <NumberField label="Fare must be at least" suffix="UGX" value={o.minFare} onChange={(v) => set({ minFare: v })} />
      </Card>

      {(o.kind === "time_window" || o.kind === "flash") && <Card title="When it applies"><WindowsEditor value={c.windows ?? []} onChange={(w) => setCond({ windows: w })} /></Card>}
      {o.kind === "route_zone" && (
        <Card title="Where it applies">
          <SelectField label="Which end of the trip" value={c.zoneMatch ?? "either"} onChange={(v) => setCond({ zoneMatch: v })} options={[{ value: "either", label: "Pickup or drop-off" }, { value: "pickup", label: "Pickup only" }, { value: "dropoff", label: "Drop-off only" }]} />
          <ZonesEditor value={c.zones ?? []} onChange={(z) => setCond({ zones: z })} />
        </Card>
      )}
      {o.kind === "nth_ride" && <Card title="Which ride"><NumberField label="Every Nth ride" value={c.nth ?? 5} onChange={(v) => setCond({ nth: v })} min={2} max={1000} /></Card>}
      {o.kind === "vehicle_type" && (
        <Card title="Car types">
          <div className="flex flex-wrap gap-2">
            {(["convenient", "comfort", "xl"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={(c.carTiers ?? []).includes(t)} onClick={() => setCond({ carTiers: toggleIn(c.carTiers, t) })} className={`rounded-full px-4 py-2 text-sm font-bold ${(c.carTiers ?? []).includes(t) ? "bg-gold text-ink" : "bg-surface-muted text-ink-500"}`}>{t}</button>
            ))}
          </div>
        </Card>
      )}
      {o.kind === "loyalty_tier" && <Card title="Tiers"><TextField label="Tier ids, comma separated" hint="The tiers are named under General settings below (bronze, silver, gold, platinum by default)." value={(c.loyaltyTiers ?? []).join(", ")} onChange={(v) => setCond({ loyaltyTiers: v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) })} /></Card>}
      {o.kind === "group" && <Card title="Groups"><TextField label="Group names, comma separated" hint="Assign customers to a group when you verify them (for example student, corporate)." value={(c.groups ?? []).join(", ")} onChange={(v) => setCond({ groups: v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) })} /></Card>}
      {o.kind === "winback" && <Card title="Inactive for"><NumberField label="Days since the last ride" value={c.inactiveDays ?? 30} onChange={(v) => setCond({ inactiveDays: v })} min={1} max={730} /></Card>}
      {o.kind === "birthday_event" && (
        <Card title="Which days">
          <Toggle label="Customer's birthday" hint="Uses the birthday on their offer profile." checked={!!c.birthday} onChange={(v) => setCond({ birthday: v })} />
          <TextField label="Event dates (MM-DD, comma separated)" hint="For example 12-25, 01-01" value={(c.dates ?? []).join(", ")} onChange={(v) => setCond({ dates: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </Card>
      )}
      {o.kind === "bundle" && (
        <Card title="The pack" hint="A pack gives a customer a number of discounted rides. Customers buy it from their wallet, or you can give it to them.">
          <Grid>
            <NumberField label="Rides in the pack" value={c.packRides ?? 10} onChange={(v) => setCond({ packRides: v })} min={1} max={1000} />
            <NumberField label="Price" suffix="UGX" value={c.packPrice ?? 0} onChange={(v) => setCond({ packPrice: v })} hint="0 = not for sale, only given by you" />
          </Grid>
          {o.id && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-500">Give this pack to a customer</p>
              <Grid>
                <TextField label="Phone or email" value={grantTo} onChange={setGrantTo} />
                <NumberField label="Rides" value={grantUses} onChange={setGrantUses} min={1} max={1000} />
              </Grid>
              <button type="button" onClick={grant} className="rounded-full bg-surface-muted px-4 py-2 text-xs font-bold text-ink">Give</button>
            </div>
          )}
        </Card>
      )}

      <Card title="Where it applies">
        <div className="flex flex-wrap gap-2">
          {OFFER_SERVICES.map((s) => (
            <button key={s} type="button" aria-pressed={o.services.includes(s)} onClick={() => set({ services: toggleIn(o.services, s) })} className={`rounded-full px-3 py-2 text-xs font-bold ${o.services.includes(s) ? "bg-gold text-ink" : "bg-surface-muted text-ink-500"}`}>{OFFER_SERVICE_LABEL[s]}</button>
          ))}
        </div>
        <p className="text-xs text-ink-500">{o.services.length === 0 ? "No service picked: this offer applies to every service that accepts offers." : "Only the services picked."}</p>
      </Card>

      <Card title="Limits and money">
        <Grid cols={3}>
          <NumberField label="Total uses" value={o.usageLimitTotal} onChange={(v) => set({ usageLimitTotal: v })} hint="0 = unlimited" />
          <NumberField label="Uses per customer" value={o.usageLimitPerUser} onChange={(v) => set({ usageLimitPerUser: v })} hint="0 = unlimited" />
          <NumberField label="Budget" suffix="UGX" value={o.budgetTotal} onChange={(v) => set({ budgetTotal: v })} hint="Most Peebee will spend on this offer. 0 = no cap" />
        </Grid>
        <Grid>
          <Field label="Starts"><input type="datetime-local" value={o.startsAt ? o.startsAt.slice(0, 16) : ""} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputClass} /></Field>
          <Field label="Ends"><input type="datetime-local" value={o.endsAt ? o.endsAt.slice(0, 16) : ""} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inputClass} /></Field>
        </Grid>
        <SelectField label="Who pays for the discount" value={o.funder} onChange={(v) => set({ funder: v })} options={[{ value: "platform", label: "Peebee — the rider is compensated through the discount wallet" }, { value: "rider", label: "The rider — no compensation" }]} />
        <Toggle label="Applies by itself when the customer qualifies" hint="Off means the customer must type the code (or hold a pack)." checked={o.autoApply} onChange={(v) => set({ autoApply: v })} disabled={o.kind === "promo_code"} />
        <Toggle label="Can be combined with other offers" hint="Only matters when stacking is allowed in General settings." checked={o.stackable} onChange={(v) => set({ stackable: v })} />
        <NumberField label="Priority" value={o.priority} onChange={(v) => set({ priority: v })} min={-1000} max={1000} hint="Breaks ties between offers worth the same." />
        <SelectField label="Status" value={o.status} onChange={(v) => set({ status: v })} options={[{ value: "draft", label: "Draft — not live" }, { value: "active", label: "Live" }, { value: "paused", label: "Paused" }]} />
      </Card>

      {error && <Notice tone="warn">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="admin-btn-gold min-h-11 px-6 text-sm font-bold">{busy ? "Saving…" : "Save offer"}</button>
        <button type="button" onClick={onCancel} className="min-h-11 px-4 text-sm font-semibold text-ink-500">Cancel</button>
        {o.id && <button type="button" onClick={remove} className="ml-auto min-h-11 px-4 text-sm font-semibold text-red-600">Delete</button>}
      </div>
    </div>
  );
}

type Preview = { applied: { name: string; discount: number; cashback: number }[]; considered: { name: string; eligible: boolean; reason?: string; discount: number }[]; discount: number; cashback: number; fare: number; payable: number };

function Calculator() {
  const [service, setService] = useState<(typeof OFFER_SERVICES)[number]>("ride.car");
  const [fare, setFare] = useState(15000);
  const [code, setCode] = useState("");
  const [rides, setRides] = useState(0);
  const [away, setAway] = useState(0);
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setResult(await adminRequest<Preview>("/admin/offers/preview", { method: "POST", body: { service, fare, code: code || null, rideCount: rides, daysSinceLastRide: rides > 0 ? away : null } }));
    } catch (err) {
      setError(requestErrorMessage(err));
    }
  }

  return (
    <Card title="Try it" hint="See what a customer would pay today with the offers that are live.">
      <Grid cols={3}>
        <SelectField label="Service" value={service} onChange={setService} options={OFFER_SERVICES.map((s) => ({ value: s, label: OFFER_SERVICE_LABEL[s] }))} />
        <NumberField label="Fare" suffix="UGX" value={fare} onChange={setFare} />
        <TextField label="Promo code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
        <NumberField label="Rides taken so far" value={rides} onChange={setRides} hint="0 = a new customer" />
        <NumberField label="Days since last ride" value={away} onChange={setAway} />
      </Grid>
      <button type="button" onClick={run} className="admin-btn-gold min-h-11 px-6 text-sm font-bold">Calculate</button>
      {error && <Notice tone="warn">{error}</Notice>}
      {result && (
        <div className="space-y-2 text-sm">
          <p className="font-bold text-ink">Customer pays {ugx(result.payable)} <span className="font-normal text-ink-500">(fare {ugx(result.fare)}, saving {ugx(result.discount)}{result.cashback > 0 ? `, plus ${ugx(result.cashback)} cashback` : ""})</span></p>
          {result.applied.length > 0 && <p className="text-ink-500">Applied: {result.applied.map((a) => a.name).join(", ")}</p>}
          <ul className="space-y-1 text-xs text-ink-500">
            {result.considered.map((r, i) => <li key={i}>{r.eligible ? "✓" : "✗"} {r.name}{r.reason ? ` — ${r.reason}` : ""}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function GeneralSettings() {
  const { draft, setDraft, error, busy, saved, save, loading } = useOffersConfig("offers");
  if (loading || !draft) return null;
  return (
    <form onSubmit={save} className="space-y-4">
      <Card title="General settings" hint="How offers behave across the whole platform.">
        <Toggle label="Offers are on" hint="Turn off to stop every offer from applying. Nothing is deleted." checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
        <Toggle label="Customers can type a promo code" checked={draft.allowCodeEntry} onChange={(v) => setDraft({ ...draft, allowCodeEntry: v })} />
        <Toggle label="Show the saving before the customer pays" checked={draft.showSavings} onChange={(v) => setDraft({ ...draft, showSavings: v })} />
        <Grid>
          <SelectField label="When several offers qualify" value={draft.stacking.mode} onChange={(v) => setDraft({ ...draft, stacking: { ...draft.stacking, mode: v } })} options={[{ value: "best_one", label: "Only the best one applies (recommended)" }, { value: "stack", label: "Offers marked “can be combined” add up" }]} />
          <NumberField label="Savings can never exceed" suffix="% of the fare" value={draft.stacking.maxDiscountPercent} onChange={(v) => setDraft({ ...draft, stacking: { ...draft.stacking, maxDiscountPercent: v } })} min={1} max={100} />
        </Grid>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-500">Services that accept offers</p>
          {OFFER_SERVICES.map((s) => (
            <Toggle key={s} label={OFFER_SERVICE_LABEL[s]} checked={draft.services[s]} onChange={(v) => setDraft({ ...draft, services: { ...draft.services, [s]: v } })} />
          ))}
        </div>
        <Toggle label="Ride packs can be bought from the wallet" checked={draft.packsPurchasable} onChange={(v) => setDraft({ ...draft, packsPurchasable: v })} />
      </Card>
      <Card title="Invitations" hint="Customers and riders get a code to invite friends. The invited customer gets your “Referral” offer on their first ride.">
        <Toggle label="Invitations are on" checked={draft.referral.enabled} onChange={(v) => setDraft({ ...draft, referral: { ...draft.referral, enabled: v } })} />
        <NumberField label="Credit for the friend who invited" suffix="UGX" value={draft.referral.referrerCreditUgx} onChange={(v) => setDraft({ ...draft, referral: { ...draft.referral, referrerCreditUgx: v } })} hint="Added as wallet credit when the invited customer completes their first ride. 0 = none." />
      </Card>
      <Card title="Loyalty tiers" hint="Customers move up by the number of rides they have taken. Loyalty offers can target a tier.">
        {draft.loyaltyTiers.map((t: { id: string; label: string; minRides: number }, i: number) => (
          <Grid key={t.id} cols={3}>
            <TextField label="Id" value={t.id} onChange={(v) => setDraft({ ...draft, loyaltyTiers: draft.loyaltyTiers.map((x: typeof t, j: number) => (j === i ? { ...x, id: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") } : x)) })} />
            <TextField label="Name" value={t.label} onChange={(v) => setDraft({ ...draft, loyaltyTiers: draft.loyaltyTiers.map((x: typeof t, j: number) => (j === i ? { ...x, label: v } : x)) })} />
            <NumberField label="From ride" value={t.minRides} onChange={(v) => setDraft({ ...draft, loyaltyTiers: draft.loyaltyTiers.map((x: typeof t, j: number) => (j === i ? { ...x, minRides: v } : x)) })} />
          </Grid>
        ))}
      </Card>
      <SettingsSaveBar busy={busy} error={error} saved={saved} />
    </form>
  );
}
