import { signToken } from "../auth/jwt.js";
import { db } from "../db/client.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import {
  claimLastMile,
  collectFromMatatu,
  DEMO_OUTLET_PREFIX,
  handToCustomerAtStage,
  receiveAtMatatu,
  receiveAtStation,
  relayStationsReady,
  releaseToCustomer,
  RELAY_DROP_SANDBOX,
  type StationStaff,
} from "./service.js";
import { getRelaySettings } from "./settings.js";

/**
 * Sandbox relay demo. With no real people at the other end, a sandbox relay
 * parcel would stop at its first handoff. Demo riders, a demo matatu operator
 * per route and demo petrol stations with a demo pump attendant take each step
 * a tester leaves, one step at a time, after the admin's step delay. They act
 * through the same handoff functions (and order routes) real people use, so a
 * sandbox run exercises the real code.
 *
 * Kept out of live: every demo step needs a sandbox order; demo riders stay
 * offline (live matching only looks at online riders); demo stations are stored
 * closed and take relay parcels in sandbox only; demo accounts can't sign in.
 */

type Row = Record<string, unknown>;

const DEMO_PASSWORD = "sandbox-demo-relay-account-disabled";
const DEMO_STATION_ID = "demo-relay-fuel";
/** One demo rider per parcel at a time, so a few cover several testers at once. */
const DEMO_RIDERS = [
  ["demo-relay-rider-1", "Demo rider Okello"],
  ["demo-relay-rider-2", "Demo rider Nakato"],
  ["demo-relay-rider-3", "Demo rider Ssebuufu"],
  ["demo-relay-rider-4", "Demo rider Achieng"],
  ["demo-relay-rider-5", "Demo rider Mugisha"],
  ["demo-relay-rider-6", "Demo rider Namusoke"],
] as const;
const DEMO_RIDER_IDS = new Set<string>(DEMO_RIDERS.map(([id]) => id));

const operatorId = (routeId: string) => `demo-relay-op-${routeId}`;
const isDemoOperator = (id: unknown) => typeof id === "string" && id.startsWith("demo-relay-op-");
export const isDemoRelayRider = (id: unknown) => typeof id === "string" && DEMO_RIDER_IDS.has(id);

/** The demo attendant who works whichever station holds a sandbox parcel. */
const demoAttendant = (outletId: string): StationStaff => ({ kind: "attendant", id: `demo-relay-att-${outletId}`, outletId, name: "Demo pump attendant" });

export async function sandboxDemoReady(): Promise<boolean> {
  return (await hasTable("order_relay")) && (await hasTable("order_relay_legs")) && (await hasColumn("fuel_station_outlets", "relay_drop"));
}

async function ensureUser(id: string, name: string, role: "rider" | "customer") {
  await db.execute({
    sql: "INSERT OR IGNORE INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, ?, ?)",
    args: [id, id, name, DEMO_PASSWORD, role],
  });
}

let ridersReady = false;
async function ensureDemoRiders() {
  if (ridersReady) return;
  for (const [id, name] of DEMO_RIDERS) {
    await ensureUser(id, name, "rider");
    await db.execute({
      sql: `INSERT OR IGNORE INTO riders (user_id, verified, is_online, area, vehicle_info, subscription_status, subscription_paid_through)
            VALUES (?, 1, 0, 'Sandbox demo', 'Demo boda', 'active', '2099-12-31')`,
      args: [id],
    });
  }
  ridersReady = true;
}

/** The route's demo matatu, approved on that route only. */
async function ensureDemoOperator(routeId: string): Promise<string> {
  const id = operatorId(routeId);
  await ensureUser(id, "Demo matatu", "customer");
  await db.execute({
    sql: "INSERT OR IGNORE INTO relay_operators (user_id, route_id, vehicle_plate, status) VALUES (?, ?, 'DEMO 001', 'approved')",
    args: [id, routeId],
  });
  return id;
}

/**
 * A demo petrol station at both ends of every active route and at each of its
 * stages, so sandbox parcels have a station near the customer. Stored 'closed'
 * so no live list shows them; relay_drop 2 limits them to sandbox.
 */
export async function ensureDemoStations(): Promise<number> {
  if (!(await relayStationsReady())) return 0;
  await db.execute({
    sql: "INSERT OR IGNORE INTO fuel_stations (id, brand_name, company_name, status) VALUES (?, 'Peebee Demo Fuel', 'Peebee (sandbox demo)', 'active')",
    args: [DEMO_STATION_ID],
  });
  const routes = (await db.execute("SELECT * FROM relay_routes WHERE active = 1")).rows as Row[];
  const spots: Array<{ key: string; name: string; lat: number; lng: number }> = [];
  for (const route of routes) {
    spots.push({ key: `${route.id}-a`, name: String(route.stage_a_name), lat: Number(route.stage_a_lat), lng: Number(route.stage_a_lng) });
    spots.push({ key: `${route.id}-b`, name: String(route.stage_b_name), lat: Number(route.stage_b_lat), lng: Number(route.stage_b_lng) });
  }
  if (await hasTable("relay_route_stages")) {
    const stages = (await db.execute("SELECT s.* FROM relay_route_stages s JOIN relay_routes r ON r.id = s.route_id WHERE s.active = 1 AND r.active = 1 AND s.outlet_id IS NULL")).rows as Row[];
    for (const stage of stages) spots.push({ key: String(stage.id), name: String(stage.name), lat: Number(stage.lat), lng: Number(stage.lng) });
  }
  for (const spot of spots) {
    const outletId = `${DEMO_OUTLET_PREFIX}${spot.key}`;
    // A few hundred metres from the stage, like a real roadside station.
    await db.execute({
      sql: `INSERT OR IGNORE INTO fuel_station_outlets (id, station_id, name, code, address, lat, lng, status, relay_drop)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [outletId, DEMO_STATION_ID, `${spot.name} (demo)`, `DEMO-${spot.key}`.toUpperCase(), `Near ${spot.name}`,
        spot.lat + 0.002, spot.lng + 0.002, "closed", RELAY_DROP_SANDBOX],
    });
    const attendant = demoAttendant(outletId);
    await db.execute({
      sql: `INSERT OR IGNORE INTO fuel_pump_attendants (id, outlet_id, attendant_code, full_name, phone, status, pin)
            VALUES (?, ?, ?, ?, '0700000000', 'on_duty', ?)`,
      args: [attendant.id, outletId, `DEMO-ATT-${spot.key}`.toUpperCase(), attendant.name, DEMO_PASSWORD],
    });
  }
  return spots.length;
}

async function freeDemoRider(): Promise<string | null> {
  await ensureDemoRiders();
  const busy = new Set(((await db.execute({
    sql: `SELECT rider_id FROM orders WHERE environment = 'sandbox' AND rider_id IN (${DEMO_RIDERS.map(() => "?").join(",")}) AND stage NOT IN ('Settle', 'Cancelled')`,
    args: DEMO_RIDERS.map(([id]) => id),
  })).rows as Row[]).map((row) => String(row.rider_id)));
  return DEMO_RIDERS.find(([id]) => !busy.has(id))?.[0] ?? null;
}

/** An order route called as a demo user, so its checks and side effects are the real ones. */
async function asUser(userId: string, role: "rider" | "customer", path: string, body: object = {}): Promise<boolean> {
  const { default: app } = await import("../app.js");
  const token = await signToken({ sub: userId, role });
  const res = await app.request(`/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

const legOf = (legs: Row[], n: number) => legs.find((leg) => Number(leg.leg) === n);

/**
 * One demo step for a sandbox relay parcel, if one is due. Returns what was done
 * (for tests and logs), or null when the order waits on the customer, a real
 * tester acted recently, or the demo is off.
 */
export async function stepSandboxRelay(orderId: string, opts: { force?: boolean } = {}): Promise<string | null> {
  const settings = await getRelaySettings();
  if (!settings.sandboxDemo || !(await sandboxDemoReady())) return null;
  const order = (await db.execute({
    sql: `SELECT o.*, (SELECT MAX(created_at) FROM order_events e WHERE e.order_id = o.id) AS last_event_at
          FROM orders o WHERE o.id = ? AND o.environment = 'sandbox' AND o.type = 'parcel' AND o.stage NOT IN ('Settle', 'Cancelled')`,
    args: [orderId],
  })).rows[0] as Row | undefined;
  if (!order) return null;
  const legs = (await db.execute({ sql: "SELECT * FROM order_relay_legs WHERE order_id = ? ORDER BY leg", args: [orderId] })).rows as Row[];
  const relay = (await db.execute({ sql: "SELECT * FROM order_relay WHERE order_id = ?", args: [orderId] })).rows[0] as Row | undefined;
  const [l1, l2, l3] = [legOf(legs, 1), legOf(legs, 2), legOf(legs, 3)];
  if (!l1 || !l2 || !relay) return null;

  // Give a real tester the step delay to act first.
  if (!opts.force) {
    const last = [order.updated_at, order.last_event_at].filter(Boolean).map((t) => Date.parse(`${String(t).replace(" ", "T")}Z`)).filter(Number.isFinite);
    if (last.length && Date.now() - Math.max(...last) < settings.sandboxDemoStepSeconds * 1000) return null;
  }

  const rider = order.rider_id ? String(order.rider_id) : null;
  const stage = String(order.stage);
  try {
    // 1. A demo rider takes the first leg. A relay the customer paid first (it waits in
    //    Match, escrow held) goes straight to Shop on assignment, so there is no payment wait;
    //    one still being paid (Fund) waits for the payment to finish.
    if (["Create", "Match"].includes(stage) && !rider && l1.status !== "done") {
      const demo = await freeDemoRider();
      if (!demo) return null;
      const { assignRider } = await import("../orders/routes.js");
      const name = DEMO_RIDERS.find(([id]) => id === demo)![1];
      return (await assignRider(orderId, order, demo, name, false)) ? "first rider assigned" : null;
    }
    // (Paying is the customer's step: before this rider for a relay paid first, otherwise now.)
    // 2. The demo rider sets off.
    if (stage === "Shop" && isDemoRelayRider(rider) && l1.status !== "done") {
      return (await asUser(rider!, "rider", `/orders/${orderId}/deliver`, {})) ? "first rider set off" : null;
    }
    // 3. The demo matatu takes the parcel at the boarding stage, with the rider's code.
    if (stage === "Deliver" && l1.status !== "done" && rider && l2.status === "waiting") {
      await receiveAtMatatu(await ensureDemoOperator(String(l1.route_id)), String(l1.handoff_code));
      return "matatu received";
    }
    // 4. The demo matatu drives: a position close to the drop (the "arriving soon" alert), then arrival.
    if (l2.status === "in_transit" && isDemoOperator(l2.provider_id)) {
      if (order.rider_lat == null) {
        const at = (from: unknown, to: unknown) => Number(from) + (Number(to) - Number(from)) * 0.85;
        await asUser(String(l2.provider_id), "customer", `/relay/operator/legs/${l2.id}/location`, { lat: at(l2.from_lat, l2.to_lat), lng: at(l2.from_lng, l2.to_lng) });
        return "matatu nearly there";
      }
      return (await asUser(String(l2.provider_id), "customer", `/relay/operator/legs/${l2.id}/arrived`, {})) ? "matatu arrived" : null;
    }
    if (l2.status === "arrived" && isDemoOperator(l2.provider_id)) {
      // 5a. Meeting at a stage: the customer shows their code to the conductor.
      if (relay.meet_stage_id && relay.last_mile === "collect" && !relay.missed_at && relay.collect_code) {
        await handToCustomerAtStage(String(l2.provider_id), String(relay.collect_code));
        return "handed to customer at the stage";
      }
      // 5b. Petrol-station drop: the demo attendant takes it in with the matatu's code.
      if (relay.drop_mode === "station" && relay.outlet_id && !relay.held_at) {
        await receiveAtStation(demoAttendant(String(relay.outlet_id)), String(l2.handoff_code));
        return "station received";
      }
    }
    // 6. At the station: the customer comes for it, or a demo rider takes it to the door.
    if (relay.drop_mode === "station" && relay.held_at && !relay.released_at && relay.outlet_id) {
      if (relay.last_mile === "collect" && relay.collect_code) {
        await releaseToCustomer(demoAttendant(String(relay.outlet_id)), String(relay.collect_code));
        return "customer collected at the station";
      }
    }
    // 7. The last mile: a demo rider claims it and collects from the matatu (stage drop) or the station.
    if (l3 && l3.status === "open" && !rider) {
      const demo = await freeDemoRider();
      if (!demo) return null;
      await claimLastMile(demo, String(l3.id), { demo: true });
      return "last rider assigned";
    }
    if (l3 && l3.status === "assigned" && isDemoRelayRider(l3.provider_id)) {
      const code = relay.drop_mode === "station" ? relay.release_code : l2.handoff_code;
      if (!code) return null;
      await collectFromMatatu(String(l3.provider_id), String(l3.id), String(code));
      return relay.drop_mode === "station" ? "last rider collected at the station" : "last rider collected from the matatu";
    }
    // 8. At the door: the demo rider arrives; the customer confirms with their PIN; the rider settles.
    if (l3 && l3.status === "in_transit" && stage === "Deliver" && isDemoRelayRider(rider)) {
      return (await asUser(rider!, "rider", `/orders/${orderId}/arrived`, {})) ? "last rider at the door" : null;
    }
    if (stage === "Handover" && isDemoRelayRider(rider)) {
      return (await asUser(rider!, "rider", `/orders/${orderId}/settle`, {})) ? "settled" : null;
    }
  } catch (err) {
    // A real tester got there first, or the order changed: the next step will see the new state.
    console.warn(`Sandbox relay demo step skipped for ${orderId}:`, err instanceof Error ? err.message : err);
  }
  return null;
}

/** Every open sandbox relay parcel gets its next due step (the cron heartbeat). */
export async function sweepSandboxRelay(): Promise<number> {
  const settings = await getRelaySettings();
  if (!settings.sandboxDemo || !(await sandboxDemoReady())) return 0;
  await ensureDemoStations();
  const open = (await db.execute(`SELECT o.id FROM orders o JOIN order_relay r ON r.order_id = o.id
                                  WHERE o.environment = 'sandbox' AND o.type = 'parcel' AND o.stage NOT IN ('Settle', 'Cancelled')
                                  ORDER BY o.created_at DESC LIMIT 50`)).rows as Row[];
  let steps = 0;
  for (const row of open) if (await stepSandboxRelay(String(row.id))) steps += 1;
  return steps;
}
