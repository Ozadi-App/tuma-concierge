import { patchSchema } from "../lib/patch-schema.js";
import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { tablesExist } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { checkoutTotal, commissionPlan, customerFee, goodsPrice, LAUNDRY_TREATMENTS, normaliseTip, offerBand, priceLines, RIDE_PAYERS, splitRides, type ItemPrices } from "./laundry-pricing.js";
import { getLaundrySettings, LAUNDRY_SERVICES, setLaundrySettings, type LaundrySettings } from "./laundry-settings.js";
import { customerActions, getJob, jobView } from "./jobs.js";
import { LAUNDRY_SERVICE_ID } from "./laundry-orders.js";
import { chargeCustomer, dropUnpaidHold, inMinutes, logEvent, notifyProviders, toDb, type Row } from "./service.js";
import { getWorkSettings, type WorkMatchingMode } from "./settings.js";

/**
 * Laundry catalogue, quote and admin configuration. Mounted under /v1/work.
 * Until migration 0132 is applied these answer "laundry_upgrade_pending" and
 * the existing Work laundry booking keeps working untouched.
 */

export const laundryRoutes = new Hono();
const ip = (c: { req: { header: (k: string) => string | undefined } }) => c.req.header("cf-connecting-ip") ?? null;

let readyCache: { at: number; ok: boolean } | null = null;
export const resetLaundryCache = () => { readyCache = null; };
async function laundryReady(): Promise<boolean> {
  if (readyCache && (readyCache.ok || Date.now() - readyCache.at < 30_000)) return readyCache.ok;
  const ok = await tablesExist(["laundry_items", "laundry_packages", "laundry_orders", "laundry_order_lines"]).catch(() => false);
  readyCache = { at: Date.now(), ok };
  return ok;
}
const pending = { error: "laundry_upgrade_pending", message: "Laundry is being set up. Try again shortly." } as const;

const stepOf500 = z.number().int().min(0).max(100_000_000).refine((n) => n % 500 === 0, "Prices move in steps of 500 UGX.");

const rowToItem = (r: Row) => ({
  id: String(r.id), name: String(r.name), category: String(r.category), maxCount: Number(r.max_count),
  washUgx: r.wash_price_ugx == null ? null : Number(r.wash_price_ugx),
  dryCleanUgx: r.dry_clean_price_ugx == null ? null : Number(r.dry_clean_price_ugx),
  ironUgx: r.iron_price_ugx == null ? null : Number(r.iron_price_ugx),
  sortOrder: Number(r.sort_order), active: Number(r.active) === 1,
});
export const DEFAULT_LAUNDRY_PACKAGES = [
  { id: "lp_single", name: "Single load", description: "1/2 Full Laundry Bag · 1–10 lbs", minLb: 1, maxLb: 10, priceUgx: 20000, maxCount: 10, sortOrder: 10, active: true },
  { id: "lp_couple", name: "Couple load", description: "1 Full Laundry Bag · 10–25 lbs", minLb: 10, maxLb: 25, priceUgx: 35000, maxCount: 10, sortOrder: 20, active: true },
  { id: "lp_family", name: "Family load", description: "2 Full Laundry Bags · 25–40 lbs", minLb: 25, maxLb: 40, priceUgx: 55000, maxCount: 10, sortOrder: 30, active: true },
  { id: "lp_duvet", name: "Duvet or blanket", description: "Large comforter, blanket or duvet", minLb: 1, maxLb: 15, priceUgx: 25000, maxCount: 10, sortOrder: 40, active: true },
];

const rowToPackage = (r: Row) => ({
  id: String(r.id), name: String(r.name), description: String(r.description), minLb: r.min_lb == null ? null : Number(r.min_lb), maxLb: r.max_lb == null ? null : Number(r.max_lb),
  priceUgx: Number(r.price_ugx), maxCount: Number(r.max_count), sortOrder: Number(r.sort_order), active: Number(r.active) === 1,
});

function publicSettings(s: LaundrySettings) {
  return {
    pricing: s.pricing,
    offer: { minPercent: s.offerMinPercent, maxPercent: s.offerMaxPercent, stepUgx: s.offerStepUgx },
    tips: { freeEnabled: s.tipFreeEnabled, conditionalEnabled: s.tipConditionalEnabled, maxUgx: s.tipMaxUgx, stepUgx: s.offerStepUgx, ontimeHours: s.tipOntimeHours },
    rides: { pickupPayer: s.ridePayerPickup, deliveryPayer: s.ridePayerDelivery, splitCustomerPercent: s.rideSplitCustomerPercent },
    overageUgxPerLb: s.overageUgxPerLb,
  };
}

// ---------------------------------------------------------------------------
// Customer: what can be picked, and what an order would cost
// ---------------------------------------------------------------------------

laundryRoutes.get("/laundry/catalog", async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const [items, packages, settings] = await Promise.all([
    db.execute("SELECT * FROM laundry_items WHERE active = 1 ORDER BY sort_order, name"),
    db.execute("SELECT * FROM laundry_packages WHERE active = 1 AND price_ugx > 0 ORDER BY sort_order, name"),
    getLaundrySettings(),
  ]);
  return c.json({
    // An item with no price for any treatment can't be ordered, so it isn't shown.
    items: (items.rows as Row[]).map(rowToItem).filter((i) => [i.washUgx, i.dryCleanUgx, i.ironUgx].some((p) => p != null && p > 0)),
    packages: (packages.rows as Row[]).length > 0 ? (packages.rows as Row[]).map(rowToPackage) : DEFAULT_LAUNDRY_PACKAGES,
    settings: publicSettings(settings),
  });
});

const quoteSchema = z.object({
  items: z.array(z.object({ itemId: z.string().min(1).max(80), treatment: z.enum(LAUNDRY_TREATMENTS), count: z.number().int().min(1).max(500) })).max(100).default([]),
  packages: z.array(z.object({ packageId: z.string().min(1).max(80), count: z.number().int().min(1).max(100) })).max(10).default([]),
  /** The customer's offer, used only when admin has set this order's service to "estimate". */
  offerUgx: z.number().int().min(0).max(100_000_000).optional(),
  tip: z.object({ kind: z.enum(["none", "free", "conditional"]), amountUgx: z.number().int().min(0).max(100_000_000) }).optional(),
});

/**
 * Prices a basket without creating anything: the catalogue total, the pricing mode that applies
 * (admin's choice), the offer slider band, the goods price after any offer, ride shares and tip.
 */
async function quoteBasket(d: z.infer<typeof quoteSchema>, settings: LaundrySettings) {
  const bad = (body: Record<string, unknown>) => ({ ok: false as const, status: 400 as const, body });
  if (d.items.length === 0 && d.packages.length === 0) return bad({ error: "empty_order", message: "Choose something to wash first." });
  const itemRows = d.items.length
    ? ((await db.execute({ sql: `SELECT * FROM laundry_items WHERE active = 1 AND id IN (${d.items.map(() => "?").join(",")})`, args: [...new Set(d.items.map((i) => i.itemId))] })).rows as Row[])
    : [];
  const itemMap = new Map<string, ItemPrices & { name: string; maxCount: number }>(itemRows.map((r) => {
    const i = rowToItem(r);
    return [i.id, { washUgx: i.washUgx, dryCleanUgx: i.dryCleanUgx, ironUgx: i.ironUgx, name: i.name, maxCount: i.maxCount }];
  }));
  const counts = new Map<string, number>();
  for (const l of d.items) counts.set(l.itemId, (counts.get(l.itemId) ?? 0) + l.count);
  for (const [id, n] of counts) {
    const max = itemMap.get(id)?.maxCount;
    if (max != null && n > max) return bad({ error: "too_many", message: `You can add up to ${max} of ${itemMap.get(id)?.name}.` });
  }
  const lines = priceLines(d.items, itemMap);
  if (!lines.ok) return bad({ error: lines.error, itemId: lines.itemId, message: "One of those items can't be ordered that way." });

  let packagesUgx = 0;
  const packageLines: { packageId: string; name: string; count: number; unitUgx: number; lineUgx: number }[] = [];
  if (d.packages.length) {
    const rows = (await db.execute({ sql: `SELECT * FROM laundry_packages WHERE active = 1 AND price_ugx > 0 AND id IN (${d.packages.map(() => "?").join(",")})`, args: d.packages.map((p) => p.packageId) })).rows as Row[];
    const byId = new Map(rows.map((r) => [String(r.id), rowToPackage(r)]));
    for (const dp of DEFAULT_LAUNDRY_PACKAGES) {
      if (!byId.has(dp.id) || (byId.get(dp.id)?.priceUgx ?? 0) <= 0) {
        byId.set(dp.id, dp);
      }
    }
    for (const p of d.packages) {
      const pkg = byId.get(p.packageId);
      if (!pkg) return bad({ error: "unknown_package", message: "That package isn't available." });
      if (p.count > pkg.maxCount) return bad({ error: "too_many", message: `You can order up to ${pkg.maxCount} of ${pkg.name}.` });
      packagesUgx += pkg.priceUgx * p.count;
      packageLines.push({ packageId: pkg.id, name: pkg.name, count: p.count, unitUgx: pkg.priceUgx, lineUgx: pkg.priceUgx * p.count });
    }
  }

  const catalogueUgx = lines.totalUgx + packagesUgx;
  // Which admin switch governs this basket: custom items, or the treatment of a package order (wash and fold).
  const services = new Set<string>();
  if (d.items.length) services.add("custom");
  if (d.packages.length) services.add("wash_fold");
  // If any part is fixed, the whole order is fixed: admin's price overrides an offer.
  const mode = [...services].some((s) => settings.pricing[s as (typeof LAUNDRY_SERVICES)[number]] === "fixed") ? "fixed" : "estimate";
  const band = offerBand(catalogueUgx, settings.offerMinPercent, settings.offerMaxPercent, settings.offerStepUgx);
  const goodsUgx = goodsPrice(mode, catalogueUgx, band, d.offerUgx);
  const tip = normaliseTip(d.tip?.kind ?? "none", d.tip?.amountUgx ?? 0, { freeEnabled: settings.tipFreeEnabled, conditionalEnabled: settings.tipConditionalEnabled, maxUgx: settings.tipMaxUgx, stepUgx: settings.offerStepUgx });
  const rides = splitRides({ pickupUgx: settings.rideFeeUgx, deliveryUgx: settings.rideFeeUgx }, { pickup: settings.ridePayerPickup, delivery: settings.ridePayerDelivery }, settings.rideSplitCustomerPercent);

  const feeUgx = customerFee(goodsUgx + rides.customerUgx, { enabled: settings.customerFeeEnabled, type: settings.customerFeeType, value: settings.customerFeeValue, maxSharePercent: settings.customerFeeMaxSharePercent });

  const commission = commissionPlan(goodsUgx, settings.providerCommissionPercent, settings.commissionTiming);
  return { ok: true as const, data: {
    currency: "UGX",
    lines: lines.priced.map((l) => ({ ...l, name: itemMap.get(l.itemId)?.name })),
    packageLines: packageLines,
    catalogueUgx,
    pricingMode: mode,
    // The slider only exists when the customer is allowed to offer.
    offerBand: mode === "estimate" ? band : null,
    goodsUgx,
    tip,
    rides: { customerUgx: rides.customerUgx, providerUgx: rides.providerUgx, pickup: rides.pickup, delivery: rides.delivery },
    // Peebee's fee, added automatically at checkout. Shown to the customer as its own line.
    customerFeeUgx: feeUgx,
    customerTotalUgx: checkoutTotal({ goodsUgx, customerRideUgx: rides.customerUgx, tipUgx: tip.amountUgx, feeUgx }),
  }, commission, itemLines: lines.priced, packageLines, rides };
}


laundryRoutes.post("/laundry/quote", async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const parsed = quoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const result = await quoteBasket(parsed.data, await getLaundrySettings());
  return result.ok ? c.json(result.data) : c.json(result.body, result.status);
});

// ---------------------------------------------------------------------------
// Placing an order. This goes through the same checkout as every other Work booking:
// the customer's wallet is charged and the money is held by Peebee; the engine's
// top-up prompt (402), idempotency key, scheduling rules and provider matching all apply.
// ---------------------------------------------------------------------------

const orderSchema = quoteSchema.extend({
  address: z.string().min(3).max(200),
  area: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  scheduledFor: z.string().max(40).optional(),
  matchingMode: z.enum(["broadcast", "customer_picks", "admin_assigns"]).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
  frequency: z.enum(["one_time", "weekly", "biweekly"]).default("one_time"),
  detergent: z.enum(["standard", "fragrance_free"]).default("standard"),
  contactless: z.boolean().default(false),
  notes: z.string().max(1000).default(""),
  /** What the customer saw on screen. If the price moved since, nothing is charged and they see the new one. */
  expectedTotalUgx: z.number().int().min(0).optional(),
});

laundryRoutes.post("/laundry/orders", async (c) => {
  const user = c.get("user");
  if (user.role === "admin") return c.json({ error: "forbidden", message: "Staff accounts can't book jobs." }, 403);
  if (!(await laundryReady())) return c.json(pending, 503);
  const parsed = orderSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const [work, settings] = await Promise.all([getWorkSettings(), getLaundrySettings()]);
  if (!(work.serviceTypes as string[]).includes("laundry")) return c.json({ error: "service_closed", message: "Laundry isn't open right now." }, 403);

  if (d.idempotencyKey) {
    const existing = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE customer_id = ? AND idempotency_key = ?", args: [user.sub, d.idempotencyKey] })).rows[0] as Row | undefined;
    if (existing) return c.json({ job: await jobView(existing, "customer"), actions: customerActions(existing, work), repeated: true });
  }

  const quote = await quoteBasket(d, settings);
  if (!quote.ok) return c.json(quote.body, quote.status);
  const q = quote.data;
  if (d.expectedTotalUgx != null && d.expectedTotalUgx !== q.customerTotalUgx) {
    return c.json({ error: "price_changed", message: "The price changed. Check the new total and confirm again.", quote: q }, 409);
  }
  if (q.goodsUgx <= 0) return c.json({ error: "pricing_unavailable", message: "That order can't be booked right now." }, 409);

  const matchingMode: WorkMatchingMode = d.matchingMode ?? work.defaultMatching;
  if (!work.matchingModes.includes(matchingMode)) return c.json({ error: "matching_unavailable", message: "That way of finding a provider isn't available." }, 400);
  if (matchingMode === "broadcast" && (d.lat == null || d.lng == null)) return c.json({ error: "location_required", message: "Share your location so nearby providers can be found." }, 400);

  let scheduledFor: string | null = null;
  if (d.scheduledFor) {
    const when = new Date(d.scheduledFor);
    if (Number.isNaN(when.getTime())) return c.json({ error: "invalid_schedule", message: "That date and time isn't valid." }, 400);
    const minutesAhead = (when.getTime() - Date.now()) / 60_000;
    if (minutesAhead < work.minLeadMinutes) return c.json({ error: "too_soon", message: `Book at least ${work.minLeadMinutes} minutes ahead.` }, 400);
    if (minutesAhead > work.maxAdvanceDays * 1440) return c.json({ error: "too_far", message: `You can book up to ${work.maxAdvanceDays} days ahead.` }, 400);
    scheduledFor = toDb(when);
  }

  const limit = await consume(`work-book:${user.sub}`, work.jobsPerHour, 3600);
  if (!limit.allowed) return c.json({ error: "too_many_requests", message: "You've booked several jobs already. Try again later.", retryAfterSeconds: limit.retryAfterSeconds }, 429);

  const service = (await db.execute({ sql: "SELECT * FROM work_services WHERE id = ?", args: [LAUNDRY_SERVICE_ID] })).rows[0] as Row | undefined;
  if (!service) return c.json(pending, 503);

  const environment = await getPlatformEnvironment();
  const id = newId("wjob");
  const hold = q.customerTotalUgx;
  const details = [d.notes, d.detergent === "fragrance_free" ? "Fragrance-free detergent." : "", d.contactless ? "Contactless pickup." : "", d.frequency !== "one_time" ? `Repeats ${d.frequency === "weekly" ? "weekly" : "every two weeks"}.` : ""].filter(Boolean).join(" ").slice(0, 1000);
  const promisedBy = toDb(new Date(Date.now() + settings.tipOntimeHours * 3_600_000));
  const takenAtCheckout = quote.commission.takenAtCheckoutUgx;

  // Everything about the order is written while the job is still 'pending_payment', so providers never see an unpaid order.
  const statements: DbStatement[] = [
    {
      sql: `INSERT INTO work_jobs (id, customer_id, service_id, service_type, service_name, pricing_mode, matching_mode, status, quantity, details,
              address, area, lat, lng, scheduled_for, unit_price_ugx, callout_fee_ugx, price_ugx, commission_percent, idempotency_key, environment)
            VALUES (?, ?, ?, 'laundry', ?, 'fixed', ?, 'pending_payment', 1, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      args: [id, user.sub, LAUNDRY_SERVICE_ID, service.name, matchingMode, details, d.address, d.area ?? null, d.lat ?? null, d.lng ?? null, scheduledFor, q.goodsUgx, q.goodsUgx, settings.providerCommissionPercent, d.idempotencyKey ?? null, environment],
    },
    {
      sql: `INSERT INTO laundry_orders (job_id, mode, pricing_mode, catalogue_total_ugx, offer_ugx, goods_ugx, tip_kind, tip_ugx, pickup_ride_ugx, delivery_ride_ugx,
              pickup_payer, delivery_payer, customer_ride_ugx, provider_ride_ugx, frequency, detergent, contactless, notes,
              commission_timing, cancel_rule, commission_taken_ugx, fee_ugx, tip_promised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, d.items.length ? "custom" : "package", q.pricingMode, q.catalogueUgx, q.pricingMode === "estimate" ? q.goodsUgx : null, q.goodsUgx, q.tip.kind, q.tip.amountUgx,
        settings.rideFeeUgx, settings.rideFeeUgx, settings.ridePayerPickup, settings.ridePayerDelivery, q.rides.customerUgx, q.rides.providerUgx, d.frequency, d.detergent, d.contactless ? 1 : 0, d.notes,
        settings.commissionTiming, settings.cancelCommission, takenAtCheckout, q.customerFeeUgx, q.tip.kind === "conditional" ? promisedBy : null],
    },
    ...quote.itemLines.map((l) => ({
      sql: "INSERT INTO laundry_order_lines (id, job_id, kind, ref_id, name, treatment, count, unit_price_ugx, line_total_ugx) VALUES (?, ?, 'item', ?, ?, ?, ?, ?, ?)",
      args: [newId("lol"), id, l.itemId, q.lines.find((x) => x.itemId === l.itemId && x.treatment === l.treatment)?.name ?? l.itemId, l.treatment, l.count, l.unitUgx, l.lineUgx],
    })),
    ...quote.packageLines.map((l) => ({
      sql: "INSERT INTO laundry_order_lines (id, job_id, kind, ref_id, name, treatment, count, unit_price_ugx, line_total_ugx) VALUES (?, ?, 'package', ?, ?, NULL, ?, ?, ?)",
      args: [newId("lol"), id, l.packageId, l.name, l.count, l.unitUgx, l.lineUgx],
    })),
  ];
  try {
    await executeBatch(statements);
  } catch (err) {
    const again = d.idempotencyKey && (await db.execute({ sql: "SELECT * FROM work_jobs WHERE customer_id = ? AND idempotency_key = ?", args: [user.sub, d.idempotencyKey] })).rows[0];
    if (again) return c.json({ job: await jobView(again as Row, "customer"), actions: customerActions(again as Row, work), repeated: true });
    throw err;
  }

  // Peebee's customer fee (and the commission, when admin takes it at checkout) is recorded as Peebee's the moment the order is paid.
  const open = {
    sql: "UPDATE work_jobs SET status = 'open', held_ugx = ?, commission_ugx = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending_payment'",
    args: [hold, takenAtCheckout + q.customerFeeUgx, inMinutes(work.offerWindowMinutes), id],
  };
  const result = await chargeCustomer({ jobId: id, key: "booking", customerId: user.sub, amount: hold, environment, note: `Peebee Work — ${service.name}`, then: open });
  if (!result.charged) {
    await dropUnpaidHold(id, "booking");
    await db.execute({ sql: "DELETE FROM laundry_order_lines WHERE job_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM laundry_orders WHERE job_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM work_jobs WHERE id = ? AND status = 'pending_payment'", args: [id] });
    return c.json({ error: "insufficient_wallet", message: `You need UGX ${hold.toLocaleString("en-UG")} in your wallet to book this. Top up and try again.`, neededUgx: hold }, 402);
  }
  await logEvent(id, user.sub, "customer", "created", { laundry: true, goodsUgx: q.goodsUgx, totalUgx: hold, pricingMode: q.pricingMode, matchingMode });

  const job = (await getJob(id)) as Row;
  if (matchingMode !== "admin_assigns") await notifyProviders(job, work);
  return c.json({ job: await jobView(job, "customer"), actions: customerActions(job, work), totalUgx: hold }, 201);
});
// ---------------------------------------------------------------------------
// Admin: settings, items and packages
// ---------------------------------------------------------------------------

const laundryPricingMode = z.enum(["fixed", "estimate"]).optional();
const settingsSchema = z.object({
  pricing: z.object(Object.fromEntries(LAUNDRY_SERVICES.map((s) => [s, laundryPricingMode])) as Record<(typeof LAUNDRY_SERVICES)[number], typeof laundryPricingMode>).optional(),
  offerMinPercent: z.number().int().min(1).max(100).optional(),
  offerMaxPercent: z.number().int().min(100).max(500).optional(),
  offerStepUgx: z.number().int().min(500).max(50_000).refine((n) => n % 500 === 0, "The step moves in multiples of 500.").optional(),
  ridePayerPickup: z.enum(RIDE_PAYERS).optional(),
  ridePayerDelivery: z.enum(RIDE_PAYERS).optional(),
  rideSplitCustomerPercent: z.number().int().min(0).max(100).optional(),
  rideFeeUgx: z.number().int().min(0).max(1_000_000).optional(),
  overageUgxPerLb: z.number().int().min(0).max(1_000_000).optional(),
  tipFreeEnabled: z.boolean().optional(),
  tipConditionalEnabled: z.boolean().optional(),
  tipMaxUgx: z.number().int().min(0).max(10_000_000).optional(),
  tipOntimeHours: z.number().int().min(1).max(720).optional(),
  commissionTiming: z.enum(["on_payout", "at_checkout"]).optional(),
  cancelCommission: z.enum(["refund", "keep"]).optional(),
  providerCommissionPercent: z.number().int().min(0).max(60).optional(),
  customerFeeEnabled: z.boolean().optional(),
  customerFeeType: z.enum(["flat", "percent"]).optional(),
  customerFeeValue: z.number().int().min(0).max(10_000_000).optional(),
  customerFeeMaxSharePercent: z.number().int().min(1).max(99).optional(),
});

laundryRoutes.get("/admin/laundry/settings", requirePermission("work.view"), async (c) => c.json({ settings: await getLaundrySettings() }));

laundryRoutes.put("/admin/laundry/settings", requirePermission("work.manage"), async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const before = await getLaundrySettings();
  await setLaundrySettings(parsed.data as Parameters<typeof setLaundrySettings>[0]);
  await logActivity({ actor: c.get("user"), action: "laundry.settings.update", summary: "Changed laundry settings", entityType: "laundry_settings", entityId: "laundry", before, after: parsed.data, ip: ip(c) });
  return c.json({ settings: await getLaundrySettings() });
});

laundryRoutes.get("/admin/laundry/items", requirePermission("work.view"), async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const [items, packages] = await Promise.all([db.execute("SELECT * FROM laundry_items ORDER BY sort_order, name"), db.execute("SELECT * FROM laundry_packages ORDER BY sort_order, name")]);
  return c.json({ items: (items.rows as Row[]).map(rowToItem), packages: (packages.rows as Row[]).map(rowToPackage) });
});

const priceField = stepOf500.nullable();
const itemFields = {
  name: z.string().min(2).max(80), category: z.string().max(40), washUgx: priceField, dryCleanUgx: priceField, ironUgx: priceField,
  maxCount: z.number().int().min(1).max(500), sortOrder: z.number().int().min(0).max(100000), active: z.boolean(),
};

laundryRoutes.post("/admin/laundry/items", requirePermission("work.manage"), async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const parsed = z.object({ ...itemFields, category: itemFields.category.default("clothing"), washUgx: priceField.default(null), dryCleanUgx: priceField.default(null), ironUgx: priceField.default(null), maxCount: itemFields.maxCount.default(50), sortOrder: itemFields.sortOrder.default(0), active: itemFields.active.default(false) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const id = `li_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db.execute({ sql: "INSERT INTO laundry_items (id, name, category, wash_price_ugx, dry_clean_price_ugx, iron_price_ugx, max_count, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, d.name, d.category, d.washUgx, d.dryCleanUgx, d.ironUgx, d.maxCount, d.sortOrder, d.active ? 1 : 0] });
  await logActivity({ actor: c.get("user"), action: "laundry.item.create", summary: `Added laundry item "${d.name}"`, entityType: "laundry_item", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

laundryRoutes.patch("/admin/laundry/items/:id", requirePermission("work.manage"), async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const id = c.req.param("id") as string;
  const before = (await db.execute({ sql: "SELECT * FROM laundry_items WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found", message: "Item not found." }, 404);
  const parsed = patchSchema(z.object(itemFields)).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  // A price can be cleared (null) to stop offering that treatment, so "present" is tested by key, not value.
  const has = (k: keyof typeof d) => (k in d ? 1 : 0);
  await db.execute({
    sql: `UPDATE laundry_items SET name = COALESCE(?, name), category = COALESCE(?, category),
            wash_price_ugx = CASE WHEN ? = 1 THEN ? ELSE wash_price_ugx END, dry_clean_price_ugx = CASE WHEN ? = 1 THEN ? ELSE dry_clean_price_ugx END,
            iron_price_ugx = CASE WHEN ? = 1 THEN ? ELSE iron_price_ugx END, max_count = COALESCE(?, max_count), sort_order = COALESCE(?, sort_order),
            active = COALESCE(?, active), updated_at = datetime('now') WHERE id = ?`,
    args: [d.name ?? null, d.category ?? null, has("washUgx"), d.washUgx ?? null, has("dryCleanUgx"), d.dryCleanUgx ?? null, has("ironUgx"), d.ironUgx ?? null,
      d.maxCount ?? null, d.sortOrder ?? null, d.active == null ? null : d.active ? 1 : 0, id],
  });
  await logActivity({ actor: c.get("user"), action: "laundry.item.update", summary: `Changed laundry item "${before.name}"`, entityType: "laundry_item", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});

const packageFields = {
  name: z.string().min(2).max(80), description: z.string().max(200), minLb: z.number().int().min(0).max(1000).nullable(), maxLb: z.number().int().min(1).max(1000).nullable(),
  priceUgx: stepOf500, maxCount: z.number().int().min(1).max(100), sortOrder: z.number().int().min(0).max(100000), active: z.boolean(),
};

laundryRoutes.patch("/admin/laundry/packages/:id", requirePermission("work.manage"), async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const id = c.req.param("id") as string;
  const before = (await db.execute({ sql: "SELECT * FROM laundry_packages WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found", message: "Package not found." }, 404);
  const parsed = patchSchema(z.object(packageFields)).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  if (d.active === true && !((d.priceUgx ?? Number(before.price_ugx)) > 0)) return c.json({ error: "invalid_package", message: "Set a price before switching a package on." }, 400);
  const has = (k: keyof typeof d) => (k in d ? 1 : 0);
  await db.execute({
    sql: `UPDATE laundry_packages SET name = COALESCE(?, name), description = COALESCE(?, description), min_lb = CASE WHEN ? = 1 THEN ? ELSE min_lb END,
            max_lb = CASE WHEN ? = 1 THEN ? ELSE max_lb END, price_ugx = COALESCE(?, price_ugx), max_count = COALESCE(?, max_count),
            sort_order = COALESCE(?, sort_order), active = COALESCE(?, active), updated_at = datetime('now') WHERE id = ?`,
    args: [d.name ?? null, d.description ?? null, has("minLb"), d.minLb ?? null, has("maxLb"), d.maxLb ?? null, d.priceUgx ?? null, d.maxCount ?? null, d.sortOrder ?? null,
      d.active == null ? null : d.active ? 1 : 0, id],
  });
  await logActivity({ actor: c.get("user"), action: "laundry.package.update", summary: `Changed laundry package "${before.name}"`, entityType: "laundry_package", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});
