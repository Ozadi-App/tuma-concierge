import assert from "node:assert/strict";
import test from "node:test";
import { runInPractice } from "../db/practice-context.js";
import { practiceHarness } from "./world-test-helpers.js";

test("Deliver and Buy: fuel, relay, pharmacy and live selling have demo data a practising user can use", async (t) => {
  const { db, tokens, call, json, post, start } = await practiceHarness();
  const customer = await start("customer");
  const n = async (sql: string) => Number((await db.execute(sql)).rows[0]!.n);

  await t.test("fuel: stations are listed in practice and not for the live platform", async () => {
    const practice = await json<{ outlets: { id: string }[] }>(await call(customer.token, "/gas/stations"));
    assert.ok(practice.outlets.filter((o) => o.id.startsWith("prac_fo_")).length === 3);
    const live = await json<{ outlets: { id: string }[] }>(await call(tokens.customer, "/gas/stations"));
    assert.ok(live.outlets.every((o) => !o.id.startsWith("prac_")));
  });

  await t.test("fuel: a pump attendant signs in to a practice shift and sees the day's dispenses", async () => {
    const session = await json<{ token: string; attendant: { outletId: string } }>(await post(tokens.customer, "/practice/session", { role: "gas" }));
    assert.equal(session.attendant.outletId, "prac_fo_1");
    const me = await call(session.token, "/gas/me");
    assert.equal(me.status, 200);
    const dispenses = await json<{ dispenses: unknown[] }>(await call(session.token, "/gas/dispenses"));
    assert.ok(dispenses.dispenses.length >= 1);
    const verified = await post(session.token, "/gas/verify-code", { code: "905555" });
    assert.equal(verified.status, 200, JSON.stringify(await json(verified)));
  });

  await t.test("fuel: a practice rider has fuel history", async () => {
    const rider = await start("rider", "rider");
    const history = await json<{ dispenses: unknown[] }>(await call(rider.token, "/gas/rider/dispenses"));
    assert.ok(history.dispenses.length >= 1);
  });

  await t.test("pharmacy: two licensed pharmacies, prescriptions at every stage", async () => {
    const pharmacies = await json<{ pharmacies: { id: string }[] }>(await call(customer.token, "/pharmacy/pharmacies"));
    assert.equal(pharmacies.pharmacies.length, 2);
    const statuses = (await db.execute("SELECT DISTINCT status FROM pharmacy_prescriptions ORDER BY 1")).rows.map((r) => r.status);
    assert.deepEqual(statuses, ["accepted", "pending_review", "quoted", "rejected"]);
    const mine = await json<{ prescriptions: { id: string }[] }>(await call(customer.token, "/pharmacy/prescriptions"));
    assert.ok(mine.prescriptions.length >= 1);
    const live = await json<{ pharmacies: unknown[] }>(await call(tokens.customer, "/pharmacy/pharmacies"));
    assert.equal(live.pharmacies.length, 0, "a live customer sees no practice pharmacy");
  });

  await t.test("live selling: a live stream with chat, and a replay", async () => {
    const live = await json<{ sessions?: unknown[]; stores?: unknown[] }>(await call(customer.token, "/marketplace/live"));
    assert.ok(JSON.stringify(live).includes("prac_live_1") || JSON.stringify(live).includes("Lakeside"), JSON.stringify(live).slice(0, 200));
    assert.equal(await n("SELECT COUNT(*) n FROM store_live_chats"), 5);
    assert.equal(await n("SELECT COUNT(*) n FROM store_ad_campaigns"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM store_subscriptions WHERE status = 'active'"), 1);
  });

  await t.test("relay: stops and matatu operators are in place on both routes", async () => {
    assert.equal(await n("SELECT COUNT(*) n FROM relay_route_stages WHERE route_id LIKE 'prac\\_%' ESCAPE '\\'"), 13);
    assert.equal(await n("SELECT COUNT(*) n FROM relay_operators WHERE status = 'approved'"), 3);
    const liveRoutes = await runInPractice(async () => n("SELECT COUNT(*) n FROM relay_routes WHERE active = 1"));
    assert.equal(liveRoutes, 6);
  });
});

test("Buy and Deliver: demo customers place a marketplace basket, a relay parcel and a parcel", async (t) => {
  await practiceHarness();
  const { runInPractice } = await import("../db/practice-context.js");
  const { seedPracticeWorld } = await import("./seed.js");
  const { actAs } = await import("./demo-customers.js");
  const { BUY_SCENARIOS } = await import("./scenarios-buy.js");
  const { PRACTICE_CUSTOMERS } = await import("./personas.js");
  await runInPractice(seedPracticeWorld);
  for (const [name, scenario] of BUY_SCENARIOS) {
    await t.test(name, async () => {
      const customer = PRACTICE_CUSTOMERS[1]!;
      assert.ok(await runInPractice(async () => scenario(customer, await actAs(customer))), `${name} was placed`);
    });
  }
});
