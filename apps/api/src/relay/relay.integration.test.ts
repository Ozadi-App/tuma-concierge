import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { orderRoutes } from "../orders/routes.js";
import { relayRoutes } from "./routes.js";

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

// Kampala taxi park <-> Entebbe stage, with a pickup and a door near each end.
const KAMPALA = { lat: 0.3136, lng: 32.5811 };
const ENTEBBE = { lat: 0.0512, lng: 32.4637 };
const PICKUP = { lat: 0.33, lng: 32.59 };
const DOOR = { lat: 0.06, lng: 32.47 };

test("relay delivery: boda -> matatu -> boda with coded handoffs and split payouts", async (t) => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "relay-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  try {
    for (const [id, role] of [["customer", "customer"], ["first", "rider"], ["last", "rider"], ["op", "customer"], ["staff", "admin"]]) {
      await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'hash', ?)", args: [id, id, id, role] });
    }
    await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'staff'");
    await client.execute({ sql: "INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng) VALUES ('first', 1, 1, ?, ?), ('last', 1, 1, ?, ?)", args: [PICKUP.lat, PICKUP.lng, ENTEBBE.lat, ENTEBBE.lng] });
    await client.execute("INSERT INTO lists (id, customer_id, title) VALUES ('list', 'customer', 'Parcel'), ('short', 'customer', 'Short'), ('cash', 'customer', 'Cash')");
    for (const [key, value] of Object.entries({ delivery_rate_per_km: "2000", minimum_delivery_fee: "2000", relay_enabled: "1", relay_release_per_leg: "1" })) {
      await client.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
    }

    const app = new Hono().route("/v1", orderRoutes).route("/v1", relayRoutes);
    const tokens = Object.fromEntries(await Promise.all(
      [["customer", "customer"], ["first", "rider"], ["last", "rider"], ["op", "customer"], ["staff", "admin"]].map(async ([sub, role]) => [sub, await signToken({ sub, role } as never)] as const),
    ));
    const call = (who: string, path: string, body?: object, method?: string) => app.request(`/v1/${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const parcel = (listId: string, from: typeof PICKUP, to: typeof DOOR, paymentRail = "escrow") => call("customer", "orders", {
      listId, type: "parcel", paymentRail,
      pickupArea: "Nakasero", pickupLat: from.lat, pickupLng: from.lng,
      destinationArea: "Entebbe", destinationLat: to.lat, destinationLng: to.lng,
    });
    const wallet = async (table: string, id: string) => Number((await client.execute({ sql: `SELECT wallet_balance FROM ${table} WHERE ${table === "riders" ? "user_id" : "id"} = ?`, args: [id] })).rows[0].wallet_balance);

    let routeId = "";
    await t.test("staff add a route and approve an operator", async () => {
      const created = await call("staff", "admin/relay/routes", {
        name: "Kampala - Entebbe", stageAName: "Kampala taxi park", stageALat: KAMPALA.lat, stageALng: KAMPALA.lng,
        stageBName: "Entebbe stage", stageBLat: ENTEBBE.lat, stageBLng: ENTEBBE.lng, parcelFare: 5000,
      });
      assert.equal(created.status, 201);
      routeId = ((await created.json()) as { id: string }).id;
      assert.equal((await call("op", "relay/operator/apply", { routeId, vehiclePlate: "uaz 123k" })).status, 201);
      assert.equal((await call("op", "relay/operator/parcels")).status, 403);
      assert.equal((await call("staff", "admin/relay/operators/op/status", { status: "approved" })).status, 200);
    });

    let orderId = "";
    let total = 0;
    await t.test("a long parcel is relayed and priced as the sum of its legs", async () => {
      const quote = (await (await call("customer", `relay/quote?pickupLat=${PICKUP.lat}&pickupLng=${PICKUP.lng}&destinationLat=${DOOR.lat}&destinationLng=${DOOR.lng}`)).json()) as { relay: { total: number; legs: { fee: number; kind: string }[] } };
      assert.deepEqual(quote.relay.legs.map((leg) => leg.kind), ["boda", "matatu", "boda"]);
      assert.equal(quote.relay.legs[1].fee, 5000);
      assert.equal(quote.relay.total, quote.relay.legs.reduce((sum, leg) => sum + leg.fee, 0));

      const res = await parcel("list", PICKUP, DOOR);
      assert.equal(res.status, 201);
      const order = ((await res.json()) as { order: { id: string; estimated_total: number; delivery_fee: number } }).order;
      orderId = order.id;
      total = order.estimated_total;
      assert.equal(total, quote.relay.total);
      assert.equal(order.delivery_fee, total);
      const legs = (await client.execute({ sql: "SELECT leg, status FROM order_relay_legs WHERE order_id = ? ORDER BY leg", args: [orderId] })).rows;
      assert.deepEqual(legs.map((l) => [l.leg, l.status]), [[1, "waiting"], [2, "waiting"], [3, "waiting"]]);
    });

    await t.test("short parcels go on one boda and relays can't be paid in cash", async () => {
      const short = await parcel("short", PICKUP, KAMPALA);
      assert.equal(short.status, 201);
      const shortId = ((await short.json()) as { order: { id: string } }).order.id;
      assert.equal((await client.execute({ sql: "SELECT COUNT(*) AS n FROM order_relay_legs WHERE order_id = ?", args: [shortId] })).rows[0].n, 0);
      assert.equal((await parcel("cash", PICKUP, DOOR, "float")).status, 409);
    });

    let leg1Code = "";
    await t.test("the first rider hands the parcel to the matatu with their code", async () => {
      await client.execute({ sql: "UPDATE orders SET rider_id = 'first', stage = 'Deliver', pin_code = '4321', payment_rail = 'escrow' WHERE id = ?", args: [orderId] });
      await client.execute({ sql: "INSERT INTO payments (id, order_id, type, provider, amount, currency, status) VALUES ('pay', ?, 'collection', 'wallet', ?, 'UGX', 'successful')", args: [orderId, total] });
      const view = (await (await call("first", `orders/${orderId}`)).json()) as { relay: { legs: { handoffCode?: string }[] } };
      leg1Code = view.relay.legs[0].handoffCode!;
      assert.match(leg1Code, /^\d{6}$/);
      const customerView = (await (await call("customer", `orders/${orderId}`)).json()) as { relay: { legs: { handoffCode?: string }[] } };
      assert.equal(customerView.relay.legs[0].handoffCode, undefined);

      assert.equal((await call("first", `orders/${orderId}/arrived`, {})).status, 409);
      assert.equal((await call("op", "relay/operator/receive", { code: "000000" })).status, 404);
      assert.equal((await call("op", "relay/operator/receive", { code: leg1Code })).status, 200);
      assert.equal((await call("op", "relay/operator/receive", { code: leg1Code })).status, 404);
      const order = (await client.execute({ sql: "SELECT rider_id, stage FROM orders WHERE id = ?", args: [orderId] })).rows[0];
      assert.deepEqual([order.rider_id, order.stage], [null, "Deliver"]);
      assert.ok((await wallet("riders", "first")) > 0, "leg 1 is paid at its handoff");
    });

    await t.test("the last rider claims, collects with the operator's code and delivers", async () => {
      const open = (await (await call("last", "relay/legs/open")).json()) as { legs: { id: string }[] };
      assert.equal(open.legs.length, 1);
      const legId = open.legs[0].id;
      assert.equal((await call("last", `relay/legs/${legId}/claim`, {})).status, 200);
      assert.equal((await call("first", `relay/legs/${legId}/claim`, {})).status, 409);
      assert.equal((await call("last", `orders/${orderId}/arrived`, {})).status, 409);
      assert.equal((await call("customer", `orders/${orderId}/handover`, { pin: "4321" })).status, 409);

      const parcels = (await (await call("op", "relay/operator/parcels")).json()) as { carrying: { id: string; handoff_code: string }[] };
      assert.equal(parcels.carrying.length, 1);
      assert.equal((await call("op", `relay/operator/legs/${parcels.carrying[0].id}/arrived`, {})).status, 200);
      assert.equal((await call("last", `relay/legs/${legId}/collect`, { code: "999999" })).status, 400);
      assert.equal((await call("last", `relay/legs/${legId}/collect`, { code: parcels.carrying[0].handoff_code })).status, 200);
      assert.ok((await wallet("users", "op")) > 0, "the matatu leg is paid at its handoff");

      assert.equal((await call("last", `orders/${orderId}/arrived`, {})).status, 200);
      assert.equal((await call("customer", `orders/${orderId}/handover`, { pin: "4321" })).status, 200);
      assert.equal((await call("last", `orders/${orderId}/settle`, {})).status, 200);

      const paid = (await wallet("riders", "first")) + (await wallet("users", "op")) + (await wallet("riders", "last"));
      assert.equal(paid, total, "the three legs share exactly what one rider would have been paid");
      const legs = (await client.execute({ sql: "SELECT leg, status, paid_amount FROM order_relay_legs WHERE order_id = ? ORDER BY leg", args: [orderId] })).rows;
      assert.deepEqual(legs.map((l) => l.status), ["done", "done", "done"]);
      const view = (await (await call("customer", `orders/${orderId}`)).json()) as { relay: { legs: { handedOverAt: string | null }[] } };
      assert.ok(view.relay.legs.every((leg) => leg.handedOverAt), "every handoff is timestamped");
    });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
