import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { setMatchingModesEnabled } from "../lib/settings.js";
import { resetSchemaCache } from "../lib/schema.js";
import { orderRoutes } from "./routes.js";
import { riderRoutes } from "../riders/routes.js";
import { tripRoutes } from "../passengers/trips.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      const results = await client.batch(statements.map(({ sql, args }) => ({ sql, args: args as InArgs })), "write");
      return results.map((result) => ({ results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } }));
    },
  } as unknown as D1Database);
}

const pickup = { pickupLat: 0.3136, pickupLng: 32.5811, pickupArea: "Kololo" };
const destination = { destinationLat: 0.3476, destinationLng: 32.6, destinationArea: "Ntinda" };

// Production D1 gets migration 0104 by hand, after the code ships. Until then
// everything that exists today must work exactly as before, and the new
// ride options must answer a clean 503 instead of failing.
test("before migration 0104: existing rides work and new ride options degrade cleanly", async (t) => {
  process.env.JWT_SECRET = "local-ride-extras-fallback-secret-only";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  const files = readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.includes("0104_ride_fare_offers_and_stops.sql"));
  for (const file of files.filter((f) => !f.startsWith("0104_"))) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  for (const [id, role] of [["cust", "customer"], ["r1", "rider"]]) {
    await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'h', ?)", args: [id, id, `${id} Rider`, role] });
  }
  await client.execute("INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng) VALUES ('r1', 1, 1, 0.3136, 32.5811)");
  for (const id of ["l1", "l2", "l3"]) await client.execute({ sql: "INSERT INTO lists (id, customer_id, title) VALUES (?, 'cust', 'ride')", args: [id] });
  await setMatchingModesEnabled(["first_to_claim"]);

  const app = new Hono().route("/v1", orderRoutes).route("/v1", riderRoutes);
  const publicApp = new Hono().route("/v1/trips", tripRoutes);
  const tokens = { cust: await signToken({ sub: "cust", role: "customer" }), r1: await signToken({ sub: "r1", role: "rider" }) };
  const call = async (method: string, path: string, who: keyof typeof tokens, body?: unknown) => {
    const res = await app.request(`/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> };
  };
  const rideBody = (listId: string, extra: Record<string, unknown> = {}) => ({ listId, type: "parcel", isRide: true, ...pickup, ...destination, ...extra });
  const unavailable = (r: { status: number; body: Record<string, any> }) => {
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "feature_unavailable");
    assert.equal(r.body.code, "feature_unavailable");
  };

  await t.test("quote still works, with stops and offers switched off so the apps hide them", async () => {
    const r = await call("GET", `/rides/quote?pickupLat=${pickup.pickupLat}&pickupLng=${pickup.pickupLng}&destinationLat=${destination.destinationLat}&destinationLng=${destination.destinationLng}`, "cust");
    assert.equal(r.status, 200);
    assert.ok(r.body.quote > 0);
    assert.equal(r.body.maxStops, 0);
    assert.equal(r.body.offers, null);
  });

  await t.test("booking with stops or an offer answers 503 feature_unavailable", async () => {
    unavailable(await call("POST", "/orders", "cust", rideBody("l1", { stops: [{ area: "Garden City", lat: 0.33, lng: 32.59 }] })));
    unavailable(await call("POST", "/orders", "cust", rideBody("l1", { fareOffer: 3000 })));
  });

  let orderId = "";
  await t.test("a standard ride books, shows in the rider feed, and reads as before", async () => {
    const created = await call("POST", "/orders", "cust", rideBody("l2"));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    orderId = created.body.order.id;
    const feed = await call("GET", "/riders/jobs/available", "r1");
    assert.equal(feed.status, 200);
    const job = (feed.body.jobs as Array<Record<string, any>>).find((j) => j.id === orderId);
    assert.ok(job, "the ride is in the rider feed");
    assert.ok(job.fareOffer == null);
    assert.equal(job.stop_count, 0);
    const detail = await call("GET", `/orders/${orderId}`, "cust");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.rideStops, undefined);
    assert.equal(detail.body.fareOffer, undefined);
    assert.deepEqual(detail.body.feeProposals, []);
    const active = await call("GET", "/orders/active", "cust");
    assert.equal(active.status, 200);
    assert.equal((await call("GET", `/orders/${orderId}/stops`, "cust")).body.stops.length, 0);
    assert.deepEqual((await call("GET", `/orders/${orderId}/fare-counters`, "cust")).body, { fareOffer: null, counters: [] });
  });

  await t.test("the new write endpoints answer 503 feature_unavailable", async () => {
    unavailable(await call("POST", `/orders/${orderId}/fare-offer`, "cust", { amount: 5000 }));
    unavailable(await call("POST", `/orders/${orderId}/fare-counters`, "r1", { amount: 5000 }));
    await client.execute({ sql: "UPDATE orders SET rider_id = 'r1', stage = 'PickedUp' WHERE id = ?", args: [orderId] });
    unavailable(await call("POST", `/orders/${orderId}/stops/1/arrived`, "r1"));
    unavailable(await call("POST", `/orders/${orderId}/stops/1/continue`, "r1"));
  });

  await t.test("fee proposals work as today", async () => {
    const proposed = await call("POST", `/orders/${orderId}/fee-proposals`, "r1", { proposedTotal: 9000, reason: "Traffic" });
    assert.equal(proposed.status, 201, JSON.stringify(proposed.body));
    const detail = await call("GET", `/orders/${orderId}`, "cust");
    assert.equal(detail.body.feeProposals.length, 1);
    const decided = await call("POST", `/orders/${orderId}/fee-proposals/${proposed.body.proposalId}/decision`, "cust", { approve: true });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.equal(decided.body.order.final_total, 9000);
  });

  await t.test("the shared trip link works without stops", async () => {
    await client.execute({ sql: "UPDATE orders SET share_token = 'tok-fallback-0123456789abcdef01' WHERE id = ?", args: [orderId] });
    const shared = await publicApp.request("/v1/trips/tok-fallback-0123456789abcdef01");
    assert.equal(shared.status, 200);
    const trip = ((await shared.json()) as { trip: { stops?: unknown[] } }).trip;
    assert.ok(!trip.stops || trip.stops.length === 0);
  });
  resetSchemaCache();
});
