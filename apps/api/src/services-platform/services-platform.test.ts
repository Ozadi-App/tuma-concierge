import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { resetSchemaCache } from "../lib/schema.js";
import { signToken } from "../auth/jwt.js";

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

test("standalone services platform: business onboarding, offerings, aggregator isolation, public site and booking flow", async () => {
  process.env.JWT_SECRET = "services-test-secret";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = existsSync(join(process.cwd(), "apps/api/src/db/migrations"))
    ? join(process.cwd(), "apps/api/src/db/migrations")
    : join(process.cwd(), "src/db/migrations");

  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) {
      await client.execute(sql);
    }
  }
  bindDatabase(client);

  // Seed user
  await client.execute("INSERT INTO users (id, phone, name, password_hash, role, status) VALUES ('usr_srv_pro', '+256701998877', 'Dr. Ronald Kasule', 'hash', 'customer', 'active')");

  const providerJwt = await signToken({
    sub: "usr_srv_pro",
    role: "customer",
  });

  const req = (path: string, method = "GET", body?: object) =>
    app.request(`/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerJwt}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  // 1. Initially user has no service business
  const initRes = await req("/services-platform/my-business");
  assert.equal(initRes.status, 200);
  const initJson = await initRes.json();
  assert.equal(initJson.business, null);

  // 2. Launch Standalone Service Business Profile
  const launchRes = await req("/services-platform/my-business", "POST", {
    name: "Kasule Renewable Energy & Power Diagnostics",
    category: "home_trades",
    tagline: "Certified Solar, Inverter & Electrical Inspections",
    description: "Full residential and industrial electrical inspections with thermal imaging.",
    phone: "+256 701 998 877",
    whatsapp: "+256 701 998 877",
    email: "ronald@kasulepower.co.ug",
    address: "Lugogo Bypass Plaza, Kampala",
    city: "Kampala",
    service_area: "Greater Kampala & Entebbe",
    cancellation_policy: "Free cancellation 24h prior to visit",
    allowed_payment_rails: ["momo_mtn", "momo_airtel", "cash_at_venue"],
  });
  assert.equal(launchRes.status, 200);
  const launchJson = await launchRes.json();
  assert.equal(launchJson.ok, true);
  assert.ok(launchJson.business.id.startsWith("sbiz_"));
  const bizSlug = launchJson.business.slug;

  // 3. Create Service Offering
  const addOffRes = await req("/services-platform/offerings", "POST", {
    title: "Full 3-Phase Inverter & Solar Terminal Diagnostic",
    category: "home_trades",
    description: "Complete checkup of battery banks, DC isolators and surge protectors.",
    pricing_type: "fixed",
    price_ugx: 95000,
    deposit_ugx: 35000,
    duration_minutes: 90,
    buffer_minutes: 15,
    location_type: "client_site",
    deliverables: ["Diagnostic report", "Safety certificate", "Load balance analysis"],
  });
  assert.equal(addOffRes.status, 200);
  const addOffJson = await addOffRes.json();
  assert.equal(addOffJson.ok, true);
  const serviceId = addOffJson.offering.id;

  // 4. Create Staff Specialist
  const addStaffRes = await req("/services-platform/staff", "POST", {
    name: "Eng. Brian Mukasa",
    role: "Senior PV Technician",
    phone: "+256 702 111 222",
    email: "brian@kasulepower.co.ug",
  });
  assert.equal(addStaffRes.status, 200);
  const addStaffJson = await addStaffRes.json();
  const staffId = addStaffJson.staff.id;

  // 5. Public Dedicated Site Query (Unauthenticated client)
  const publicRes = await app.request(`/v1/services-platform/public/${bizSlug}`);
  assert.equal(publicRes.status, 200);
  const publicJson = await publicRes.json();
  assert.equal(publicJson.business.name, "Kasule Renewable Energy & Power Diagnostics");
  assert.equal(publicJson.offerings.length, 1);
  assert.equal(publicJson.offerings[0].title, "Full 3-Phase Inverter & Solar Terminal Diagnostic");
  assert.equal(publicJson.staff.length, 1);
  assert.deepEqual(publicJson.business.allowed_payment_rails, ["momo_mtn", "momo_airtel", "cash_at_venue"]);

  // 6. Aggregator Isolation Test:
  // If a customer tries to book with an unallowed / card rail on this service business
  const invalidRailRes = await app.request(`/v1/services-platform/public/${bizSlug}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      customer_name: "Baker Lubega",
      customer_phone: "+256 752 000 111",
      scheduled_date: "2026-11-05",
      scheduled_time: "10:30",
      location_type: "client_site",
      address: "Plot 8, Ntinda Ministers Village",
      payment_rail: "bank_wire", // not in allowed rails for this business
    }),
  });
  assert.equal(invalidRailRes.status, 400);
  const invalidRailJson = await invalidRailRes.json();
  assert.equal(invalidRailJson.error, "unsupported_service_rail");

  // 7. Successful Customer Booking with Compliant Rail (MTN MoMo)
  const validBookRes = await app.request(`/v1/services-platform/public/${bizSlug}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      customer_name: "Baker Lubega",
      customer_phone: "+256 752 000 111",
      customer_email: "baker@lubega.com",
      scheduled_date: "2026-11-05",
      scheduled_time: "10:30",
      location_type: "client_site",
      address: "Plot 8, Ntinda Ministers Village",
      payment_rail: "momo_mtn",
    }),
  });
  assert.equal(validBookRes.status, 200);
  const validBookJson = await validBookRes.json();
  assert.equal(validBookJson.ok, true);
  assert.ok(validBookJson.booking.id.startsWith("sbk_"));
  assert.equal(validBookJson.booking.total_price_ugx, 95000);
  assert.equal(validBookJson.booking.payment_rail, "momo_mtn");
  const bookingId = validBookJson.booking.id;

  // 8. Provider reviews Bookings CRM and updates status / assigns staff
  const crmListRes = await req("/services-platform/bookings");
  assert.equal(crmListRes.status, 200);
  const crmListJson = await crmListRes.json();
  assert.equal(crmListJson.bookings.length, 1);
  assert.equal(crmListJson.bookings[0].customer_name, "Baker Lubega");

  const assignRes = await req(`/services-platform/bookings/${bookingId}/status`, "PATCH", {
    status: "in_progress",
    staff_id: staffId,
  });
  assert.equal(assignRes.status, 200);
  const assignJson = await assignRes.json();
  assert.equal(assignJson.ok, true);
});
