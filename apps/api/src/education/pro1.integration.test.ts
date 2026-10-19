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

process.env.JWT_SECRET = "pro1-test-only-secret";
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

/** A school with two published courses (A, then B which needs A), each with a text lesson and a quiz in two sections. */
async function school(ctx: Awaited<ReturnType<typeof setup>>) {
  const teacher = await ctx.mk("t_1");
  const learner = await ctx.mk("l_1");
  const edu = (p: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${p}`, { ...o, token: teacher });
  const me = (p: string, o: { method?: string; body?: unknown } = {}) => ctx.request(`/v1/education${p}`, { ...o, token: learner });
  const sc = (await edu("/studio/schools", { body: { name: "Rules school", kind: "school", streams: ["foundations"] } })).json.school;
  const cls = (await edu(`/studio/schools/${sc.id}/classes`, { body: { stream: "foundations", name: "P6", framework: "uganda_primary" } })).json.class;
  const make = async (title: string) => {
    const course = (await edu(`/studio/classes/${cls.id}/courses`, { body: { title, priceUgx: 0 } })).json.course;
    const m1 = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Week one" } })).json.module;
    const m2 = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Week two" } })).json.module;
    const a = (await edu(`/studio/modules/${m1.id}/lessons`, { body: { title: "Reading one", contentType: "text", body: "hello" } })).json.lesson;
    const b = (await edu(`/studio/modules/${m1.id}/lessons`, { body: { title: "Reading two", contentType: "text", body: "again" } })).json.lesson;
    const c = (await edu(`/studio/modules/${m2.id}/lessons`, { body: { title: "Reading three", contentType: "text", body: "more" } })).json.lesson;
    await edu(`/studio/courses/${course.id}`, { method: "PATCH", body: { status: "published" } });
    return { course, m1, m2, a, b, c };
  };
  return { teacher, learner, edu, me, make, ctx };
}

test("sequential courses: an item opens only when the ones before it are done", async () => {
  const k = await school(await setup());
  const A = await k.make("Course A");
  const rules = await k.edu(`/studio/courses/${A.course.id}/rules`, { method: "PUT", body: { sequential: true, prerequisiteCourseId: null, certificateEnabled: true } });
  assert.equal(rules.status, 200, JSON.stringify(rules.json));
  await k.me(`/learn/courses/${A.course.id}/enroll`, { body: {} });

  const view = (await k.me(`/learn/courses/${A.course.id}`)).json.course;
  const byId = Object.fromEntries(view.modules.flatMap((m: Json) => m.lessons).map((l: Json) => [l.id, l]));
  assert.equal(byId[A.a.id].locked, null);
  assert.equal(byId[A.b.id].locked.reason, "sequence");
  assert.equal((await k.me(`/learn/lessons/${A.b.id}`)).status, 403);
  assert.equal((await k.me(`/learn/lessons/${A.b.id}/complete`, { body: {} })).json.error, "locked");
  assert.equal((await k.me(`/learn/lessons/${A.a.id}/complete`, { body: {} })).status, 200);
  assert.equal((await k.me(`/learn/lessons/${A.b.id}`)).status, 200, "the next item opens");
  // The educator sees everything open.
  assert.equal((await k.edu(`/learn/lessons/${A.c.id}`)).status, 200);
});

test("drip release: a section opens some days after enrolling", async () => {
  const ctx = await setup();
  const k = await school(ctx);
  const A = await k.make("Dripped");
  assert.equal((await k.edu(`/studio/modules/${A.m2.id}/drip`, { method: "PUT", body: { days: 7 } })).status, 200);
  await k.me(`/learn/courses/${A.course.id}/enroll`, { body: {} });
  const view = (await k.me(`/learn/courses/${A.course.id}`)).json.course;
  assert.ok(view.modules[1].opensAt, "the section says when it opens");
  assert.equal(view.modules[1].lessons[0].locked.reason, "drip");
  assert.equal((await k.me(`/learn/lessons/${A.c.id}`)).status, 403);
  // Pretend the learner enrolled eight days ago.
  await ctx.client.execute({ sql: "UPDATE edu_enrollments SET created_at = datetime('now', '-8 days') WHERE course_id = ?", args: [A.course.id] });
  assert.equal((await k.me(`/learn/lessons/${A.c.id}`)).status, 200);
  assert.equal((await k.edu(`/studio/courses/${A.course.id}`)).json.course.modules[1].dripDays, 7);

  await setLearnSettings({ dripEnabled: false });
  await ctx.client.execute({ sql: "UPDATE edu_enrollments SET created_at = datetime('now') WHERE course_id = ?", args: [A.course.id] });
  assert.equal((await k.me(`/learn/lessons/${A.c.id}`)).status, 200, "admin can switch drip off everywhere");
});

test("prerequisite course: enrolling needs the earlier course finished, and loops are refused", async () => {
  const k = await school(await setup());
  const A = await k.make("Basics A");
  const B = await k.make("Advanced B");
  assert.equal((await k.edu(`/studio/courses/${B.course.id}/rules`, { method: "PUT", body: { sequential: false, prerequisiteCourseId: A.course.id, certificateEnabled: true } })).status, 200);
  assert.equal((await k.edu(`/studio/courses/${A.course.id}/rules`, { method: "PUT", body: { sequential: false, prerequisiteCourseId: B.course.id, certificateEnabled: true } })).json.error, "prerequisite_loop");

  const preview = (await ctx_public(k, B.course.id)).json.course;
  assert.equal(preview.prerequisite.title, "Basics A");
  const blocked = await k.me(`/learn/courses/${B.course.id}/enroll`, { body: {} });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.error, "prereq_not_met");
  await k.me(`/learn/courses/${A.course.id}/enroll`, { body: {} });
  for (const l of [A.a, A.b, A.c]) await k.me(`/learn/lessons/${l.id}/complete`, { body: {} });
  assert.equal((await k.me(`/learn/courses/${B.course.id}/enroll`, { body: {} })).status, 200);
});
const ctx_public = (k: Awaited<ReturnType<typeof school>>, id: string) => k.ctx.request(`/v1/education/catalog/courses/${id}`);

test("finishing a course issues one certificate that anyone can verify, and badges are awarded", async () => {
  const k = await school(await setup());
  const A = await k.make("Certified");
  await k.me(`/learn/courses/${A.course.id}/enroll`, { body: {} });
  assert.deepEqual((await k.me("/learn/certificates")).json.certificates, []);
  for (const l of [A.a, A.b]) await k.me(`/learn/lessons/${l.id}/complete`, { body: {} });
  assert.equal((await k.me("/learn/certificates")).json.certificates.length, 0, "not finished yet");
  await k.me(`/learn/lessons/${A.c.id}/complete`, { body: {} });
  await k.me(`/learn/lessons/${A.c.id}/complete`, { body: {} });

  const certs = (await k.me("/learn/certificates")).json.certificates;
  assert.equal(certs.length, 1);
  assert.equal(certs[0].courseTitle, "Certified");
  assert.match(certs[0].code, /^[A-Z2-9]{10}$/);
  assert.equal((await k.me(`/learn/certificates/${certs[0].id}`)).status, 200);
  assert.equal((await k.ctx.request(`/v1/education/learn/certificates/${certs[0].id}`, { token: k.teacher })).status, 404, "a certificate belongs to its learner");
  const check = await k.ctx.request(`/v1/education/catalog/certificates/${certs[0].code.toLowerCase()}`);
  assert.equal(check.json.certificate.learnerName, "Person l_1");
  assert.equal((await k.ctx.request("/v1/education/catalog/certificates/NOPE")).status, 404);
  assert.equal((await k.me(`/learn/courses/${A.course.id}`)).json.course.certificateId, certs[0].id);

  const badges = (await k.me("/learn/badges")).json.badges;
  const got = badges.filter((b: Json) => b.awardedAt).map((b: Json) => b.key).sort();
  assert.deepEqual(got, ["course_complete", "first_step"]);

  // Switched off per course and by Admin.
  const B = await k.make("No certificate");
  await k.edu(`/studio/courses/${B.course.id}/rules`, { method: "PUT", body: { sequential: false, prerequisiteCourseId: null, certificateEnabled: false } });
  await k.me(`/learn/courses/${B.course.id}/enroll`, { body: {} });
  for (const l of [B.a, B.b, B.c]) await k.me(`/learn/lessons/${l.id}/complete`, { body: {} });
  assert.equal((await k.me("/learn/certificates")).json.certificates.length, 1);
  await setLearnSettings({ certificatesEnabled: false });
  const C = await k.make("Admin off");
  await k.me(`/learn/courses/${C.course.id}/enroll`, { body: {} });
  for (const l of [C.a, C.b, C.c]) await k.me(`/learn/lessons/${l.id}/complete`, { body: {} });
  assert.equal((await k.me("/learn/certificates")).json.certificates.length, 1);
});

test("before migration 0117 nothing is locked, issued or required, and rules say 'upgrade pending'", async () => {
  const k = await school(await setup(["0117_"]));
  const A = await k.make("Old");
  const rules = await k.edu(`/studio/courses/${A.course.id}/rules`, { method: "PUT", body: { sequential: true, prerequisiteCourseId: null, certificateEnabled: true } });
  assert.equal(rules.status, 503);
  await k.me(`/learn/courses/${A.course.id}/enroll`, { body: {} });
  for (const l of [A.a, A.b, A.c]) assert.equal((await k.me(`/learn/lessons/${l.id}/complete`, { body: {} })).status, 200);
  assert.deepEqual((await k.me("/learn/certificates")).json.certificates, []);
  assert.equal((await k.edu(`/studio/courses/${A.course.id}`)).status, 200);
  assert.equal((await k.me(`/learn/courses/${A.course.id}`)).json.course.progressPercent, 100);
});
