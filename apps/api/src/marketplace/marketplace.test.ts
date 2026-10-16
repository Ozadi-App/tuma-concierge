import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { signToken } from "../auth/jwt.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql,
    args: [] as unknown[],
    bind(...args: unknown[]) {
      this.args = args;
      return this;
    },
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

test("marketplace routes: public browsing is accessible without authentication", async () => {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) {
      await client.execute(sql);
    }
  }
  bindDatabase(client);

  // 1. Public stores list
  const storesRes = await app.request("/v1/marketplace/stores");
  assert.equal(storesRes.status, 200);
  const storesData = (await storesRes.json()) as any;
  assert.ok(Array.isArray(storesData.stores));
  assert.ok(storesData.stores.length > 0);
  // Verify demo stores have is_live = 1
  const freshMart = storesData.stores.find((s: any) => s.id === "store_demo_fresh_mart");
  assert.ok(freshMart);
  assert.equal(Number(freshMart.is_live), 1);

  // 1b. Public stores sorted nearest first when lat & lng are provided
  const nearRes = await app.request("/v1/marketplace/stores?lat=0.3353&lng=32.5857");
  assert.equal(nearRes.status, 200);
  const nearData = (await nearRes.json()) as any;
  assert.ok(Array.isArray(nearData.stores));
  assert.equal(nearData.stores[0].id, "store_demo_fresh_mart");
  assert.equal(nearData.stores[0].distance_km, 0);
  for (let i = 1; i < nearData.stores.length; i++) {
    const prev = nearData.stores[i - 1].distance_km ?? 999999;
    const curr = nearData.stores[i].distance_km ?? 999999;
    assert.ok(prev <= curr, `stores should be sorted ascending by distance: ${prev} <= ${curr}`);
  }

  // 2. Public live channels rail
  const liveRes = await app.request("/v1/marketplace/live");
  assert.equal(liveRes.status, 200);
  const liveData = (await liveRes.json()) as any;
  assert.ok(Array.isArray(liveData.liveChannels));
  assert.ok(liveData.liveChannels.length > 0);

  // 3. Public spotlight feed
  const spotRes = await app.request("/v1/marketplace/spotlight");
  assert.equal(spotRes.status, 200);
  const spotData = (await spotRes.json()) as any;
  assert.ok(Array.isArray(spotData.spotlight));
  assert.ok(spotData.spotlight.length > 0);

  // 4. Public single product detail
  const prodRes = await app.request("/v1/marketplace/products/prod_honey_glazed_chicken");
  assert.equal(prodRes.status, 200);
  const prodData = (await prodRes.json()) as any;
  assert.ok(prodData.product);
  assert.equal(prodData.product.id, "prod_honey_glazed_chicken");
  assert.equal(prodData.product.image_url, "/products/honey-glazed-chicken.jpg");
  assert.ok(prodData.store);
  assert.equal(prodData.store.id, "store_demo_fresh_mart");

  const blazerRes = await app.request("/v1/marketplace/products/prod_pink_blazer");
  assert.equal(blazerRes.status, 200);
  const blazerData = (await blazerRes.json()) as any;
  assert.ok(blazerData.product);
  assert.equal(blazerData.product.id, "prod_pink_blazer");
  assert.equal(blazerData.product.image_url, "/products/pink-blazer.jpg");

  // 5. Authenticated merchant endpoint rejects without bearer token
  const meStoreRes = await app.request("/v1/merchants/me/store");
  assert.equal(meStoreRes.status, 401);
});

test("marketplace checkout: links orders to delivery system and alerts boda riders", async () => {
  process.env.JWT_SECRET = "marketplace-tests-only";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) {
      await client.execute(sql);
    }
  }
  bindDatabase(client);

  // Setup user and rider
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, status) VALUES ('cust_1', '+256700111222', 'Alice Mukasa', 'hash', 'customer', 'active')");
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, status) VALUES ('rider_1', '+256700333444', 'Bob Boda', 'hash', 'rider', 'active')");
  await client.execute("INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng, area) VALUES ('rider_1', 1, 1, 0.3353, 32.5857, 'Kololo')");

  const customerToken = await signToken({ sub: "cust_1", role: "customer" });
  const riderToken = await signToken({ sub: "rider_1", role: "rider" });

  // Customer checks out items from FreshMart Supermarket
  const checkoutRes = await app.request("/v1/marketplace/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${customerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          productId: "prod_milk_1l",
          storeId: "store_demo_fresh_mart",
          title: "Farm Fresh Whole Milk",
          price: 3500,
          quantity: 2,
          variantTitle: "1 Litre Bottle",
        },
        {
          productId: "prod_eggs_tray",
          storeId: "store_demo_fresh_mart",
          title: "Farm Fresh Eggs",
          price: 13500,
          quantity: 1,
          variantTitle: "Full Tray (30)",
        },
      ],
      paymentMethod: "momo",
      paymentRail: "escrow",
      destinationAddress: "Acacia Mall / Kololo, Kampala",
      destinationArea: "Kololo",
      destinationLat: 0.3353,
      destinationLng: 32.5857,
    }),
  });

  assert.equal(checkoutRes.status, 201);
  const checkoutData = (await checkoutRes.json()) as any;
  assert.equal(checkoutData.ok, true);
  assert.ok(checkoutData.order);
  const orderId = checkoutData.order.id;
  assert.equal(checkoutData.order.store_id, "store_demo_fresh_mart");
  assert.equal(checkoutData.order.stage, "Create");
  assert.equal(checkoutData.order.payment_rail, "escrow");

  // Verify list and items in database
  const listItems = await client.execute({ sql: "SELECT * FROM list_items WHERE list_id = ?", args: [checkoutData.order.list_id] });
  assert.equal(listItems.rows.length, 2);

  // Rider views available jobs feed
  const availableRes = await app.request("/v1/riders/jobs/available", {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  assert.equal(availableRes.status, 200);
  const availableData = (await availableRes.json()) as any;
  const job = availableData.jobs.find((j: any) => j.id === orderId);
  assert.ok(job, "Marketplace order must appear in rider available jobs");
  assert.equal(job.store_name, "FreshMart Supermarket");
  assert.equal(job.store_category, "groceries");

  // Rider previews job shopping list
  const previewRes = await app.request(`/v1/riders/jobs/${orderId}/preview`, {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  assert.equal(previewRes.status, 200);
  const previewData = (await previewRes.json()) as any;
  assert.equal(previewData.items.length, 2);

  // Rider claims job
  const claimRes = await app.request(`/v1/orders/${orderId}/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  assert.equal(claimRes.status, 200);

  // Check order details
  const getOrderRes = await app.request(`/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${riderToken}` },
  });
  assert.equal(getOrderRes.status, 200);
  const getOrderData = (await getOrderRes.json()) as any;
  assert.equal(getOrderData.order.store_name, "FreshMart Supermarket");
  assert.equal(getOrderData.order.rider_id, "rider_1");
});


test("marketplace checkout: a bag from several stores is one delivery, priced exactly and paid once", async () => {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "marketplace-bag-tests-only";
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role, wallet_balance) VALUES ('shopper', 'shopper', 'Shopper', 'hash', 'customer', 1000000), ('boda', 'boda', 'Boda', 'hash', 'rider', 0)");
    await client.execute("INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng) VALUES ('boda', 1, 1, 0.3353, 32.5857)");
    await client.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('delivery_rate_per_km', '1000'), ('minimum_delivery_fee', '2000')");
    const shopper = await signToken({ sub: "shopper", role: "customer" });
    const boda = await signToken({ sub: "boda", role: "rider" });
    const post = (path: string, token: string, body: object) => app.request(`/v1${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const items = [
      { productId: "prod_avocado", storeId: "store_demo_fresh_mart", title: "Hass Avocados", price: 5000, quantity: 1 },
      { productId: "prod_retro_high_top", storeId: "store_demo_sneaker_hub", title: "Air Retro", price: 185000, quantity: 1 },
    ];
    const destination = { destinationLat: 0.3476, destinationLng: 32.5825 };

    const quote = (await (await post("/marketplace/checkout/quote", shopper, { items, ...destination })).json()) as {
      itemsTotal: number; deliveryFee: number; total: number; stores: { deliveryFee: number }[];
    };
    assert.equal(quote.itemsTotal, 190000);
    assert.ok(quote.deliveryFee >= 2000);
    assert.equal(quote.stores.reduce((sum, store) => sum + store.deliveryFee, 0), quote.deliveryFee);
    assert.equal(quote.total, 190000 + quote.deliveryFee);

    const res = await post("/marketplace/checkout", shopper, { items, paymentRail: "escrow", destinationArea: "Kololo", ...destination });
    assert.equal(res.status, 201);
    const { orders } = (await res.json()) as { orders: { id: string; estimated_total: number; delivery_fee: number; delivery_bundle_id: string }[] };
    assert.equal(orders.length, 2);
    assert.ok(orders.every((order) => order.delivery_bundle_id === orders[0].id), "both stores are one delivery");
    assert.deepEqual(orders.map((order) => order.estimated_total - order.delivery_fee), [5000, 185000], "items are not reduced by the delivery fee");
    assert.equal(orders.reduce((sum, order) => sum + order.estimated_total, 0), quote.total, "the orders charge exactly the quote");

    await client.execute("UPDATE orders SET matching_mode = 'first_to_claim', updated_at = datetime('now', '-1 hour')");
    assert.equal((await post(`/orders/${orders[0].id}/claim`, boda, {})).status, 200);
    const fund = await post(`/orders/${orders[0].id}/fund`, shopper, { paymentMethod: "wallet", useWallet: true, acceptedAmount: quote.total });
    assert.equal(fund.status, 200);
    const stages = (await client.execute("SELECT stage, rider_id FROM orders ORDER BY created_at")).rows;
    assert.deepEqual(stages.map((row) => [row.stage, row.rider_id]), [["Shop", "boda"], ["Shop", "boda"]], "one rider, one payment for both stores");
    assert.equal(Number((await client.execute("SELECT wallet_balance FROM users WHERE id = 'shopper'")).rows[0].wallet_balance), 1000000 - quote.total);
  } finally {
    process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});

test("marketplace checkout: a long delivery from one store is relayed by matatu", async () => {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "marketplace-relay-tests-only";
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role) VALUES ('shopper', 'shopper', 'Shopper', 'hash', 'customer')");
    await client.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('delivery_rate_per_km', '2000'), ('minimum_delivery_fee', '2000'), ('relay_enabled', '1')");
    // FreshMart is at Acacia Mall, Kololo; the customer is in Entebbe.
    await client.execute(`INSERT INTO relay_routes (id, name, stage_a_name, stage_a_lat, stage_a_lng, stage_b_name, stage_b_lat, stage_b_lng, parcel_fare, drop_mode)
                          VALUES ('r', 'Kampala - Entebbe', 'Kampala taxi park', 0.3136, 32.5811, 'Entebbe stage', 0.0512, 32.4637, 5000, 'stage')`);
    const shopper = await signToken({ sub: "shopper", role: "customer" });
    const post = (path: string, body: object) => app.request(`/v1${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${shopper}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const items = [{ productId: "prod_avocados_pack", storeId: "store_demo_fresh_mart", title: "Hass Avocados", price: 5000, quantity: 1 }];
    const destination = { destinationLat: 0.06, destinationLng: 32.47 };
    const quote = (await (await post("/marketplace/checkout/quote", { items, ...destination })).json()) as {
      deliveryFee: number; relay: { legs: { kind: string; fee: number }[]; doorTotal: number } | null;
    };
    assert.ok(quote.relay, "relayed");
    assert.deepEqual(quote.relay!.legs.map((leg) => leg.kind), ["boda", "matatu", "boda"]);
    assert.equal(quote.deliveryFee, quote.relay!.doorTotal);
    const res = await post("/marketplace/checkout", { items, paymentRail: "escrow", ...destination });
    const { order } = (await res.json()) as { order: { id: string; delivery_fee: number; estimated_total: number } };
    assert.equal(order.delivery_fee, quote.deliveryFee);
    assert.equal(order.estimated_total, 5000 + quote.deliveryFee);
    assert.equal((await client.execute({ sql: "SELECT COUNT(*) AS n FROM order_relay_legs WHERE order_id = ?", args: [order.id] })).rows[0].n, 3);
  } finally {
    process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
