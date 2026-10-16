import { Hono, type Context } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { newId } from "../lib/ids.js";
import { hasColumn } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { notifyUser } from "../lib/webpush.js";
import {
  approvedOperator,
  claimLastMile,
  collectFromMatatu,
  planRelay,
  receiveAtMatatu,
  relayReady,
  RelayError,
} from "./service.js";
import { getRelaySettings, setRelaySettings } from "./settings.js";

type Row = Record<string, unknown>;

/** Relay delivery endpoints: the customer's quote, the last-mile rider, the matatu operator and staff. */
export const relayRoutes = new Hono();
relayRoutes.use("/relay/*", requireAuth);
relayRoutes.use("/admin/relay/*", requireAuth, requireRole("admin"));

const ip = (c: Context) => c.req.header("cf-connecting-ip") ?? null;

function fail(c: Context, e: unknown) {
  if (e instanceof RelayError) return c.json({ error: e.code, message: e.message }, e.status);
  throw e;
}

relayRoutes.use("/relay/*", async (c, next) => {
  if (!(await relayReady())) return c.json({ error: "relay_unavailable", message: "Relay delivery isn't set up yet." }, 503);
  await next();
});

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

const quoteSchema = z.object({
  pickupLat: z.coerce.number(), pickupLng: z.coerce.number(),
  destinationLat: z.coerce.number(), destinationLng: z.coerce.number(),
  pickupName: z.string().max(240).optional(), destinationName: z.string().max(240).optional(),
});

/** The relay a long parcel would take and what each leg costs, or relay: null for a normal delivery. */
relayRoutes.get("/relay/quote", async (c) => {
  const parsed = quoteSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "invalid_query" }, 400);
  const d = parsed.data;
  const plan = await planRelay(
    { lat: d.pickupLat, lng: d.pickupLng, name: d.pickupName },
    { lat: d.destinationLat, lng: d.destinationLng, name: d.destinationName },
  );
  return c.json({
    relay: plan && {
      routeName: plan.routeName,
      total: plan.total,
      legs: plan.legs.map((leg) => ({ leg: leg.leg, kind: leg.kind, fromName: leg.fromName, toName: leg.toName, distanceKm: leg.distanceKm, fee: leg.fee })),
    },
  });
});

// ---------------------------------------------------------------------------
// Last-mile rider
// ---------------------------------------------------------------------------

/** Last-mile legs waiting for a rider near the rider's stage. */
relayRoutes.get("/relay/legs/open", requireRole("rider"), async (c) => {
  const user = c.get("user");
  const rider = (await db.execute({ sql: "SELECT stage_lat, stage_lng FROM riders WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  const { lastMileRadiusKm } = await getRelaySettings();
  const res = await db.execute({
    sql: `SELECT l.id, l.order_id, l.from_name, l.from_lat, l.from_lng, l.to_name, l.distance_km, l.fee, l.created_at,
                 o.destination_area, o.destination_address, m.status AS matatu_status, ro.vehicle_plate
          FROM order_relay_legs l
          JOIN orders o ON o.id = l.order_id
          LEFT JOIN order_relay_legs m ON m.order_id = l.order_id AND m.leg = 2
          LEFT JOIN relay_operators ro ON ro.user_id = m.provider_id
          WHERE l.leg = 3 AND l.status = 'open' AND o.environment = ? AND o.stage = 'Deliver' AND o.rider_id IS NULL
          ORDER BY l.created_at LIMIT 50`,
    args: [await getPlatformEnvironment()],
  });
  const legs = (res.rows as Row[]).filter((leg) =>
    rider?.stage_lat == null || rider?.stage_lng == null ||
    haversineKm(Number(rider.stage_lat), Number(rider.stage_lng), Number(leg.from_lat), Number(leg.from_lng)) <= lastMileRadiusKm,
  );
  return c.json({ legs });
});

relayRoutes.post("/relay/legs/:id/claim", requireRole("rider"), async (c) => {
  try {
    return c.json(await claimLastMile(c.get("user").sub, c.req.param("id") as string));
  } catch (e) {
    return fail(c, e);
  }
});

const codeSchema = z.object({ code: z.string().trim().min(4).max(12) });

relayRoutes.post("/relay/legs/:id/collect", requireRole("rider"), async (c) => {
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the code." }, 400);
  try {
    return c.json(await collectFromMatatu(c.get("user").sub, c.req.param("id") as string, parsed.data.code));
  } catch (e) {
    return fail(c, e);
  }
});

// ---------------------------------------------------------------------------
// Matatu operator
// ---------------------------------------------------------------------------

relayRoutes.get("/relay/operator/me", async (c) => {
  const user = c.get("user");
  const [operator, routes] = await Promise.all([
    db.execute({
      sql: "SELECT ro.*, rr.name AS route_name FROM relay_operators ro LEFT JOIN relay_routes rr ON rr.id = ro.route_id WHERE ro.user_id = ?",
      args: [user.sub],
    }),
    db.execute("SELECT id, name, stage_a_name, stage_b_name FROM relay_routes WHERE active = 1 ORDER BY name"),
  ]);
  return c.json({ operator: operator.rows[0] ?? null, routes: routes.rows, enabled: (await getRelaySettings()).enabled });
});

const applySchema = z.object({
  routeId: z.string().min(1),
  vehiclePlate: z.string().trim().min(3).max(20),
  phone: z.string().trim().max(20).optional(),
});

relayRoutes.post("/relay/operator/apply", async (c) => {
  const user = c.get("user");
  const parsed = applySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose a route and enter the number plate." }, 400);
  const d = parsed.data;
  const route = (await db.execute({ sql: "SELECT id FROM relay_routes WHERE id = ? AND active = 1", args: [d.routeId] })).rows[0];
  if (!route) return c.json({ error: "route_not_found", message: "That route isn't available." }, 404);
  const existing = (await db.execute({ sql: "SELECT status FROM relay_operators WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (existing?.status === "suspended") return c.json({ error: "suspended", message: "Your operator account is suspended. Contact support." }, 403);
  // Changing route or plate sends the operator back for approval.
  await db.execute({
    sql: `INSERT INTO relay_operators (user_id, route_id, vehicle_plate, phone, status) VALUES (?, ?, ?, ?, 'pending')
          ON CONFLICT(user_id) DO UPDATE SET route_id = excluded.route_id, vehicle_plate = excluded.vehicle_plate,
            phone = excluded.phone, status = 'pending', updated_at = datetime('now')`,
    args: [user.sub, d.routeId, d.vehiclePlate.toUpperCase(), d.phone ?? null],
  });
  return c.json({ ok: true }, 201);
});

/** Parcels on the operator's matatu, and the ones riders are bringing to it. */
relayRoutes.get("/relay/operator/parcels", async (c) => {
  const user = c.get("user");
  const operator = await approvedOperator(user.sub);
  if (!operator) return c.json({ error: "not_operator", message: "Your operator account isn't approved yet." }, 403);
  const [carrying, incoming, recent] = await Promise.all([
    db.execute({
      sql: `SELECT l.id, l.order_id, l.from_name, l.to_name, l.status, l.handoff_code, l.started_at,
                   last.status AS last_mile_status, u.name AS last_rider_name
            FROM order_relay_legs l
            LEFT JOIN order_relay_legs last ON last.order_id = l.order_id AND last.leg = 3
            LEFT JOIN users u ON u.id = last.provider_id
            WHERE l.leg = 2 AND l.provider_id = ? AND l.status IN ('in_transit', 'arrived') ORDER BY l.started_at`,
      args: [user.sub],
    }),
    db.execute({
      sql: `SELECT l.order_id, l.to_name AS stage_name, o.stage, u.name AS rider_name
            FROM order_relay_legs l JOIN orders o ON o.id = l.order_id LEFT JOIN users u ON u.id = o.rider_id
            WHERE l.leg = 1 AND l.status != 'done' AND l.route_id = ? AND o.stage IN ('Match', 'Fund', 'Shop', 'Deliver') AND o.environment = ?
            ORDER BY o.updated_at DESC LIMIT 30`,
      args: [String(operator.route_id), await getPlatformEnvironment()],
    }),
    db.execute({
      sql: `SELECT l.id, l.order_id, l.from_name, l.to_name, l.handed_over_at, l.paid_amount
            FROM order_relay_legs l WHERE l.leg = 2 AND l.provider_id = ? AND l.status = 'done'
            ORDER BY l.handed_over_at DESC LIMIT 20`,
      args: [user.sub],
    }),
  ]);
  return c.json({ carrying: carrying.rows, incoming: incoming.rows, recent: recent.rows });
});

relayRoutes.post("/relay/operator/receive", async (c) => {
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the rider's code." }, 400);
  try {
    return c.json(await receiveAtMatatu(c.get("user").sub, parsed.data.code));
  } catch (e) {
    return fail(c, e);
  }
});

async function operatorLeg(c: Context): Promise<Row | null> {
  const row = (await db.execute({
    sql: "SELECT * FROM order_relay_legs WHERE id = ? AND leg = 2 AND provider_id = ? AND status IN ('in_transit', 'arrived')",
    args: [c.req.param("id") as string, c.get("user").sub],
  })).rows[0] as Row | undefined;
  return row ?? null;
}

/** The matatu reached the drop stage: tell the last rider and the customer. */
relayRoutes.post("/relay/operator/legs/:id/arrived", async (c) => {
  const leg = await operatorLeg(c);
  if (!leg) return c.json({ error: "not_found", message: "This parcel isn't on your matatu." }, 404);
  await db.execute({ sql: "UPDATE order_relay_legs SET status = 'arrived' WHERE id = ? AND status = 'in_transit'", args: [String(leg.id)] });
  await db.execute({
    sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, 'Deliver', ?, ?)",
    args: [newId("evt"), String(leg.order_id), `Matatu reached ${leg.to_name}`, c.get("user").sub],
  });
  const order = (await db.execute({ sql: "SELECT customer_id, rider_id FROM orders WHERE id = ?", args: [String(leg.order_id)] })).rows[0] as Row | undefined;
  const sends: Promise<void>[] = [];
  if (order?.rider_id) sends.push(notifyUser(String(order.rider_id), { title: "The matatu is at the stage", body: `Collect the parcel at ${leg.to_name}.`, url: `/jobs/${leg.order_id}`, tag: `relay-${leg.order_id}` }));
  if (order?.customer_id) sends.push(notifyUser(String(order.customer_id), { title: "Your parcel reached the stage", body: `It's at ${leg.to_name}, waiting for the last rider.`, url: `/orders/${leg.order_id}`, tag: `order-${leg.order_id}` }));
  await Promise.allSettled(sends);
  return c.json({ ok: true });
});

const locationSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** The matatu's position while it carries the parcel — shown to the customer as the live location. */
relayRoutes.post("/relay/operator/legs/:id/location", async (c) => {
  const leg = await operatorLeg(c);
  if (!leg) return c.json({ error: "not_found" }, 404);
  const parsed = locationSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  if (await hasColumn("orders", "rider_location_updated_at")) {
    await db.execute({
      sql: "UPDATE orders SET rider_lat = ?, rider_lng = ?, rider_location_updated_at = datetime('now') WHERE id = ? AND rider_id IS NULL",
      args: [parsed.data.lat, parsed.data.lng, String(leg.order_id)],
    });
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

relayRoutes.get("/admin/relay/settings", requirePermission("settings.manage"), async (c) => {
  return c.json({ settings: await getRelaySettings(), ready: await relayReady() });
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  minDistanceKm: z.number().min(1).max(500),
  maxAccessKm: z.number().min(0.5).max(100),
  lastMileRadiusKm: z.number().min(0.5).max(100),
  releasePerLeg: z.boolean(),
}).partial();

relayRoutes.put("/admin/relay/settings", requirePermission("settings.manage"), async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const before = await getRelaySettings();
  await setRelaySettings(parsed.data);
  const after = await getRelaySettings();
  await logActivity({ actor: c.get("user"), action: "settings.relay", summary: "Updated relay delivery settings", entityType: "settings", entityId: "relay", before, after, ip: ip(c) });
  return c.json({ settings: after });
});

relayRoutes.get("/admin/relay/routes", requirePermission("settings.manage"), async (c) => {
  if (!(await relayReady())) return c.json({ routes: [], ready: false });
  const res = await db.execute(`SELECT rr.*, (SELECT COUNT(*) FROM relay_operators ro WHERE ro.route_id = rr.id AND ro.status = 'approved') AS operators
                                FROM relay_routes rr ORDER BY rr.active DESC, rr.name`);
  return c.json({ routes: res.rows, ready: true });
});

const routeFields = {
  name: z.string().trim().min(2).max(80),
  stageAName: z.string().trim().min(2).max(80),
  stageALat: z.number().min(-90).max(90),
  stageALng: z.number().min(-180).max(180),
  stageBName: z.string().trim().min(2).max(80),
  stageBLat: z.number().min(-90).max(90),
  stageBLng: z.number().min(-180).max(180),
  parcelFare: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
};

relayRoutes.post("/admin/relay/routes", requirePermission("settings.manage"), async (c) => {
  if (!(await relayReady())) return c.json({ error: "relay_unavailable", message: "Apply migration 0102 first." }, 503);
  const parsed = z.object({ ...routeFields, active: routeFields.active.default(true) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const id = newId("rrt");
  await db.execute({
    sql: `INSERT INTO relay_routes (id, name, stage_a_name, stage_a_lat, stage_a_lng, stage_b_name, stage_b_lat, stage_b_lng, parcel_fare, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, d.name, d.stageAName, d.stageALat, d.stageALng, d.stageBName, d.stageBLat, d.stageBLng, d.parcelFare, d.active ? 1 : 0],
  });
  await logActivity({ actor: c.get("user"), action: "relay.route.create", summary: `Added relay route "${d.name}"`, entityType: "relay_route", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

relayRoutes.patch("/admin/relay/routes/:id", requirePermission("settings.manage"), async (c) => {
  const id = c.req.param("id") as string;
  const before = (await db.execute({ sql: "SELECT * FROM relay_routes WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found" }, 404);
  const parsed = z.object(routeFields).partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const columns: [string, unknown][] = [
    ["name", d.name], ["stage_a_name", d.stageAName], ["stage_a_lat", d.stageALat], ["stage_a_lng", d.stageALng],
    ["stage_b_name", d.stageBName], ["stage_b_lat", d.stageBLat], ["stage_b_lng", d.stageBLng],
    ["parcel_fare", d.parcelFare], ["active", d.active == null ? undefined : d.active ? 1 : 0],
  ];
  const set = columns.filter(([, value]) => value !== undefined);
  if (!set.length) return c.json({ ok: true });
  await db.execute({
    sql: `UPDATE relay_routes SET ${set.map(([column]) => `${column} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    args: [...set.map(([, value]) => value as string | number), id],
  });
  await logActivity({ actor: c.get("user"), action: "relay.route.update", summary: `Updated relay route "${before.name}"`, entityType: "relay_route", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});

relayRoutes.get("/admin/relay/operators", requirePermission("riders.view"), async (c) => {
  if (!(await relayReady())) return c.json({ operators: [] });
  const res = await db.execute(`SELECT ro.*, u.name, u.phone AS account_phone, rr.name AS route_name,
                                       (SELECT COUNT(*) FROM order_relay_legs l WHERE l.leg = 2 AND l.provider_id = ro.user_id AND l.status = 'done') AS parcels
                                FROM relay_operators ro JOIN users u ON u.id = ro.user_id LEFT JOIN relay_routes rr ON rr.id = ro.route_id
                                ORDER BY CASE ro.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, ro.updated_at DESC`);
  return c.json({ operators: res.rows });
});

relayRoutes.post("/admin/relay/operators/:userId/status", requirePermission("riders.verify"), async (c) => {
  const userId = c.req.param("userId") as string;
  const parsed = z.object({ status: z.enum(["approved", "suspended", "pending"]) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const before = (await db.execute({ sql: "SELECT * FROM relay_operators WHERE user_id = ?", args: [userId] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found" }, 404);
  await db.execute({ sql: "UPDATE relay_operators SET status = ?, updated_at = datetime('now') WHERE user_id = ?", args: [parsed.data.status, userId] });
  await logActivity({ actor: c.get("user"), action: "relay.operator.status", summary: `Set matatu operator ${before.vehicle_plate} to ${parsed.data.status}`, entityType: "relay_operator", entityId: userId, before, after: parsed.data, ip: ip(c) });
  if (parsed.data.status === "approved") {
    await notifyUser(userId, { title: "You're approved for relay parcels", body: "Open Relay parcels in the Peebee Car app to receive them.", url: "/relay", tag: "relay-approved" }).catch(() => {});
  }
  return c.json({ ok: true });
});

/** Recent relayed orders with every leg, for oversight. */
relayRoutes.get("/admin/relay/orders", requirePermission("orders.view"), async (c) => {
  if (!(await relayReady())) return c.json({ orders: [] });
  const res = await db.execute(`SELECT l.*, o.stage, o.created_at AS order_created_at, o.environment, u.name AS provider_name
                                FROM order_relay_legs l JOIN orders o ON o.id = l.order_id LEFT JOIN users u ON u.id = l.provider_id
                                WHERE l.order_id IN (SELECT order_id FROM order_relay_legs GROUP BY order_id ORDER BY MAX(created_at) DESC LIMIT 50)
                                ORDER BY o.created_at DESC, l.leg`);
  const byOrder = new Map<string, Row & { legs: Row[] }>();
  for (const row of res.rows as Row[]) {
    const id = String(row.order_id);
    if (!byOrder.has(id)) byOrder.set(id, { id, stage: row.stage, createdAt: row.order_created_at, environment: row.environment, legs: [] });
    byOrder.get(id)!.legs.push({
      leg: row.leg, kind: row.kind, fromName: row.from_name, toName: row.to_name, fee: row.fee, status: row.status,
      providerName: row.provider_name, handedOverAt: row.handed_over_at, paidAmount: row.paid_amount, paidAt: row.paid_at,
    });
  }
  return c.json({ orders: [...byOrder.values()] });
});
