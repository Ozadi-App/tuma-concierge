"use client";

import { MONEY_MODULES, MONEY_MODULE_LABEL, hasPermission, type MoneyFlowConfig, type MoneyModule, type Waterfall } from "@peebee/shared";
import { useEffect, useMemo, useState } from "react";
import { Card, Field, Grid, NumberField, Notice, Pill, SelectField, TextField, Toggle, ugx } from "../../components/offers/fields";
import { SettingsPageShell, SettingsSaveBar } from "../../components/SettingsPageShell";
import { adminRequest, requestErrorMessage } from "../../lib/admin-request";
import { useAuth } from "../../lib/auth-context";

type Loaded = { config: MoneyFlowConfig; defaults: MoneyFlowConfig; migrationApplied: boolean };
type Report = {
  available: boolean; days: number;
  byModule: { module: MoneyModule; orders: number; gross: number; gateway_fee: number; tax_total: number; commission: number; maintenance: number; provider_share: number; platform_net: number; promo_cost: number }[];
  totals: { orders: number; gross: number; customer_pays: number; gateway_fee: number; tax_total: number; commission: number; maintenance: number; provider_share: number; platform_net: number; promo_cost: number; service_fee: number } | null;
  taxPayable: { id: string; name: string; amount: number }[];
};

/** Modules whose payouts the platform already splits with this mechanism. The others are planned here and shown in the calculator. */
const APPLIED: MoneyModule[] = ["ride_boda", "ride_car", "delivery_parcel", "delivery_shopping"];

const BEARER = [
  { value: "platform", label: "Peebee pays it (the customer pays the exact price)" },
  { value: "customer", label: "The customer pays it on top" },
  { value: "provider", label: "The rider / merchant pays it from their share" },
  { value: "split", label: "Shared" },
] as const;

export default function MoneyFlowPage() {
  const { user } = useAuth();
  const can = hasPermission(user?.adminRole ?? null, "payments.manage");
  const [data, setData] = useState<Loaded | null>(null);
  const [cfg, setCfg] = useState<MoneyFlowConfig | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [module, setModule] = useState<MoneyModule>("ride_car");

  useEffect(() => {
    let alive = true;
    Promise.all([adminRequest<Loaded>("/admin/money-flow"), adminRequest<Report>("/admin/money-flow/report?days=30")])
      .then(([d, r]) => { if (alive) { setData(d); setCfg(d.config); setReport(r); } })
      .catch((err) => { if (alive) setError(requestErrorMessage(err)); });
    return () => { alive = false; };
  }, [saved]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await adminRequest<{ config: MoneyFlowConfig }>("/admin/money-flow", { method: "PUT", body: cfg });
      setCfg(res.config);
      setSaved(true);
    } catch (err) {
      setError(requestErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (data && !can) return <SettingsPageShell title="Money flow" loading={false}><p className="text-sm text-ink-500">You don&apos;t have permission to manage this.</p></SettingsPageShell>;
  if (!cfg) return <SettingsPageShell title="Money flow" loading>{error ? <Notice tone="warn">{error}</Notice> : null}</SettingsPageShell>;

  const mod = cfg.modules[module];
  const setMod = (patch: Partial<MoneyFlowConfig["modules"][MoneyModule]>) => setCfg({ ...cfg, modules: { ...cfg.modules, [module]: { ...mod, ...patch } } });
  const setCommission = (patch: Partial<typeof mod.commission>) => setMod({ commission: { ...mod.commission, ...patch } });
  const anyFeeOn = cfg.providerFees.some((r) => r.enabled);

  return (
    <SettingsPageShell title="Money flow" description="Where every shilling goes: what the customer pays, what the payment gateway takes, tax, Peebee's commission, the maintenance reserve and what the rider or merchant receives." loading={false}>
      {data && !data.migrationApplied && <Notice tone="warn">Recording each payment&apos;s split needs migration 0148 applied to the database. Until then the calculator works but the report stays empty. See MIGRATIONS_TO_APPLY.md.</Notice>}
      {!anyFeeOn && <Notice>No gateway fee is switched on yet, so payments show no transaction cost. Check the rates in your agreements with each provider, enter them below, and switch them on.</Notice>}

      <Report report={report} />

      <form onSubmit={save} className="space-y-4">
        <Card title="Payment gateway fees" hint="What each provider charges Peebee on a payment. The newest rate in force on the day is used, so you can add a new row when a rate changes and keep the old one for the record.">
          <div className="space-y-4">
            {cfg.providerFees.map((r, i) => {
              const set = (patch: Partial<typeof r>) => setCfg({ ...cfg, providerFees: cfg.providerFees.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={r.id + i} className="space-y-3 rounded-xl border border-[var(--border-faint)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink">{r.provider} · {r.direction === "collection" ? "money in" : "money out"}{r.network !== "any" ? ` · ${r.network}` : ""}</p>
                    <Toggle label="On" checked={r.enabled} onChange={(v) => set({ enabled: v })} />
                  </div>
                  <Grid cols={3}>
                    <TextField label="Provider" value={r.provider} onChange={(v) => set({ provider: v.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} hint="yo, flutterwave, mtn, airtel, pesapal…" />
                    <SelectField label="Direction" value={r.direction} onChange={(v) => set({ direction: v })} options={[{ value: "collection", label: "Money in (customer pays)" }, { value: "disbursement", label: "Money out (payouts)" }]} />
                    <SelectField label="Network" value={r.network} onChange={(v) => set({ network: v })} options={[{ value: "any", label: "Any" }, { value: "mtn", label: "MTN" }, { value: "airtel", label: "Airtel" }, { value: "card", label: "Card" }]} />
                  </Grid>
                  <Grid cols={3}>
                    <SelectField label="Charged as" value={r.type} onChange={(v) => set({ type: v })} options={[{ value: "percent", label: "A percent" }, { value: "flat", label: "A fixed amount" }, { value: "percent_plus_flat", label: "A percent plus a fixed amount" }]} />
                    {r.type !== "flat" && <NumberField label="Percent" suffix="%" value={r.percent} onChange={(v) => set({ percent: v })} max={50} step={0.05} />}
                    {r.type !== "percent" && <NumberField label="Fixed amount" suffix="UGX" value={r.flat} onChange={(v) => set({ flat: v })} />}
                    <NumberField label="At least" suffix="UGX" value={r.min} onChange={(v) => set({ min: v })} hint="0 = none" />
                    <NumberField label="At most" suffix="UGX" value={r.max} onChange={(v) => set({ max: v })} hint="0 = none" />
                    <Field label="Rate in force from"><input type="date" value={r.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold" /></Field>
                  </Grid>
                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setCfg({ ...cfg, providerFees: cfg.providerFees.filter((_, j) => j !== i) })}>Remove this rate</button>
                </div>
              );
            })}
            <button type="button" className="text-sm font-semibold text-gold" onClick={() => setCfg({ ...cfg, providerFees: [...cfg.providerFees, { id: `rate-${Date.now()}`, provider: "pesapal", direction: "collection", network: "any", type: "percent", percent: 3, flat: 0, min: 0, max: 0, effectiveFrom: new Date().toISOString().slice(0, 10), enabled: false }] })}>+ Add a provider or a new rate</button>
          </div>
        </Card>

        <Card title="Each service" hint="Pick a service to set its commission and who pays the gateway fee.">
          <div className="flex flex-wrap gap-2">
            {MONEY_MODULES.map((m) => (
              <button key={m} type="button" aria-pressed={module === m} onClick={() => setModule(m)} className={`rounded-full px-3 py-2 text-xs font-bold ${module === m ? "bg-gold text-ink" : "bg-surface-muted text-ink-500"}`}>{MONEY_MODULE_LABEL[m]}</button>
            ))}
          </div>
          {APPLIED.includes(module) ? (
            <Notice>Applied to payouts. Rides and deliveries already have their own commission (the car owner/driver split, delivery commission under Monetization). What you set here is taken <strong>in addition</strong> — leave it at 0 to change nothing.</Notice>
          ) : (
            <Notice tone="warn">This service keeps using the commission in its own settings page for now. What you enter here drives the calculator and the report; it does not yet change what is paid out.</Notice>
          )}
          <SelectField label="Commission is" value={mod.commission.type} onChange={(v) => setCommission({ type: v })} options={[{ value: "percent", label: "A percent of the payment" }, { value: "flat", label: "A fixed amount per payment" }, { value: "percent_min_max", label: "A percent with a lowest and highest amount" }, { value: "tiered", label: "A percent that falls as monthly volume rises" }]} />
          <Grid cols={3}>
            {mod.commission.type !== "flat" && <NumberField label="Percent" suffix="%" value={mod.commission.percent} onChange={(v) => setCommission({ percent: v })} max={100} step={0.1} />}
            {mod.commission.type === "flat" && <NumberField label="Amount" suffix="UGX" value={mod.commission.flat} onChange={(v) => setCommission({ flat: v })} />}
            {mod.commission.type === "percent_min_max" && <><NumberField label="At least" suffix="UGX" value={mod.commission.min} onChange={(v) => setCommission({ min: v })} /><NumberField label="At most" suffix="UGX" value={mod.commission.max} onChange={(v) => setCommission({ max: v })} hint="0 = none" /></>}
          </Grid>
          {mod.commission.type === "tiered" && (
            <div className="space-y-3">
              {mod.commission.tiers.map((t, i) => (
                <Grid key={i}>
                  <NumberField label="From monthly volume" suffix="UGX" value={t.fromAmount} onChange={(v) => setCommission({ tiers: mod.commission.tiers.map((x, j) => (j === i ? { ...x, fromAmount: v } : x)) })} />
                  <NumberField label="Commission" suffix="%" value={t.percent} onChange={(v) => setCommission({ tiers: mod.commission.tiers.map((x, j) => (j === i ? { ...x, percent: v } : x)) })} max={100} step={0.1} />
                </Grid>
              ))}
              <button type="button" className="text-sm font-semibold text-gold" onClick={() => setCommission({ tiers: [...mod.commission.tiers, { fromAmount: (mod.commission.tiers.at(-1)?.fromAmount ?? 0) + 1_000_000, percent: Math.max(0, (mod.commission.tiers.at(-1)?.percent ?? mod.commission.percent) - 1) }] })}>+ Add a tier</button>
            </div>
          )}
          <SelectField label="Commission is worked out on" value={mod.commission.base} onChange={(v) => setCommission({ base: v })} options={[{ value: "gross", label: "The whole payment" }, { value: "fare_only", label: "The fare only (not items or fees)" }]} />
          <SelectField label="Who pays the gateway fee" value={mod.gatewayFeeBearer} onChange={(v) => setMod({ gatewayFeeBearer: v })} options={BEARER.map((b) => ({ value: b.value, label: b.label }))} />
          {mod.gatewayFeeBearer === "split" && <NumberField label="The customer's share of the fee" suffix="%" value={mod.gatewayFeeCustomerPercent} onChange={(v) => setMod({ gatewayFeeCustomerPercent: v })} max={100} hint="The rest is shared equally between Peebee and the rider or merchant." />}
          <Toggle label="Taxes apply to this service" checked={mod.taxed} onChange={(v) => setMod({ taxed: v })} />
        </Card>

        <Card title="Taxes" hint="Taxes Peebee must collect or pay. The rates and what they apply to come from your tax adviser; none are set until you add them.">
          <div className="space-y-4">
            {cfg.taxes.map((t, i) => {
              const set = (patch: Partial<typeof t>) => setCfg({ ...cfg, taxes: cfg.taxes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={t.id} className="space-y-3 rounded-xl border border-[var(--border-faint)] p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-ink">{t.name || "New tax"}</p><Toggle label="On" checked={t.enabled} onChange={(v) => set({ enabled: v })} /></div>
                  <Grid cols={3}>
                    <TextField label="Name" value={t.name} onChange={(v) => set({ name: v })} maxLength={80} />
                    <NumberField label="Rate" suffix="%" value={t.percent} onChange={(v) => set({ percent: v })} max={100} step={0.01} />
                    <Field label="In force from"><input type="date" value={t.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold" /></Field>
                  </Grid>
                  <Grid>
                    <SelectField label="Charged on" value={t.appliesTo} onChange={(v) => set({ appliesTo: v })} options={[{ value: "commission", label: "Peebee's commission" }, { value: "gateway_fee", label: "The gateway's fee" }, { value: "gross", label: "The whole payment" }, { value: "provider_payout", label: "The rider's or merchant's share" }]} />
                    <SelectField label="It is" value={t.mode} onChange={(v) => set({ mode: v })} options={[{ value: "inclusive", label: "Already inside the amount" }, { value: "on_top", label: "Added on top for the customer" }]} />
                  </Grid>
                  {t.mode === "inclusive" && <SelectField label="Who bears it" value={t.bearer} onChange={(v) => set({ bearer: v })} options={[{ value: "platform", label: "Peebee" }, { value: "provider", label: "The rider / merchant" }]} />}
                  <Field label="Only for these services (none selected = all)">
                    <div className="flex flex-wrap gap-1.5">
                      {MONEY_MODULES.map((m) => (
                        <button key={m} type="button" aria-pressed={t.modules.includes(m)} onClick={() => set({ modules: t.modules.includes(m) ? t.modules.filter((x) => x !== m) : [...t.modules, m] })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${t.modules.includes(m) ? "bg-gold text-ink" : "bg-surface-muted text-ink-500"}`}>{MONEY_MODULE_LABEL[m]}</button>
                      ))}
                    </div>
                  </Field>
                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setCfg({ ...cfg, taxes: cfg.taxes.filter((_, j) => j !== i) })}>Remove this tax</button>
                </div>
              );
            })}
            <button type="button" className="text-sm font-semibold text-gold" onClick={() => setCfg({ ...cfg, taxes: [...cfg.taxes, { id: `tax-${Date.now()}`, name: "", enabled: false, percent: 0, appliesTo: "commission", mode: "inclusive", bearer: "platform", modules: [], effectiveFrom: new Date().toISOString().slice(0, 10) }] })}>+ Add a tax</button>
          </div>
        </Card>

        <Card title="Platform maintenance reserve" hint="A share set aside from Peebee's earnings to run the platform (servers, SMS, support). It is shown separately so you see what is really available to spend.">
          <Toggle label="Set a reserve aside" checked={cfg.maintenance.enabled} onChange={(v) => setCfg({ ...cfg, maintenance: { ...cfg.maintenance, enabled: v } })} />
          {cfg.maintenance.enabled && (
            <Grid>
              <NumberField label="Share" suffix="%" value={cfg.maintenance.percent} onChange={(v) => setCfg({ ...cfg, maintenance: { ...cfg.maintenance, percent: v } })} max={100} step={0.5} />
              <SelectField label="Of" value={cfg.maintenance.of} onChange={(v) => setCfg({ ...cfg, maintenance: { ...cfg.maintenance, of: v } })} options={[{ value: "platform_net", label: "What Peebee keeps (after fees and tax)" }, { value: "gross", label: "The whole payment" }]} />
            </Grid>
          )}
        </Card>
        <SettingsSaveBar busy={busy} error={error} saved={saved} />
      </form>

      <Calculator cfg={cfg} initial={module} />
    </SettingsPageShell>
  );
}

function Report({ report }: { report: Report | null }) {
  if (!report?.available || !report.totals) return null;
  const t = report.totals;
  const cell = (n: number) => <span className="text-ink">{ugx(n)}</span>;
  return (
    <Card title={`Last ${report.days} days`} hint={`${t.orders.toLocaleString("en-UG")} settled rides and deliveries. Customers paid ${ugx(t.customer_pays)}.`}>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Rider / driver received", t.provider_share], ["Peebee commission", t.commission], ["Gateway fees", t.gateway_fee], ["Tax", t.tax_total], ["Maintenance reserve", t.maintenance], ["Discounts Peebee funded", t.promo_cost]].map(([label, n]) => (
          <div key={String(label)} className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-0.5 text-[15px] font-bold text-ink">{ugx(Number(n))}</p></div>
        ))}
      </div>
      <p className="text-sm text-ink-500">Peebee kept <strong className="text-ink">{ugx(t.platform_net)}</strong> after fees, tax and discounts{t.service_fee > 0 ? ` (plus ${ugx(t.service_fee)} of service fees)` : ""}.</p>
      {report.taxPayable.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-500">Tax to pay</p>
          <ul className="space-y-1 text-sm">{report.taxPayable.map((x) => <li key={x.id} className="flex justify-between"><span className="text-ink">{x.name}</span><strong className="text-ink">{ugx(x.amount)}</strong></li>)}</ul>
        </div>
      )}
      {report.byModule.length > 0 && (
        <ul className="space-y-1.5 text-xs text-ink-500">
          {report.byModule.map((r) => <li key={r.module}><strong className="text-ink">{MONEY_MODULE_LABEL[r.module]}</strong> · {r.orders} orders · {cell(r.gross)} · commission {cell(r.commission)} · gateway {cell(r.gateway_fee)} · tax {cell(r.tax_total)}</li>)}
        </ul>
      )}
    </Card>
  );
}

function Calculator({ cfg, initial }: { cfg: MoneyFlowConfig; initial: MoneyModule }) {
  const [module, setModule] = useState<MoneyModule>(initial);
  const [gross, setGross] = useState(10000);
  const [rail, setRail] = useState<"wallet" | "cash" | "mobile_money" | "card">("mobile_money");
  const [provider, setProvider] = useState("yo");
  const [discount, setDiscount] = useState(0);
  const [result, setResult] = useState<Waterfall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const body = useMemo(() => ({ config: cfg, module, gross, rail, provider: rail === "mobile_money" || rail === "card" ? provider : null, platformFundedDiscount: discount }), [cfg, module, gross, rail, provider, discount]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      adminRequest<Waterfall>("/admin/money-flow/preview", { method: "POST", body })
        .then((r) => { if (alive) { setResult(r); setError(null); } })
        .catch((err) => { if (alive) setError(requestErrorMessage(err)); });
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [body]);

  return (
    <Card title="Calculator" hint="Pick a service and an amount and see who gets what — using the settings above as you edit them, before you save.">
      <Grid cols={3}>
        <SelectField label="Service" value={module} onChange={setModule} options={MONEY_MODULES.map((m) => ({ value: m, label: MONEY_MODULE_LABEL[m] }))} />
        <NumberField label="Price" suffix="UGX" value={gross} onChange={setGross} />
        <SelectField label="Paid with" value={rail} onChange={setRail} options={[{ value: "mobile_money", label: "Mobile money" }, { value: "card", label: "Card" }, { value: "wallet", label: "Wallet" }, { value: "cash", label: "Cash" }]} />
        {(rail === "mobile_money" || rail === "card") && <TextField label="Provider" value={provider} onChange={setProvider} hint="yo, flutterwave, mtn, airtel…" />}
        <NumberField label="Discount Peebee funds" suffix="UGX" value={discount} onChange={setDiscount} />
      </Grid>
      {error && <Notice tone="warn">{error}</Notice>}
      {result && (
        <div className="space-y-2">
          <ul className="space-y-1.5 text-sm">
            {result.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3"><span className={l.key === "customer" || l.key === "provider" ? "font-bold text-ink" : "text-ink-500"}>{l.label}</span><span className={l.key === "customer" || l.key === "provider" ? "font-bold text-ink" : "text-ink-500"}>{l.amount < 0 ? "−" : ""}{ugx(Math.abs(l.amount))}</span></li>
            ))}
          </ul>
          <p className="text-sm text-ink-500">Peebee keeps <strong className="text-ink">{ugx(result.platformNet)}</strong>{result.maintenance > 0 ? `, of which ${ugx(result.maintenance)} is set aside` : ""}. {result.platformNet < 0 && <Pill>Peebee loses money on this payment</Pill>}</p>
        </div>
      )}
    </Card>
  );
}
