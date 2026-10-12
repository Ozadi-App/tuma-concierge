import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";

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
