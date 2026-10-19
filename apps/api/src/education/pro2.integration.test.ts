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
import { setLearnSettings } from "./settings.js";
import { resetStudioCache } from "./studio.js";

process.env.JWT_SECRET = "pro2-test-only-secret";
process.env.PUBLIC_API_URL = "https://api.test";

type Json = Record<string, any>;

function bind(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const r = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: r.rows, success: true, meta: { changes: r.rowsAffected, last_row_id: Number(r.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({ prepare, async batch(st: { all(): Promise<unknown> }[]) { const o = []; for (const s of st) o.push(await s.all()); return o; } } as unknown as D1Database);
}

async function setup(skip: string[] = []) {
  resetSchemaCache();
  resetStudioCache();
  const client = createClient({ url: "file::memory:" });
  const dir = join(process.cwd(), "src/db/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (skip.some((s) => f.startsWith(s))) continue;
    for (const sql of splitSqlStatements(readFileSync(join(dir, f), "utf8"))) await client.execute(sql);
  }
  bind(client);
  setR2Binding({ async put() {}, async get() { return null; }, async delete() {} } as unknown as R2Bucket);
  await setLearnSettings({ createsPerHour: 1000, quizAttemptsPerHour: 200 });
  let n = 0;
  const mk = async (id: string) => {
    n += 1;
    await client.execute({ sql: "INSERT INTO users (id, phone, name, role, password_hash, email_verified_at, wallet_balance) VALUES (?, ?, ?, 'customer', 'x', datetime('now'), 0)", args: [id, `+25676000${String(n).padStart(4, "0")}`, `Person ${id}`] });
    return signToken({ sub: id, role: "customer" });
  };
  const request = async (path: string, o: { method?: string; token?: string; body?: unknown } = {}) => {
    const res = await app.request(path, { method: o.method ?? (o.body !== undefined ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  };
  return { client, mk, request };
}

async function world(ctx: Awaited<ReturnType<typeof setup>>) {
  const teacher = await ctx.mk("t_1");
  const learner = await ctx.mk("l_1");
  const other = await ctx.mk("l_2");
  const edu = (p: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${p}`, { ...o, token: teacher });
  const me = (p: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${p}`, { ...o, token: learner });
  const them = (p: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${p}`, { ...o, token: other });
  const sc = (await edu("/studio/schools", { body: { name: "Marking school", kind: "school", streams: ["foundations"] } })).json.school;
  const cls = (await edu(`/studio/schools/${sc.id}/classes`, { body: { stream: "foundations", name: "S1", framework: "uganda_primary" } })).json.class;
  const course = (await edu(`/studio/classes/${cls.id}/courses`, { body: { title: "Essays", priceUgx: 0 } })).json.course;
  const m1 = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Writing" } })).json.module;
  const text = (await edu(`/studio/modules/${m1.id}/lessons`, { body: { title: "How to write", contentType: "text", body: "Say it plainly." } })).json.lesson;
  return { teacher, learner, edu, me, them, course, m1, text, ctx };
}

test("assignments: set, hand in, mark, and the item counts as done only when passed", async () => {
  const k = await world(await setup());
  const made = await k.edu(`/studio/modules/${k.m1.id}/lessons`, { body: { title: "Essay", contentType: "assignment", body: "Write 200 words.", assignment: { maxPoints: 20, passPercent: 50 } } });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  const essay = made.json.lesson;
  assert.equal(essay.assignment.maxPoints, 20);
  await k.edu(`/studio/courses/${k.course.id}`, { method: "PATCH", body: { status: "published" } });
  await k.me(`/learn/courses/${k.course.id}/enroll`, { body: {} });
  await k.them(`/learn/courses/${k.course.id}/enroll`, { body: {} });

  const view = (await k.me(`/learn/lessons/${essay.id}`)).json.lesson;
  assert.equal(view.assignment.open, true);
  assert.equal(view.assignment.submission, null);
  assert.equal((await k.me(`/learn/lessons/${essay.id}/complete`, { body: {} })).json.error, "hand_in_first");
  assert.equal((await k.me(`/learn/lessons/${essay.id}/submission`, { body: { body: "" } })).json.error, "empty");
  assert.equal((await k.me(`/learn/lessons/${essay.id}/submission`, { body: { body: "x", link: "http://nope" } })).json.error, "bad_link");
  assert.equal((await k.me(`/learn/lessons/${essay.id}/submission`, { body: { body: "My first draft" } })).status, 200);
  assert.equal((await k.them(`/learn/lessons/${essay.id}/submission`, { body: { body: "Theirs", link: "https://docs.example/x" } })).status, 200);

  const list = (await k.edu(`/studio/lessons/${essay.id}/submissions`)).json;
  assert.equal(list.submissions.length, 2);
  assert.equal(list.submissions[0].status, "submitted");
  const mine = list.submissions.find((s: Json) => s.learnerName === "Person l_1");

  assert.equal((await k.edu(`/studio/submissions/${mine.id}/grade`, { method: "PUT", body: { score: 99, feedback: "" } })).json.error, "score_too_high");
  const low = await k.edu(`/studio/submissions/${mine.id}/grade`, { method: "PUT", body: { score: 6, feedback: "Needs more detail" } });
  assert.equal(low.json.passed, false);
  let after = (await k.me(`/learn/lessons/${essay.id}`)).json.lesson;
  assert.equal(after.assignment.submission.status, "graded");
  assert.equal(after.assignment.submission.feedback, "Needs more detail");
  assert.equal(after.completed, false, "a low mark isn't done");
  assert.equal(after.assignment.open, true, "can try again");

  assert.equal((await k.me(`/learn/lessons/${essay.id}/submission`, { body: { body: "Better draft" } })).status, 200);
  const fresh = (await k.edu(`/studio/lessons/${essay.id}/submissions`)).json.submissions.find((s: Json) => s.learnerName === "Person l_1");
  assert.equal(fresh.status, "submitted", "a new hand-in waits to be marked again");
  const high = await k.edu(`/studio/submissions/${fresh.id}/grade`, { method: "PUT", body: { score: 17, feedback: "Good" } });
  assert.equal(high.json.passed, true);
  after = (await k.me(`/learn/lessons/${essay.id}`)).json.lesson;
  assert.equal(after.completed, true);
  assert.equal(after.bestScorePercent, 85);
  assert.equal((await k.me(`/learn/lessons/${essay.id}/submission`, { body: { body: "again" } })).json.error, "closed");

  // Only the owner can mark.
  const mallory = await k.ctx.mk("t_2");
  assert.equal((await k.ctx.request(`/v1/education/studio/submissions/${fresh.id}/grade`, { method: "PUT", token: mallory, body: { score: 1, feedback: "" } })).status, 404);
  assert.equal((await k.ctx.request(`/v1/education/studio/lessons/${essay.id}/submissions`, { token: mallory })).status, 404);

  const book = (await k.edu(`/studio/courses/${k.course.id}/gradebook`)).json.gradebook;
  assert.equal(book.items.length, 2);
  const row = book.rows.find((r: Json) => r.name === "Person l_1");
  assert.equal(row.averagePercent, 85);
  assert.equal(row.progressPercent, 50);
  const theirs = book.rows.find((r: Json) => r.name === "Person l_2");
  assert.equal(theirs.cells.find((c: Json) => c.lessonId === essay.id).needsMarking, true);
});

test("assignments: deadlines, one-shot hand-ins, and the Admin switch", async () => {
  const ctx = await setup();
  const k = await world(ctx);
  const late = (await k.edu(`/studio/modules/${k.m1.id}/lessons`, { body: { title: "Late one", contentType: "assignment", assignment: { maxPoints: 10, passPercent: 50, dueAt: new Date(Date.now() - 86400_000).toISOString() } } })).json.lesson;
  const once = (await k.edu(`/studio/modules/${k.m1.id}/lessons`, { body: { title: "Once only", contentType: "assignment", assignment: { maxPoints: 10, passPercent: 50, allowResubmit: false } } })).json.lesson;
  await k.edu(`/studio/courses/${k.course.id}`, { method: "PATCH", body: { status: "published" } });
  await k.me(`/learn/courses/${k.course.id}/enroll`, { body: {} });
  const view = (await k.me(`/learn/courses/${k.course.id}`)).json.course;
  const l = view.modules[0].lessons.find((x: Json) => x.id === late.id);
  assert.equal(l.assignment.open, false);
  assert.equal((await k.me(`/learn/lessons/${late.id}/submission`, { body: { body: "too late" } })).json.error, "past_due");
  assert.equal((await k.me(`/learn/lessons/${once.id}/submission`, { body: { body: "first" } })).status, 200);
  assert.equal((await k.me(`/learn/lessons/${once.id}/submission`, { body: { body: "second" } })).json.error, "closed");

  await setLearnSettings({ assignmentsEnabled: false });
  assert.equal((await k.me(`/learn/lessons/${once.id}/submission`, { body: { body: "x" } })).json.error, "assignments_off");
  assert.equal((await k.edu(`/studio/modules/${k.m1.id}/lessons`, { body: { title: "New", contentType: "assignment" } })).json.error, "assignments_off");
});

test("assignments: before migration 0118 they can't be created and the rest keeps working", async () => {
  const k = await world(await setup(["0118_"]));
  const res = await k.edu(`/studio/modules/${k.m1.id}/lessons`, { body: { title: "Essay", contentType: "assignment", assignment: { maxPoints: 10 } } });
  assert.equal(res.status, 503);
  assert.equal(res.json.error, "upgrade_pending");
  await k.edu(`/studio/courses/${k.course.id}`, { method: "PATCH", body: { status: "published" } });
  await k.me(`/learn/courses/${k.course.id}/enroll`, { body: {} });
  assert.equal((await k.me(`/learn/lessons/${k.text.id}/complete`, { body: {} })).status, 200);
  assert.equal((await k.edu(`/studio/courses/${k.course.id}/gradebook`)).status, 200);
  assert.equal((await k.edu(`/studio/courses/${k.course.id}`)).status, 200);
});
