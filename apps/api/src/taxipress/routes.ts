import { Hono, type Context } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getTaxipressSettings, setTaxipressSettings } from "./settings.js";
import { getTaxipressRoute, listActiveTaxipressRoutes, listTaxipressRoutes, taxipressReady } from "./service.js";

type Row = Record<string, unknown>;

/** Taxipress: scheduled shared-taxi seats on fixed routes. See docs/FLYEXPRESS_INTEGRATION_BREAKDOWN.md. */
export const taxipressRoutes = new Hono();
taxipressRoutes.use("/taxipress/*", requireAuth);
taxipressRoutes.use("/admin/taxipress/*", requireAuth, requireRole("admin"));

const ip = (c: Context) => c.req.header("cf-connecting-ip") ?? null;

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

/**
 * What the app needs to decide whether to show Taxipress. Always answers: `enabled` is true only
 * when staff switched it on, the migration is applied and at least one route is running.
 */
taxipressRoutes.get("/taxipress/config", async (c) => {
  const settings = await getTaxipressSettings();
  const routes = settings.enabled && (await taxipressReady()) ? await listActiveTaxipressRoutes() : [];
  return c.json({
    enabled: routes.length > 0,
    routes: routes.map((r) => ({
      id: r.id, directionLabel: r.directionLabel, routeCode: r.routeCode, fromName: r.fromName, toName: r.toName,
      farePerSeat: r.farePerSeat,
    })),
    cashEnabled: settings.cashEnabled,
    seatChoiceFeeUgx: settings.seatChoiceFeeUgx,
    returnDiscountPercent: settings.returnDiscountPercent,
    maxSeatsPerBooking: settings.maxSeatsPerBooking,
    parcelFitText: settings.parcelFitText,
    parcelNotAllowed: settings.parcelNotAllowed,
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

taxipressRoutes.get("/admin/taxipress/settings", requirePermission("settings.manage"), async (c) => {
  return c.json({ settings: await getTaxipressSettings(), ready: await taxipressReady() });
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  departureRule: z.enum(["full_only", "driver_choice", "after_wait"]),
  sellFreeSeatsOnRoad: z.boolean(),
  commissionType: z.enum(["percent", "flat"]),
  commissionDigitalPercent: z.number().min(0).max(100),
  commissionCashPercent: z.number().min(0).max(100),
  commissionFlatUgx: z.number().int().min(0).max(1_000_000),
  blockWhenOwing: z.boolean(),
  maxOwedUgx: z.number().int().min(0).max(100_000_000),
  cashEnabled: z.boolean(),
  seatChoiceFeeUgx: z.number().int().min(0).max(100_000),
  returnDiscountPercent: z.number().min(0).max(100),
  maxSeatsPerBooking: z.number().int().min(1).max(30),
  parcelAcceptRule: z.enum(["boarding_now", "any_in_line"]),
  maxParcels14: z.number().int().min(0).max(50),
  maxParcels18: z.number().int().min(0).max(50),
  parcelFitText: z.string().trim().max(200),
  parcelNotAllowed: z.array(z.string().trim().min(1).max(60)).max(50),
}).partial();

taxipressRoutes.put("/admin/taxipress/settings", requirePermission("settings.manage"), async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const before = await getTaxipressSettings();
  await setTaxipressSettings(parsed.data);
  const after = await getTaxipressSettings();
  await logActivity({ actor: c.get("user"), action: "settings.taxipress", summary: "Updated Taxipress settings", entityType: "settings", entityId: "taxipress", before, after, ip: ip(c) });
  return c.json({ settings: after });
});

taxipressRoutes.get("/admin/taxipress/routes", requirePermission("settings.manage"), async (c) => {
  if (!(await taxipressReady())) return c.json({ routes: [], relayRoutes: [], ready: false });
  // Relay routes staff can run Taxipress on (set up in Settings → Relay delivery).
  const relay = (await db.execute("SELECT id, name, stage_a_name, stage_b_name, active FROM relay_routes ORDER BY name")).rows as Row[];
  return c.json({
    routes: await listTaxipressRoutes(),
    relayRoutes: relay.map((r) => ({ id: String(r.id), name: String(r.name), stageAName: String(r.stage_a_name), stageBName: String(r.stage_b_name), active: Number(r.active) === 1 })),
    ready: true,
  });
});

const notReady = { error: "taxipress_unavailable", message: "Apply migration 0123 first." } as const;

const createSchema = z.object({
  relayRouteId: z.string().min(1),
  direction: z.enum(["a_to_b", "b_to_a"]),
  farePerSeat: z.number().int().min(0).max(1_000_000),
  stopPricingEnabled: z.boolean().default(false),
  // A new route stays off until staff switch it on.
  active: z.boolean().default(false),
});

taxipressRoutes.post("/admin/taxipress/routes", requirePermission("settings.manage"), async (c) => {
  if (!(await taxipressReady())) return c.json(notReady, 503);
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const relay = (await db.execute({ sql: "SELECT id, name FROM relay_routes WHERE id = ?", args: [d.relayRouteId] })).rows[0] as Row | undefined;
  if (!relay) return c.json({ error: "route_not_found", message: "Choose a route set up in Relay delivery first." }, 404);
  const exists = (await db.execute({ sql: "SELECT 1 FROM taxipress_routes WHERE relay_route_id = ? AND direction = ?", args: [d.relayRouteId, d.direction] })).rows[0];
  if (exists) return c.json({ error: "route_exists", message: "That direction is already set up." }, 409);
  const id = newId("tpr");
  await db.execute({
    sql: "INSERT INTO taxipress_routes (id, relay_route_id, direction, fare_per_seat, stop_pricing_enabled, active) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, d.relayRouteId, d.direction, d.farePerSeat, d.stopPricingEnabled ? 1 : 0, d.active ? 1 : 0],
  });
  await logActivity({ actor: c.get("user"), action: "taxipress.route.create", summary: `Added Taxipress route on "${relay.name}"`, entityType: "taxipress_route", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

const updateSchema = z.object({
  farePerSeat: z.number().int().min(0).max(1_000_000),
  stopPricingEnabled: z.boolean(),
  active: z.boolean(),
}).partial();

taxipressRoutes.patch("/admin/taxipress/routes/:id", requirePermission("settings.manage"), async (c) => {
  if (!(await taxipressReady())) return c.json(notReady, 503);
  const id = c.req.param("id") as string;
  const before = await getTaxipressRoute(id);
  if (!before) return c.json({ error: "not_found" }, 404);
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const columns: [string, number | undefined][] = [
    ["fare_per_seat", d.farePerSeat],
    ["stop_pricing_enabled", d.stopPricingEnabled == null ? undefined : d.stopPricingEnabled ? 1 : 0],
    ["active", d.active == null ? undefined : d.active ? 1 : 0],
  ];
  const set = columns.filter(([, value]) => value !== undefined);
  if (!set.length) return c.json({ ok: true });
  await db.execute({
    sql: `UPDATE taxipress_routes SET ${set.map(([column]) => `${column} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    args: [...set.map(([, value]) => value as number), id],
  });
  await logActivity({ actor: c.get("user"), action: "taxipress.route.update", summary: `Updated Taxipress route ${before.directionLabel}`, entityType: "taxipress_route", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});
