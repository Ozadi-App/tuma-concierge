import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { notifyGuest } from "./notify.js";
import { isGuestOrder } from "./service.js";
import { guestRoutes } from "./routes.js";

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

test("before migration 0122 guest checkout is simply off and nothing else changes", async () => {
  const client = createClient({ url: "file::memory:" });
  process.env.JWT_SECRET = "guest-premigration-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql") && !f.startsWith("0122_")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const app = new Hono().route("/v1", guestRoutes);

  const config = await (await app.request("/v1/guest/config")).json() as { enabled: boolean };
  assert.equal(config.enabled, false);
  const checkout = await app.request("/v1/guest/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(checkout.status, 403);
  assert.equal((await app.request("/v1/guest/track/PB-ABCDEFGH")).status, 404);
  assert.equal(await isGuestOrder("anything"), false);
  await notifyGuest("anything", "delivered");
});
