import { computeFare, computeWaterfall, FARE_SERVICES, MONEY_MODULES, DEFAULT_MONEY_FLOW_CONFIG, DEFAULT_PRICING_CONFIG, type FareService, type MoneyFlowConfig, type PricingConfig } from "@peebee/shared";
import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { clientIp } from "../lib/ratelimit.js";
import { hasTable } from "../lib/schema.js";
import { getPlatformEnvironment, getSetting, setSetting } from "../lib/settings.js";
import { costingKinds, getMoneyFlowConfig, getPricingConfig, moneyFlowConfigSchema, pricingConfigSchema, saveCostingConfig, type CostingKind } from "./config.js";

type Row = Record<string, unknown>;

/** Admin → Pricing and Admin → Money flow. */
export const costingAdminRoutes = new Hono();
costingAdminRoutes.use("/admin/pricing", requireAuth, requireRole("admin"), requirePermission("payments.manage"));
costingAdminRoutes.use("/admin/pricing/*", requireAuth, requireRole("admin"), requirePermission("payments.manage"));
costingAdminRoutes.use("/admin/money-flow", requireAuth, requireRole("admin"), requirePermission("payments.manage"));
costingAdminRoutes.use("/admin/money-flow/*", requireAuth, requireRole("admin"), requirePermission("payments.manage"));

const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

/** The base rates still live in their original settings so every older page and report keeps working. */
async function readRates() {
  const [rideRate, rideMin, parcelRate, parcelMin, shopping, carRate, carMin, comfort, xl, stop] = await Promise.all([
    getSetting("ride_rate_per_km"), getSetting("ride_minimum_fare"), getSetting("delivery_rate_per_km"), getSetting("minimum_delivery_fee"),
    getSetting("shopping_delivery_fee"), getSetting("car_convenient_rate_per_km"), getSetting("car_convenient_minimum_fare"),
    getSetting("car_comfort_premium_percent"), getSetting("car_xl_premium_percent"), getSetting("ride_stop_fee"),
  ]);
  return {
    boda: { ratePerKm: num(rideRate, 1500), minimumFare: num(rideMin, 2500) },
    parcel: { ratePerKm: num(parcelRate, 1000), minimumFare: num(parcelMin, 2000) },
    shopping: { deliveryFee: num(shopping, 3000) },
    car: { ratePerKm: num(carRate, 5000), minimumFare: num(carMin, 10000), comfortPremiumPercent: num(comfort, 30), xlPremiumPercent: num(xl, 50) },
    stopFee: num(stop, 1000),
  };
}

const ratesSchema = z.object({
  boda: z.object({ ratePerKm: z.number().int().min(1).max(1_000_000), minimumFare: z.number().int().min(0).max(10_000_000) }),
  parcel: z.object({ ratePerKm: z.number().int().min(1).max(1_000_000), minimumFare: z.number().int().min(0).max(10_000_000) }),
  shopping: z.object({ deliveryFee: z.number().int().min(0).max(10_000_000) }),
  car: z.object({ ratePerKm: z.number().int().min(1).max(1_000_000), minimumFare: z.number().int().min(0).max(10_000_000), comfortPremiumPercent: z.number().min(0).max(300), xlPremiumPercent: z.number().min(0).max(300) }),
  stopFee: z.number().int().min(0).max(100_000),
});

costingAdminRoutes.get("/admin/pricing", async (c) =>
  c.json({ pricing: await getPricingConfig(), rates: await readRates(), defaults: DEFAULT_PRICING_CONFIG, migrationApplied: await hasTable("payment_splits") }));

costingAdminRoutes.put("/admin/pricing", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { pricing?: unknown; rates?: unknown } | null;
  const pricing = pricingConfigSchema.safeParse(body?.pricing);
  const rates = ratesSchema.safeParse(body?.rates);
  if (!pricing.success || !rates.success) return c.json({ error: "invalid_body", issues: [...(pricing.success ? [] : pricing.error.issues), ...(rates.success ? [] : rates.error.issues)] }, 400);
  const before = { pricing: await getPricingConfig(), rates: await readRates() };
  const saved = await saveCostingConfig("pricing", pricing.data);
  if (!saved.ok) return c.json({ error: "invalid_body", issues: saved.issues }, 400);
  const r = rates.data;
  await Promise.all([
    setSetting("ride_rate_per_km", String(r.boda.ratePerKm)), setSetting("ride_minimum_fare", String(r.boda.minimumFare)),
    setSetting("delivery_rate_per_km", String(r.parcel.ratePerKm)), setSetting("minimum_delivery_fee", String(r.parcel.minimumFare)),
    setSetting("shopping_delivery_fee", String(r.shopping.deliveryFee)),
    setSetting("car_convenient_rate_per_km", String(r.car.ratePerKm)), setSetting("car_convenient_minimum_fare", String(r.car.minimumFare)),
    setSetting("car_comfort_premium_percent", String(r.car.comfortPremiumPercent)), setSetting("car_xl_premium_percent", String(r.car.xlPremiumPercent)),
    setSetting("ride_stop_fee", String(r.stopFee)),
  ]);
  await logActivity({ actor: c.get("user"), action: "pricing.update", summary: "Changed ride and delivery pricing", entityType: "pricing", entityId: "pricing", before, after: { pricing: pricing.data, rates: r }, ip: clientIp(c) });
  return c.json({ pricing: await getPricingConfig(), rates: await readRates() });
});

/** The admin's fare calculator. Takes the settings being edited (unsaved is fine), so changes can be tried before they are saved. */
costingAdminRoutes.post("/admin/pricing/preview", async (c) => {
  const parsed = z.object({
    service: z.enum(FARE_SERVICES),
    distanceKm: z.number().min(0).max(5000),
    at: z.string().datetime({ offset: true }).optional(),
    pricing: pricingConfigSchema.optional(),
    rates: ratesSchema.optional(),
    stops: z.number().int().min(0).max(5).default(0),
    scheduled: z.boolean().default(false),
    returnTrip: z.boolean().default(false),
    demandRatio: z.number().min(0).max(100).nullable().optional(),
    pickup: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
    dropoff: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const cfg = (d.pricing ?? (await getPricingConfig())) as PricingConfig;
  const rates = d.rates ?? (await readRates());
  const service: FareService = d.service;
  const base = service === "boda" ? rates.boda : service === "parcel" ? rates.parcel : service === "shopping" ? { ratePerKm: 0, minimumFare: rates.shopping.deliveryFee } : { ratePerKm: rates.car.ratePerKm, minimumFare: rates.car.minimumFare };
  const fare = computeFare(cfg, { service, rates: base, distanceKm: d.distanceKm, now: d.at ? new Date(d.at) : new Date(), stops: d.stops, scheduled: d.scheduled, returnTrip: d.returnTrip, demandRatio: d.demandRatio, pickup: d.pickup, dropoff: d.dropoff });
  // Comfort and large cars add their premium on top of the engine's price, exactly as customers are charged.
  let total = fare.total;
  const premiums: { label: string; percent: number }[] = [];
  if (service === "car_comfort") premiums.push({ label: "Comfort premium", percent: rates.car.comfortPremiumPercent });
  if (service === "car_xl") premiums.push({ label: "Large car premium", percent: rates.car.xlPremiumPercent });
  for (const p of premiums) total = Math.round(total * (1 + p.percent / 100));
  return c.json({ ...fare, premiums, total });
});

// --- money flow -------------------------------------------------------------------------

costingAdminRoutes.get("/admin/money-flow", async (c) =>
  c.json({ config: await getMoneyFlowConfig(), defaults: DEFAULT_MONEY_FLOW_CONFIG, migrationApplied: await hasTable("payment_splits") }));

costingAdminRoutes.put("/admin/money-flow", async (c) => {
  const before = await getMoneyFlowConfig();
  const saved = await saveCostingConfig("moneyFlow", await c.req.json().catch(() => null));
  if (!saved.ok) return c.json({ error: "invalid_body", issues: saved.issues }, 400);
  await logActivity({ actor: c.get("user"), action: "money_flow.update", summary: "Changed commissions, gateway fees, taxes or the maintenance reserve", entityType: "money_flow", entityId: "money_flow", before, after: saved.value, ip: clientIp(c) });
  return c.json({ config: saved.value });
});

costingAdminRoutes.post("/admin/money-flow/preview", async (c) => {
  const parsed = z.object({
    config: moneyFlowConfigSchema.optional(),
    module: z.enum(MONEY_MODULES),
    gross: z.number().int().min(0).max(1_000_000_000),
    rail: z.enum(["wallet", "cash", "mobile_money", "card"]),
    provider: z.string().max(30).nullable().optional(),
    network: z.string().max(20).nullable().optional(),
    commissionRelief: z.number().int().min(0).default(0),
    platformFundedDiscount: z.number().int().min(0).default(0),
    monthlyVolume: z.number().min(0).optional(),
  }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { config, ...input } = parsed.data;
  return c.json(computeWaterfall((config ?? (await getMoneyFlowConfig())) as MoneyFlowConfig, input));
});

/** What happened to the money over the last N days: by module, and the tax Peebee owes. */
costingAdminRoutes.get("/admin/money-flow/report", async (c) => {
  if (!(await hasTable("payment_splits"))) return c.json({ available: false, days: 30, byModule: [], totals: null, recent: [] });
  const days = Math.min(365, Math.max(1, Number(c.req.query("days")) || 30));
  const env = await getPlatformEnvironment();
  const since = `-${days} days`;
  const [byModule, recent, taxes] = await Promise.all([
    db.execute({
      sql: `SELECT module, COUNT(*) AS orders, SUM(gross) AS gross, SUM(customer_pays) AS customer_pays, SUM(gateway_fee) AS gateway_fee, SUM(tax_total) AS tax_total,
                   SUM(commission) AS commission, SUM(maintenance) AS maintenance, SUM(provider_share) AS provider_share, SUM(platform_net) AS platform_net,
                   SUM(promo_cost) AS promo_cost, SUM(service_fee) AS service_fee
            FROM payment_splits WHERE environment = ? AND created_at >= datetime('now', ?) GROUP BY module ORDER BY gross DESC`,
      args: [env, since],
    }),
    db.execute({ sql: "SELECT * FROM payment_splits WHERE environment = ? ORDER BY created_at DESC LIMIT 30", args: [env] }),
    db.execute({ sql: "SELECT taxes FROM payment_splits WHERE environment = ? AND tax_total > 0 AND created_at >= datetime('now', ?)", args: [env, since] }),
  ]);
  const byTax = new Map<string, { name: string; amount: number }>();
  for (const r of taxes.rows as Row[]) {
    for (const t of JSON.parse(String(r.taxes)) as { id: string; name: string; amount: number }[]) {
      const cur = byTax.get(t.id) ?? { name: t.name, amount: 0 };
      cur.amount += t.amount;
      byTax.set(t.id, cur);
    }
  }
  const sum = (key: string) => (byModule.rows as Row[]).reduce((s, r) => s + Number(r[key] ?? 0), 0);
  return c.json({
    available: true, days, byModule: byModule.rows, recent: recent.rows, taxPayable: [...byTax.entries()].map(([id, v]) => ({ id, ...v })),
    totals: { orders: sum("orders"), gross: sum("gross"), customer_pays: sum("customer_pays"), gateway_fee: sum("gateway_fee"), tax_total: sum("tax_total"), commission: sum("commission"), maintenance: sum("maintenance"), provider_share: sum("provider_share"), platform_net: sum("platform_net"), promo_cost: sum("promo_cost"), service_fee: sum("service_fee") },
  });
});

export { costingKinds, type CostingKind };
