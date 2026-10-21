import { Hono, type Context } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { bookingFor, bookSeats, manifestFor, myBookings, releaseStaleBookings } from "./bookings.js";
import { activeQueue, applyTaxi, arrive, driverView, goOnRoad, joinLine, leaveLine, lineOf, listTaxis, onRoadOf, removeFromLine, startBoarding, TaxipressError, updateLocation, updateTaxi, walkUp } from "./queue.js";
import { getTaxipressSettings, setTaxipressSettings } from "./settings.js";
import { getTaxipressRoute, listActiveTaxipressRoutes, listTaxipressRoutes, taxipressReady } from "./service.js";

type Row = Record<string, unknown>;

/** Taxipress: scheduled shared-taxi seats on fixed routes. See docs/FLYEXPRESS_INTEGRATION_BREAKDOWN.md. */
export const taxipressRoutes = new Hono();
taxipressRoutes.use("/taxipress/*", requireAuth);
taxipressRoutes.use("/admin/taxipress/*", requireAuth, requireRole("admin"));

const ip = (c: Context) => c.req.header("cf-connecting-ip") ?? null;

function fail(c: Context, e: unknown) {
  if (e instanceof TaxipressError) return c.json({ error: e.code, message: e.message }, e.status);
  throw e;
}

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
    payWithinMinutes: settings.payWithinMinutes,
    parcelFitText: settings.parcelFitText,
    parcelNotAllowed: settings.parcelNotAllowed,
  });
});

// ---------------------------------------------------------------------------
// The line: what drivers do, and what passengers see
// ---------------------------------------------------------------------------

/** The taxis waiting on a route (the one Boarding Now first) and the ones already on the road. */
taxipressRoutes.get("/taxipress/routes/:id/queue", async (c) => {
  const id = c.req.param("id") as string;
  await releaseStaleBookings();
  const [line, onRoad, route] = await Promise.all([lineOf(id), onRoadOf(id), getTaxipressRoute(id)]);
  return c.json({
    line, onRoad,
    route: route ? { id: route.id, fromName: route.fromName, toName: route.toName, directionLabel: route.directionLabel, farePerSeat: route.farePerSeat } : null,
  });
});

/** The driver's taxi, their place in the line and what they can do next. */
taxipressRoutes.get("/taxipress/taxi/me", async (c) => {
  const view = await driverView(c.get("user").sub);
  return c.json({ ...view, bookings: view.entry ? await manifestFor(view.entry.id) : [] });
});

const applySchema = z.object({
  relayRouteId: z.string().min(1),
  plate: z.string().trim().min(3).max(20),
  seatLayout: z.enum(["14", "18"]),
});

taxipressRoutes.post("/taxipress/taxi/apply", async (c) => {
  const parsed = applySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose a route, enter the number plate and the seats." }, 400);
  try {
    await applyTaxi(c.get("user").sub, parsed.data);
    return c.json({ ok: true }, 201);
  } catch (e) {
    return fail(c, e);
  }
});

const placeSchema = z.object({ lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() });

taxipressRoutes.post("/taxipress/driver/join", async (c) => {
  const parsed = placeSchema.extend({ routeId: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose which way you are going." }, 400);
  try {
    return c.json({ entry: await joinLine(c.get("user").sub, parsed.data.routeId, parsed.data) }, 201);
  } catch (e) {
    return fail(c, e);
  }
});

taxipressRoutes.post("/taxipress/driver/boarding", async (c) => {
  try { return c.json({ entry: await startBoarding(c.get("user").sub) }); } catch (e) { return fail(c, e); }
});

taxipressRoutes.post("/taxipress/driver/on-road", async (c) => {
  try { return c.json({ entry: await goOnRoad(c.get("user").sub) }); } catch (e) { return fail(c, e); }
});

taxipressRoutes.post("/taxipress/driver/arrive", async (c) => {
  try { await arrive(c.get("user").sub); return c.json({ ok: true }); } catch (e) { return fail(c, e); }
});

taxipressRoutes.post("/taxipress/driver/leave", async (c) => {
  try { await leaveLine(c.get("user").sub); return c.json({ ok: true }); } catch (e) { return fail(c, e); }
});

taxipressRoutes.post("/taxipress/driver/walk-up", async (c) => {
  const parsed = z.object({ delta: z.number().int().min(-14).max(14).refine((n) => n !== 0) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  try { return c.json({ entry: await walkUp(c.get("user").sub, parsed.data.delta) }); } catch (e) { return fail(c, e); }
});

taxipressRoutes.post("/taxipress/driver/location", async (c) => {
  const parsed = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  await updateLocation(c.get("user").sub, parsed.data.lat, parsed.data.lng);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Passenger bookings
// ---------------------------------------------------------------------------

const bookSchema = z.object({
  queueId: z.string().min(1),
  seats: z.number().int().min(1).max(30),
  payment: z.enum(["app", "cash"]),
});

taxipressRoutes.post("/taxipress/bookings", async (c) => {
  const parsed = bookSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose a taxi, the seats and how you will pay." }, 400);
  return bookSeats(c, parsed.data);
});

taxipressRoutes.get("/taxipress/bookings/mine", async (c) => c.json({ bookings: await myBookings(c.get("user").sub) }));

taxipressRoutes.get("/taxipress/bookings/:id", async (c) => {
  const booking = await bookingFor(c.req.param("id") as string, c.get("user").sub);
  return booking ? c.json({ booking }) : c.json({ error: "not_found" }, 404);
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
  waitMinutes: z.number().int().min(0).max(600),
  stageRadiusM: z.number().int().min(0).max(5000),
  payWithinMinutes: z.number().int().min(1).max(1440),
  maxCashBookings: z.number().int().min(0).max(50),
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

// ---- Taxis and the live line, for staff -------------------------------------

taxipressRoutes.get("/admin/taxipress/taxis", requirePermission("riders.view"), async (c) => c.json({ taxis: await listTaxis() }));

const taxiPatch = z.object({
  status: z.enum(["pending", "approved", "suspended"]),
  passengersEnabled: z.boolean(),
  parcelsEnabled: z.boolean(),
}).partial();

taxipressRoutes.post("/admin/taxipress/taxis/:id", requirePermission("riders.verify"), async (c) => {
  const parsed = taxiPatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const id = c.req.param("id") as string;
  try {
    const taxi = await updateTaxi(id, c.get("user").sub, parsed.data);
    await logActivity({ actor: c.get("user"), action: "taxipress.taxi.update", summary: `Updated Taxipress taxi ${taxi.plate}`, entityType: "taxipress_taxi", entityId: id, after: parsed.data, ip: ip(c) });
    return c.json({ taxi });
  } catch (e) {
    return fail(c, e);
  }
});

/** Every taxi in a line or on the road right now. */
taxipressRoutes.get("/admin/taxipress/queue", requirePermission("riders.view"), async (c) => c.json({ queue: await activeQueue() }));

taxipressRoutes.post("/admin/taxipress/queue/:id/remove", requirePermission("settings.manage"), async (c) => {
  const id = c.req.param("id") as string;
  try {
    await removeFromLine(id);
    await logActivity({ actor: c.get("user"), action: "taxipress.queue.remove", summary: "Removed a taxi from the Taxipress line", entityType: "taxipress_queue", entityId: id, ip: ip(c) });
    return c.json({ ok: true });
  } catch (e) {
    return fail(c, e);
  }
});
