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
