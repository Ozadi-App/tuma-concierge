import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { setSetting } from "../lib/settings.js";
import { setR2Binding, type R2Bucket } from "../storage/r2.js";

process.env.JWT_SECRET = "pharmacy-test-only-secret";

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

type Json = Record<string, any>;
const JPEG = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 64 }, (_, i) => i)]);
const VINE = "store_rx_vine";
const FIRST = "store_rx_first";
const SHOP = "store_rx_shop"; // calls itself a pharmacy but was never approved

async function setup() {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await setSetting("pharmacy_enabled", "1");
  await setSetting("pharmacy_max_image_mb", "6");
  await setSetting("pharmacy_submissions_per_hour", "10");

  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  setR2Binding({
    async put(key: string, value: any, options?: any) {
      objects.set(key, { bytes: new Uint8Array(value), contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const o = objects.get(key);
      return o ? { body: new Response(o.bytes as unknown as BodyInit).body!, httpMetadata: { contentType: o.contentType } } : null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
  } as unknown as R2Bucket);

  const mkUser = async (id: string) => {
    await client.execute({ sql: "INSERT INTO users (id, phone, name, role, password_hash) VALUES (?, ?, ?, 'customer', 'x')", args: [id, `+2567${Math.floor(10000000 + Math.random() * 89999999)}`, `User ${id}`] });
    return signToken({ sub: id, role: "customer" });
  };
  const call = async (path: string, opts: { method?: string; token?: string; body?: unknown; form?: FormData } = {}) => {
    const res = await app.request(`/v1/pharmacy${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: { ...(opts.form ? {} : { "Content-Type": "application/json" }), ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, headers: res.headers, json: (type.includes("json") ? await res.json() : {}) as Json, raw: res };
  };
  const upload = async (token: string, bytes: Uint8Array = JPEG(), type = "image/jpeg") => {
    const form = new FormData();
    form.set("file", new File([bytes as unknown as BlobPart], "slip.jpg", { type }));
    return call("/uploads", { token, form });
  };

  // Two approved pharmacies and one shop that was never approved.
  const customer = await mkUser("cust_a");
  const other = await mkUser("cust_b");
  const submit = async (token: string, pharmacyId: string, extra: Json = {}) => {
    const up = await upload(token);
    return call("/prescriptions", { token, body: { pharmacyId, prescriptionImageKey: up.json.key, patientNotes: "Cough", patientAge: 30, patientGender: "female", ...extra } });
  };
  for (const [store, name] of [[VINE, "Vine Pharmacy"], [FIRST, "First Pharmacy"], [SHOP, "Corner Shop"]] as const) {
    await client.execute({ sql: "INSERT INTO merchants (id, legal_name, display_name, status, trust_tier, environment) VALUES (?, ?, ?, 'active', 'standard', 'live')", args: [`${store}-merchant`, name, name] });
    await client.execute({ sql: "INSERT INTO stores (id, merchant_id, name, slug, category, sub_category, status, environment) VALUES (?, ?, ?, ?, 'stores', 'pharmacy', 'active', 'live')", args: [store, `${store}-merchant`, name, store] });
  }
  for (const store of [VINE, FIRST]) {
    await client.execute({ sql: "INSERT INTO pharmacy_approvals (store_id, licence_number, status, approved_by) VALUES (?, 'NDA/TEST/001', 'approved', 'admin_x')", args: [store] });
  }

  const member = async (id: string, store: string, role: string) => {
    const token = await mkUser(id);
    await client.execute({ sql: "INSERT INTO merchant_members (merchant_id, user_id, role, status) VALUES (?, ?, ?, 'active')", args: [`${store}-merchant`, id, role] });
    return token;
  };
  const vine = await member("pharm_vine", VINE, "owner");
  const vineCashier = await member("cash_vine", VINE, "cashier");
  const first = await member("pharm_first", FIRST, "manager");

  const admin = await (async () => {
    await client.execute("INSERT INTO users (id, phone, name, role, password_hash, admin_role) VALUES ('admin_rx', '+256700555000', 'Admin', 'admin', 'x', 'super_admin')");
    return signToken({ sub: "admin_rx", role: "admin" });
  })();

  return { client, call, upload, submit, customer, other, vine, vineCashier, first, objects, admin };
}

test("pharmacy: prescription lifecycle with a server-computed quote and an audit trail", async () => {
  const { client, call, submit, customer, other, vine } = await setup();

  const sent = await submit(customer, VINE, { deliveryAddress: "Kisementi" });
  assert.equal(sent.status, 201);
  const rx = sent.json.prescription;
  assert.equal(rx.status, "pending_review");
  assert.equal(rx.pharmacyId, VINE);
  assert.ok(rx.deliveryFeeUgx > 0, "delivery fee comes from the admin's delivery settings");

  assert.equal((await call("/prescriptions", { token: customer })).json.prescriptions.length, 1);
  assert.equal((await call("/prescriptions", { token: other })).json.prescriptions.length, 0, "customers only see their own");

  const queue = await call("/pharmacist/prescriptions", { token: vine });
  assert.equal(queue.json.prescriptions.length, 1);
  assert.equal(queue.json.prescriptions[0].customerName, "User cust_a");

  const quote = await call(`/pharmacist/prescriptions/${rx.id}`, {
    method: "PATCH",
    token: vine,
    body: {
      status: "priced_ready",
      quotedTotalUgx: 1,
      quotedItems: [
        { name: "Ascoril", quantity: 2, unitPrice: 16000 },
        { name: "Panadol", quantity: 1, unitPrice: 5000 },
      ],
      dosageInstructions: "After meals",
    },
  });
  assert.equal(quote.status, 200);
  assert.equal(quote.json.prescription.quotedTotalUgx, 37000, "total is the sum of the lines, whatever the client sent");

  assert.equal((await call(`/pharmacist/prescriptions/${rx.id}`, { method: "PATCH", token: vine, body: { status: "dispensed" } })).status, 200);
  const back = await call(`/pharmacist/prescriptions/${rx.id}`, { method: "PATCH", token: vine, body: { status: "priced_ready", quotedItems: [{ name: "X", quantity: 1, unitPrice: 1 }] } });
  assert.equal(back.status, 409, "a dispensed prescription is final");
  assert.equal((await call(`/prescriptions/${rx.id}/cancel`, { token: customer, body: {} })).status, 404, "and can't be cancelled");

  const events = (await client.execute("SELECT action, actor_kind FROM pharmacy_prescription_events ORDER BY created_at, rowid")).rows.map((r) => `${r.actor_kind}:${r.action}`);
  assert.deepEqual(events, ["customer:submitted", "pharmacist:priced_ready", "pharmacist:dispensed"]);

  assert.equal((await call(`/pharmacist/prescriptions/${rx.id}`, { method: "PATCH", token: vine, body: { status: "priced_ready" } })).status, 400, "a quote needs line items");
});

test("pharmacy: nothing works without signing in, and pharmacies are walled off", async () => {
  const { call, submit, customer, other, vine, vineCashier, first } = await setup();
  const rx = (await submit(customer, VINE)).json.prescription;

  for (const [method, path] of [
    ["GET", "/me"], ["POST", "/uploads"], ["POST", "/prescriptions"], ["GET", "/prescriptions"],
    ["POST", `/prescriptions/${rx.id}/cancel`], ["GET", `/prescriptions/${rx.id}/image`],
    ["GET", "/pharmacist/prescriptions"], ["PATCH", `/pharmacist/prescriptions/${rx.id}`],
  ] as const) {
    assert.equal((await call(path, { method })).status, 401, `${method} ${path} without a token`);
  }

  // A customer is not a pharmacist.
  assert.equal((await call("/pharmacist/prescriptions", { token: customer })).status, 403);
  assert.equal((await call("/me", { token: customer })).status, 403);
  assert.equal((await call(`/pharmacist/prescriptions/${rx.id}`, { method: "PATCH", token: other, body: { status: "declined" } })).status, 403);

  // Cashiers are staff but not clinical.
  assert.equal((await call("/pharmacist/prescriptions", { token: vineCashier })).status, 403);

  // Another pharmacy can't see, open or change it.
  assert.equal((await call("/pharmacist/prescriptions", { token: first })).json.prescriptions.length, 0);
  assert.equal((await call(`/pharmacist/prescriptions/${rx.id}`, { method: "PATCH", token: first, body: { status: "declined" } })).status, 404);
  assert.equal((await call(`/prescriptions/${rx.id}/image`, { token: first })).status, 404);

  // Another customer can't open or cancel it.
  assert.equal((await call(`/prescriptions/${rx.id}/image`, { token: other })).status, 404);
  assert.equal((await call(`/prescriptions/${rx.id}/cancel`, { token: other, body: {} })).status, 404);

  // The owner and the pharmacy that received it can.
  assert.equal((await call(`/prescriptions/${rx.id}/image`, { token: customer })).status, 200);
  const slip = await call(`/prescriptions/${rx.id}/image`, { token: vine });
  assert.equal(slip.status, 200);
  assert.equal(slip.headers.get("cache-control"), "private, no-store");
  assert.equal(slip.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await call("/me", { token: vine })).json.pharmacy.id, VINE);
});

test("pharmacy: uploads are checked by their bytes, size and owner", async () => {
  const { call, upload, customer, other, objects } = await setup();

  const fake = await upload(customer, new TextEncoder().encode("<script>alert(1)</script>".padEnd(80, " ")), "image/jpeg");
  assert.equal(fake.status, 400, "a page labelled as a JPEG is refused");
  assert.equal((await upload(customer, JPEG(), "application/pdf")).status, 400);

  await setSetting("pharmacy_max_image_mb", "1");
  const big = new Uint8Array(1024 * 1024 + 10);
  big.set([0xff, 0xd8, 0xff]);
  assert.equal((await upload(customer, big)).json.error, "file_too_large");
  await setSetting("pharmacy_max_image_mb", "6");

  const mine = await upload(customer);
  assert.equal(mine.status, 201);
  assert.ok(String(mine.json.key).startsWith("rx/cust_a/"));
  assert.ok(objects.has(mine.json.key));

  // Someone else's photo, a made-up key, or a path trick can't be attached.
  for (const key of [mine.json.key, "rx/cust_b/none.jpg", "rx/cust_b/../cust_a/x.jpg", "users/cust_b/profile-photo.jpg"]) {
    const res = await call("/prescriptions", { token: other, body: { pharmacyId: VINE, prescriptionImageKey: key } });
    assert.equal(res.status, 400, `key ${key}`);
  }
  assert.equal((await call("/prescriptions", { token: customer, body: { pharmacyId: SHOP, prescriptionImageKey: mine.json.key } })).status, 404, "a shop that was never approved can't receive prescriptions");
  assert.equal((await call("/prescriptions", { token: customer, body: { pharmacyId: "no_such_store", prescriptionImageKey: mine.json.key } })).status, 404);
});

test("pharmacy: admin switch, rate limit and the migration gate", async () => {
  const { client, call, submit, customer } = await setup();

  await setSetting("pharmacy_submissions_per_hour", "2");
  assert.equal((await submit(customer, VINE)).status, 201);
  assert.equal((await submit(customer, VINE)).status, 201);
  assert.equal((await submit(customer, VINE)).status, 429);
  await setSetting("pharmacy_submissions_per_hour", "10");

  await setSetting("pharmacy_enabled", "0");
  assert.equal((await call("/prescriptions", { token: customer })).status, 503);
  await setSetting("pharmacy_enabled", "1");
  assert.equal((await call("/prescriptions", { token: customer })).status, 200);

  await client.execute("DROP TABLE pharmacy_prescription_events");
  resetSchemaCache();
  const gated = await call("/prescriptions", { token: customer });
  assert.equal(gated.status, 503);
  assert.equal(gated.json.error, "pharmacy_upgrade_pending");
});

test("pharmacy: the old open endpoints are gone", async () => {
  const { call } = await setup();
  // These used to return every patient's records to anyone.
  const res = await app.request("/v1/pharmacy/pharmacist/prescriptions");
  assert.equal(res.status, 401);
  assert.equal((await call("/pharmacist/prescriptions")).status, 401);
});

test("pharmacy: only staff approve pharmacies, and approval controls who receives and who reads", async () => {
  const { client, call, submit, customer, vine, admin } = await setup();

  const listed = (await call("/pharmacies", { token: customer })).json.pharmacies.map((p: Json) => p.id).sort();
  assert.deepEqual(listed, [FIRST, VINE], "customers only see approved pharmacies");

  // The unapproved shop's owner is not a pharmacist.
  await client.execute("INSERT INTO users (id, phone, name, role, password_hash) VALUES ('shop_owner', '+256700666000', 'Shop', 'customer', 'x')");
  await client.execute({ sql: "INSERT INTO merchant_members (merchant_id, user_id, role, status) VALUES (?, 'shop_owner', 'owner', 'active')", args: [`${SHOP}-merchant`] });
  const shopOwner = await signToken({ sub: "shop_owner", role: "customer" });
  assert.equal((await call("/me", { token: shopOwner })).status, 403);

  // Merchants can't approve themselves; only an admin with the right permission.
  assert.equal((await call(`/admin/pharmacies/${SHOP}/approve`, { token: shopOwner, body: { licenceNumber: "NDA/FAKE/1" } })).status, 403);
  assert.equal((await call(`/admin/pharmacies/${SHOP}/approve`, { token: admin, body: {} })).status, 400, "a licence number is required");
  assert.equal((await call(`/admin/pharmacies/${SHOP}/approve`, { token: admin, body: { licenceNumber: "NDA/REAL/42" } })).status, 200);
  assert.equal((await call("/me", { token: shopOwner })).status, 200);
  assert.equal((await client.execute("SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'pharmacy.approve'")).rows[0].n, 1);

  // Withdrawing approval cuts the pharmacy off, including from prescriptions already sent to it.
  const rx = (await submit(customer, VINE)).json.prescription;
  assert.equal((await call(`/prescriptions/${rx.id}/image`, { token: vine })).status, 200);
  assert.equal((await call(`/admin/pharmacies/${VINE}/revoke`, { token: admin, body: {} })).status, 200);
  assert.equal((await call(`/prescriptions/${rx.id}/image`, { token: vine })).status, 404);
  assert.equal((await call("/pharmacist/prescriptions", { token: vine })).status, 403);
  assert.equal((await submit(customer, VINE)).status, 404);
});
