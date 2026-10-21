import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { relayRoutes } from "../relay/routes.js";
import { taxipressRoutes } from "./routes.js";

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

test("taxipress: off by default, routes run on a relay route, staff control it", async (t) => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "taxipress-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  resetSchemaCache();
  try {
    for (const [id, role] of [["customer", "customer"], ["staff", "admin"]]) {
      await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'hash', ?)", args: [id, id, id, role] });
    }
    await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'staff'");

    const app = new Hono().route("/v1", relayRoutes).route("/v1", taxipressRoutes);
    const tokens = Object.fromEntries(await Promise.all(
      [["customer", "customer"], ["staff", "admin"]].map(async ([sub, role]) => [sub, await signToken({ sub, role } as never)] as const),
    ));
    const call = (who: string, path: string, body?: object, method?: string) => app.request(`/v1/${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = async <T>(res: Response) => (await res.json()) as T;
    type Config = { enabled: boolean; routes: Array<{ id: string; directionLabel: string; fromName: string; toName: string; farePerSeat: number }>; cashEnabled: boolean; parcelNotAllowed: string[] };
    const config = async () => json<Config>(await call("customer", "taxipress/config"));

    await t.test("nothing is offered until staff set it up", async () => {
      const c = await config();
      assert.equal(c.enabled, false);
      assert.deepEqual(c.routes, []);
      assert.equal((await call("customer", "admin/taxipress/settings")).status, 403);
    });

    let relayRouteId = "";
    await t.test("a Taxipress route is a relay route run in one direction", async () => {
      const relay = await call("staff", "admin/relay/routes", {
        name: "Kampala - Entebbe", stageAName: "Kampala Stage", stageALat: 0.3136, stageALng: 32.5811,
        stageBName: "Entebbe Stage", stageBLat: 0.0512, stageBLng: 32.4637, parcelFare: 5000,
      });
      assert.equal(relay.status, 201);
      relayRouteId = (await json<{ id: string }>(relay)).id;

      const settings = await json<{ settings: { enabled: boolean; departureRule: string; parcelAcceptRule: string; maxParcels14: number }; ready: boolean }>(await call("staff", "admin/taxipress/settings"));
      assert.equal(settings.ready, true);
      assert.equal(settings.settings.enabled, false);
      assert.equal(settings.settings.departureRule, "full_only");
      assert.equal(settings.settings.parcelAcceptRule, "boarding_now");
      assert.equal(settings.settings.maxParcels14, 0);

      const made = await call("staff", "admin/taxipress/routes", { relayRouteId, direction: "a_to_b", farePerSeat: 5000 });
      assert.equal(made.status, 201);
      assert.equal((await call("staff", "admin/taxipress/routes", { relayRouteId, direction: "a_to_b", farePerSeat: 6000 })).status, 409);
      assert.equal((await call("staff", "admin/taxipress/routes", { relayRouteId: "nope", direction: "b_to_a", farePerSeat: 1 })).status, 404);
      assert.equal((await call("staff", "admin/taxipress/routes", { relayRouteId, direction: "b_to_a", farePerSeat: -1 })).status, 400);
      assert.equal((await call("staff", "admin/taxipress/routes", { relayRouteId, direction: "b_to_a", farePerSeat: 5000 })).status, 201);

      const listed = await json<{ routes: Array<{ direction: string; active: boolean; directionLabel: string; fromName: string }>; relayRoutes: unknown[] }>(await call("staff", "admin/taxipress/routes"));
      assert.equal(listed.routes.length, 2);
      assert.ok(listed.routes.every((r) => r.active === false), "a new route is off until staff switch it on");
      assert.equal(listed.relayRoutes.length, 1);
      const forward = listed.routes.find((r) => r.direction === "a_to_b")!;
      assert.equal(forward.fromName, "Kampala Stage");
      assert.match(forward.directionLabel, /^KAM - ENT$/);
    });

    await t.test("customers see it only when it is on and a route is running", async () => {
      assert.equal((await config()).enabled, false);

      const listed = await json<{ routes: Array<{ id: string; direction: string }> }>(await call("staff", "admin/taxipress/routes"));
      const forward = listed.routes.find((r) => r.direction === "a_to_b")!;
      assert.equal((await call("staff", `admin/taxipress/routes/${forward.id}`, { active: true }, "PATCH")).status, 200);
      // A running route alone is not enough: the service itself is still off.
      assert.equal((await config()).enabled, false);

      assert.equal((await call("staff", "admin/taxipress/settings", { enabled: true }, "PUT")).status, 200);
      const on = await config();
      assert.equal(on.enabled, true);
      assert.equal(on.routes.length, 1);
      assert.equal(on.routes[0].fromName, "Kampala Stage");
      assert.equal(on.routes[0].toName, "Entebbe Stage");
      assert.equal(on.routes[0].farePerSeat, 5000);
    });

    await t.test("renaming a stage in Relay renames it in Taxipress", async () => {
      assert.equal((await call("staff", `admin/relay/routes/${relayRouteId}`, { stageAName: "Kampala Old Taxi Park" }, "PATCH")).status, 200);
      assert.equal((await config()).routes[0].fromName, "Kampala Old Taxi Park");
    });

    await t.test("switching the relay route off hides the Taxipress route", async () => {
      assert.equal((await call("staff", `admin/relay/routes/${relayRouteId}`, { active: false }, "PATCH")).status, 200);
      assert.equal((await config()).enabled, false);
      assert.equal((await call("staff", `admin/relay/routes/${relayRouteId}`, { active: true }, "PATCH")).status, 200);
      assert.equal((await config()).enabled, true);
    });

    await t.test("staff change the rules, with limits, and it is recorded", async () => {
      assert.equal((await call("staff", "admin/taxipress/settings", { departureRule: "sometimes" }, "PUT")).status, 400);
      assert.equal((await call("staff", "admin/taxipress/settings", { commissionDigitalPercent: 120 }, "PUT")).status, 400);
      assert.equal((await call("staff", "admin/taxipress/settings", { maxParcels14: 5, maxParcels18: 8, commissionType: "flat", commissionFlatUgx: 300, cashEnabled: false, parcelNotAllowed: ["Charcoal", "Fuel", "Paint"] }, "PUT")).status, 200);
      const after = await json<{ settings: { maxParcels14: number; maxParcels18: number; commissionType: string; commissionFlatUgx: number; cashEnabled: boolean } }>(await call("staff", "admin/taxipress/settings"));
      assert.deepEqual([after.settings.maxParcels14, after.settings.maxParcels18, after.settings.commissionType, after.settings.commissionFlatUgx, after.settings.cashEnabled], [5, 8, "flat", 300, false]);
      const c = await config();
      assert.equal(c.cashEnabled, false);
      assert.deepEqual(c.parcelNotAllowed, ["Charcoal", "Fuel", "Paint"]);
      const log = await client.execute("SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'settings.taxipress'");
      assert.ok(Number(log.rows[0].n) >= 2);
    });

    await t.test("until migration 0123 is applied it offers nothing and does not fail", async () => {
      await client.execute("DROP TABLE taxipress_routes");
      resetSchemaCache();
      assert.equal((await config()).enabled, false);
      const admin = await json<{ ready: boolean; routes: unknown[] }>(await call("staff", "admin/taxipress/routes"));
      assert.equal(admin.ready, false);
      assert.equal((await call("staff", "admin/taxipress/routes", { relayRouteId, direction: "a_to_b", farePerSeat: 1 })).status, 503);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
