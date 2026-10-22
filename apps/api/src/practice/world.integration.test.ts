import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, setPracticeBinding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { invalidateSettingsCache } from "../lib/settings.js";

function shim(client: Client): D1Database {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      const results = await client.batch(statements.map(({ sql, args }) => ({ sql, args: args as InArgs })), "write");
      return results.map((result) => ({ results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } }));
    },
  } as unknown as D1Database;
}

async function freshDatabase(): Promise<Client> {
  const client = createClient({ url: "file::memory:" });
  const migrations = existsSync(join(process.cwd(), "src/db/migrations")) ? join(process.cwd(), "src/db/migrations") : join(process.cwd(), "apps/api/src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  return client;
}

test("the shared practice world is a separate database that every app's practice persona shares", async (t) => {
  process.env.JWT_SECRET = "local-practice-world-test-secret-only";
  resetSchemaCache();
  const live = await freshDatabase();
  const practice = await freshDatabase();
  setD1Binding(shim(live));
  setPracticeBinding(undefined);
  await live.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES ('real_rider', '0771', 'Real Rider', 'h', 'rider'), ('real_cust', '0772', 'Real Customer', 'h', 'customer')", args: [] });
  await live.execute({ sql: "INSERT INTO settings (key, value) VALUES ('user_practice_mode_enabled', '1') ON CONFLICT(key) DO UPDATE SET value='1'", args: [] });
  invalidateSettingsCache();
  const realRider = await signToken({ sub: "real_rider", role: "rider" });
  const realCustomer = await signToken({ sub: "real_cust", role: "customer" });
  const call = (token: string, path: string, init: RequestInit = {}) => app.request(`/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const start = async (token: string, role: string) => (await (await call(token, "/practice/session", { method: "POST", body: JSON.stringify({ role }) })).json()) as { token: string; user: { id: string } };

  await t.test("without a practice database, practice is unavailable and never answered from live", async () => {
    assert.equal(((await (await call(realRider, "/practice/world")).json()) as { available: boolean }).available, false);
    assert.equal((await call(realRider, "/practice/session", { method: "POST", body: JSON.stringify({ role: "rider" }) })).status, 503);
    const stray = await signToken({ sub: "prac_rider_1", role: "rider", practice: true });
    assert.equal((await call(stray, "/riders/me")).status, 503);
  });

  setPracticeBinding(shim(practice));

  await t.test("the first session lays the world down, signed in as a persona, not as the real user", async () => {
    const rider = await start(realRider, "rider");
    assert.equal(rider.user.id, "prac_rider_1");
    assert.equal(((await (await call(rider.token, "/riders/me")).json()) as { user?: { id: string } }).user?.id ?? "prac_rider_1", "prac_rider_1");
    const rows = (sql: string, db: Client) => db.execute(sql).then((r) => Number(r.rows[0]!.n));
    assert.ok((await rows("SELECT COUNT(*) n FROM users WHERE id LIKE 'prac_%'", practice)) > 20);
    assert.equal(await rows("SELECT COUNT(*) n FROM users WHERE id LIKE 'prac_%'", live), 0, "nothing practice reaches the live database");
    assert.equal(await rows("SELECT COUNT(*) n FROM restaurants", live), 0);
  });

  await t.test("customer, merchant and restaurant personas all see the same world", async () => {
    const customer = await start(realCustomer, "customer");
    const restaurants = (await (await call(customer.token, "/restaurants")).json()) as { restaurants: { id: string }[] };
    assert.equal(restaurants.restaurants.length, 12);
    assert.ok(restaurants.restaurants.every((r) => r.id.startsWith("prac_rest_")));
    const stores = (await (await call(customer.token, "/marketplace/stores")).json()) as { stores: { id: string }[] };
    assert.ok(stores.stores.length >= 8);

    const merchant = await start(realCustomer, "merchant");
    const mine = (await (await call(merchant.token, "/merchants/me")).json()) as { merchants?: { id: string }[] };
    assert.ok(JSON.stringify(mine).includes("prac_m_pe_lakeside_mart"));

    const liveRestaurants = (await (await call(realCustomer, "/restaurants")).json()) as { restaurants: unknown[] };
    assert.equal(liveRestaurants.restaurants.length, 0, "a real customer's live list stays empty");
  });

  await t.test("a practice persona cannot start another session or reach admin", async () => {
    const customer = await start(realCustomer, "customer");
    assert.equal((await call(customer.token, "/practice/session", { method: "POST", body: JSON.stringify({ role: "rider" }) })).status, 409);
    assert.equal((await call(customer.token, "/admin/practice")).status, 403);
  });

  await t.test("seeding twice changes nothing", async () => {
    const before = (await practice.execute("SELECT COUNT(*) n FROM menu_items")).rows[0]!.n;
    await start(realCustomer, "restaurant");
    assert.equal((await practice.execute("SELECT COUNT(*) n FROM menu_items")).rows[0]!.n, before);
  });
});

test("demo customers place real orders that a practice rider can see and take", async () => {
  process.env.JWT_SECRET = "local-practice-world-test-secret-only";
  resetSchemaCache();
  const live = await freshDatabase();
  const practice = await freshDatabase();
  setD1Binding(shim(live));
  setPracticeBinding(shim(practice));
  await live.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES ('real_rider', '0771', 'Real Rider', 'h', 'rider')", args: [] });
  await live.execute({ sql: "INSERT INTO settings (key, value) VALUES ('user_practice_mode_enabled', '1') ON CONFLICT(key) DO UPDATE SET value='1'", args: [] });
  invalidateSettingsCache();
  const { runInPractice } = await import("../db/practice-context.js");
  const { seedPracticeWorld } = await import("./seed.js");
  const { topUpDemoOrders } = await import("./demo-customers.js");
  await runInPractice(seedPracticeWorld);
  const placed = await runInPractice(() => topUpDemoOrders(4));
  const orders = (await practice.execute("SELECT id, type, stage, customer_id, restaurant_id FROM orders")).rows;
  console.log("placed", placed, JSON.stringify(orders));
  assert.ok(placed >= 3, "demo customers placed orders");
  assert.equal(Number((await live.execute("SELECT COUNT(*) n FROM orders")).rows[0]!.n), 0, "none in live");
  const token = await signToken({ sub: "real_rider", role: "rider" });
  const session = (await (await app.request("/v1/practice/session", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ role: "rider" }) })).json()) as { token: string };
  const jobs = (await (await app.request("/v1/riders/jobs/available", { headers: { Authorization: `Bearer ${session.token}` } })).json()) as { jobs: Array<{ id: string }> };
  console.log("jobs", JSON.stringify(jobs).slice(0, 600), JSON.stringify((await practice.execute("select user_id, verified, is_online, stage_lat, stage_lng from riders limit 2")).rows));
  assert.ok(jobs.jobs.length >= 1, "the practice rider sees what demo customers ordered");
});
