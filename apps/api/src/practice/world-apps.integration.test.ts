import assert from "node:assert/strict";
import test from "node:test";
import { practiceHarness } from "./world-test-helpers.js";

test("Every partner app can practise on the shared world", async (t) => {
  const { db, call, json, start, tokens } = await practiceHarness();
  const n = async (sql: string, args: unknown[] = []) => Number((await db.execute({ sql, args: args as never })).rows[0]!.n);

  await t.test("pharmacy: the pharmacist sees their pharmacy and the prescriptions waiting", async () => {
    const pharmacist = await start("pharmacy");
    const me = await json(await call(pharmacist.token, "/pharmacy/me"));
    assert.ok(me.pharmacy?.id, JSON.stringify(me));
    const queue = await json<{ prescriptions: unknown[] }>(await call(pharmacist.token, "/pharmacy/pharmacist/prescriptions"));
    assert.ok(queue.prescriptions.length >= 2, `prescriptions ${queue.prescriptions.length}`);
  });

  await t.test("work: a provider and a worker each have their own jobs", async () => {
    const provider = await start("provider");
    assert.ok((await json<{ jobs: unknown[] }>(await call(provider.token, "/work/provider/jobs"))).jobs.length >= 1);
    const worker = await start("worker");
    assert.ok(worker.user.id.length > 0);
  });

  await t.test("partner: owner, driver, taxi driver and relay operator in one", async () => {
    const partner = await start("partner");
    assert.equal(partner.user.id, "prac_partner_1");
    const me = await json(await call(partner.token, "/car/me"));
    assert.equal(me.owner?.status ?? me.ownerStatus, "approved", JSON.stringify(me).slice(0, 300));
    assert.ok((me.vehicles ?? []).length >= 3, "owns cars");
    assert.equal((await call(partner.token, "/car/driver/jobs")).status, 200);
    assert.equal((await call(partner.token, "/car/carpool/my-trips")).status, 200);
    assert.equal((await call(partner.token, "/taxipress/taxi/me")).status, 200);
    const relay = await json(await call(partner.token, "/relay/operator/me"));
    assert.ok(relay.operator, JSON.stringify(relay).slice(0, 200));
  });

  await t.test("sales: the agent sees their book, registers a business, and nobody real is touched", async () => {
    const sales = await start("sales");
    assert.equal((await json(await call(sales.token, "/sales-access/status"))).status, "approved");
    const book = await json<{ records: Array<{ id: string; delivery_status: string | null }> }>(await call(sales.token, "/sales/onboarding"));
    assert.equal(book.records.length, 6);
    const usersBefore = await n("SELECT COUNT(*) n FROM users WHERE id NOT LIKE 'prac\\_%' ESCAPE '\\'");
    const made = await call(sales.token, "/sales/onboarding", { method: "POST", body: JSON.stringify({ requestId: crypto.randomUUID(), accountType: "customer", name: "Test Customer", phone: "0772123456", preferredChannel: "sms", consent: true }) });
    assert.equal(made.status, 201, JSON.stringify(await made.clone().json()));
    assert.equal((await json<{ records: unknown[] }>(await call(sales.token, "/sales/onboarding"))).records.length, 7);
    const again = await call(sales.token, `/sales/onboarding/${book.records[0]!.id}/resend`, { method: "POST" });
    assert.equal(again.status, 200);
    assert.equal(await n("SELECT COUNT(*) n FROM users WHERE id NOT LIKE 'prac\\_%' ESCAPE '\\'"), usersBefore, "no real account was made");
    const live = await json<{ agents: Array<{ user_id: string }> }>(await call(tokens.admin, "/admin/onboarding/agents"));
    assert.ok(!live.agents.some((a) => a.user_id.startsWith("prac_")), "admin's live list has no demo agents");
  });

  await t.test("tv: the demo living-room screen is paired and shows the learner's classes", async () => {
    const tv = await start("tv");
    assert.ok(tv.token.length >= 32);
    const me = await json(await fetchAs(tv.token, "/tv/me"));
    assert.equal(me.status, "paired", JSON.stringify(me));
  });

  async function fetchAs(secret: string, path: string) {
    const { default: app } = await import("../app.js");
    return app.request(`/v1${path}`, { headers: { Authorization: `Device ${secret}` } });
  }
});

test("the partner always has ride requests to look at", async () => {
  const { call, json, start } = await practiceHarness();
  const { topUpDemoOrders } = await import("./demo-customers.js");
  const { runInPractice } = await import("../db/practice-context.js");
  await start("customer");
  await runInPractice(() => topUpDemoOrders(1, 0));
  const partner = await start("partner");
  const jobs = await json<{ jobs: unknown[] }>(await call(partner.token, "/car/driver/jobs"));
  assert.ok(jobs.jobs.length >= 1, "a demo customer's ride request reaches the partner driver");
});

test("a partner drives a demo customer's ride all the way: offer, be chosen, be paid for, drive, hand over, settle, be rated and paid out", async () => {
  const { db, call, json, start } = await practiceHarness();
  const { actAs, runDemoCustomerAutopilot } = await import("./demo-customers.js");
  const { carNow } = await import("./scenarios-ride.js");
  const { PRACTICE_CUSTOMERS } = await import("./personas.js");
  const { runInPractice } = await import("../db/practice-context.js");
  await start("customer");
  const rider = PRACTICE_CUSTOMERS[2]!;
  const orderId = await runInPractice(async () => String(await carNow(rider, await actAs(rider))));
  assert.ok(orderId.startsWith("ord"), `a ride was requested (${orderId})`);
  const autopilot = () => runInPractice(() => runDemoCustomerAutopilot());
  const stage = async () => String((await db.execute({ sql: "SELECT stage FROM orders WHERE id = ?", args: [orderId] })).rows[0]!.stage);
  const partner = await start("partner");
  const act = async (path: string, body: unknown = {}) => { const res = await call(partner.token, path, { method: "POST", body: JSON.stringify(body) }); assert.ok(res.status < 300, `${path} ${res.status} ${JSON.stringify(await res.clone().json().catch(() => ({})))}`); };

  await act("/car/driver/online", { online: true, vehicleId: "prac_veh_pp1", position: { lat: 0.0612, lng: 32.4637 } });
  const jobs = await json<{ jobs: Array<{ id: string }> }>(await call(partner.token, "/car/driver/jobs"));
  assert.ok(jobs.jobs.some((j) => j.id === orderId), "the ride is on the partner's list");
  await act(`/car/orders/${orderId}/apply`);
  assert.ok(await autopilot() >= 1, "the customer picks the partner");
  assert.equal((await db.execute({ sql: "SELECT rider_id FROM orders WHERE id = ?", args: [orderId] })).rows[0]!.rider_id, "prac_partner_1");
  assert.ok(await autopilot() >= 1, "the customer pays");
  assert.equal(await stage(), "Shop");
  await act(`/orders/${orderId}/deliver`, { etaMinutes: 8 });
  assert.ok(await autopilot() >= 1, "the customer gives the PIN");
  assert.equal(await stage(), "Handover");
  await act(`/orders/${orderId}/settle`);
  assert.equal(await stage(), "Settle");
  assert.ok(await autopilot() >= 1, "the customer rates the driver");
  const booking = (await db.execute({ sql: "SELECT status, driver_amount, owner_amount FROM car_bookings WHERE order_id = ?", args: [orderId] })).rows[0]!;
  assert.equal(booking.status, "completed");
  assert.ok(Number(booking.driver_amount) + Number(booking.owner_amount) > 0, "the fare was shared out");
  const wallet = await json(await call(partner.token, "/car/wallet"));
  assert.ok(JSON.stringify(wallet).length > 2, "the partner can see their earnings");
  const active = await json<{ recent: unknown[]; totalEarned: number }>(await call(partner.token, "/car/driver/active"));
  assert.ok(active.recent.length >= 1 && active.totalEarned > 0, "the finished ride shows in the driver's history");
});

test("a customer hires a demo worker: post, invite, be answered, hire, work handed in, pay, review", async () => {
  const { db, call, json, post, start } = await practiceHarness();
  const { runDemoWorkerAutopilot } = await import("./demo-workers.js");
  const { runInPractice } = await import("../db/practice-context.js");
  const customer = await start("customer");

  const workers = await json<{ workers: Array<{ id: string; name: string }> }>(await call(customer.token, "/talent/workers"));
  assert.ok(workers.workers.filter((w) => w.id.startsWith("prac_wk_")).length >= 10, "Entebbe's own workers are listed");
  const plumber = workers.workers.find((w) => w.id === "prac_wk_plumber")!;
  assert.ok(plumber, "the plumber can be found");

  const posted = await post(customer.token, "/talent/jobs", {
    type: "gig", title: "Fix a leaking kitchen tap", description: "The tap under the sink drips all day. Please replace the washer or the tap.", categoryId: "tcat_repairs",
    area: "Kitoro", remote: false, budgetMinUgx: 40_000, budgetMaxUgx: 60_000, paymentMode: "escrow", acceptRules: true,
  });
  assert.equal(posted.status, 201, JSON.stringify(await posted.clone().json()));
  const jobId = String((await posted.json() as any).job.id);
  const job = (await db.execute({ sql: "SELECT status FROM talent_jobs WHERE id = ?", args: [jobId] })).rows[0]!;
  assert.equal(job.status, "open", "the job is live straight away");
  assert.equal((await post(customer.token, `/talent/jobs/${jobId}/invite`, { workerId: plumber.id })).status, 200);

  const autopilot = () => runInPractice(() => runDemoWorkerAutopilot());
  assert.ok(await autopilot() >= 1, "the plumber answers the invitation");
  const apps = await json<{ applicants: unknown[] }>(await call(customer.token, `/talent/jobs/${jobId}/applications`));
  assert.ok(apps.applicants.length >= 1, "applications arrived");
  const application = (await db.execute({ sql: "SELECT id FROM talent_applications WHERE job_id = ? AND worker_id = ?", args: [jobId, plumber.id] })).rows[0];
  assert.ok(application, "the plumber applied");

  const accepted = await post(customer.token, `/talent/applications/${String(application!.id)}/accept`, {});
  assert.equal(accepted.status, 201, JSON.stringify(await accepted.clone().json()));
  const contractId = String((await db.execute({ sql: "SELECT id FROM talent_contracts WHERE job_id = ?", args: [jobId] })).rows[0]!.id);

  assert.ok(await autopilot() >= 1, "the plumber does the work and hands it in");
  const submitted = (await db.execute({ sql: "SELECT status FROM talent_milestones WHERE contract_id = ?", args: [contractId] })).rows.map((r) => r.status);
  assert.ok(submitted.includes("submitted"), `work was handed in (${submitted})`);

  const released = await post(customer.token, `/talent/contracts/${contractId}/release`, {});
  assert.equal(released.status, 200, JSON.stringify(await released.clone().json()));
  assert.equal(String((await db.execute({ sql: "SELECT status FROM talent_contracts WHERE id = ?", args: [contractId] })).rows[0]!.status), "settled");
  assert.equal((await post(customer.token, `/talent/contracts/${contractId}/review`, { rating: 5, comment: "Fixed it the same day." })).status, 200);

  const { resetPracticeWorld } = await import("./seed.js");
  await runInPractice(resetPracticeWorld);
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) n FROM talent_jobs WHERE id = ?", args: [jobId] })).rows[0]!.n), 0, "a reset clears jobs posted while practising");
  assert.ok(Number((await db.execute("SELECT COUNT(*) n FROM talent_jobs WHERE id LIKE 'prac\\_tj\\_%' ESCAPE '\\'")).rows[0]!.n) >= 2, "and keeps the seeded ones");
});

test("a customer books a Work service and a demo provider takes it all the way", async () => {
  const { db, call, json, post, start } = await practiceHarness();
  const { runDemoProviderAutopilot } = await import("./demo-workers.js");
  const { runInPractice } = await import("../db/practice-context.js");
  const customer = await start("customer");
  const catalog = await json<{ services: Array<{ id: string; name: string; pricingMode?: string; pricing_mode?: string }> }>(await call(customer.token, "/work/catalog"));
  const service = catalog.services.find((s) => (s.pricingMode ?? s.pricing_mode) === "fixed") ?? catalog.services[0]!;
  assert.ok(service, "services are on offer");
  const booked = await post(customer.token, "/work/jobs", { serviceId: service.id, address: "Kitoro, Entebbe", area: "Kitoro", lat: 0.0558, lng: 32.4692, details: "Please come this afternoon." });
  assert.equal(booked.status, 201, JSON.stringify(await booked.clone().json()));
  const jobId = String((await booked.json() as any).job.id);
  const status = async () => String((await db.execute({ sql: "SELECT status FROM work_jobs WHERE id = ?", args: [jobId] })).rows[0]!.status);
  const autopilot = () => runInPractice(() => runDemoProviderAutopilot());
  const seen: string[] = [await status()];
  for (let i = 0; i < 6 && !["completed", "settled"].includes(await status()); i++) {
    await autopilot();
    const now = await status();
    if (now !== seen[seen.length - 1]) seen.push(now);
    if (now === "quoted") assert.equal((await post(customer.token, `/work/jobs/${jobId}/quote/accept`, {})).status, 200);
    if (now === "open" && (await db.execute({ sql: "SELECT COUNT(*) n FROM work_offers WHERE job_id = ?", args: [jobId] })).rows[0]!.n) {
      const offer = (await db.execute({ sql: "SELECT id FROM work_offers WHERE job_id = ? LIMIT 1", args: [jobId] })).rows[0]!;
      assert.equal((await post(customer.token, `/work/jobs/${jobId}/offers/${String(offer.id)}/select`, {})).status, 200);
    }
  }
  assert.ok(seen.includes("booked") || seen.includes("assigned"), `a provider took the job (${seen.join(" > ")})`);
  assert.equal(await status(), "completed", `the provider finished the work (${seen.join(" > ")})`);
  assert.equal((await post(customer.token, `/work/jobs/${jobId}/confirm`, {})).status, 200);
  assert.equal((await post(customer.token, `/work/jobs/${jobId}/rate`, { rating: 5, comment: "On time and tidy." })).status, 200);
});

test("demo car drivers take a ride all the way, by themselves", async () => {
  const { db, start } = await practiceHarness();
  const { actAs, runDemoCustomerAutopilot } = await import("./demo-customers.js");
  const { runDemoDriverAutopilot } = await import("./demo-drivers.js");
  const { carNow } = await import("./scenarios-ride.js");
  const { PRACTICE_CUSTOMERS } = await import("./personas.js");
  const { runInPractice } = await import("../db/practice-context.js");
  await start("customer");
  const rider = PRACTICE_CUSTOMERS[3]!;
  const orderId = await runInPractice(async () => String(await carNow(rider, await actAs(rider))));
  assert.ok(orderId.startsWith("ord"), `a ride was requested (${orderId})`);

  const tick = () => runInPractice(async () => ({ drivers: await runDemoDriverAutopilot(), customers: await runDemoCustomerAutopilot() }));
  assert.equal((await tick()).drivers, 0, "a ride that has only just been asked for is left for a practising partner first");
  await db.execute({ sql: "UPDATE orders SET created_at = datetime('now', '-10 minutes') WHERE id = ?", args: [orderId] });
  const stages: string[] = [];
  for (let i = 0; i < 10; i++) {
    await tick();
    const stage = String((await db.execute({ sql: "SELECT stage FROM orders WHERE id = ?", args: [orderId] })).rows[0]!.stage);
    if (stages[stages.length - 1] !== stage) stages.push(stage);
    const rated = Number((await db.execute({ sql: "SELECT COUNT(*) n FROM order_ratings WHERE order_id = ?", args: [orderId] })).rows[0]!.n);
    if (stage === "Settle" && rated) break;
  }
  assert.deepEqual(stages.slice(-1), ["Settle"], `the ride finished (${stages.join(" > ")})`);
  const booking = (await db.execute({ sql: "SELECT status, driver_id, driver_amount FROM car_bookings WHERE order_id = ?", args: [orderId] })).rows[0]!;
  assert.equal(booking.status, "completed");
  assert.ok(String(booking.driver_id).startsWith("prac_cdrv_"), "a demo driver drove it");
  assert.ok(Number(booking.driver_amount) > 0, "and was paid");
  assert.equal(Number((await db.execute({ sql: "SELECT COUNT(*) n FROM order_ratings WHERE order_id = ?", args: [orderId] })).rows[0]!.n), 1, "and was rated");
});

test("Taxipress has demo routes, and admin decides which luggage options and languages passengers see", async (t) => {
  const { db, call, json, post, start, tokens } = await practiceHarness();
  const customer = await start("customer");
  const put = (token: string, path: string, body: unknown) => call(token, path, { method: "PUT", body: JSON.stringify(body) });

  await t.test("the Kampala routes are there, each with taxis in the line", async () => {
    const config = await json<{ routes: Array<{ id: string; fromName: string; toName: string }> }>(await call(customer.token, "/taxipress/config"));
    const pairs = new Set(config.routes.map((r) => `${r.fromName} > ${r.toName}`));
    for (const wanted of ["Kampala Old Taxi Park > Mukono Taxi Park", "Kampala Old Taxi Park > Ntinda Stage", "Kampala Old Taxi Park > Naalya Stage", "Busega Roundabout > Naalya Stage"]) assert.ok(pairs.has(wanted), `${wanted} is offered`);
    assert.ok(new Set(config.routes.map((r) => r.id.replace(/_(a_to_b|b_to_a)$/, ""))).size >= 5, "at least five routes");
    for (const id of ["prac_rr_mukono", "prac_rr_ntinda", "prac_rr_naalya", "prac_rr_busega_naalya"]) {
      const queue = await json<{ line: unknown[] }>(await call(customer.token, `/taxipress/routes/${id}_a_to_b/queue`));
      assert.ok(queue.line.length >= 2, `${id} has taxis in the line`);
    }
  });

  await t.test("luggage: admin picks how many options show", async () => {
    const cfg = async () => json<{ luggageTypes: string[] }>(await call(customer.token, "/taxipress/config"));
    assert.equal((await cfg()).luggageTypes.length, 6, "all six by default");
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { luggageOptionsShown: 3 })).status, 200);
    assert.deepEqual((await cfg()).luggageTypes, ["personal", "standard", "large"]);
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { luggageOptionsShown: 0 })).status, 400, "at least one");
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { luggageOptionsShown: 7 })).status, 400, "no more than there are");
    const queueId = String((await db.execute("SELECT id FROM taxipress_queue WHERE id = 'prac_q_7'")).rows[0]!.id);
    const booked = await post(customer.token, "/taxipress/bookings", { queueId, adults: 1, luggage: { standard: 1, excess: 2 }, payment: "cash" });
    assert.equal(booked.status, 201, JSON.stringify(await booked.clone().json()));
    const saved = JSON.parse(String((await db.execute("SELECT luggage_json FROM taxipress_bookings ORDER BY rowid DESC LIMIT 1")).rows[0]!.luggage_json));
    assert.deepEqual(saved, { standard: 1 }, "a type that isn't offered is left off the booking");
  });

  await t.test("languages: admin adds, removes and chooses which are displayed", async () => {
    const cfg = async () => json<{ languages: Array<{ code: string; name: string }> }>(await call(customer.token, "/taxipress/config"));
    assert.deepEqual((await cfg()).languages.map((l) => l.code), ["en", "lg", "sw"]);
    const list = [{ code: "en", name: "English", enabled: true }, { code: "lg", name: "Luganda", enabled: true }, { code: "sw", name: "Swahili", enabled: false }, { code: "rw", name: "Kinyarwanda", enabled: true }];
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { languages: list })).status, 200);
    assert.deepEqual((await cfg()).languages.map((l) => l.code), ["en", "lg", "rw"], "a hidden language isn't shown; an added one is");
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { languages: [...list, { code: "en", name: "Again", enabled: true }] })).status, 400, "no duplicates");
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { languages: [{ code: "not a code", name: "x", enabled: true }] })).status, 400);
    const queueId = "prac_q_9";
    const bad = await post(customer.token, "/taxipress/bookings", { queueId, adults: 1, language: "sw", payment: "cash" });
    assert.equal(bad.status, 400, "a hidden language can't be chosen");
    const good = await post(customer.token, "/taxipress/bookings", { queueId, adults: 1, language: "rw", payment: "cash" });
    assert.equal(good.status, 201, JSON.stringify(await good.clone().json()));
    assert.equal(String((await db.execute("SELECT language FROM taxipress_bookings ORDER BY rowid DESC LIMIT 1")).rows[0]!.language), "rw");
    assert.equal((await put(tokens.admin, "/admin/taxipress/settings", { languages: [list[0]] })).status, 200, "languages can be removed");
    assert.deepEqual((await cfg()).languages.map((l) => l.code), ["en"]);
  });
});
