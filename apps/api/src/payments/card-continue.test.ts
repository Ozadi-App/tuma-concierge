import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { setFlutterwaveDirect } from "../lib/settings.js";
import { paymentRoutes } from "./routes.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({ prepare } as unknown as D1Database);
}

const card = { number: "4242424242424242", cvv: "123", expiryMonth: "12", expiryYear: "2099" };

test("continuing a direct card payment is owner-only, validated, and never stores the card", async (t) => {
  const client = createClient({ url: "file::memory:" });
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const saved = { jwt: process.env.JWT_SECRET, secret: process.env.FLUTTERWAVE_SECRET_KEY, key: process.env.FLUTTERWAVE_ENCRYPTION_KEY };
  process.env.JWT_SECRET = "card-continue-tests-only";
  process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST";
  process.env.FLUTTERWAVE_ENCRYPTION_KEY = "abcdefghijklmnopqrstuvwx";
  const realFetch = globalThis.fetch;
  const sent: { url: string; body: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), body: String(init?.body ?? "") });
    return new Response(JSON.stringify({ status: "success", data: { flw_ref: "FLW-5", status: "pending" }, meta: { authorization: { mode: "otp" } } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
    for (const [name, value] of [["JWT_SECRET", saved.jwt], ["FLUTTERWAVE_SECRET_KEY", saved.secret], ["FLUTTERWAVE_ENCRYPTION_KEY", saved.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  for (const id of ["owner", "stranger"]) {
    await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'hash', 'customer')", args: [id, id, id] });
  }
  await client.execute("INSERT INTO wallet_topups (id, user_id, amount, provider, provider_ref, method, status) VALUES ('wtu_live', 'owner', 20000, 'flutterwave', 'wtu_live', 'card', 'pending')");
  await client.execute("INSERT INTO wallet_topups (id, user_id, amount, provider, provider_ref, method, status) VALUES ('wtu_mock', 'owner', 20000, 'flutterwave_mock', 'wtu_mock', 'card', 'pending')");
  const app = new Hono().route("/v1", paymentRoutes);
  const owner = await signToken({ sub: "owner", role: "customer" });
  const stranger = await signToken({ sub: "stranger", role: "customer" });
  const post = (id: string, token: string, body: unknown) =>
    app.request(`/v1/payments/${id}/card/continue`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  await setFlutterwaveDirect("card", true);
  const pin = { card, authorization: { mode: "pin", pin: "1234" } };

  await t.test("someone else's payment is not found", async () => {
    assert.equal((await post("wtu_live", stranger, pin)).status, 404);
    assert.equal(sent.length, 0);
  });

  await t.test("a mistyped card is refused before Flutterwave is called", async () => {
    const res = await post("wtu_live", owner, { card: { ...card, number: "4242424242424241" }, authorization: { mode: "pin", pin: "1234" } });
    assert.equal(res.status, 400);
    assert.equal(sent.length, 0);
  });

  await t.test("the owner's PIN step re-submits the charge under the same reference and returns the next step", async () => {
    const res = await post("wtu_live", owner, pin);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const json = await res.json() as { nextAction: { type: string; flowRef: string } };
    assert.deepEqual(json.nextAction, { type: "otp", flowRef: "FLW-5" });
    assert.ok(sent[0].url.endsWith("/charges?type=card"));
    assert.ok(!sent[0].body.includes(card.number), "card is encrypted on the wire");
  });

  await t.test("the one-time code is validated against the flow reference", async () => {
    sent.length = 0;
    await post("wtu_live", owner, { otp: "123456", flowRef: "FLW-5" });
    assert.ok(sent[0].url.endsWith("/validate-charge"));
  });

  await t.test("if the admin turns the card form off mid-payment, the step is refused cleanly", async () => {
    await setFlutterwaveDirect("card", false);
    sent.length = 0;
    const res = await post("wtu_live", owner, pin);
    assert.equal(res.status, 409);
    assert.equal(sent.length, 0);
    await setFlutterwaveDirect("card", true);
  });

  await t.test("a simulated payment has no card step", async () => {
    sent.length = 0;
    const res = await post("wtu_mock", owner, pin);
    assert.deepEqual(await res.json(), { status: "pending" });
    assert.equal(sent.length, 0);
  });

  await t.test("nothing about the card is written to the database", async () => {
    const dump = JSON.stringify((await client.execute("SELECT * FROM wallet_topups")).rows);
    assert.ok(!dump.includes(card.number) && !dump.includes("1234"));
  });

  await t.test("options report hosted card until the admin turns the direct form on", async () => {
    const { paymentMethodOptions } = await import("./service.js");
    await client.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('payments_active_providers', ?)", args: [JSON.stringify(["flutterwave"])] });
    await setFlutterwaveDirect("card", false);
    assert.deepEqual(await paymentMethodOptions(), { card: { available: true, direct: false }, mobileMoney: { direct: true } });
    await setFlutterwaveDirect("card", true);
    assert.equal((await paymentMethodOptions()).card.direct, true);
    await setFlutterwaveDirect("mobile_money", false);
    assert.equal((await paymentMethodOptions()).mobileMoney.direct, false);
  });
});
