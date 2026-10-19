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
import { setR2Binding, type R2Bucket } from "../storage/r2.js";
import { resetAutopilotCache } from "./autopilot.js";
import { freeSessionCode, resetLiveCache } from "./classroom.js";
import { DEMO_STEPS } from "./demo.js";
import { DEMO_TRIALS } from "./demo/index.js";
import { setLearnSettings } from "./settings.js";
import { resetStudioCache } from "./studio.js";

process.env.JWT_SECRET = "tv-learn-test-only-secret";
process.env.PUBLIC_API_URL = "https://api.test";
process.env.CUSTOMER_APP_URL = "https://customer.test";

type Json = Record<string, any>;

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
    // Statements in a batch run in order, as they do on D1.
    async batch(statements: { all(): Promise<unknown> }[]) {
      const out = [];
      for (const s of statements) out.push(await s.all());
      return out;
    },
  } as unknown as D1Database);
}

async function setup(skip: string[] = []) {
  resetSchemaCache();
  resetStudioCache();
  resetLiveCache();
  resetAutopilotCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    if (skip.some((s) => file.startsWith(s))) continue;
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const store = new Map<string, Uint8Array>();
  setR2Binding({
    async put(k: string, v: unknown) { store.set(k, new Uint8Array(await new Response(v as BodyInit).arrayBuffer())); },
    async get(k: string) { const b = store.get(k); return b ? { body: new Blob([b as BlobPart]).stream(), httpMetadata: { contentType: "video/mp4" }, size: b.length } : null; },
    async delete(k: string | string[]) { for (const key of Array.isArray(k) ? k : [k]) store.delete(key); },
  } as unknown as R2Bucket);
  await setLearnSettings({ trialClassesEnabled: true, trialCodeA: "111222", trialCodeB: "222111", demoContentVisible: true, liveEnabled: true });

  let n = 0;
  const mkUser = async (id: string, role: "customer" | "admin" = "customer", wallet = 0) => {
    n += 1;
    await client.execute({
      sql: "INSERT INTO users (id, phone, name, role, password_hash, email_verified_at, admin_role, wallet_balance) VALUES (?, ?, ?, ?, 'x', datetime('now'), ?, ?)",
      args: [id, `+25674000${String(n).padStart(4, "0")}`, `${id.split("_")[0]} Person${n}`, role, role === "admin" ? "super_admin" : null, wallet],
    });
    return signToken({ sub: id, role });
  };
  const wallet = async (id: string) => Number((await client.execute({ sql: "SELECT wallet_balance AS b FROM users WHERE id = ?", args: [id] })).rows[0]!.b);
  const request = async (path: string, o: { method?: string; token?: string; device?: string; body?: unknown } = {}) => {
    const res = await app.request(path, {
      method: o.method ?? (o.body !== undefined ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}), ...(o.device ? { Authorization: `Device ${o.device}` } : {}) },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  };
  const admin = await mkUser("admin_d", "admin");
  const demo = (o: { method?: string; body?: unknown } = {}) => request("/v1/admin/learn-demo", { ...o, token: admin });
  const installAll = async (password?: string) => {
    for (let step = 0; step < DEMO_STEPS; step += 1) {
      const res = await request("/v1/admin/learn-demo/install", { token: admin, body: { step, ...(password ? { password } : {}) } });
      assert.equal(res.status, 200, `step ${step}: ${JSON.stringify(res.json)}`);
    }
  };
  const count = async (sql: string, args: unknown[] = []) => Number((await client.execute({ sql, args: args as InArgs })).rows[0]!.n);
  return { client, store, mkUser, wallet, request, admin, demo, installAll, count };
}


/** An educator with a published course: one plain lesson and one with a two-question quiz. */
async function publishedCourse(ctx: Awaited<ReturnType<typeof setup>>, ownerId: string, priceUgx: number) {
  const token = await ctx.mkUser(ownerId);
  const edu = (path: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${path}`, { ...o, token });
  const school = (await edu("/studio/schools", { body: { name: `${ownerId} school`, kind: "school", streams: ["foundations"] } })).json.school;
  const cls = (await edu(`/studio/schools/${school.id}/classes`, { body: { stream: "foundations", name: "P4", framework: "uganda_primary" } })).json.class;
  const course = (await edu(`/studio/classes/${cls.id}/courses`, { body: { title: `Course by ${ownerId}`, priceUgx } })).json.course;
  const mod = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Unit 1" } })).json.module;
  const plain = (await edu(`/studio/modules/${mod.id}/lessons`, { body: { title: "Reading lesson", summary: "Some words to read." } })).json.lesson;
  const quizzed = (
    await edu(`/studio/modules/${mod.id}/lessons`, {
      body: {
        title: "Halves",
        quiz: {
          title: "Check",
          passingScorePercent: 50,
          questions: [
            { question: "1/2 of 10?", options: ["5", "2"], correctIndex: 0, explanation: "Half of ten is five" },
            { question: "1/4 of 8?", options: ["4", "2"], correctIndex: 1, explanation: "A quarter of eight is two" },
          ],
        },
      },
    })
  ).json.lesson;
  await edu(`/studio/courses/${course.id}`, { method: "PATCH", body: { status: "published" } });
  return { course, plain, quizzed };
}

test("a learner links a TV from their phone, even while TV is a Pro feature for educators", async () => {
  const ctx = await setup();
  const learner = await ctx.mkUser("lrn_a");
  await ctx.request("/v1/admin/learn-settings", { method: "PATCH", token: ctx.admin, body: { tvProRequired: true, proPriceUgx: 30_000 } });

  const started = await ctx.request("/v1/tv/pair/start", { body: {} });
  assert.equal(started.status, 201);
  assert.match(started.json.linkUrl, /\/learn\/tv\?code=[A-Z0-9]{6}$/, "the TV is told where its QR code should send a phone");
  assert.ok(String(started.json.linkUrl).includes(started.json.code));

  // The educator's way in (no purpose) is still a Pro feature; the learner's is not.
  assert.equal((await ctx.request("/v1/tv/pair", { token: learner, body: { code: started.json.code } })).status, 402);
  const linked = await ctx.request("/v1/tv/pair", { token: learner, body: { code: started.json.code, purpose: "learn" } });
  assert.equal(linked.status, 201, JSON.stringify(linked.json));
  assert.equal(linked.json.device.name, "My TV");

  const me = await ctx.request("/v1/tv/me", { device: started.json.secret });
  assert.deepEqual({ status: me.json.status, learn: me.json.learnEnabled }, { status: "paired", learn: true });
  // The same code can't be claimed twice.
  const second = await ctx.mkUser("lrn_b");
  assert.equal((await ctx.request("/v1/tv/pair", { token: second, body: { code: started.json.code, purpose: "learn" } })).status, 404);
  // And it shows up in the phone's list of screens.
  const list = await ctx.request("/v1/tv/devices", { token: learner });
  assert.deepEqual(list.json.devices.map((d: Json) => d.name), ["My TV"]);
});

test("a linked TV studies as its owner: courses, lessons, quizzes and progress are shared with the phone", async () => {
  const ctx = await setup();
  const { course, plain, quizzed } = await publishedCourse(ctx, "edu_a", 0);
  const learner = await ctx.mkUser("lrn_tv");
  const started = await ctx.request("/v1/tv/pair/start", { body: {} });
  const secret = started.json.secret as string;
  await ctx.request("/v1/tv/pair", { token: learner, body: { code: started.json.code, purpose: "learn" } });
  const tv = (path: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/tv/learn${path}`, { ...o, device: secret });
  const phone = (path: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education/learn${path}`, { ...o, token: learner });

  assert.deepEqual((await tv("/enrollments")).json.enrollments, []);
  assert.equal((await tv(`/courses/${course.id}`)).status, 403, "not enrolled yet");
  const enrolled = await tv(`/courses/${course.id}/enroll`, { method: "POST", body: {} });
  assert.equal(enrolled.status, 200, JSON.stringify(enrolled.json));
  assert.equal((await phone("/enrollments")).json.enrollments.length, 1, "the phone sees what the TV did");

  const opened = (await tv(`/courses/${course.id}`)).json.course;
  assert.equal(opened.modules[0].lessons.length, 2);
  assert.equal(opened.modules[0].lessons[1].quiz.questionCount, 2);
  assert.ok(!JSON.stringify(opened).includes("correctIndex"), "answers are never sent");

  assert.equal((await tv(`/lessons/${plain.id}/complete`, { method: "POST", body: {} })).status, 200);
  assert.equal((await tv(`/lessons/${quizzed.id}/complete`, { method: "POST", body: {} })).status, 409, "a quiz lesson needs the quiz");
  const failed = await tv(`/lessons/${quizzed.id}/quiz`, { method: "POST", body: { answers: [1, 0] } });
  assert.equal(failed.json.passed, false);
  const passed = await tv(`/lessons/${quizzed.id}/quiz`, { method: "POST", body: { answers: [0, 1] } });
  assert.equal(passed.json.passed, true);
  assert.equal((await phone(`/courses/${course.id}`)).json.course.progressPercent, 100, "progress made on the TV shows on the phone");
  assert.equal((await tv("/enrollments")).json.enrollments[0].progressPercent, 100);
});

test("a TV never spends money and never gets more than the learner actions", async () => {
  const ctx = await setup();
  const paid = await publishedCourse(ctx, "edu_p", 20_000);
  const learner = await ctx.mkUser("lrn_rich", "customer", 100_000);
  const started = await ctx.request("/v1/tv/pair/start", { body: {} });
  const secret = started.json.secret as string;
  await ctx.request("/v1/tv/pair", { token: learner, body: { code: started.json.code, purpose: "learn" } });
  const tv = (path: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/tv/learn${path}`, { ...o, device: secret });

  const refused = await tv(`/courses/${paid.course.id}/enroll`, { method: "POST", body: {} });
  assert.equal(refused.status, 403);
  assert.equal(refused.json.error, "pay_on_phone");
  assert.equal(await ctx.wallet("lrn_rich"), 100_000, "nothing was charged");
  assert.equal(await ctx.count("SELECT COUNT(*) AS n FROM edu_enrollments WHERE user_id = 'lrn_rich'"), 0);

  for (const [method, path] of [["GET", "/invoices"], ["POST", "/invoices/inv_x/pay"], ["POST", "/courses/x/anything"], ["DELETE", "/enrollments"]]) {
    const res = await tv(path, { method });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(res.json.error, "not_on_tv");
  }
  // Without a device secret, or with the learner's phone token, the TV routes stay closed.
  assert.equal((await ctx.request("/v1/tv/learn/enrollments")).status, 401);
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { token: learner })).status, 401);
});

test("an unlinked TV, a switched-off feature and a suspended owner all stop the TV cold", async () => {
  const ctx = await setup();
  const free = await publishedCourse(ctx, "edu_f", 0);
  const unlinked = await ctx.request("/v1/tv/pair/start", { body: {} });
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: unlinked.json.secret })).status, 403);
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: unlinked.json.secret })).json.error, "not_linked");

  const learner = await ctx.mkUser("lrn_x");
  const started = await ctx.request("/v1/tv/pair/start", { body: {} });
  const secret = started.json.secret as string;
  assert.equal((await ctx.request("/v1/tv/pair", { token: learner, body: { code: started.json.code, purpose: "learn" } })).status, 201);
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: secret })).status, 200);

  await ctx.request("/v1/admin/learn-settings", { method: "PATCH", token: ctx.admin, body: { tvLearnEnabled: false } });
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: secret })).status, 503);
  const again = await ctx.request("/v1/tv/pair/start", { body: {} });
  assert.equal((await ctx.request("/v1/tv/pair", { token: learner, body: { code: again.json.code, purpose: "learn" } })).status, 503, "no new links while it's off");
  assert.equal((await ctx.request("/v1/tv/me", { device: secret })).json.learnEnabled, false);
  await ctx.request("/v1/admin/learn-settings", { method: "PATCH", token: ctx.admin, body: { tvLearnEnabled: true } });
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: secret })).status, 200);

  await ctx.client.execute({ sql: "UPDATE users SET status = 'suspended' WHERE id = 'lrn_x'", args: [] });
  assert.equal((await ctx.request("/v1/tv/learn/enrollments", { device: secret })).status, 403, "a suspended account is locked out of its TV too");
  void free;
});
