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

  // 8. Station Manager Login
  const mgrLoginRes = await app.request("/v1/gas/manager/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "MGR-TOT-01",
      pin: "1234",
      outletId: "fout_total_lugogo",
    }),
  });
  assert.equal(mgrLoginRes.status, 200);
  const mgrLoginData = (await mgrLoginRes.json()) as any;
  assert.equal(mgrLoginData.ok, true);
  assert.equal(mgrLoginData.manager.manager_code, "MGR-TOT-01");
  assert.equal(mgrLoginData.manager.full_name, "Patrick Semakula");
  assert.ok(mgrLoginData.token.startsWith("gmgr_"));

  // 9. Station Manager Commissions a New Attendant with Pending Status
  const commRes = await app.request("/v1/gas/manager/attendants/commission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outletId: "fout_total_lugogo",
      fullName: "Nalubega Joan",
      phone: "+256701555666",
      attendantCode: "ATT-1099",
      pumpLane: "Pump 3",
      pin: "4321",
      approveImmediately: false,
    }),
  });
  assert.equal(commRes.status, 200);
  const commData = (await commRes.json()) as any;
  assert.equal(commData.ok, true);
  assert.equal(commData.attendant.commission_status, "pending");
  const newAttId = commData.attendant.id;

  // 10. Pending attendant tries to login -> rejected with 403 pending_approval
  const blockedLoginRes = await app.request("/v1/gas/attendants/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "ATT-1099",
      pin: "4321",
    }),
  });
  assert.equal(blockedLoginRes.status, 403);
  const blockedData = (await blockedLoginRes.json()) as any;
  assert.equal(blockedData.error, "pending_approval");

  // 11. Manager approves the attendant
  const approveRes = await app.request(`/v1/gas/manager/attendants/${newAttId}/approve`, {
    method: "POST",
  });
  assert.equal(approveRes.status, 200);
  const approveData = (await approveRes.json()) as any;
  assert.equal(approveData.attendant.commission_status, "approved");

  // 12. Approved attendant can now login
  const allowedLoginRes = await app.request("/v1/gas/attendants/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "ATT-1099",
      pin: "4321",
    }),
  });
  assert.equal(allowedLoginRes.status, 200);
  const allowedData = (await allowedLoginRes.json()) as any;
  assert.equal(allowedData.ok, true);
  assert.equal(allowedData.attendant.code, "ATT-1099");

  // 13. Manager checks attendants list
  const listAttRes = await app.request("/v1/gas/manager/attendants?outletId=fout_total_lugogo");
  assert.equal(listAttRes.status, 200);
  const listAttData = (await listAttRes.json()) as any;
  assert.ok(listAttData.attendants.some((a: any) => a.attendant_code === "ATT-1099"));

  // 14. Station Sales Summary & Reports
  const salesRes = await app.request("/v1/gas/manager/sales-summary?outletId=fout_total_lugogo&period=today");
  assert.equal(salesRes.status, 200);
  const salesData = (await salesRes.json()) as any;
  assert.ok(salesData.summary.totalRevenueUgx >= 20000);
  assert.ok(salesData.summary.availableBalanceUgx >= 20000);
  assert.ok(salesData.summary.productBreakdown.length > 0);

  // 15. Station Manager adds payout account
  const addPayRes = await app.request("/v1/gas/manager/payout-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outletId: "fout_total_lugogo",
      type: "momo",
      accountRef: "+256782334455",
      accountName: "Lugogo Bypass Payout Manager",
      networkOrBank: "MTN MoMo",
      isPrimary: true,
    }),
  });
  assert.equal(addPayRes.status, 200);
  const addPayData = (await addPayRes.json()) as any;
  assert.equal(addPayData.ok, true);
  assert.equal(addPayData.account.account_name, "Lugogo Bypass Payout Manager");

  // 16. Station Manager requests fund withdrawal
  const wdRes = await app.request("/v1/gas/manager/withdrawals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outletId: "fout_total_lugogo",
      amountUgx: 10000,
      destinationType: "momo",
      destinationDetails: {
        phone: "+256782334455",
        network: "MTN",
        accountName: "Lugogo Bypass Payout Manager",
      },
    }),
  });
  assert.equal(wdRes.status, 200);
  const wdData = (await wdRes.json()) as any;
  assert.equal(wdData.ok, true);
  assert.equal(wdData.withdrawal.amount_ugx, 10000);
  assert.ok(wdData.withdrawal.reference.startsWith("WD-GAS-"));

  // 17. Verify withdrawal list & reduced available balance
  const listWdRes = await app.request("/v1/gas/manager/withdrawals?outletId=fout_total_lugogo");
  assert.equal(listWdRes.status, 200);
  const listWdData = (await listWdRes.json()) as any;
  assert.ok(listWdData.withdrawals.some((w: any) => w.reference === wdData.withdrawal.reference));

  const updatedSalesRes = await app.request("/v1/gas/manager/sales-summary?outletId=fout_total_lugogo&period=today");
  const updatedSalesData = (await updatedSalesRes.json()) as any;
  assert.equal(updatedSalesData.summary.withdrawnTotalUgx, 10000);
  assert.equal(updatedSalesData.summary.availableBalanceUgx, salesData.summary.availableBalanceUgx - 10000);
});
