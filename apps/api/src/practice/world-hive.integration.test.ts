import assert from "node:assert/strict";
import test from "node:test";
import { practiceHarness } from "./world-test-helpers.js";

test("Hive and Money: Work, Hire and wallets are populated for every role", async (t) => {
  const { db, call, json, start } = await practiceHarness();
  const customer = await start("customer");
  const provider = await start("provider");
  const worker = await start("worker");
  const n = async (sql: string) => Number((await db.execute(sql)).rows[0]!.n);

  await t.test("work: jobs in every state, with offers, photos, chat, tracking, an arrival flag and ratings", async () => {
    const states = (await db.execute("SELECT DISTINCT status FROM work_jobs WHERE id LIKE 'prac\\_%' ESCAPE '\\' ORDER BY 1")).rows.map((r) => r.status);
    assert.deepEqual(states, ["booked", "cancelled", "disputed", "in_progress", "open", "quoted", "settled"]);
    assert.equal(await n("SELECT COUNT(*) n FROM work_offers"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM work_job_photos"), 4);
    assert.equal(await n("SELECT COUNT(*) n FROM work_job_locations"), 4);
    assert.equal(await n("SELECT COUNT(*) n FROM work_flags WHERE status = 'open'"), 1);
    assert.equal(await n("SELECT COUNT(*) n FROM work_jobs WHERE rating IS NOT NULL"), 3);
    assert.ok(await n("SELECT COUNT(*) n FROM work_messages") >= 12);
  });

  await t.test("work: the customer sees their jobs and the provider sees theirs", async () => {
    const mine = await json<{ jobs: unknown[] }>(await call(customer.token, "/work/jobs"));
    assert.ok(mine.jobs.length >= 1);
    const theirs = await json<{ jobs: unknown[] }>(await call(provider.token, "/work/provider/jobs"));
    assert.ok(Array.isArray(theirs.jobs));
    const open = await json<{ jobs: unknown[] }>(await call(provider.token, "/work/provider/jobs/open"));
    assert.ok(Array.isArray(open.jobs));
  });

  await t.test("hire: workers, jobs of every kind, applications, a running contract with milestones, ratings, a repeat job", async () => {
    assert.ok(await n("SELECT COUNT(*) n FROM talent_profiles WHERE environment = 'sandbox'") >= 5);
    const kinds = (await db.execute("SELECT DISTINCT type FROM talent_jobs ORDER BY 1")).rows.map((r) => r.type);
    assert.deepEqual(kinds, ["gig", "hiring", "project"]);
    assert.equal(await n("SELECT COUNT(*) n FROM talent_milestones"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM talent_reviews"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM talent_recurrences WHERE status = 'active'"), 1);
    assert.ok(await n("SELECT COUNT(*) n FROM talent_messages") >= 2);
  });

  await t.test("hire: an employer sees their jobs and a worker sees their applications", async () => {
    const jobs = await json<{ jobs: unknown[] }>(await call(customer.token, "/talent/jobs/mine"));
    assert.ok(jobs.jobs.length >= 2);
    const applications = await json<{ applications: unknown[] }>(await call(worker.token, "/talent/applications/mine"));
    assert.ok(applications.applications.length >= 1);
    const contracts = await json<{ contracts: unknown[] }>(await call(customer.token, "/talent/contracts"));
    assert.ok(contracts.contracts.length >= 1);
  });

  await t.test("money: wallet history, shared wallet, rider Pro and weekly subscription", async () => {
    const wallet = await json<{ transactions?: unknown[]; ledger?: unknown[] }>(await call(customer.token, "/wallet"));
    assert.ok(JSON.stringify(wallet).length > 20);
    assert.equal(await n("SELECT COUNT(*) n FROM riders WHERE pro_status = 'active'"), 2);
    assert.equal(await n("SELECT COUNT(*) n FROM riders WHERE subscription_status = 'active'"), 1);
    assert.equal(await n("SELECT COUNT(*) n FROM wallet_shares WHERE status = 'active'"), 1);
    assert.equal(await n("SELECT COUNT(*) n FROM wallet_withdrawals WHERE status = 'successful'"), 1);
  });
});
