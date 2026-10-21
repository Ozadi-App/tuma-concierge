import bcrypt from "bcryptjs";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { ensureAccountCode } from "../lib/profile-codes.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { queueReady, removeFromLine } from "./queue.js";
import { getTaxipressSettings, setTaxipressSettings } from "./settings.js";

/**
 * Practice taxis for Taxipress, so a whole booking can be tested end to end in SANDBOX: a passenger with
 * sandbox wallet money, four approved taxis (two 14-seaters, two 18-seaters) and the Kampala ⇄ Entebbe
 * route running both ways. The taxis put themselves back in the line whenever a passenger looks at it,
 * so there is always a taxi to book. Everything has a fixed id, so installing again resets it in place.
 */

type Row = Record<string, unknown>;

const EMAIL_SUFFIX = "@demo.peebee.invalid";
export const DEMO_WALLET_UGX = 2_000_000;
const DEMO_FARE_UGX = 10_000;
const DEMO_RELAY_ID = "tpdemo_relay";

type DemoPerson = { id: string; name: string; phone: string; email: string };
type DemoTaxi = { id: string; driver: DemoPerson; plate: string; layout: "14" | "18"; direction: "a_to_b" | "b_to_a" };

const person = (n: number, slug: string, name: string): DemoPerson => ({
  id: `tpdemo_${slug}`, name, phone: `+25679002${String(n).padStart(4, "0")}`, email: `taxipress.${slug}${EMAIL_SUFFIX}`,
});

export const DEMO_PASSENGER = person(1, "passenger", "Demo Passenger (Taxipress)");

export const DEMO_TAXIS: DemoTaxi[] = [
  { id: "tpdemo_taxi_1", driver: person(2, "driver1", "Demo Driver 1 (Kampala Stage)"), plate: "UAX 101D", layout: "14", direction: "a_to_b" },
  { id: "tpdemo_taxi_2", driver: person(3, "driver2", "Demo Driver 2 (Kampala Stage)"), plate: "UBA 202D", layout: "18", direction: "a_to_b" },
  { id: "tpdemo_taxi_3", driver: person(4, "driver3", "Demo Driver 3 (Entebbe Stage)"), plate: "UAZ 303D", layout: "14", direction: "b_to_a" },
  { id: "tpdemo_taxi_4", driver: person(5, "driver4", "Demo Driver 4 (Entebbe Stage)"), plate: "UBB 404D", layout: "18", direction: "b_to_a" },
];

export const DEMO_ACCOUNTS: Array<DemoPerson & { role: string }> = [
  { ...DEMO_PASSENGER, role: `Passenger (sandbox wallet UGX ${DEMO_WALLET_UGX.toLocaleString("en-UG")})` },
  ...DEMO_TAXIS.map((t) => ({ ...t.driver, role: `Taxi driver · ${t.plate} · ${t.layout}-seater · ${t.direction === "a_to_b" ? "Kampala → Entebbe" : "Entebbe → Kampala"}` })),
];

export class TaxipressDemoError extends Error {
  constructor(public code: string, message: string, public status: 409 | 503 = 409) { super(message); }
}

function userStatement(p: DemoPerson, hash: string, walletUgx: number): DbStatement {
  return {
    sql: `INSERT INTO users (id, phone, email, name, role, password_hash, phone_verified_at, email_verified_at, password_set_at, wallet_balance_sandbox)
          VALUES (?, ?, ?, ?, 'customer', ?, datetime('now'), datetime('now'), datetime('now'), ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, status = 'active', password_set_at = datetime('now'),
            wallet_balance_sandbox = excluded.wallet_balance_sandbox`,
    args: [p.id, p.phone, p.email, p.name, hash, walletUgx],
  };
}

/** The Kampala ⇄ Entebbe relay route: the one staff already made if there is one, otherwise a practice route. */
async function demoRelayRoute(): Promise<string> {
  const existing = (await db.execute({
    sql: `SELECT id FROM relay_routes WHERE active = 1 AND lower(name) LIKE '%kampala%' AND lower(name) LIKE '%entebbe%' ORDER BY (id = ?) DESC, created_at LIMIT 1`,
    args: [DEMO_RELAY_ID],
  })).rows[0] as Row | undefined;
  if (existing) return String(existing.id);
  await db.execute({
    sql: `INSERT INTO relay_routes (id, name, stage_a_name, stage_a_lat, stage_a_lng, stage_b_name, stage_b_lat, stage_b_lng, parcel_fare, active)
          VALUES (?, 'Kampala - Entebbe', 'Kampala Stage', 0.3136, 32.5811, 'Entebbe Stage', 0.0512, 32.4637, 5000, 1)`,
    args: [DEMO_RELAY_ID],
  });
  return DEMO_RELAY_ID;
}

/** Sets up the route in both directions (keeping a fare staff already chose) and returns its Taxipress route ids. */
async function demoRoutes(relayRouteId: string): Promise<Record<"a_to_b" | "b_to_a", string>> {
  const ids = {} as Record<"a_to_b" | "b_to_a", string>;
  for (const direction of ["a_to_b", "b_to_a"] as const) {
    const found = (await db.execute({ sql: "SELECT id FROM taxipress_routes WHERE relay_route_id = ? AND direction = ?", args: [relayRouteId, direction] })).rows[0] as Row | undefined;
    if (found) {
      await db.execute({ sql: "UPDATE taxipress_routes SET active = 1, updated_at = datetime('now') WHERE id = ?", args: [String(found.id)] });
      ids[direction] = String(found.id);
    } else {
      const id = `tpdemo_route_${direction}`;
      await db.execute({
        sql: "INSERT INTO taxipress_routes (id, relay_route_id, direction, fare_per_seat, active) VALUES (?, ?, ?, ?, 1)",
        args: [id, relayRouteId, direction, DEMO_FARE_UGX],
      });
      ids[direction] = id;
    }
  }
  return ids;
}

async function sandboxReady() {
  if (!(await queueReady())) throw new TaxipressDemoError("upgrade_pending", "Taxipress isn't set up yet: apply migrations 0123 and 0124 first.", 503);
  if ((await getPlatformEnvironment()) !== "sandbox") throw new TaxipressDemoError("not_sandbox", "Switch the platform to sandbox first. Practice taxis are sandbox only.");
}

export async function installTaxipressDemo(password: string): Promise<{ count: number }> {
  await sandboxReady();
  const clash = (await db.execute({
    sql: `SELECT phone FROM users WHERE phone IN (${DEMO_ACCOUNTS.map(() => "?").join(",")}) AND id NOT LIKE 'tpdemo_%'`,
    args: DEMO_ACCOUNTS.map((a) => a.phone),
  })).rows as Row[];
  if (clash.length) throw new TaxipressDemoError("phone_in_use", "A real account already uses one of the practice phone numbers.");

  const hash = await bcrypt.hash(password, 10);
  const relayRouteId = await demoRelayRoute();
  await demoRoutes(relayRouteId);

  const statements: DbStatement[] = [userStatement(DEMO_PASSENGER, hash, DEMO_WALLET_UGX)];
  for (const t of DEMO_TAXIS) {
    statements.push(
      userStatement(t.driver, hash, 0),
      {
        sql: `INSERT INTO taxipress_taxis (id, user_id, relay_route_id, plate, seat_layout, seats, passengers_enabled, parcels_enabled, status, approved_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'approved', datetime('now'))
              ON CONFLICT(id) DO UPDATE SET relay_route_id = excluded.relay_route_id, plate = excluded.plate, seat_layout = excluded.seat_layout, seats = excluded.seats,
                passengers_enabled = 1, parcels_enabled = 1, status = 'approved', updated_at = datetime('now')`,
        args: [t.id, t.driver.id, relayRouteId, t.plate, t.layout, Number(t.layout)],
      },
    );
  }
  await executeBatch(statements);
  for (const a of DEMO_ACCOUNTS) await ensureAccountCode(a.id);
  // Customers see Taxipress only while it is on; this is a sandbox, so turn it on for the practice.
  await setTaxipressSettings({ enabled: true });
  await refillDemoLine();
  return { count: DEMO_ACCOUNTS.length };
}

/**
 * Puts every practice taxi that is not already in a line, boarding or on the road back at the end of its
 * home line. Cheap, and a no-op outside the sandbox or before the demo is installed, so the passenger's
 * view of the line can call it every time.
 */
export async function refillDemoLine(): Promise<number> {
  if (!(await queueReady())) return 0;
  const idle = (await db.execute({
    sql: `SELECT x.id, x.user_id, x.seats, x.relay_route_id FROM taxipress_taxis x
          WHERE x.id LIKE 'tpdemo_taxi_%' AND x.status = 'approved' AND x.passengers_enabled = 1
            AND NOT EXISTS (SELECT 1 FROM taxipress_queue q WHERE q.taxi_id = x.id AND q.status IN ('in_line', 'boarding', 'on_road'))
          ORDER BY x.id`,
    args: [],
  })).rows as Row[];
  if (!idle.length) return 0;
  if ((await getPlatformEnvironment()) !== "sandbox" || !(await getTaxipressSettings()).enabled) return 0;

  let joined = 0;
  for (const taxi of idle) {
    const home = DEMO_TAXIS.find((t) => t.id === String(taxi.id));
    if (!home) continue;
    const route = (await db.execute({
      sql: "SELECT id FROM taxipress_routes WHERE relay_route_id = ? AND direction = ? AND active = 1",
      args: [String(taxi.relay_route_id), home.direction],
    })).rows[0] as Row | undefined;
    if (!route) continue;
    try {
      await db.execute({
        // Always one second behind whoever is already waiting, so a rejoining taxi really goes to the back.
        sql: `INSERT INTO taxipress_queue (id, taxipress_route_id, taxi_id, driver_id, seats_total, joined_at)
              VALUES (?, ?, ?, ?, ?, MAX(datetime('now'), COALESCE((SELECT datetime(MAX(joined_at), '+1 second') FROM taxipress_queue WHERE taxipress_route_id = ? AND status IN ('in_line', 'boarding')), datetime('now'))))`,
        args: [newId("tpq"), String(route.id), String(taxi.id), String(taxi.user_id), Number(taxi.seats), String(route.id)],
      });
      joined++;
    } catch {
      // Another request put it back first.
    }
  }
  return joined;
}

export async function taxipressDemoStatus(): Promise<{
  installed: boolean;
  sandbox: boolean;
  accounts: Array<{ name: string; phone: string; email: string; role: string }>;
  line: Array<{ plate: string; status: string; seatsBooked: number; seatsTotal: number; direction: string }>;
}> {
  const ready = await queueReady();
  const installed = ready && Number(((await db.execute("SELECT COUNT(*) AS n FROM taxipress_taxis WHERE id LIKE 'tpdemo_taxi_%'")).rows[0] as Row).n) > 0;
  const rows = installed
    ? ((await db.execute({
        sql: `SELECT x.plate, q.status, q.seats_booked, q.walk_up_seats, q.seats_total, t.direction FROM taxipress_queue q
              JOIN taxipress_taxis x ON x.id = q.taxi_id JOIN taxipress_routes t ON t.id = q.taxipress_route_id
              WHERE x.id LIKE 'tpdemo_taxi_%' AND q.status IN ('in_line', 'boarding', 'on_road') ORDER BY q.joined_at`,
        args: [],
      })).rows as Row[])
    : [];
  return {
    installed,
    sandbox: (await getPlatformEnvironment()) === "sandbox",
    accounts: DEMO_ACCOUNTS.map(({ name, phone, email, role }) => ({ name, phone, email, role })),
    line: rows.map((r) => ({
      plate: String(r.plate), status: String(r.status), seatsBooked: Number(r.seats_booked) + Number(r.walk_up_seats), seatsTotal: Number(r.seats_total),
      direction: r.direction === "a_to_b" ? "Kampala → Entebbe" : "Entebbe → Kampala",
    })),
  };
}

/** Ends every practice trip (a taxi on the road is marked arrived) and lines the practice taxis up again. */
export async function resetDemoLine(): Promise<number> {
  await sandboxReady();
  const active = (await db.execute({
    sql: `SELECT q.id, q.status FROM taxipress_queue q WHERE q.taxi_id LIKE 'tpdemo_taxi_%' AND q.status IN ('in_line', 'boarding', 'on_road')`,
    args: [],
  })).rows as Row[];
  for (const q of active) {
    if (q.status === "on_road") {
      await db.execute({ sql: "UPDATE taxipress_queue SET status = 'arrived', arrived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'on_road'", args: [String(q.id)] });
    } else {
      await removeFromLine(String(q.id), "demo_reset");
    }
  }
  await refillDemoLine();
  return active.length;
}

/** Takes the practice taxis out of the line and locks the accounts; deletes them outright when no booking ever involved them. */
export async function removeTaxipressDemo(): Promise<{ deleted: number; locked: number }> {
  const ids = DEMO_ACCOUNTS.map((a) => a.id);
  const marks = ids.map(() => "?").join(",");
  if (await queueReady()) {
    await db.execute({ sql: "UPDATE taxipress_queue SET status = 'cancelled', ended_reason = 'demo_removed', updated_at = datetime('now') WHERE taxi_id LIKE 'tpdemo_taxi_%' AND status IN ('in_line', 'boarding', 'on_road')", args: [] });
    await db.execute({ sql: "UPDATE taxipress_taxis SET status = 'suspended', updated_at = datetime('now') WHERE id LIKE 'tpdemo_taxi_%'", args: [] });
  }
  let used = false;
  try {
    const bookings = (await db.execute({ sql: `SELECT COUNT(*) AS n FROM taxipress_bookings WHERE passenger_id IN (${marks}) OR driver_id IN (${marks})`, args: [...ids, ...ids] })).rows[0] as Row;
    used = Number(bookings.n) > 0;
  } catch {
    // Booking tables not applied yet: nothing can have been booked.
  }
  if (used) {
    await db.execute({ sql: `UPDATE users SET status = 'suspended', password_hash = '!locked-demo-account' WHERE id IN (${marks})`, args: ids });
    return { deleted: 0, locked: ids.length };
  }
  const ran = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM taxipress_queue WHERE taxi_id LIKE 'tpdemo_taxi_%' AND (ended_reason IS NULL OR ended_reason != 'demo_removed')", args: [] })).rows[0] as Row;
  if (Number(ran.n) > 0) {
    await db.execute({ sql: `UPDATE users SET status = 'suspended', password_hash = '!locked-demo-account' WHERE id IN (${marks})`, args: ids });
    return { deleted: 0, locked: ids.length };
  }
  await executeBatch([
    { sql: "DELETE FROM taxipress_queue WHERE taxi_id LIKE 'tpdemo_taxi_%'", args: [] },
    { sql: "DELETE FROM taxipress_taxis WHERE id LIKE 'tpdemo_taxi_%'", args: [] },
    { sql: `DELETE FROM users WHERE id IN (${marks})`, args: ids },
    { sql: "DELETE FROM taxipress_routes WHERE id LIKE 'tpdemo_route_%'", args: [] },
  ]);
  // The practice relay route goes too, unless staff have since attached anything else to it.
  await db.execute({ sql: "DELETE FROM relay_routes WHERE id = ?", args: [DEMO_RELAY_ID] }).catch(() => undefined);
  return { deleted: ids.length, locked: 0 };
}
