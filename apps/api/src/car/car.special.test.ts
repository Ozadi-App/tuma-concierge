import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import { Hono } from "hono";
import { signToken } from "../auth/jwt.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";
import { setCarSettings, setPlatformEnvironment } from "../lib/settings.js";
import { resetSchemaCache } from "../lib/schema.js";
import { orderRoutes } from "../orders/routes.js";
import { carAdminRoutes } from "./admin-routes.js";
import { carRoutes } from "./routes.js";
import { categoryFare } from "./service.js";

const SCHEDULED = { enabled: true, maxAdvanceHours: 72, minLeadMinutes: 30, openMinutes: 60, watchMinutes: 30, noSignalMinutes: 10, avgSpeedKmh: 25 };
const CARPOOL = { enabled: false, maxSeatsPerBooking: 3, maxRepeatWeeks: 2, cutoffMinutes: 15, payWithinMinutes: 15, matchRadiusKm: 10 };
const SELFDRIVE = { enabled: false, platformPercent: 10, maxDays: 7, minDeposit: 50000, approveWithinHours: 12, overtimeGraceHours: 3, inspectionsRequired: false };
const DEALS = { enabled: false, shareEnabled: true, rentEnabled: true, minOwnerSharePercent: 40, maxOwnerSharePercent: 80, maxRentPerDay: 0 };
const BASE_SETTINGS = {
  enabled: true, onDemandEnabled: true, matchingMode: "customer_selects" as const, shares: { owner: 60, driver: 30, platform: 10 }, maxPickupKm: 10,
  withdrawalsEnabled: true, withdrawalMinAmount: 1000, scheduled: SCHEDULED, carpool: CARPOOL, selfDrive: SELFDRIVE,
  vehiclePhotos: { max: 8, minRequired: 0 }, kyc: { ownerIdRequired: false, driverIdRequired: false, driverLicenceRequired: false }, deals: DEALS,
};

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

async function setup() {
  process.env.JWT_SECRET = "local-car-special-test-secret";
  resetSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await setPlatformEnvironment("sandbox");
  await setCarSettings(BASE_SETTINGS);
  for (const [id, role] of [["cust", "customer"], ["lux_owner", "customer"], ["lux_drv", "customer"], ["amb_owner", "customer"], ["amb_drv", "customer"], ["admin", "admin"]]) {
    await client.execute({ sql: "INSERT INTO users (id, phone, name, password_hash, role) VALUES (?, ?, ?, 'h', ?)", args: [id, id, id, role] });
  }
  await client.execute("UPDATE users SET admin_role = 'super_admin' WHERE id = 'admin'");
  const app = new Hono().route("/v1", orderRoutes).route("/v1", carRoutes).route("/v1", carAdminRoutes);
  const tokens: Record<string, string> = {};
  for (const [id, role] of [["cust", "customer"], ["lux_drv", "customer"], ["amb_drv", "customer"], ["admin", "admin"]] as const) tokens[id] = await signToken({ sub: id, role });
  const call = (method: string, path: string, who: string, body?: unknown) =>
    app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async (res: Response) => (await res.json()) as Record<string, any>;
  /** An approved, online driver with an approved vehicle of this category, standing at the pickup point. */
  const driverOnline = async (owner: string, driver: string, categoryId: string, plate: string, at = { lat: 0.3, lng: 32.58 }) => {
    await client.execute({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status) VALUES (?, 'approved', 'none')", args: [owner] });
    await client.execute({ sql: "INSERT OR IGNORE INTO car_partners (user_id, owner_status, driver_status) VALUES (?, 'none', 'approved')", args: [driver] });
    await client.execute({ sql: "INSERT INTO vehicles (id, owner_id, category_id, plate, make, model, status) VALUES (?, ?, ?, ?, 'Test', 'Car', 'approved')", args: [`veh_${plate}`, owner, categoryId, plate] });
    await client.execute({ sql: "INSERT INTO vehicle_assignments (id, vehicle_id, driver_id, status) VALUES (?, ?, ?, 'active')", args: [`asg_${plate}`, `veh_${plate}`, driver] });
    await client.execute({ sql: "INSERT OR REPLACE INTO car_driver_state (driver_id, vehicle_id, online, lat, lng) VALUES (?, ?, 1, ?, ?)", args: [driver, `veh_${plate}`, at.lat, at.lng] });
  };
  return { client, call, json, driverOnline };
}

const trip = { pickupLat: 0.3, pickupLng: 32.58, destinationLat: 0.35, destinationLng: 32.58, pickupAddress: "A", destinationAddress: "B" };

test("car categories: Luxury and Ambulance are added without touching what was there", async () => {
  const { client } = await setup();
  const rows = (await client.execute("SELECT id, kind, service_group, active, rate_per_km, rate_per_hour FROM vehicle_categories ORDER BY sort, id")).rows;
  const byId = Object.fromEntries(rows.map((r) => [String(r.id), r]));
  assert.equal(byId["peebee-cargo-van"].kind, "cargo");
  assert.equal(byId["peebee-cargo-van"].service_group, "standard", "existing categories are ordinary");
  assert.equal(rows.filter((r) => r.service_group === "luxury").length, 3);
  assert.ok(rows.filter((r) => r.service_group === "luxury").every((r) => r.kind === "passenger" && r.active === 1 && Number(r.rate_per_hour) > 0));
  assert.equal(rows.filter((r) => r.service_group === "ambulance").length, 2);
  assert.ok(rows.filter((r) => r.service_group === "ambulance").every((r) => r.active === 1), "owners can register ambulances");
  await assert.rejects(() => client.execute("UPDATE vehicle_categories SET service_group = 'spaceship' WHERE id = 'peebee-cargo-van'"), "other groups are refused");
});

test("luxury: priced by the trip plus hours of hire, offered only where a car is near, and the note reaches the driver", async () => {
  const { client, call, json, driverOnline } = await setup();
  const config = await json(await call("GET", "/car/config", "cust"));
  const luxury = config.categories.filter((c: any) => c.service_group === "luxury");
  assert.equal(luxury.length, 3);
  assert.ok(luxury.every((c: any) => c.rate_per_hour > 0 && c.description));
  assert.ok(luxury.every((c: any) => Number(c.has_vehicles) === 0), "no approved luxury car yet");
  const ambulances = config.categories.filter((c: any) => c.service_group === "ambulance");
  assert.equal(ambulances.length, 2, "owners can see the ambulance types to register one");
  assert.ok(ambulances.every((c: any) => Number(c.has_vehicles) === 0), "customers are not shown an ambulance until one is approved");
  assert.equal(config.emergencyNumber, "999");
  assert.equal(config.maxHireHours, 24);

  const sedan = "peebee-luxury-sedan";
  const base = await json(await call("POST", "/car/quote", "cust", { categoryId: sedan, ...trip }));
  const hired = await json(await call("POST", "/car/quote", "cust", { categoryId: sedan, hireHours: 3, ...trip }));
  assert.equal(hired.fare - base.fare, 3 * 40000, "three hours at the hourly rate on top of the trip");
  assert.equal((await call("POST", "/car/quote", "cust", { categoryId: "peebee-cargo-van", hireHours: 2, ...trip })).status, 400, "only Luxury is hired by the hour");
  assert.equal((await call("POST", "/car/quote", "cust", { categoryId: sedan, hireHours: 25, ...trip })).status, 400, "no more than 24 hours");
  assert.equal(categoryFare({ service_group: "luxury", rate_per_km: 5000, minimum_fare: 60000, rate_per_hour: 40000 }, 2, 2), 60000 + 80000);

  const noCar = await call("POST", "/car/bookings", "cust", { categoryId: sedan, hireHours: 2, note: "Wedding procession", ...trip });
  assert.equal(noCar.status, 409);
  assert.equal((await json(noCar)).error, "no_nearby_car");

  await driverOnline("lux_owner", "lux_drv", sedan, "UBA 001L");
  const withCar = (await json(await call("GET", "/car/config", "cust"))).categories.find((c: any) => c.id === sedan);
  assert.equal(Number(withCar.has_vehicles), 1, "an approved vehicle makes it available to customers");
  const booked = await call("POST", "/car/bookings", "cust", { categoryId: sedan, hireHours: 2, note: "Wedding procession", ...trip });
  assert.equal(booked.status, 201, JSON.stringify(await booked.clone().json()));
  const order = (await json(booked)).order;
  assert.equal(order.estimated_total, base.fare + 2 * 40000);
  assert.equal(order.matching_mode, "customer_selects", "Luxury follows the platform's normal matching");
  const row = (await client.execute({ sql: "SELECT trip_note, hire_hours, category_id FROM car_bookings WHERE order_id = ?", args: [order.id] })).rows[0];
  assert.deepEqual({ note: row.trip_note, hours: Number(row.hire_hours), cat: row.category_id }, { note: "Wedding procession", hours: 2, cat: sedan });

  const jobs = await json(await call("GET", "/car/driver/jobs", "lux_drv"));
  assert.equal(jobs.jobs.length, 1);
  assert.equal(jobs.jobs[0].tripNote, "Wedding procession");
  assert.equal(jobs.jobs[0].hireHours, 2);
  assert.equal(jobs.jobs[0].categoryKind, "luxury");

  const later = new Date(Date.now() + 5 * 3600_000).toISOString();
  assert.equal((await call("POST", "/car/bookings", "cust", { categoryId: sedan, scheduledFor: later, note: "Red carpet arrival", ...trip })).status, 201, "a Luxury car can be booked for a set time");
});

test("ambulance: now only, straight to the nearest, and points to the emergency number when none is near", async () => {
  const { client, call, json, driverOnline } = await setup();
  const ambulance = "peebee-ambulance-basic";
  await setCarSettings({ ...BASE_SETTINGS, emergencyNumber: "112" });
  assert.equal((await json(await call("GET", "/car/config", "cust"))).emergencyNumber, "112");

  const none = await call("POST", "/car/bookings", "cust", { categoryId: ambulance, note: "Chest pain", ...trip });
  assert.equal(none.status, 409);
  const noneBody = await json(none);
  assert.equal(noneBody.error, "no_nearby_car");
  assert.match(noneBody.message, /call 112/);

  assert.equal((await call("POST", "/car/bookings", "cust", { categoryId: ambulance, scheduledFor: new Date(Date.now() + 5 * 3600_000).toISOString(), ...trip })).status, 400, "no booking for later");

  await driverOnline("amb_owner", "amb_drv", ambulance, "UBA 999A");
  assert.equal(Number((await json(await call("GET", "/car/config", "cust"))).categories.find((c: any) => c.id === ambulance).has_vehicles), 1);
  // Even with on-demand taxi booking switched off, an ambulance can still be requested.
  await setCarSettings({ ...BASE_SETTINGS, onDemandEnabled: false });
  const res = await call("POST", "/car/bookings", "cust", { categoryId: ambulance, note: "Chest pain, conscious", ...trip });
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  const order = (await json(res)).order;
  assert.equal(order.matching_mode, "first_to_claim", "nobody waits to pick a driver in an emergency");
  assert.equal(order.estimated_total, (await json(await call("POST", "/car/quote", "cust", { categoryId: ambulance, ...trip }))).fare);
  const row = (await client.execute({ sql: "SELECT trip_note FROM car_bookings WHERE order_id = ?", args: [order.id] })).rows[0];
  assert.equal(row.trip_note, "Chest pain, conscious");
  const title = (await client.execute({ sql: "SELECT l.title FROM lists l JOIN orders o ON o.list_id = l.id WHERE o.id = ?", args: [order.id] })).rows[0].title;
  assert.match(String(title), /^Ambulance request/);
});

test("ambulance and luxury cars never count as ordinary taxis", async () => {
  const { call, json, driverOnline } = await setup();
  await driverOnline("lux_owner", "lux_drv", "peebee-luxury-sedan", "UBA 002L");
  await driverOnline("amb_owner", "amb_drv", "peebee-ambulance-basic", "UBA 998A");
  const options = await json(await call("GET", `/car/service-options?pickupLat=0.3&pickupLng=32.58&destinationLat=0.35&destinationLng=32.58`, "cust"));
  assert.ok(options.options.length > 0);
  assert.ok(options.options.every((o: any) => o.nearby === 0), "taxi availability ignores luxury and ambulance vehicles");
  const nearby = await json(await call("GET", "/car/category-nearby?categoryId=peebee-luxury-sedan&lat=0.3&lng=32.58", "cust"));
  assert.equal(nearby.nearby, 1);
  assert.equal((await json(await call("GET", "/car/category-nearby?categoryId=peebee-luxury-sedan&lat=10&lng=40", "cust"))).nearby, 0);
});

test("admin: categories carry the new kinds, the hourly rate and the description", async () => {
  const { client, call, json } = await setup();
  const made = await call("POST", "/admin/car/categories", "admin", { kind: "passenger", serviceGroup: "luxury", name: "Vintage wedding car", seats: 4, ratePerKm: 9000, minimumFare: 150000, ratePerHour: 90000, description: "1960s classic", active: true, sort: 25 });
  assert.equal(made.status, 201);
  const id = (await json(made)).id;
  const row = (await client.execute({ sql: "SELECT service_group, rate_per_hour, description FROM vehicle_categories WHERE id = ?", args: [id] })).rows[0];
  assert.deepEqual({ group: row.service_group, hourly: Number(row.rate_per_hour), description: row.description }, { group: "luxury", hourly: 90000, description: "1960s classic" });
  assert.equal((await call("POST", "/admin/car/categories", "admin", { kind: "spaceship", name: "x", ratePerKm: 1, minimumFare: 1 })).status, 400);
  assert.equal((await call("POST", "/admin/car/categories", "admin", { kind: "cargo", serviceGroup: "luxury", name: "x", ratePerKm: 1, minimumFare: 1 })).status, 400, "Luxury carries passengers");
});
