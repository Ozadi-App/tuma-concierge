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
import { setPlatformEnvironment } from "../lib/settings.js";
import { orderRoutes } from "../orders/routes.js";
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


test("taxipress: practice taxis for sandbox testing", async (t) => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "taxipress-demo-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  resetSchemaCache();
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role) VALUES ('staff', 'staff', 'staff', 'hash', 'admin')");
    await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'staff'");
    const app = new Hono().route("/v1", orderRoutes).route("/v1", relayRoutes).route("/v1", taxipressRoutes);
    const tokens: Record<string, string> = {};
    const tokenFor = async (who: string) => (tokens[who] ??= await signToken({ sub: who, role: who === "staff" ? "admin" : "customer" } as never));
    const call = async (who: string, path: string, body?: object, method?: string) => app.request(`/v1/${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${await tokenFor(who)}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
    const code = async (res: Response) => (await json<{ error?: string }>(res)).error;
    const install = () => call("staff", "admin/taxipress/demo/install", { password: "practice-pass-1" });
    type Line = { line: Array<{ plate: string; status: string; driverId: string; seatsLeft: number; id: string }>; onRoad: unknown[]; route: { id: string } | null };
    type Status = { installed: boolean; sandbox: boolean; accounts: unknown[]; line: Array<{ plate: string; status: string }> };

    await t.test("practice taxis are sandbox only", async () => {
      assert.equal(await code(await install()), "not_sandbox");
      assert.equal((await json<Status>(await call("staff", "admin/taxipress/demo"))).installed, false);
    });

    await setPlatformEnvironment("sandbox");

    let aToB = "";
    let bToA = "";
    await t.test("installing sets up the route both ways, four taxis and a passenger with money", async () => {
      assert.equal(await code(await call("staff", "admin/taxipress/demo/install", { password: "short" })), "invalid_body");
      const res = await install();
      assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
      const status = await json<Status>(res);
      assert.equal(status.installed, true);
      assert.equal(status.accounts.length, 5);
      assert.equal(status.line.length, 4);

      const config = await json<{ enabled: boolean; routes: Array<{ id: string; fromName: string; farePerSeat: number }> }>(await call("tpdemo_passenger", "taxipress/config"));
      assert.equal(config.enabled, true, "customers see Taxipress");
      assert.equal(config.routes.length, 2);
      assert.ok(config.routes.every((r) => r.farePerSeat === 10_000));
      aToB = config.routes.find((r) => r.fromName === "Kampala Stage")!.id;
      bToA = config.routes.find((r) => r.fromName === "Entebbe Stage")!.id;

      const wallet = await client.execute("SELECT wallet_balance_sandbox AS w FROM users WHERE id = 'tpdemo_passenger'");
      assert.equal(Number(wallet.rows[0].w), 2_000_000);
      const kampala = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${aToB}/queue`));
      assert.deepEqual(kampala.line.map((x) => x.plate), ["UAX 101D", "UBA 202D"]);
      const entebbe = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${bToA}/queue`));
      assert.deepEqual(entebbe.line.map((x) => x.plate), ["UAZ 303D", "UBB 404D"]);
    });

    await t.test("a whole booking runs start to finish, and the taxi is back in the line afterwards", async () => {
      const before = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${aToB}/queue`));
      const first = before.line[0];
      assert.equal(first.plate, "UAX 101D");

      const booked = await call("tpdemo_passenger", "taxipress/bookings", { queueId: first.id, seats: 2, payment: "app" });
      assert.equal(booked.status, 201, JSON.stringify(await booked.clone().json()));
      const { booking, order } = await json<{ booking: { id: string; ticketCode: string }; order: { id: string } }>(booked);
      assert.equal((await call("tpdemo_passenger", `orders/${order.id}/fund`, { paymentMethod: "wallet", useWallet: true })).status, 200);

      assert.equal((await call("tpdemo_driver1", "taxipress/driver/boarding", {})).status, 200);
      const board = await call("tpdemo_driver1", "taxipress/driver/board", { code: booking.ticketCode });
      assert.equal(board.status, 200, JSON.stringify(await board.clone().json()));
      assert.equal((await call("tpdemo_driver1", "taxipress/driver/walk-up", { delta: 12 })).status, 200);
      assert.equal((await call("tpdemo_driver1", "taxipress/driver/on-road", {})).status, 200);
      assert.equal((await call("tpdemo_driver1", "taxipress/driver/arrive", {})).status, 200);

      const ticket = await json<{ booking: { status: string } }>(await call("tpdemo_passenger", `taxipress/bookings/${booking.id}`));
      assert.equal(ticket.booking.status, "completed");
      const driver = await client.execute("SELECT wallet_balance_sandbox AS w FROM users WHERE id = 'tpdemo_driver1'");
      assert.ok(Number(driver.rows[0].w) > 0, "the driver was paid in sandbox money");

      const after = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${aToB}/queue`));
      assert.deepEqual(after.line.map((x) => x.plate), ["UBA 202D", "UAX 101D"], "the taxi rejoined the back of the line");
      assert.equal(after.line[1].seatsLeft, 14);
    });

    await t.test("a driver who leaves the line is put back, and installing again changes nothing twice", async () => {
      assert.equal((await call("tpdemo_driver2", "taxipress/driver/leave", {})).status, 200);
      const line = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${aToB}/queue`));
      assert.equal(line.line.length, 2);
      assert.equal((await install()).status, 200);
      const again = await json<Status>(await call("staff", "admin/taxipress/demo"));
      assert.equal(again.line.length, 4, "no taxi is in the line twice");
      const taxis = await client.execute("SELECT COUNT(*) AS n FROM taxipress_taxis WHERE id LIKE 'tpdemo_taxi_%'");
      assert.equal(Number(taxis.rows[0].n), 4);
    });

    await t.test("resetting ends every practice trip and lines the taxis up fresh", async () => {
      assert.equal((await call("tpdemo_driver1", "taxipress/driver/boarding", {})).status, 200);
      const res = await call("staff", "admin/taxipress/demo/reset", {});
      assert.equal(res.status, 200);
      const status = await json<Status>(res);
      assert.equal(status.line.length, 4);
      assert.ok(status.line.every((x) => x.status === "in_line"));
    });

    await t.test("outside the sandbox the taxis stay out of the line", async () => {
      await setPlatformEnvironment("live");
      assert.equal((await call("tpdemo_driver1", "taxipress/driver/leave", {})).status, 200);
      const line = await json<Line>(await call("tpdemo_passenger", `taxipress/routes/${aToB}/queue`));
      assert.equal(line.line.some((x) => x.plate === "UAX 101D"), false);
      await setPlatformEnvironment("sandbox");
    });

    await t.test("removing keeps the accounts that were used and locks them", async () => {
      const res = await call("staff", "admin/taxipress/demo", undefined, "DELETE");
      assert.equal(res.status, 200);
      assert.deepEqual(await json(res), { ok: true, deleted: 0, locked: 5 });
      const status = await client.execute("SELECT status FROM users WHERE id = 'tpdemo_driver1'");
      assert.equal(status.rows[0].status, "suspended");
      assert.equal((await json<Status>(await call("staff", "admin/taxipress/demo"))).line.length, 0);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
