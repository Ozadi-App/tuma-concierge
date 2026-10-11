import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";

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

test("gas routes: full lifecycle with in-memory database", async () => {
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) {
      await client.execute(sql);
    }
  }
  bindDatabase(client);

  // 1. Status & stations
  const statusRes = await app.request("/v1/gas/status");
  assert.equal(statusRes.status, 200);
  const statusData = (await statusRes.json()) as any;
  assert.equal(statusData.ok, true);
  assert.equal(statusData.settings.enabled, true);

  const stationsRes = await app.request("/v1/gas/stations");
  assert.equal(stationsRes.status, 200);
  const stationsData = (await stationsRes.json()) as any;
  assert.ok(Array.isArray(stationsData.outlets));
  assert.ok(stationsData.outlets.length > 0);
  assert.ok(stationsData.outlets.some((o: any) => o.code === "GAS-TOT-01"));

  // 2. Products & Price update
  const prodRes = await app.request("/v1/gas/products");
  assert.equal(prodRes.status, 200);
  const prodData = (await prodRes.json()) as any;
  assert.ok(prodData.products.some((p: any) => p.id === "prod_petrol"));

  const updateRes = await app.request("/v1/gas/outlets/fout_total_lugogo/prices", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prices: [
        { product_id: "prod_petrol", price_per_unit: 5600 },
        { product_id: "prod_diesel", price_per_unit: 5300 },
      ],
    }),
  });
  assert.equal(updateRes.status, 200);

  const getPricesRes = await app.request("/v1/gas/outlets/fout_total_lugogo/prices");
  assert.equal(getPricesRes.status, 200);
  const pricesData = (await getPricesRes.json()) as any;
  const petrol = pricesData.prices.find((p: any) => p.product_id === "prod_petrol");
  assert.equal(petrol.price_per_unit, 5600);

  // Seed a rider user for foreign key constraint in DB
  await client.execute(`
    INSERT INTO users (id, phone, name, role, password_hash)
    VALUES ('rider_test_123', '+256701999888', 'Mukasa Brian', 'rider', 'dummy_hash')
  `);

  // 3. Rider generates fuel code
  const genRes = await app.request("/v1/gas/rider/generate-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      riderId: "rider_test_123",
      vehiclePlate: "UFE 889P",
      amountUgx: 25000,
      productId: "prod_petrol",
    }),
  });
  assert.equal(genRes.status, 200);
  const genData = (await genRes.json()) as any;
  assert.ok(genData.code);
  assert.ok(genData.code.code.startsWith("PBGAS-"));
  assert.equal(genData.code.authorized_amount_ugx, 25000);
  const fullCode = genData.code.code;
  const shortCode = genData.code.short_code;

  // 4. Attendant verifies using short code
  const verifyRes = await app.request("/v1/gas/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: shortCode,
      outletId: "fout_total_lugogo",
    }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = (await verifyRes.json()) as any;
  assert.equal(verifyData.valid, true);
  assert.equal(verifyData.code.vehicle_plate, "UFE 889P");
  assert.equal(verifyData.code.authorized_amount_ugx, 25000);

  // 5. Attendant dispenses fuel
  const dispenseRes = await app.request("/v1/gas/dispense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: fullCode,
      outletId: "fout_total_lugogo",
      productId: "prod_petrol",
      totalUgx: 20000,
      pumpNumber: 2,
      attendantName: "Dennis Kato",
    }),
  });
  assert.equal(dispenseRes.status, 200);
  const dispenseData = (await dispenseRes.json()) as any;
  assert.equal(dispenseData.ok, true);
  assert.ok(dispenseData.receipt.receipt_ref.startsWith("RCP-GAS-"));
  assert.equal(dispenseData.receipt.total_ugx, 20000);
  assert.ok(dispenseData.receipt.litres_dispensed > 0);

  // 6. Verifying again returns already_used
  const reVerifyRes = await app.request("/v1/gas/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: fullCode,
      outletId: "fout_total_lugogo",
    }),
  });
  assert.equal(reVerifyRes.status, 400);
  const reVerifyData = (await reVerifyRes.json()) as any;
  assert.equal(reVerifyData.error, "already_used");

  // 7. Check shift summary
  const shiftRes = await app.request("/v1/gas/shift/summary?outletId=fout_total_lugogo");
  assert.equal(shiftRes.status, 200);
  const shiftData = (await shiftRes.json()) as any;
  assert.ok(shiftData.summary.total_dispenses >= 1);
  assert.ok(shiftData.summary.total_ugx >= 20000);
});
