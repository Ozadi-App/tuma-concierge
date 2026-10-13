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

