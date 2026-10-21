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
import { settingsRoutes } from "./routes.js";

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

test("admin can switch off opening the practice world in sandbox; it is on by default and logged", async () => {
  const client = createClient({ url: "file::memory:" });
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "practice-auto-tests-only";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  resetSchemaCache();
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role, admin_role) VALUES ('staff', 'staff', 'staff', 'hash', 'admin', 'super_admin')");
    const app = new Hono().route("/v1", settingsRoutes);
    const token = await signToken({ sub: "staff", role: "admin" } as never);
    const call = (method: string, path: string, body?: object) => app.request(`/v1${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const settings = async () => ((await (await call("GET", "/settings")).json()) as { settings: { practiceModeEnabled: boolean; practiceAutoInSandbox: boolean } }).settings;

    assert.deepEqual(await settings().then((s) => [s.practiceModeEnabled, s.practiceAutoInSandbox]), [true, true], "both on by default");
    const off = await call("PUT", "/admin/settings", { practiceAutoInSandbox: false });
    assert.equal(off.status, 200);
    assert.equal(((await off.json()) as { settings: { practiceAutoInSandbox: boolean } }).settings.practiceAutoInSandbox, false);
    assert.deepEqual(await settings().then((s) => [s.practiceModeEnabled, s.practiceAutoInSandbox]), [true, false], "only the new switch changed");
    const log = await client.execute("SELECT before_json, after_json FROM admin_activity_log WHERE action = 'settings.update' ORDER BY created_at DESC LIMIT 1");
    assert.match(String(log.rows[0]?.after_json ?? ""), /"practiceAutoInSandbox":false/);
    assert.match(String(log.rows[0]?.before_json ?? ""), /"practiceAutoInSandbox":true/);
    assert.equal((await call("PUT", "/admin/settings", { practiceAutoInSandbox: true })).status, 200);
    assert.equal((await settings()).practiceAutoInSandbox, true);
    assert.equal((await call("PUT", "/admin/settings", { practiceAutoInSandbox: "yes" })).status, 400, "only a true/false value is accepted");
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    client.close();
  }
});
