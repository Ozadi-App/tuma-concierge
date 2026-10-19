import { Hono, type Context } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { requireGasStaff } from "../gas/auth.js";
import { receiveAtStation, relayStationsReady, relayView, releaseToCustomer, RelayError, type StationStaff } from "./service.js";

type Row = Record<string, unknown>;

/**
 * The petrol station's side of a relay, in the Peebee Gas app (mounted at
 * /v1/gas). A matatu drops parcels here; the pump attendant keeps them in the
 * shop and hands each one to the customer (their code) or to a rider (who
 * enters the parcel's code the attendant shows them).
 */
export const relayStationRoutes = new Hono();
relayStationRoutes.use("/relay/*", requireGasStaff);
relayStationRoutes.use("/relay/*", async (c, next) => {
  if (!(await relayStationsReady())) return c.json({ error: "relay_unavailable", message: "Relay parcels aren't set up yet." }, 503);
  await next();
});

const staffOf = (c: Context): StationStaff => c.get("gasActor");

function fail(c: Context, e: unknown) {
  if (e instanceof RelayError) return c.json({ error: e.code, message: e.message }, e.status);
  throw e;
}

/** Parcels coming on a matatu, parcels in the shop, and recent handovers. */
relayStationRoutes.get("/relay/parcels", async (c) => {
  const outletId = staffOf(c).outletId;
  const [incoming, held, recent] = await Promise.all([
    db.execute({
      sql: `SELECT r.order_id, l.from_name, l.status AS matatu_status, ro.vehicle_plate, u.name AS operator_name, l.started_at
            FROM order_relay r JOIN order_relay_legs l ON l.order_id = r.order_id AND l.leg = 2
            LEFT JOIN relay_operators ro ON ro.user_id = l.provider_id LEFT JOIN users u ON u.id = l.provider_id
            WHERE r.outlet_id = ? AND r.drop_mode = 'station' AND r.held_at IS NULL AND l.status IN ('in_transit', 'arrived')
            ORDER BY l.started_at`,
      args: [outletId],
    }),
    db.execute({
      sql: `SELECT r.order_id, r.last_mile, r.held_at, r.release_code, c.name AS customer_name, c.phone AS customer_phone,
                   last.status AS rider_status, ru.name AS rider_name
            FROM order_relay r JOIN orders o ON o.id = r.order_id
            LEFT JOIN users c ON c.id = o.customer_id
            LEFT JOIN order_relay_legs last ON last.order_id = r.order_id AND last.leg = 3
            LEFT JOIN users ru ON ru.id = last.provider_id
            WHERE r.outlet_id = ? AND r.held_at IS NOT NULL AND r.released_at IS NULL
            ORDER BY r.held_at`,
      args: [outletId],
    }),
    db.execute({
      sql: `SELECT r.order_id, r.released_to, r.released_at, c.name AS customer_name
            FROM order_relay r JOIN orders o ON o.id = r.order_id LEFT JOIN users c ON c.id = o.customer_id
            WHERE r.outlet_id = ? AND r.released_at IS NOT NULL ORDER BY r.released_at DESC LIMIT 20`,
      args: [outletId],
    }),
  ]);
  return c.json({
    incoming: incoming.rows,
    // The rider code is only shown once a rider is on the way for it.
    held: (held.rows as Row[]).map((row) => ({
      ...row,
      release_code: row.last_mile === "door" && row.rider_status && row.rider_status !== "waiting" ? row.release_code : null,
    })),
    recent: recent.rows,
  });
});

/** The full journey of one parcel at this station. */
relayStationRoutes.get("/relay/parcels/:orderId", async (c) => {
  const orderId = c.req.param("orderId") as string;
  const relay = (await db.execute({ sql: "SELECT outlet_id FROM order_relay WHERE order_id = ?", args: [orderId] })).rows[0] as Row | undefined;
  if (!relay || relay.outlet_id !== staffOf(c).outletId) return c.json({ error: "not_found" }, 404);
  const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [orderId] })).rows[0] as Row;
  const events = await db.execute({ sql: "SELECT stage, note, created_at FROM order_events WHERE order_id = ? ORDER BY created_at", args: [orderId] });
  return c.json({ order: { id: order.id, stage: order.stage, destinationArea: order.destination_area }, relay: await relayView(order, ""), events: events.rows });
});

const codeSchema = z.object({ code: z.string().trim().min(4).max(12) });

/** The matatu drops a parcel: enter (or scan) the operator's code. */
relayStationRoutes.post("/relay/receive", async (c) => {
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the matatu's code." }, 400);
  try {
    return c.json(await receiveAtStation(staffOf(c), parsed.data.code));
  } catch (e) {
    return fail(c, e);
  }
});

/** The customer collects in person: enter (or scan) the code on their phone. */
relayStationRoutes.post("/relay/release", async (c) => {
  const parsed = codeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the customer's code." }, 400);
  try {
    return c.json(await releaseToCustomer(staffOf(c), parsed.data.code));
  } catch (e) {
    return fail(c, e);
  }
});
