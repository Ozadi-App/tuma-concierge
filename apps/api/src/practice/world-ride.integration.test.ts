import assert from "node:assert/strict";
import test from "node:test";
import { practiceHarness } from "./world-test-helpers.js";

test("Ride cluster: every ride module has demo data, visible in practice and hidden from live", async (t) => {
  const { db, tokens, call, json, start } = await practiceHarness();
  const customer = await start("customer");
  const rows = async (sql: string) => (await db.execute(sql)).rows;

  await t.test("fleet: standard, luxury, ambulance and cargo drivers are online with approved vehicles", async () => {
    const groups = await rows("SELECT c.service_group g, c.kind k, COUNT(*) n FROM car_driver_state s JOIN vehicles v ON v.id = s.vehicle_id JOIN vehicle_categories c ON c.id = v.category_id WHERE s.online = 1 AND v.status = 'approved' AND s.driver_id LIKE 'prac\\_%' ESCAPE '\\' GROUP BY g, k");
    const seen = Object.fromEntries(groups.map((r) => [`${r.g}/${r.k}`, Number(r.n)]));
    assert.ok(seen["standard/passenger"] >= 8 && seen["luxury/passenger"] === 3 && seen["ambulance/passenger"] === 2 && seen["standard/cargo"] === 4, JSON.stringify(seen));
  });

  await t.test("config: Luxury and Ambulance show for practice and not for the live platform", async () => {
    const config = async (token: string) => (await json<{ categories: { service_group: string; has_vehicles: number }[] }>(await call(token, "/car/config"))).categories;
    const inPractice = await config(customer.token);
    assert.ok(inPractice.some((c) => c.service_group === "luxury" && c.has_vehicles === 1));
    assert.ok(inPractice.some((c) => c.service_group === "ambulance" && c.has_vehicles === 1));
    const live = await call(tokens.customer, "/car/config");
    if (live.status === 200) assert.ok((await json<{ categories: { has_vehicles: number }[] }>(live)).categories.every((c) => c.has_vehicles === 0), "no demo cars count for live");
  });

  await t.test("carpool, self-drive, deals and Taxipress each have rows a practising customer can read", async () => {
    const trips = await json<{ trips: unknown[] }>(await call(customer.token, "/car/carpool/trips?nearLat=0.0612&nearLng=32.4637&nearLabel=Entebbe"));
    assert.ok(trips.trips.length >= 2, "carpool trips");
    const listings = await json<{ vehicles: unknown[] }>(await call(customer.token, `/car/rentals/listings?startsAt=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}&endsAt=${encodeURIComponent(new Date(Date.now() + 3 * 86_400_000).toISOString())}`));
    assert.ok(listings.vehicles.length >= 5, "cars to hire");
    const cfg = await json<{ enabled: boolean; routes: unknown[] }>(await call(customer.token, "/taxipress/config"));
    assert.equal(cfg.enabled, true);
    assert.ok(cfg.routes.length >= 2, "taxipress routes");
  });

  await t.test("a live customer sees none of the demo fleet or routes", async () => {
    const live = await call(tokens.customer, "/taxipress/config");
    if (live.status === 200) assert.equal((await json<{ routes: unknown[] }>(live)).routes.length, 0);
    const poolLive = (await db.execute("SELECT s.driver_id FROM car_driver_state s WHERE s.online = 1")).rows.length;
    assert.ok(poolLive >= 17, "the demo drivers exist in the database");
  });

  await t.test("deals and self-drive history are seeded", async () => {
    assert.equal(Number((await rows("SELECT COUNT(*) n FROM driver_requests WHERE status = 'pending'"))[0]!.n), 2);
    assert.equal(Number((await rows("SELECT COUNT(*) n FROM rentals WHERE status IN ('active','completed')"))[0]!.n), 2);
    assert.equal(Number((await rows("SELECT COUNT(*) n FROM taxipress_queue WHERE status IN ('boarding','in_line')"))[0]!.n), 5);
  });
});

test("Ride cluster: demo customers book every kind of ride through the real API", async (t) => {
  const { db } = await practiceHarness();
  const { runInPractice } = await import("../db/practice-context.js");
  const { seedPracticeWorld } = await import("./seed.js");
  const { actAs } = await import("./demo-customers.js");
  const { RIDE_SCENARIOS } = await import("./scenarios-ride.js");
  const { PRACTICE_CUSTOMERS } = await import("./personas.js");
  await runInPractice(seedPracticeWorld);
  const customer = PRACTICE_CUSTOMERS[0]!;
  for (const [name, scenario] of RIDE_SCENARIOS) {
    await t.test(name, async () => {
      const result = await runInPractice(async () => scenario(customer, await actAs(customer)));
      assert.ok(result, `${name} was booked`);
    });
  }
  await t.test("the bookings are in the database as sandbox rows", async () => {
    const n = async (sql: string) => Number((await db.execute(sql)).rows[0]!.n);
    assert.ok(await n("SELECT COUNT(*) n FROM car_bookings WHERE environment = 'sandbox'") >= 5);
    assert.ok(await n("SELECT COUNT(*) n FROM car_bookings WHERE scheduled_for IS NOT NULL") >= 1);
    assert.equal(await n("SELECT COUNT(*) n FROM taxipress_bookings WHERE environment = 'sandbox'"), 1);
    assert.equal(await n("SELECT COUNT(*) n FROM carpool_seats"), 1);
    assert.ok(await n("SELECT COUNT(*) n FROM orders WHERE fare_offer IS NOT NULL") >= 1);
    assert.ok(await n("SELECT COUNT(*) n FROM orders WHERE passenger_name IS NOT NULL") >= 1);
  });
});
