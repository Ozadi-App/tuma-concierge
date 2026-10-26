import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { signToken } from "../auth/jwt.js";
import { allowDemoCatalog } from "../test-support/db.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { reconcilePayment } from "../payments/reconciliation.js";

// The payment mocks settle from a hash of the provider reference; pick a reference that succeeds.
function refWithOutcome(succeeds: boolean): string {
  const hash = (input: string) => { let h = 0; for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0; return h; };
  for (let i = 0; i < 1000; i++) if ((hash(`bag-pay-first-${i}`) % 100 < 8) !== succeeds) return `bag-pay-first-${i}`;
  throw new Error("no reference found");
}

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

// Three Kampala stores (demo marketplace) and a customer in Entebbe.
const ITEMS = [
  { productId: "prod_avocados_pack", storeId: "store_demo_fresh_mart", title: "Hass Avocados (Pack of 3)", price: 5000, quantity: 1 },
  { productId: "prod_sourdough_loaf", storeId: "store_demo_golden_crust", title: "Sourdough Loaf", price: 12000, quantity: 1 },
  { productId: "prod_linen_shirt", storeId: "store_demo_urban_vogue", title: "Linen Shirt", price: 65000, quantity: 1 },
];
const ENTEBBE_DOOR = { destinationLat: 0.06, destinationLng: 32.47 };

type Quote = {
  deliveryFee: number; deliveryMode: "rider" | "relay";
  options: { rider: number; relay: number | null };
  stores: Array<{ storeName: string; deliveryFee: number }>;
  trip: { legs: Array<{ fromName: string; toName: string; km: number }>; totalKm: number; directKm: number; directFee: number; addedKm: number; addedFee: number; fee: number };
  relay: { legs: Array<{ kind: string; fromName: string; distanceKm: number; fee: number }>; doorTotal: number } | null;
};

test("a bag's delivery is the rider's whole road trip, and a long one offers a relay the whole bag rides", async (t) => {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await allowDemoCatalog(client);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "bag-relay-tests-only";
  try {
    for (const [id, role] of [["shopper", "customer"], ["first", "rider"], ["last", "rider"], ["op", "customer"], ["staff", "admin"]]) {
      await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role, wallet_balance) VALUES (?, ?, ?, 'hash', ?, 1000000)", args: [id, id, id, role] });
    }
    await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'staff'");
    await client.execute("INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng) VALUES ('first', 1, 1, 0.3353, 32.5857), ('last', 1, 1, 0.0512, 32.4637)");
    for (const [key, value] of Object.entries({ delivery_rate_per_km: "1000", minimum_delivery_fee: "2000", relay_enabled: "1", relay_min_distance_km: "20", road_distance_factor: "1.3" })) {
      await client.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
    }
    const tokens = Object.fromEntries(await Promise.all(
      [["shopper", "customer"], ["first", "rider"], ["last", "rider"], ["op", "customer"], ["staff", "admin"]].map(async ([sub, role]) => [sub, await signToken({ sub, role } as never)] as const),
    )) as Record<string, string>;
    const call = (who: string, path: string, body?: object) => app.request(`/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = async <T>(res: Response | Promise<Response>) => (await (await res).json()) as T;

    await t.test("one rider: every leg along the road, the direct trip and the distance the other stops add", async () => {
      const quote = await json<Quote>(call("shopper", "/marketplace/checkout/quote", { items: ITEMS, ...ENTEBBE_DOOR }));
      assert.equal(quote.relay, null, "no relay route yet");
      assert.equal(quote.deliveryMode, "rider");
      const { trip } = quote;
      assert.equal(trip.legs.length, 3, "store -> store -> store -> you");
      assert.equal(trip.legs[2].toName, "You");
      assert.ok(Math.abs(trip.legs.reduce((sum, leg) => sum + leg.km, 0) - trip.totalKm) < 0.2);
      assert.ok(trip.totalKm > 40, "Kampala to Entebbe along the road, not the 5 km around the stores");
      assert.equal(trip.directFee + trip.addedFee, trip.fee);
      assert.ok(trip.addedKm > 0 && trip.addedFee > 0, "the extra stops cost what they add");
      assert.equal(quote.stores.reduce((sum, store) => sum + store.deliveryFee, 0), quote.deliveryFee);
      assert.equal(quote.deliveryFee, trip.fee);
      assert.ok(quote.stores.every((store) => store.deliveryFee % 500 === 0), "each store's share is in whole fare steps");
    });

    await t.test("a demo store saved without a map pin still gets its catalogue pin", async () => {
      await client.execute("UPDATE stores SET lat = NULL, lng = NULL WHERE id LIKE 'store_demo_%'");
      const quote = await json<Quote>(call("shopper", "/marketplace/checkout/quote", { items: ITEMS, ...ENTEBBE_DOOR }));
      assert.ok(quote.trip && quote.trip.totalKm > 40, "priced as the real trip, not the flat fee");
    });

    let routeId = "";
    await t.test("staff open the Kampala - Entebbe matatu route", async () => {
      const route = await call("staff", "/admin/relay/routes", {
        name: "Kampala - Entebbe", stageAName: "Kampala taxi park", stageALat: 0.3136, stageALng: 32.5811,
        stageBName: "Entebbe stage", stageBLat: 0.0512, stageBLng: 32.4637, parcelFare: 5000, dropMode: "stage",
      });
      assert.equal(route.status, 201);
      routeId = (await json<{ id: string }>(route)).id;
      await call("op", "/relay/operator/apply", { routeId, vehiclePlate: "UAZ 123K" });
      assert.equal((await call("staff", "/admin/relay/operators/op/status", { status: "approved" })).status, 200);
    });

    let orders: Array<{ id: string; delivery_fee: number; estimated_total: number }> = [];
    let quote: Quote;
    await t.test("a long trip offers the relay by default, with both prices shown", async () => {
      quote = await json<Quote>(call("shopper", "/marketplace/checkout/quote", { items: ITEMS, ...ENTEBBE_DOOR }));
      assert.ok(quote.relay);
      assert.equal(quote.deliveryMode, "relay");
      assert.equal(quote.options.rider, quote.trip.fee);
      assert.equal(quote.options.relay, quote.relay!.doorTotal);
      assert.equal(quote.deliveryFee, quote.relay!.doorTotal);
      assert.ok(quote.relay!.doorTotal < quote.trip.fee, "cheaper than one rider all the way");
      const [first] = quote.relay!.legs;
      assert.equal(first.kind, "boda");
      assert.ok(first.distanceKm > quote.trip.legs[0].km, "the first rider collects from every store before the stage");

      const rider = await json<Quote>(call("shopper", "/marketplace/checkout/quote", { items: ITEMS, ...ENTEBBE_DOOR, deliveryMode: "rider" }));
      assert.equal(rider.deliveryMode, "rider");
      assert.equal(rider.deliveryFee, quote.trip.fee, "or one rider all the way, at its own price");

      const res = await call("shopper", "/marketplace/checkout", { items: ITEMS, paymentRail: "escrow", destinationArea: "Entebbe", ...ENTEBBE_DOOR });
      assert.equal(res.status, 201);
      orders = (await json<{ orders: typeof orders }>(res)).orders;
      assert.equal(orders.length, 3);
      assert.equal(orders.reduce((sum, order) => sum + order.delivery_fee, 0), quote.relay!.doorTotal, "the relay is paid once");
      const legs = (await client.execute("SELECT order_id, leg, fee FROM order_relay_legs ORDER BY order_id, leg")).rows;
      assert.equal(legs.length, 9, "every store's order rides the relay");
      assert.equal(legs.filter((l) => l.order_id !== orders[0].id).every((l) => Number(l.fee) === 0), true, "only the first pickup carries the fees");
    });

    await t.test("one code moves the whole bag through every handoff", async () => {
      const total = orders.reduce((sum, order) => sum + order.estimated_total, 0);
      await client.execute("UPDATE orders SET matching_mode = 'first_to_claim', updated_at = datetime('now', '-1 hour')");
      const claim = await call("first", `/orders/${orders[0].id}/claim`, {});
      assert.equal(claim.status, 200, await claim.clone().text());
      assert.equal((await call("shopper", `/orders/${orders[0].id}/fund`, { paymentMethod: "wallet", useWallet: true, acceptedAmount: total })).status, 200);
      // Skip the shop purchase details: the rider has every store's goods.
      await client.execute("UPDATE orders SET stage = 'Shop' WHERE stage IN ('Fund', 'Match')");
      const leadCode = (await json<{ relay: { legs: Array<{ handoffCode?: string }> } }>(call("first", `/orders/${orders[0].id}`))).relay.legs[0].handoffCode!;

      // Not before the rider has every store's order.
      await client.execute({ sql: "UPDATE orders SET stage = 'Deliver' WHERE id = ?", args: [orders[0].id] });
      assert.equal((await call("op", "/relay/operator/receive", { code: leadCode })).status, 409);
      await client.execute("UPDATE orders SET stage = 'Deliver'");
      assert.equal((await call("op", "/relay/operator/receive", { code: leadCode })).status, 200);
      const afterBoard = (await client.execute("SELECT leg, status FROM order_relay_legs WHERE leg IN (1, 2) ORDER BY leg")).rows;
      assert.ok(afterBoard.filter((l) => Number(l.leg) === 1).every((l) => l.status === "done"), "all three handed to the matatu");
      assert.ok(afterBoard.filter((l) => Number(l.leg) === 2).every((l) => l.status === "in_transit"));

      const carrying = (await json<{ carrying: Array<{ id: string; order_id: string; handoff_code: string }> }>(call("op", "/relay/operator/parcels"))).carrying;
      const leadLeg = carrying.find((p) => p.order_id === orders[0].id)!;
      assert.equal((await call("op", `/relay/operator/legs/${leadLeg.id}/arrived`, {})).status, 200);
      assert.equal((await client.execute("SELECT COUNT(*) AS n FROM order_relay_legs WHERE leg = 2 AND status = 'arrived'")).rows[0].n, 3);

      const open = await json<{ legs: Array<{ id: string; order_id: string }> }>(call("last", "/relay/legs/open"));
      assert.deepEqual(open.legs.map((l) => l.order_id), [orders[0].id], "the bag is one last-mile job");
      assert.equal((await call("last", `/relay/legs/${open.legs[0].id}/claim`, {})).status, 200);
      assert.deepEqual((await client.execute("SELECT DISTINCT rider_id FROM orders")).rows.map((r) => r.rider_id), ["last"]);
      assert.equal((await call("last", `/relay/legs/${open.legs[0].id}/collect`, { code: leadLeg.handoff_code })).status, 200);
      const final = (await client.execute("SELECT leg, status FROM order_relay_legs WHERE leg IN (2, 3)")).rows;
      assert.ok(final.every((l) => (Number(l.leg) === 2 ? l.status === "done" : l.status === "in_transit")), "the last rider has the whole bag");
    });

    await t.test("the pay screen's breakdown: items, subtotal, the relay legs and fees add up to what is charged", async () => {
      for (const [key, value] of Object.entries({ monetization_service_fee_enabled: "1", monetization_service_fee_type: "flat", monetization_service_fee_value: "500", monetization_processing_fee_enabled: "1", monetization_processing_fee_percent: "2", monetization_processing_fee_mode: "customer" })) {
        await client.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
      }
      try {
        const twoStores = [ITEMS[2], { productId: "prod_retro_high_top", storeId: "store_demo_sneaker_hub", title: "Air sneakers", price: 185000, quantity: 1 }];
        const res = await call("shopper", "/marketplace/checkout", { items: twoStores, paymentRail: "escrow", destinationArea: "Entebbe", ...ENTEBBE_DOOR });
        assert.equal(res.status, 201, await res.clone().text());
        const bag = (await json<{ orders: typeof orders }>(res)).orders;
        assert.equal(bag.length, 2);
        type Breakdown = {
          baseAmount: number; mobileMoney: number; wallet: number; cash: number;
          bundle?: { deliveryFee: number };
          items: Array<{ orderId: string; storeName: string | null; name: string; quantity: number; price: number | null }>;
          itemsSubtotal: number;
          delivery: { total: number; mode: string; pickups: string[]; lastMile?: string; legs?: Array<{ kind: string; fromName: string; toName: string; distanceKm: number; fee: number; direction?: string | null }> };
        };
        const quote = await json<Breakdown>(call("shopper", `/orders/${bag[0].id}/checkout`));
        assert.ok(quote.bundle, "the first pickup's quote covers the whole bag");
        assert.equal(quote.items.length, 2);
        assert.deepEqual(quote.items.map((item) => item.price).sort((a, b) => a! - b!), [65000, 185000]);
        assert.equal(new Set(quote.items.map((item) => item.storeName)).size, 2, "each item names its store");
        assert.equal(quote.itemsSubtotal, 65000 + 185000);
        assert.equal(quote.delivery.mode, "relay");
        assert.equal(quote.delivery.lastMile, "door");
        assert.equal(quote.delivery.pickups.length, 2, "the first rider collects from both stores");
        assert.deepEqual(quote.delivery.legs!.map((leg) => leg.kind), ["boda", "matatu", "boda"]);
        assert.match(quote.delivery.legs![1].direction ?? "", /^[A-Z]{2,4} - [A-Z]{2,4}$/, "the matatu leg carries its direction");
        assert.equal(quote.delivery.legs!.reduce((sum, leg) => sum + leg.fee, 0), quote.delivery.total, "the legs make up the delivery charged");
        assert.equal(quote.delivery.total, bag.reduce((sum, order) => sum + order.delivery_fee, 0));
        assert.equal(quote.itemsSubtotal + quote.delivery.total, quote.baseAmount);
        assert.ok(quote.mobileMoney > quote.baseAmount, "fees apply");
        for (const charged of [quote.mobileMoney, quote.wallet, quote.cash]) {
          const fees = charged - quote.baseAmount;
          assert.ok(fees >= 0);
          assert.equal(quote.itemsSubtotal + quote.delivery.total + fees, charged);
        }
        // The order page shows the same breakdown from either store's order.
        const page = await json<Breakdown & { total: number }>(call("shopper", `/orders/${bag[1].id}/breakdown`));
        assert.equal(page.itemsSubtotal, quote.itemsSubtotal);
        assert.equal(page.delivery.total, quote.delivery.total);
        assert.equal(page.total, quote.baseAmount);
        assert.equal((await call("first", `/orders/${bag[1].id}/breakdown`)).status, 403);
      } finally {
        await client.execute("DELETE FROM settings WHERE key LIKE 'monetization_%'");
      }
    });

    const twoStores = [ITEMS[0], ITEMS[1]];
    const stagesOf = async (ids: string[]) => Promise.all(ids.map(async (id) => {
      const row = (await client.execute({ sql: "SELECT stage, rider_id FROM orders WHERE id = ?", args: [id] })).rows[0];
      return `${row.stage}/${row.rider_id ?? "-"}`;
    }));
    await t.test("Relay: a two-store bag is paid in full before any rider, and both stores proceed once the rider is assigned", async () => {
      await client.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('payments_demo_mode', '1')");
      try {
        const res = await call("shopper", "/marketplace/checkout", { items: twoStores, paymentRail: "escrow", destinationArea: "Entebbe", ...ENTEBBE_DOOR });
        assert.equal(res.status, 201, await res.clone().text());
        const bag = (await json<{ orders: typeof orders }>(res)).orders;
        const ids = bag.map((order) => order.id);
        assert.equal(ids.length, 2);
        assert.deepEqual(await stagesOf(ids), ["Create/-", "Create/-"]);
        const quote = await json<{ mobileMoney: number; payBeforeRider: boolean; bundle?: object }>(call("shopper", `/orders/${ids[0]}/checkout`));
        assert.ok(quote.bundle);
        assert.equal(quote.payBeforeRider, true);
        assert.equal(quote.mobileMoney, bag.reduce((sum, order) => sum + order.estimated_total, 0), "the combined total");

        const second = await call("shopper", `/orders/${ids[1]}/fund`, { paymentMethod: "mobile_money", msisdn: "256772123456", acceptedAmount: quote.mobileMoney });
        assert.equal(second.status, 409, "the bag is paid from its first store");
        const paid = await call("shopper", `/orders/${ids[0]}/fund`, { paymentMethod: "mobile_money", msisdn: "256772123456", acceptedAmount: quote.mobileMoney });
        assert.equal(paid.status, 200, await paid.clone().text());
        const payment = (await json<{ payment: { id: string; status: string } }>(paid)).payment;
        assert.equal(payment.status, "pending");
        assert.deepEqual(await stagesOf(ids), ["Fund/-", "Fund/-"]);
        await client.execute({ sql: "UPDATE payments SET provider_ref = ?, created_at = datetime('now', '-1 hour') WHERE id = ?", args: [refWithOutcome(true), payment.id] });
        const child = (await client.execute({ sql: "SELECT id FROM payments WHERE order_id = ?", args: [ids[1]] })).rows[0];
        assert.equal(await reconcilePayment(String(child.id), "test"), "successful", "checking either store's payment resolves the collection");
        assert.deepEqual(await stagesOf(ids), ["Match/-", "Match/-"], "both funded, waiting for a rider");
        const collected = (await client.execute({ sql: `SELECT SUM(amount) AS total FROM payments WHERE order_id IN (?, ?) AND type = 'collection' AND status = 'successful'`, args: ids })).rows[0];
        assert.equal(Number(collected.total), quote.mobileMoney, "both orders are funded with the one payment");

        await client.execute({ sql: "UPDATE orders SET matching_mode = 'first_to_claim', updated_at = datetime('now', '-1 hour') WHERE id IN (?, ?)", args: ids });
        const claim = await call("first", `/orders/${ids[0]}/claim`, {});
        assert.equal(claim.status, 200, await claim.clone().text());
        assert.deepEqual(await stagesOf(ids), ["Shop/first", "Shop/first"], "the rider takes the whole bag and both go straight to Shop");
        assert.equal((await client.execute({ sql: "SELECT COUNT(*) AS n FROM payments WHERE order_id IN (?, ?)", args: ids })).rows[0].n, 2, "no second charge");
        await client.execute({ sql: "UPDATE orders SET stage = 'Settle' WHERE id IN (?, ?)", args: ids });
      } finally {
        await client.execute("DELETE FROM settings WHERE key = 'payments_demo_mode'");
      }
    });

    await t.test("Direct: a one-rider bag still waits for its rider before it can be paid", async () => {
      const res = await call("shopper", "/marketplace/checkout", { items: twoStores, paymentRail: "escrow", destinationArea: "Entebbe", ...ENTEBBE_DOOR, deliveryMode: "rider" });
      assert.equal(res.status, 201, await res.clone().text());
      const bag = (await json<{ orders: typeof orders }>(res)).orders;
      const quote = await json<{ wallet: number; payBeforeRider: boolean }>(call("shopper", `/orders/${bag[0].id}/checkout`));
      assert.equal(quote.payBeforeRider, false);
      const early = await call("shopper", `/orders/${bag[0].id}/fund`, { paymentMethod: "wallet", useWallet: true, acceptedAmount: quote.wallet });
      assert.equal(early.status, 409);
      assert.deepEqual(await stagesOf(bag.map((order) => order.id)), ["Create/-", "Create/-"]);
    });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
