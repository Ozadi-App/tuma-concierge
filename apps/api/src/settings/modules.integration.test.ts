import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { isPathHidden, moduleForPath } from "@peebee/shared";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { getModuleSwitches, setModuleSwitches } from "../lib/settings.js";
import { moduleGate } from "../lib/module-gate.js";
import { resetSchemaCache } from "../lib/schema.js";
import { orderRoutes } from "../orders/routes.js";
import { customerRestaurantRoutes } from "../restaurants/customer.js";
import { carRoutes } from "../car/routes.js";

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

test("hiding a module refuses its new orders and nothing else", async (t) => {
  process.env.JWT_SECRET = "local-modules-test-secret-only";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = existsSync(join(process.cwd(), "src/db/migrations"))
    ? join(process.cwd(), "src/db/migrations")
    : join(process.cwd(), "apps/api/src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES ('cust', 'cust', 'cust', 'h', 'customer')", args: [] });
  const app = new Hono().use("/v1/*", moduleGate).route("/v1", orderRoutes).route("/v1", customerRestaurantRoutes).route("/v1", carRoutes);
  const token = await signToken({ sub: "cust", role: "customer" });
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const list = async () => {
    const id = `list_${Math.random().toString(36).slice(2, 10)}`;
    await client.execute({ sql: "INSERT INTO lists (id, customer_id, title, status, environment) VALUES (?, 'cust', 'L', 'draft', 'live')", args: [id] });
    return id;
  };
  const geo = { pickupLat: 0.3, pickupLng: 32.58, destinationLat: 0.35, destinationLng: 32.58 };

  await t.test("everything is visible by default", async () => {
    assert.ok(Object.values(await getModuleSwitches()).every(Boolean));
  });

  await t.test("a child module off refuses only that kind of order", async () => {
    await setModuleSwitches({ "deliver.parcel": false });
    assert.equal((await call("POST", "/orders", { listId: await list(), type: "parcel", ...geo })).status, 404);
    assert.equal((await call("POST", "/orders", { listId: await list(), type: "parcel", isRide: true, ...geo })).status, 201);
    assert.equal((await call("POST", "/orders", { listId: await list(), type: "shopping", estimatedTotal: 5000 })).status, 201);
    await setModuleSwitches({ "deliver.parcel": true });
    assert.equal((await call("POST", "/orders", { listId: await list(), type: "parcel", ...geo })).status, 201);
  });

  await t.test("a group off takes its children with it", async () => {
    await setModuleSwitches({ ride: false });
    assert.equal((await call("POST", "/car/bookings", { categoryId: "x", ...geo })).status, 404);
    await setModuleSwitches({ ride: true });
    assert.notEqual((await call("POST", "/car/bookings", { categoryId: "x", ...geo })).status, 404);
  });

  await t.test("food hidden: nothing to browse", async () => {
    await setModuleSwitches({ food: false });
    assert.deepEqual(await (await call("GET", "/restaurants")).json(), { restaurants: [], paused: true });
    await setModuleSwitches({ food: true });
  });

  await t.test("module paths resolve to the most specific module", () => {
    assert.equal(moduleForPath("/ride/boda"), "ride.boda");
    assert.equal(moduleForPath("/ride"), "ride");
    assert.equal(moduleForPath("/carpool/abc"), "ride.rideshare");
    assert.equal(moduleForPath("/account"), null);
    assert.equal(isPathHidden({ "shopping.pharmacy": false }, "/pharmacy/rx"), true);
    assert.equal(isPathHidden({ shopping: false }, "/pharmacy"), true);
    assert.equal(isPathHidden({ shopping: false }, "/orders"), false);
  });
});
