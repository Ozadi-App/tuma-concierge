import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { db } from "../db/client.js";
import { tablesExist } from "../lib/schema.js";
import { checkoutTotal, customerFee, goodsPrice, LAUNDRY_TREATMENTS, normaliseTip, offerBand, priceLines, RIDE_PAYERS, splitRides, type ItemPrices } from "./laundry-pricing.js";
import { getLaundrySettings, LAUNDRY_SERVICES, setLaundrySettings, type LaundrySettings } from "./laundry-settings.js";
import type { Row } from "./service.js";

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
    packages: (packages.rows as Row[]).map(rowToPackage),
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
laundryRoutes.post("/laundry/quote", async (c) => {
  if (!(await laundryReady())) return c.json(pending, 503);
  const parsed = quoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  if (d.items.length === 0 && d.packages.length === 0) return c.json({ error: "empty_order", message: "Choose something to wash first." }, 400);
  const settings = await getLaundrySettings();

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
    if (max != null && n > max) return c.json({ error: "too_many", message: `You can add up to ${max} of ${itemMap.get(id)?.name}.` }, 400);
  }
  const lines = priceLines(d.items, itemMap);
  if (!lines.ok) return c.json({ error: lines.error, itemId: lines.itemId, message: "One of those items can't be ordered that way." }, 400);

  let packagesUgx = 0;
  const packageLines: { packageId: string; name: string; count: number; unitUgx: number; lineUgx: number }[] = [];
  if (d.packages.length) {
    const rows = (await db.execute({ sql: `SELECT * FROM laundry_packages WHERE active = 1 AND price_ugx > 0 AND id IN (${d.packages.map(() => "?").join(",")})`, args: d.packages.map((p) => p.packageId) })).rows as Row[];
    const byId = new Map(rows.map((r) => [String(r.id), rowToPackage(r)]));
    for (const p of d.packages) {
      const pkg = byId.get(p.packageId);
      if (!pkg) return c.json({ error: "unknown_package", message: "That package isn't available." }, 400);
      if (p.count > pkg.maxCount) return c.json({ error: "too_many", message: `You can order up to ${pkg.maxCount} of ${pkg.name}.` }, 400);
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

  return c.json({
    currency: "UGX",
    lines: lines.priced.map((l) => ({ ...l, name: itemMap.get(l.itemId)?.name })),
    packageLines,
    catalogueUgx,
    pricingMode: mode,
    // The slider only exists when the customer is allowed to offer.
    offerBand: mode === "estimate" ? band : null,
    goodsUgx,
    tip,
    rides: { customerUgx: rides.customerUgx, providerUgx: rides.providerUgx, pickup: rides.pickup, delivery: rides.delivery },
    // Peebee's fee, added automatically at checkout. Shown to the customer as its own line.\n    customerFeeUgx: feeUgx,\n    customerTotalUgx: checkoutTotal({ goodsUgx, customerRideUgx: rides.customerUgx, tipUgx: tip.amountUgx, feeUgx }),
  });
});

// ---------------------------------------------------------------------------
// Admin: settings, items and packages
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  pricing: z.object(Object.fromEntries(LAUNDRY_SERVICES.map((s) => [s, z.enum(["fixed", "estimate"]).optional()])) as Record<(typeof LAUNDRY_SERVICES)[number], z.ZodOptional<z.ZodEnum<["fixed", "estimate"]>>>).optional(),
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
  const parsed = z.object(itemFields).partial().safeParse(await c.req.json().catch(() => ({})));
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
  const parsed = z.object(packageFields).partial().safeParse(await c.req.json().catch(() => ({})));
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
