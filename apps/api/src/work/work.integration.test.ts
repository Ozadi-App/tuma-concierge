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
import { splitHeld } from "./service.js";
import { resetWorkSchemaCache } from "./service.js";
import { sweepWork } from "./scheduled.js";
import { setWorkSettings } from "./settings.js";

process.env.JWT_SECRET = "work-test-only-secret";

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
const KAMPALA = { lat: 0.3136, lng: 32.5811 };
const HOUSE = "wsv_clean_house_standard"; // fixed, UGX 35,000 per bedroom
const WINDOW = "wsv_clean_item_window"; // quote, call-out UGX 10,000

async function setup() {
  resetSchemaCache();
  resetWorkSchemaCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  await setWorkSettings({
    enabled: true, serviceTypes: ["clean"], pricingModes: ["fixed", "quote"], matchingModes: ["broadcast", "customer_picks", "admin_assigns"], defaultMatching: "broadcast",
    providerKinds: ["individual", "company"], commissionPercent: 15, requireApproval: true, offerWindowMinutes: 60, radiusKm: 15, maxNotified: 20, minLeadMinutes: 30,
    maxAdvanceDays: 30, quoteValidHours: 24, maxQuoteUgx: 5_000_000, freeCancelMinutes: 10, lateCancelFeePercent: 20, autoConfirmHours: 24, disputeWindowHours: 48, jobsPerHour: 100,
  });

  let n = 0;
  const mkUser = async (id: string, opts: { role?: "customer" | "admin"; wallet?: number } = {}) => {
    n += 1;
    await client.execute({
      sql: "INSERT INTO users (id, phone, name, role, password_hash, wallet_balance, admin_role) VALUES (?, ?, ?, ?, 'x', ?, ?)",
      args: [id, `+25670000${String(n).padStart(4, "0")}`, `User ${id}`, opts.role ?? "customer", opts.wallet ?? 0, opts.role === "admin" ? "super_admin" : null],
    });
    return signToken({ sub: id, role: opts.role ?? "customer" });
  };
  const wallet = async (id: string) => Number((await client.execute({ sql: "SELECT wallet_balance AS b FROM users WHERE id = ?", args: [id] })).rows[0].b);
  const call = async (path: string, opts: { method?: string; token?: string; body?: unknown } = {}) => {
    const res = await app.request(`/v1/work${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  };

  const admin = await mkUser("admin_w", { role: "admin" });
  /** A registered, approved, online provider near the job. */
  const mkProvider = async (id: string, services: string[] = [HOUSE, WINDOW], kind: "individual" | "company" = "individual", approve = true) => {
    const token = await mkUser(id);
    const reg = await call("/provider/register", { token, body: { kind, displayName: `Provider ${id}`, ...(kind === "company" ? { companyName: `${id} Cleaners Ltd` } : {}), serviceIds: services } });
    assert.equal(reg.status, 201, JSON.stringify(reg.json));
    if (approve) {
      await call(`/admin/providers/${reg.json.provider.id}/approve`, { token: admin, body: {} });
      await call("/provider/me", { method: "PUT", token, body: { online: true, ...KAMPALA } });
    }
    return { token, providerId: reg.json.provider.id as string };
  };
  const book = (token: string, extra: Json = {}) =>
    call("/jobs", { token, body: { serviceId: HOUSE, quantity: 2, address: "Plot 5 Kololo", area: "Kololo", ...KAMPALA, details: "Two bedroom flat", ...extra } });
  const dbJob = async (id: string) => (await client.execute({ sql: "SELECT * FROM work_jobs WHERE id = ?", args: [id] })).rows[0] as Json;
  return { client, call, mkUser, mkProvider, wallet, admin, book, dbJob };
}

test("work: split of held money always adds up", () => {
  for (const [held, pct, refund] of [[70000, 15, 0], [70000, 15, 70000], [70000, 15, 35000], [33333, 12.5, 11111], [1, 60, 0], [10000, 0, 2500]] as const) {
    const s = splitHeld(held, pct, refund);
    assert.equal(s.refund + s.commission + s.payout, held, `${held}/${pct}/${refund}`);
    assert.ok(s.payout >= 0 && s.commission >= 0 && s.refund >= 0);
  }
});

test("work: fixed price + broadcast — pay, accept, do, confirm, rate", async () => {
  const { call, mkUser, mkProvider, wallet, book, dbJob } = await setup();
  const customer = await mkUser("cust_1", { wallet: 200000 });
  const pro = await mkProvider("pro_1");

  const catalog = await call("/catalog?type=clean", { token: customer });
  assert.ok(catalog.json.services.length >= 10);
  assert.ok(catalog.json.services.every((s: Json) => s.type === "clean"));

  const booked = await book(customer);
  assert.equal(booked.status, 201, JSON.stringify(booked.json));
  const jobId = booked.json.job.id;
  assert.equal(booked.json.job.priceUgx, 70000, "price comes from the catalogue: 2 bedrooms × 35,000");
  assert.equal(booked.json.job.status, "open");
  assert.equal(await wallet("cust_1"), 130000, "the customer's money is held when they book");

  const open = await call("/provider/jobs/open", { token: pro.token });
  assert.equal(open.json.jobs.length, 1);
  assert.equal(open.json.jobs[0].customer, null, "who the customer is stays private until the job is theirs");
  assert.equal((await call(`/provider/jobs/${jobId}/accept`, { token: pro.token, body: {} })).status, 200);
  assert.equal((await dbJob(jobId)).status, "booked");
  const mine = await call("/provider/jobs", { token: pro.token });
  assert.equal(mine.json.jobs[0].customer.name, "User cust_1", "once it is theirs, they can reach the customer");
  assert.equal(mine.json.jobs[0].commissionPercent, 15);
  assert.equal((await call(`/provider/jobs/${jobId}`, { token: pro.token })).json.job.customer.name, "User cust_1");
  const rival = await mkProvider("pro_rival");
  assert.equal((await call(`/provider/jobs/${jobId}`, { token: rival.token })).status, 404, "another provider can't open it");

  assert.equal((await call(`/provider/jobs/${jobId}/complete`, { token: pro.token, body: {} })).status, 409, "can't finish a job that hasn't started");
  assert.equal((await call(`/provider/jobs/${jobId}/start`, { token: pro.token, body: {} })).status, 200);
  assert.equal((await call(`/jobs/${jobId}/confirm`, { token: customer, body: {} })).status, 409, "can't confirm before it is done");
  assert.equal((await call(`/provider/jobs/${jobId}/complete`, { token: pro.token, body: {} })).status, 200);

  // Confirming pays the provider once, even if the button is hammered.
  const confirms = await Promise.all([1, 2, 3, 4].map(() => call(`/jobs/${jobId}/confirm`, { token: customer, body: {} })));
  assert.equal(confirms.filter((r) => r.status === 200).length, 1);
  assert.equal(await wallet("pro_1"), 59500, "70,000 less 15% commission");
  assert.equal(await wallet("cust_1"), 130000);
  const done = await dbJob(jobId);
  assert.equal(done.status, "settled");
  assert.equal(done.commission_ugx, 10500);

  assert.equal((await call(`/jobs/${jobId}/rate`, { token: customer, body: { rating: 5, review: "Spotless" } })).status, 200);
  assert.equal((await call(`/jobs/${jobId}/rate`, { token: customer, body: { rating: 1 } })).status, 409, "one rating per job");
  const me = await call("/provider/me", { token: pro.token });
  assert.equal(me.json.provider.rating, 5);
  assert.equal(me.json.provider.jobsCompleted, 1);
  const earnings = await call("/provider/earnings", { token: pro.token });
  assert.equal(earnings.json.paidUgx, 59500);
});

test("work: quote after inspection — quote, accept, pay the difference, decline, lapse", async () => {
  const { call, mkUser, mkProvider, wallet, book, dbJob, client } = await setup();
  const customer = await mkUser("cust_q", { wallet: 100000 });
  const pro = await mkProvider("pro_q");

  const booked = await book(customer, { serviceId: WINDOW, quantity: 5 });
  const jobId = booked.json.job.id;
  assert.equal(booked.json.job.quantity, 1, "a quote job is one job");
  assert.equal(booked.json.job.heldUgx, 10000, "only the call-out fee is held at first");
  assert.equal(await wallet("cust_q"), 90000);

  assert.equal((await call(`/provider/jobs/${jobId}/accept`, { token: pro.token, body: {} })).status, 200);
  assert.equal((await dbJob(jobId)).status, "assigned");
  assert.equal((await call(`/provider/jobs/${jobId}/start`, { token: pro.token, body: {} })).status, 409, "no work before a quote is agreed");
  assert.equal((await call(`/provider/jobs/${jobId}/quote`, { token: pro.token, body: { priceUgx: 5000 } })).status, 400, "a quote can't be below the call-out fee");
  assert.equal((await call(`/provider/jobs/${jobId}/quote`, { token: pro.token, body: { priceUgx: 60000 } })).status, 200);
  assert.equal((await call(`/provider/jobs/${jobId}/quote`, { token: pro.token, body: { priceUgx: 50000 } })).status, 200, "a quote can be revised");

  const accept = await Promise.all([1, 2, 3].map(() => call(`/jobs/${jobId}/quote/accept`, { token: customer, body: {} })));
  assert.ok(accept.some((r) => r.status === 200) && accept.every((r) => r.status === 200 || r.status === 409), "repeat taps are harmless");
  assert.equal(await wallet("cust_q"), 50000, "the 40,000 difference was taken exactly once");
  assert.equal((await dbJob(jobId)).status, "booked");
  assert.equal((await dbJob(jobId)).held_ugx, 50000);

  // A second job: the customer declines the quote and the provider keeps the call-out fee (less commission).
  const second = await book(customer, { serviceId: WINDOW });
  await call(`/provider/jobs/${second.json.job.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${second.json.job.id}/quote`, { token: pro.token, body: { priceUgx: 200000 } });
  const before = await wallet("pro_q");
  assert.equal((await call(`/jobs/${second.json.job.id}/quote/decline`, { token: customer, body: {} })).status, 200);
  assert.equal((await wallet("pro_q")) - before, 8500, "10,000 call-out less 15%");

  // A third: insufficient wallet to accept leaves it quoted and charges nothing.
  const third = await book(customer, { serviceId: WINDOW });
  await call(`/provider/jobs/${third.json.job.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${third.json.job.id}/quote`, { token: pro.token, body: { priceUgx: 900000 } });
  const walletBefore = await wallet("cust_q");
  const broke = await call(`/jobs/${third.json.job.id}/quote/accept`, { token: customer, body: {} });
  assert.equal(broke.status, 402);
  assert.equal(await wallet("cust_q"), walletBefore);
  assert.equal((await dbJob(third.json.job.id)).status, "quoted");

  // An old quote can't be accepted; the sweep lets it lapse and pays the call-out fee.
  await client.execute({ sql: "UPDATE work_jobs SET quote_expires_at = datetime('now', '-1 hour') WHERE id = ?", args: [third.json.job.id] });
  assert.equal((await call(`/jobs/${third.json.job.id}/quote/accept`, { token: customer, body: {} })).json.error, "quote_expired");
  const proBefore = await wallet("pro_q");
  assert.equal((await sweepWork()).lapsedQuotes, 1);
  assert.equal((await wallet("pro_q")) - proBefore, 8500);
});

test("work: customer chooses among offers (fixed and quote)", async () => {
  const { call, mkUser, mkProvider, wallet, book, dbJob } = await setup();
  const customer = await mkUser("cust_p", { wallet: 300000 });
  const a = await mkProvider("pro_a");
  const b = await mkProvider("pro_b");

  const job = (await book(customer, { matchingMode: "customer_picks" })).json.job;
  assert.equal((await call(`/provider/jobs/${job.id}/accept`, { token: a.token, body: {} })).json.error, "wrong_mode", "the customer chooses here, so accepting isn't allowed");
  assert.equal((await call(`/provider/jobs/${job.id}/offer`, { token: a.token, body: { etaMinutes: 30, message: "I can come now" } })).status, 200);
  assert.equal((await call(`/provider/jobs/${job.id}/offer`, { token: b.token, body: { etaMinutes: 90 } })).status, 200);

  const detail = await call(`/jobs/${job.id}`, { token: customer });
  assert.equal(detail.json.offers.length, 2);
  assert.ok(detail.json.offers.every((o: Json) => o.priceUgx === 70000), "a fixed price is the same for everyone");
  const offerB = detail.json.offers.find((o: Json) => o.provider.name === "Provider pro_b");
  assert.equal((await call(`/jobs/${job.id}/offers/${offerB.id}/select`, { token: customer, body: {} })).status, 200);
  assert.equal((await dbJob(job.id)).provider_id, b.providerId);
  assert.equal((await call(`/jobs/${job.id}/offers/${offerB.id}/select`, { token: customer, body: {} })).status, 409);
  assert.equal((await call("/provider/jobs/open", { token: a.token })).json.jobs.length, 0, "the other provider no longer sees it");

  // Quote job: providers name a price, and choosing one takes the extra from the wallet.
  const q = (await book(customer, { serviceId: WINDOW, matchingMode: "customer_picks" })).json.job;
  assert.equal((await call(`/provider/jobs/${q.id}/offer`, { token: a.token, body: {} })).status, 400, "a quote offer needs a price");
  await call(`/provider/jobs/${q.id}/offer`, { token: a.token, body: { priceUgx: 45000 } });
  const offers = (await call(`/jobs/${q.id}`, { token: customer })).json.offers;
  const before = await wallet("cust_p");
  assert.equal((await call(`/jobs/${q.id}/offers/${offers[0].id}/select`, { token: customer, body: {} })).status, 200);
  assert.equal(before - (await wallet("cust_p")), 35000, "45,000 less the 10,000 call-out already held");
  assert.equal((await dbJob(q.id)).status, "booked");
});

test("work: only one provider can take a job, however many try at once", async () => {
  const { call, mkUser, mkProvider, book, dbJob } = await setup();
  const customer = await mkUser("cust_r", { wallet: 100000 });
  const pros = await Promise.all(["r1", "r2", "r3", "r4"].map((id) => mkProvider(`pro_${id}`)));
  const job = (await book(customer)).json.job;
  const results = await Promise.all(pros.map((p) => call(`/provider/jobs/${job.id}/accept`, { token: p.token, body: {} })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal((await dbJob(job.id)).status, "booked");
});

test("work: admin assigns jobs when that mode is used; unassigned jobs stay out of provider feeds", async () => {
  const { call, mkUser, mkProvider, admin, book, dbJob } = await setup();
  const customer = await mkUser("cust_a", { wallet: 300000 });
  const pro = await mkProvider("pro_s");
  const adminJob = await book(customer, { matchingMode: "admin_assigns", lat: undefined, lng: undefined });
  const job = adminJob.json.job;
  assert.equal((await call("/provider/jobs/open", { token: pro.token })).json.jobs.length, 0);
  assert.equal((await call(`/admin/jobs/${job.id}/assign`, { token: customer, body: { providerId: pro.providerId } })).status, 403);
  assert.equal((await call(`/admin/jobs/${job.id}/assign`, { token: admin, body: { providerId: pro.providerId } })).status, 200);
  assert.equal((await dbJob(job.id)).status, "booked");

  // The wrong service can't be assigned.
  const other = await mkProvider("pro_t", ["wsv_clean_car_wash"]);
  const j2 = (await book(customer, { matchingMode: "admin_assigns" })).json.job;
  assert.equal((await call(`/admin/jobs/${j2.id}/assign`, { token: admin, body: { providerId: other.providerId } })).json.error, "service_mismatch");
});

test("work: the admin's switches decide what customers and providers can do", async () => {
  const { call, mkUser, mkProvider, book } = await setup();
  const customer = await mkUser("cust_s", { wallet: 500000 });
  await mkProvider("pro_s1");

  await setWorkSettings({ matchingModes: ["customer_picks"], defaultMatching: "customer_picks" });
  assert.equal((await book(customer)).json.job.matchingMode, "customer_picks", "the only enabled mode is used");
  assert.equal((await book(customer, { matchingMode: "broadcast" })).json.error, "matching_unavailable");

  await setWorkSettings({ pricingModes: ["fixed"] });
  assert.ok((await call("/catalog", { token: customer })).json.services.every((s: Json) => s.pricingMode === "fixed"));
  assert.equal((await book(customer, { serviceId: WINDOW })).json.error, "pricing_unavailable");

  await setWorkSettings({ serviceTypes: [] });
  const closed = await book(customer);
  assert.equal(closed.status, 403);
  await setWorkSettings({ serviceTypes: ["clean"], providerKinds: ["individual"] });
  const company = await mkUser("co_x", { wallet: 0 });
  assert.equal((await call("/provider/register", { token: company, body: { kind: "company", displayName: "Xco", companyName: "X Ltd", serviceIds: [HOUSE] } })).status, 403);

  await setWorkSettings({ enabled: false });
  assert.equal((await call("/catalog", { token: customer })).status, 503, "the master switch closes the customer side");
});

test("work: booking checks — wallet, location, schedule, quantity, double submit", async () => {
  const { call, mkUser, book, wallet, client } = await setup();
  const poor = await mkUser("cust_poor", { wallet: 5000 });
  const none = await book(poor);
  assert.equal(none.status, 402);
  assert.equal(await wallet("cust_poor"), 5000);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM work_jobs WHERE customer_id = 'cust_poor'")).rows[0].n), 0, "no job without payment");
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM work_money WHERE user_id = 'cust_poor'")).rows[0].n), 0);

  const customer = await mkUser("cust_c", { wallet: 1_000_000 });
  assert.equal((await book(customer, { lat: undefined, lng: undefined })).json.error, "location_required");
  assert.equal((await book(customer, { quantity: 99 })).json.error, "invalid_quantity");
  assert.equal((await book(customer, { scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString() })).json.error, "too_soon");
  assert.equal((await book(customer, { scheduledFor: new Date(Date.now() + 90 * 86_400_000).toISOString() })).json.error, "too_far");
  assert.equal((await book(customer, { scheduledFor: new Date(Date.now() + 3 * 3_600_000).toISOString() })).status, 201);
  assert.equal((await book(customer, { serviceId: "nope" })).status, 404);

  const before = await wallet("cust_c");
  const key = "idem-key-0001";
  const twice = await Promise.all([book(customer, { idempotencyKey: key }), book(customer, { idempotencyKey: key })]);
  assert.ok(twice.every((r) => r.status === 201 || r.status === 200));
  assert.equal(twice[0].json.job.id, twice[1].json.job.id, "the same booking");
  assert.equal(before - (await wallet("cust_c")), 70000, "charged once");
  assert.equal((await call("/jobs", { token: customer })).json.jobs.length, 2);
});

test("work: cancelling — refunds, late fee, provider cancel, and the point of no return", async () => {
  const { call, mkUser, mkProvider, wallet, book, dbJob, client } = await setup();
  const customer = await mkUser("cust_x", { wallet: 500000 });
  const pro = await mkProvider("pro_x");

  const open = (await book(customer)).json.job;
  assert.equal((await call(`/jobs/${open.id}/cancel`, { token: customer, body: {} })).status, 200);
  assert.equal(await wallet("cust_x"), 500000, "cancelled before anyone took it: full refund");
  assert.equal((await call(`/jobs/${open.id}/cancel`, { token: customer, body: {} })).status, 409);
  assert.equal(await wallet("cust_x"), 500000, "and never refunded twice");

  // Within the free window: full refund.
  const early = (await book(customer)).json.job;
  await call(`/provider/jobs/${early.id}/accept`, { token: pro.token, body: {} });
  await call(`/jobs/${early.id}/cancel`, { token: customer, body: {} });
  assert.equal(await wallet("cust_x"), 500000);
  assert.equal(await wallet("pro_x"), 0);

  // After the free window: the provider gets 20% of what was held, less commission.
  const late = (await book(customer)).json.job;
  await call(`/provider/jobs/${late.id}/accept`, { token: pro.token, body: {} });
  await client.execute({ sql: "UPDATE work_jobs SET assigned_at = datetime('now', '-2 hours') WHERE id = ?", args: [late.id] });
  await call(`/jobs/${late.id}/cancel`, { token: customer, body: {} });
  assert.equal(await wallet("cust_x"), 500000 - 14000, "customer loses the 20% fee: 70,000 × 20%");
  assert.equal(await wallet("pro_x"), 11900, "14,000 less 15%");

  // The provider cancelling always refunds in full.
  const dropped = (await book(customer)).json.job;
  await call(`/provider/jobs/${dropped.id}/accept`, { token: pro.token, body: {} });
  assert.equal((await call(`/provider/jobs/${dropped.id}/cancel`, { token: pro.token, body: {} })).status, 200);
  assert.equal(await wallet("cust_x"), 500000 - 14000);

  // Once work starts, cancelling is not on offer; there is a report-a-problem route instead.
  const started = (await book(customer)).json.job;
  await call(`/provider/jobs/${started.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${started.id}/start`, { token: pro.token, body: {} });
  assert.equal((await call(`/jobs/${started.id}/cancel`, { token: customer, body: {} })).status, 409);
  assert.equal((await call(`/provider/jobs/${started.id}/cancel`, { token: pro.token, body: {} })).status, 409);
  assert.equal((await dbJob(started.id)).status, "in_progress");
});

test("work: reporting a problem — admin splits the money; nobody else can", async () => {
  const { call, mkUser, mkProvider, wallet, admin, book, client } = await setup();
  const customer = await mkUser("cust_d", { wallet: 200000 });
  const pro = await mkProvider("pro_d");
  const job = (await book(customer)).json.job;
  await call(`/provider/jobs/${job.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${job.id}/start`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${job.id}/complete`, { token: pro.token, body: {} });

  assert.equal((await call(`/jobs/${job.id}/dispute`, { token: customer, body: { reason: "x" } })).status, 400);
  assert.equal((await call(`/jobs/${job.id}/dispute`, { token: customer, body: { reason: "Bathroom wasn't cleaned" } })).status, 200);
  assert.equal((await call(`/jobs/${job.id}/confirm`, { token: customer, body: {} })).status, 409, "a reported job can't be confirmed");

  assert.equal((await call(`/admin/jobs/${job.id}/resolve`, { token: customer, body: { outcome: "refund", note: "give it back" } })).status, 403);
  assert.equal((await call(`/admin/jobs/${job.id}/resolve`, { token: admin, body: { outcome: "split", note: "half" } })).status, 400, "a split needs a percentage");
  assert.equal((await call(`/admin/jobs/${job.id}/resolve`, { token: admin, body: { outcome: "split", refundPercent: 50, note: "Half done" } })).status, 200);
  assert.equal(await wallet("cust_d"), 130000 + 35000, "half comes back");
  assert.equal(await wallet("pro_d"), 29750, "the other half, less 15%");
  assert.equal((await call(`/admin/jobs/${job.id}/resolve`, { token: admin, body: { outcome: "refund", note: "again" } })).status, 409, "resolved once");
  assert.equal(await wallet("cust_d"), 165000);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM admin_activity_log WHERE action = 'work.job.resolve'")).rows[0].n), 1);

  // The review window closes.
  const late = (await book(customer)).json.job;
  await call(`/provider/jobs/${late.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${late.id}/start`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${late.id}/complete`, { token: pro.token, body: {} });
  await client.execute({ sql: "UPDATE work_jobs SET completed_at = datetime('now', '-3 days') WHERE id = ?", args: [late.id] });
  assert.equal((await call(`/jobs/${late.id}/dispute`, { token: customer, body: { reason: "Too late to complain" } })).status, 409);
});

test("work: providers — approval, companies and staff", async () => {
  const { call, mkUser, mkProvider, wallet, admin, book, dbJob, client } = await setup();
  const customer = await mkUser("cust_t", { wallet: 300000 });

  // Unapproved providers can register but can't work.
  const pending = await mkProvider("pro_pending", [HOUSE], "individual", false);
  assert.equal((await call("/provider/me", { method: "PUT", token: pending.token, body: { online: true } })).status, 403);
  const job = (await book(customer)).json.job;
  assert.equal((await call("/provider/jobs/open", { token: pending.token })).status, 403);
  assert.equal((await call(`/admin/providers/${pending.providerId}/approve`, { token: pending.token, body: {} })).status, 403, "providers can't approve themselves");
  await call(`/admin/providers/${pending.providerId}/approve`, { token: admin, body: {} });
  assert.equal((await call(`/admin/providers/${pending.providerId}/approve`, { token: admin, body: {} })).status, 409, "already approved");
  await call(`/admin/providers/${pending.providerId}/suspend`, { token: admin, body: { note: "complaints" } });
  assert.equal((await call(`/provider/jobs/${job.id}/accept`, { token: pending.token, body: {} })).status, 403, "suspended providers lose access at once");
  assert.equal((await call("/provider/register", { token: pending.token, body: { kind: "individual", displayName: "Again", serviceIds: [HOUSE] } })).status, 409);

  // A company: the owner takes the job, assigns a staff member, who does it; the owner is paid.
  const company = await mkProvider("pro_co", [HOUSE], "company");
  const staffToken = await mkUser("staff_1");
  const found = await call("/provider/staff", { token: company.token, body: { identifier: "+256700099999" } });
  assert.equal(found.status, 404, "unknown people can't be added");
  const phone = (await client.execute({ sql: "SELECT phone FROM users WHERE id = 'staff_1'", args: [] })).rows[0].phone as string;
  assert.equal((await call("/provider/staff", { token: company.token, body: { identifier: phone } })).status, 201);
  assert.equal((await call("/provider/staff", { token: staffToken, body: { identifier: phone } })).status, 403, "staff aren't provider owners");

  const j = (await book(customer)).json.job;
  assert.equal((await call(`/provider/jobs/${j.id}/accept`, { token: staffToken, body: {} })).status, 403, "staff can't take new jobs");
  await call(`/provider/jobs/${j.id}/accept`, { token: company.token, body: {} });
  assert.equal((await call(`/provider/jobs/${j.id}/start`, { token: staffToken, body: {} })).status, 404, "staff only see jobs assigned to them");
  assert.equal((await call(`/provider/jobs/${j.id}/assign-worker`, { token: company.token, body: { workerId: "someone_else" } })).status, 404);
  assert.equal((await call(`/provider/jobs/${j.id}/assign-worker`, { token: company.token, body: { workerId: "staff_1" } })).status, 200);
  assert.equal((await call("/provider/jobs", { token: staffToken })).json.jobs.length, 1);
  assert.equal((await call(`/provider/jobs/${j.id}/start`, { token: staffToken, body: {} })).status, 200);
  assert.equal((await call(`/provider/jobs/${j.id}/complete`, { token: staffToken, body: {} })).status, 200);
  assert.equal((await call(`/provider/jobs/${j.id}/cancel`, { token: staffToken, body: {} })).status, 403);
  await call(`/jobs/${j.id}/confirm`, { token: customer, body: {} });
  assert.equal(await wallet("pro_co"), 59500, "the company owner is paid");
  assert.equal(await wallet("staff_1"), 0);
  assert.equal((await dbJob(j.id)).worker_id, "staff_1");

  assert.equal((await call("/provider/staff/staff_1", { method: "DELETE", token: company.token })).status, 200);
  assert.equal((await call("/provider/jobs", { token: staffToken })).status, 404, "removed staff lose access");
});

test("work: sweeps expire jobs, pay out unanswered jobs and finish interrupted payments — once", async () => {
  const { call, mkUser, mkProvider, wallet, book, client, dbJob } = await setup();
  const customer = await mkUser("cust_w", { wallet: 400000 });
  const pro = await mkProvider("pro_w");

  const stale = (await book(customer)).json.job;
  await client.execute({ sql: "UPDATE work_jobs SET expires_at = datetime('now', '-1 minute') WHERE id = ?", args: [stale.id] });
  const finished = (await book(customer)).json.job;
  await call(`/provider/jobs/${finished.id}/accept`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${finished.id}/start`, { token: pro.token, body: {} });
  await call(`/provider/jobs/${finished.id}/complete`, { token: pro.token, body: {} });
  await client.execute({ sql: "UPDATE work_jobs SET confirm_by = datetime('now', '-1 minute') WHERE id = ?", args: [finished.id] });

  const first = await sweepWork();
  assert.equal(first.expired, 1);
  assert.equal(first.autoConfirmed, 1);
  assert.equal((await dbJob(stale.id)).status, "expired");
  assert.equal(await wallet("pro_w"), 59500);
  assert.equal(await wallet("cust_w"), 400000 - 70000, "the expired job was refunded, the finished one paid");

  const second = await sweepWork();
  assert.deepEqual([second.expired, second.autoConfirmed, second.moneyApplied], [0, 0, 0], "running it again changes nothing");
  assert.equal(await wallet("pro_w"), 59500);

  // A payment that was recorded but not delivered (a crash) is delivered once, even if two sweeps race.
  await client.execute({ sql: "INSERT INTO work_money (id, job_id, user_id, kind, amount_ugx, status, note, environment) VALUES ('payout:stuck', ?, 'pro_w', 'payout', 1000, 'pending', 'stuck', 'live')", args: [stale.id] });
  const [x, y] = await Promise.all([sweepWork(), sweepWork()]);
  assert.equal(x.moneyApplied + y.moneyApplied, 1);
  assert.equal(await wallet("pro_w"), 60500);

  // A booking that never got paid is cleared away.
  await client.execute({ sql: "INSERT INTO work_jobs (id, customer_id, service_id, service_type, service_name, pricing_mode, matching_mode, quantity, address, created_at) VALUES ('wjob_abandoned', 'cust_w', ?, 'clean', 'x', 'fixed', 'broadcast', 1, 'y', datetime('now', '-1 hour'))", args: [HOUSE] });
  assert.equal((await sweepWork()).cleared, 1);
});

test("work: no endpoint works without signing in, and roles are kept apart", async () => {
  const { call, mkUser, mkProvider, book } = await setup();
  const customer = await mkUser("cust_z", { wallet: 400000 });
  const pro = await mkProvider("pro_z");
  const job = (await book(customer)).json.job;
  const other = await mkUser("cust_other", { wallet: 0 });

  for (const [method, path] of [
    ["GET", "/catalog"], ["POST", "/jobs"], ["GET", "/jobs"], ["GET", `/jobs/${job.id}`], ["POST", `/jobs/${job.id}/cancel`], ["POST", `/jobs/${job.id}/confirm`],
    ["POST", "/provider/register"], ["GET", "/provider/me"], ["GET", "/provider/jobs/open"], ["POST", `/provider/jobs/${job.id}/accept`],
    ["GET", "/admin/providers"], ["POST", `/admin/jobs/${job.id}/assign`], ["PATCH", "/admin/services/x"],
  ] as const) {
    assert.equal((await call(path, { method })).status, 401, `${method} ${path}`);
  }

  // Someone else's job is invisible, not just forbidden.
  assert.equal((await call(`/jobs/${job.id}`, { token: other })).status, 404);
  assert.equal((await call(`/jobs/${job.id}/cancel`, { token: other, body: {} })).status, 404);
  assert.equal((await call(`/jobs/${job.id}/confirm`, { token: other, body: {} })).status, 404);

  // Customers and providers can't use the admin side; admins' routes need the right role.
  for (const token of [customer, pro.token]) {
    assert.equal((await call("/admin/providers", { token })).status, 403);
    assert.equal((await call("/admin/services", { token, method: "POST", body: {} })).status, 403);
  }
  // A customer who is not a provider has no provider account.
  assert.equal((await call("/provider/me", { token: customer })).status, 404);
  assert.equal((await call("/provider/jobs/open", { token: customer })).status, 404);
  // A provider can't act on a job that isn't theirs.
  const mine = (await book(customer)).json.job;
  await call(`/provider/jobs/${mine.id}/accept`, { token: pro.token, body: {} });
  const stranger = await mkProvider("pro_y");
  assert.equal((await call(`/provider/jobs/${mine.id}/start`, { token: stranger.token, body: {} })).status, 404);
  assert.equal((await call(`/provider/jobs/${mine.id}/cancel`, { token: stranger.token, body: {} })).status, 404);
});

test("work: admin manages the catalogue; changes never reprice a booked job", async () => {
  const { call, mkUser, admin, book, client } = await setup();
  const customer = await mkUser("cust_m", { wallet: 500000 });
  const before = (await book(customer)).json.job;
  assert.equal(before.priceUgx, 70000);

  assert.equal((await call(`/admin/services/${HOUSE}`, { method: "PATCH", token: admin, body: { unitPriceUgx: 50000 } })).status, 200);
  assert.equal((await call(`/jobs/${before.id}`, { token: customer })).json.job.priceUgx, 70000, "already booked at the old price");
  assert.equal((await book(customer)).json.job.priceUgx, 100000, "new bookings use the new price");

  assert.equal((await call(`/admin/services/${HOUSE}`, { method: "PATCH", token: admin, body: { pricingMode: "fixed", unitPriceUgx: 0 } })).status, 400);
  const added = await call("/admin/services", { token: admin, body: { type: "clean", category: "car", name: "Engine bay clean", pricingMode: "fixed", unitPriceUgx: 20000, unitLabel: "car" } });
  assert.equal(added.status, 201);
  assert.equal((await call("/catalog?type=clean", { token: customer })).json.services.some((s: Json) => s.name === "Engine bay clean"), true);
  await call(`/admin/services/${added.json.id}`, { method: "PATCH", token: admin, body: { active: false } });
  assert.equal((await call("/catalog?type=clean", { token: customer })).json.services.some((s: Json) => s.name === "Engine bay clean"), false);

  // Per-service commission overrides the platform default.
  await call(`/admin/services/wsv_clean_car_wash`, { method: "PATCH", token: admin, body: { commissionPercent: 5 } });
  const car = (await book(customer, { serviceId: "wsv_clean_car_wash", quantity: 1 })).json.job;
  assert.equal((await client.execute({ sql: "SELECT commission_percent AS p FROM work_jobs WHERE id = ?", args: [car.id] })).rows[0].p, 5);
  assert.ok(Number((await client.execute("SELECT COUNT(*) AS n FROM admin_activity_log WHERE action LIKE 'work.service.%'")).rows[0].n) >= 3, "changes are recorded");
});

test("work: until migration 0098 is applied everything answers 'upgrade pending'", async () => {
  const { call, mkUser, client } = await setup();
  const customer = await mkUser("cust_g", { wallet: 1000 });
  assert.equal((await call("/catalog", { token: customer })).status, 200);
  await client.execute("DROP TABLE work_events");
  resetWorkSchemaCache();
  const gated = await call("/catalog", { token: customer });
  assert.equal(gated.status, 503);
  assert.equal(gated.json.error, "work_upgrade_pending");
});
