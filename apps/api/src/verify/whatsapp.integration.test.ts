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
import { createAndSendOtp } from "./service.js";

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

test("phone verification codes go over WhatsApp first and fall back to SMS", async () => {
  const env = { ...process.env };
  const realFetch = globalThis.fetch;
  const client = createClient({ url: "file::memory:" });
  resetSchemaCache();
  bindDatabase(client);
  process.env.CREDENTIALS_ENCRYPTION_KEY = "whatsapp-verify-test-encryption";
  process.env.JWT_SECRET = "whatsapp-verify-test-jwt";
  process.env.WHATSAPP_ACCESS_TOKEN = "wa-test-token";
  process.env.AFRICASTALKING_USERNAME = "sandbox";
  process.env.AFRICASTALKING_API_KEY = "at-test-key";
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql") && !f.startsWith("0076")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role) VALUES ('u1', '+256700000001', 'u1', 'h', 'customer')");
  const calls: Array<{ url: string; body: string }> = [];
  let waStatus = 200;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? "") });
    if (url.includes("graph.facebook.com")) {
      return waStatus === 200
        ? new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 })
        : new Response("template not approved", { status: waStatus });
    }
    return new Response("{}", { status: 201 });
  }) as typeof fetch;
  const setting = (key: string, value: string) =>
    client.execute({ sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [`onboarding_${key}`, value] });
  try {
    // Off by default: SMS only, WhatsApp never called.
    assert.equal((await createAndSendOtp("u1", "sms", "+256700000001")).via, "sms");
    assert.equal(calls.some((c) => c.url.includes("graph.facebook.com")), false);

    // On but not fully configured (no template): still SMS.
    await setting("verify_whatsapp_enabled", "1");
    await setting("whatsapp_phone_id", "12345");
    assert.equal((await createAndSendOtp("u1", "sms", "+256700000001")).via, "sms");

    // Fully configured: WhatsApp, with the code in the body and the copy-code button.
    await setting("verify_whatsapp_template", "verify_code");
    calls.length = 0;
    assert.equal((await createAndSendOtp("u1", "sms", "+256700000001")).via, "whatsapp");
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.to, "256700000001");
    assert.equal(sent.template.name, "verify_code");
    assert.match(sent.template.components[0].parameters[0].text, /^\d{6}$/);
    assert.equal(sent.template.components[1].sub_type, "url");

    // WhatsApp rejects: falls back to SMS and the registration still gets a code.
    waStatus = 400;
    calls.length = 0;
    assert.equal((await createAndSendOtp("u1", "sms", "+256700000001")).via, "sms");
    assert.ok(calls.some((c) => c.url.includes("africastalking")));

    // Email is untouched.
    calls.length = 0;
    const email = await createAndSendOtp("u1", "email", "u1@example.invalid");
    assert.equal(calls.some((c) => c.url.includes("graph.facebook.com")), false);
    assert.ok(email.devCode || email.via);
  } finally {
    globalThis.fetch = realFetch;
    process.env = env;
  }
});
