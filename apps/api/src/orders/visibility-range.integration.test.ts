import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { orderRoutes } from "./routes.js";
import { riderRoutes } from "../riders/routes.js";

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

test("riders only see and take orders within their visibility range", async (t) => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "range-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role) VALUES ('customer', 'c', 'Customer', 'hash', 'customer'), ('rider', 'r', 'Rider', 'hash', 'rider')");
    await client.execute("INSERT INTO riders (user_id, verified, is_online, stage_lat, stage_lng) VALUES ('rider', 1, 1, 0, 32.5)");
    await client.execute("INSERT INTO lists (id, customer_id, title) VALUES ('list', 'customer', 'Parcel')");
    // Pickup about 25 km from the rider's stage, open to everyone by now.
    await client.execute(`INSERT INTO orders (id, list_id, customer_id, stage, type, estimated_total, delivery_fee, environment, matching_mode, pickup_lat, pickup_lng, destination_lat, destination_lng, updated_at)
                          VALUES ('far', 'list', 'customer', 'Create', 'parcel', 5000, 5000, 'live', 'first_to_claim', 0.225, 32.5, 0.3, 32.5, datetime('now', '-1 hour'))`);
    const app = new Hono().route("/v1", orderRoutes).route("/v1", riderRoutes);
    const token = await signToken({ sub: "rider", role: "rider" });
    const call = (path: string, body?: object) => app.request(`/v1/${path}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const feed = async () => ((await (await call("riders/jobs/available")).json()) as { jobs: { id: string }[] }).jobs.map((job) => job.id);

    await t.test("the 20 km default hides a 25 km order and blocks claiming it", async () => {
      assert.deepEqual(await feed(), []);
      assert.equal((await call("riders/jobs/far/preview")).status, 403);
      assert.equal((await call("orders/far/claim", {})).status, 403);
    });
    await t.test("a rider's own range overrides the default", async () => {
      await client.execute("UPDATE riders SET visibility_range_km = 30 WHERE user_id = 'rider'");
      assert.deepEqual(await feed(), ["far"]);
      await client.execute("UPDATE riders SET visibility_range_km = 10 WHERE user_id = 'rider'");
      await client.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('rider_visibility_range_km', '50')");
      assert.deepEqual(await feed(), []);
    });
    await t.test("0 means no limit", async () => {
      await client.execute("UPDATE riders SET visibility_range_km = NULL WHERE user_id = 'rider'");
      await client.execute("UPDATE settings SET value = '0' WHERE key = 'rider_visibility_range_km'");
      assert.deepEqual(await feed(), ["far"]);
      assert.equal((await call("orders/far/claim", {})).status, 200);
    });
  } finally {
    process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
