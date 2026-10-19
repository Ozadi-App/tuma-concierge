import test, { mock } from "node:test";
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
import { DEMO_EDUCATORS, DEMO_TRIALS } from "./demo/index.js";
import { setLearnSettings } from "./settings.js";
import { resetStudioCache } from "./studio.js";

process.env.JWT_SECRET = "demo-test-only-secret";
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
  const mkUser = async (id: string, role: "customer" | "admin" = "customer") => {
    n += 1;
    await client.execute({
      sql: "INSERT INTO users (id, phone, name, role, password_hash, email_verified_at, admin_role) VALUES (?, ?, ?, ?, 'x', datetime('now'), ?)",
      args: [id, `+25674000${String(n).padStart(4, "0")}`, `${id.split("_")[0]} Person${n}`, role, role === "admin" ? "super_admin" : null],
    });
    return signToken({ sub: id, role });
  };
  const request = async (path: string, o: { method?: string; token?: string; body?: unknown } = {}) => {
    const res = await app.request(path, {
      method: o.method ?? (o.body !== undefined ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
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
  return { client, store, mkUser, request, admin, demo, installAll, count };
}

/** Seconds into the trial's loop at which a given step of its run sheet begins. */
function loopPosition(slot: 0 | 1, cueIndex: number, phase: "open" | "reveal" = "open"): number {
  const cues = DEMO_TRIALS[slot]!.cues;
  let t = 0;
  for (let i = 0; i < cueIndex; i += 1) {
    const c = cues[i]!;
    t += c.open + (c.kind === "question" ? c.reveal : 0);
  }
  const c = cues[cueIndex]!;
  return phase === "reveal" && c.kind === "question" ? t + c.open : t;
}

function loopLength(slot: 0 | 1): number {
  return DEMO_TRIALS[slot]!.cues.reduce((n, c) => n + c.open + (c.kind === "question" ? c.reveal : 0), 0);
}

test("install: eight educators across all five streams, installed twice with nothing duplicated", async () => {
  const { demo, installAll, count, store, client } = await setup();
  const before = await demo();
  assert.equal(before.json.ready, true);
  assert.equal(before.json.installed, false);

  await installAll();
  const after = await demo();
  assert.equal(after.json.installed, true, JSON.stringify(after.json));
  assert.deepEqual(after.json.counts, after.json.expected);
  assert.equal(after.json.counts.educators, 8);
  assert.equal(store.size, after.json.expected.videos, "one placeholder video per video lesson");

  const totals = async () => [await count("SELECT COUNT(*) AS n FROM edu_schools"), await count("SELECT COUNT(*) AS n FROM edu_lessons"), await count("SELECT COUNT(*) AS n FROM edu_live_cues"), await count("SELECT COUNT(*) AS n FROM users")];
  const first = await totals();
  await installAll();
  assert.deepEqual(await totals(), first, "a second install updates in place");
  assert.equal(store.size, after.json.expected.videos);

  // Every stream has content, from more than one educator.
  const streams = (await client.execute("SELECT stream, COUNT(DISTINCT school_id) AS schools FROM edu_courses GROUP BY stream")).rows as Json[];
  assert.deepEqual(streams.map((r) => r.stream).sort(), ["academy", "compass", "foundations", "skills", "sprouts"]);
  for (const r of streams) assert.ok(Number(r.schools) >= 2, `${r.stream} should be taught by at least two educators`);

  // Institutions run several classes with different tutors; individuals are independent tutors.
  const institutions = (await client.execute("SELECT s.id, COUNT(k.id) AS classes, COUNT(DISTINCT k.teacher_name) AS tutors FROM edu_schools s JOIN edu_classes k ON k.school_id = s.id WHERE s.kind != 'independent_tutor' GROUP BY s.id")).rows as Json[];
  assert.equal(institutions.length, 4);
  assert.ok(institutions.filter((r) => Number(r.classes) >= 3 && Number(r.tutors) >= 3).length >= 3, "at least three institutions with several classes and tutors");
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_schools WHERE kind = 'independent_tutor'"), 4);

  // Demo courses are free and published, so nobody can ever be charged for one.
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_courses WHERE price_ugx != 0 OR status != 'published'"), 0);
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_lessons WHERE quiz_json IS NOT NULL"), (await count("SELECT COUNT(*) AS n FROM edu_lessons WHERE quiz_json LIKE '%correctIndex%'")));
});

test("accounts: locked unless the admin sets a password, never an easy one", async () => {
  const { installAll, request, client, mkUser } = await setup();
  await installAll();
  const email = DEMO_EDUCATORS[0]!.email;
  assert.equal((await request("/v1/auth/login", { body: { identifier: email, password: "password" } })).status, 401);
  assert.equal((await request("/v1/auth/login", { body: { identifier: email, password: "!locked-demo-account" } })).status, 401, "the lock value itself can't be used as a password");

  assert.equal((await request("/v1/admin/learn-demo/install", { body: { step: 0 } })).status, 401, "installing needs the admin's sign-in");
  const student = await mkUser("stu_a");
  assert.equal((await request("/v1/admin/learn-demo/install", { token: student, body: { step: 0 } })).status, 403, "and a staff role");

  await installAll("Demo-Pass-2026");
  const login = await request("/v1/auth/login", { body: { identifier: email, password: "Demo-Pass-2026" } });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  const hash = String((await client.execute({ sql: "SELECT password_hash FROM users WHERE email = ?", args: [email] })).rows[0]!.password_hash);
  assert.notEqual(hash, "Demo-Pass-2026", "stored as a hash");
});

test("install: refuses short passwords and says which migration is missing", async () => {
  const { request, admin } = await setup();
  const short = await request("/v1/admin/learn-demo/install", { token: admin, body: { step: 0, password: "short" } });
  assert.equal(short.status, 400);

  const old = await setup(["0113_"]);
  const status = await old.demo();
  assert.equal(status.json.ready, false);
  assert.deepEqual(status.json.missing, ["0113_learn_demo_content.sql"]);
  const res = await old.request("/v1/admin/learn-demo/install", { token: old.admin, body: { step: 0 } });
  assert.equal(res.status, 503);
  assert.equal(res.json.error, "upgrade_pending");
  // Nothing was written, and the catalogue still works as it did.
  assert.equal(await old.count("SELECT COUNT(*) AS n FROM edu_schools"), 0);
  assert.equal((await old.request("/v1/education/catalog/courses")).status, 200);
});

test("catalogue: demo courses are marked, listed after real ones, and can be hidden by the admin", async () => {
  const { installAll, request, mkUser, client } = await setup();
  await installAll();

  // A real educator publishes a course.
  const tutor = await mkUser("tutor_r");
  const edu = (path: string, o: { method?: string; body?: unknown } = {}) => request(`/v1/education${path}`, { ...o, token: tutor });
  const school = (await edu("/studio/schools", { body: { name: "Real School", kind: "school", streams: ["foundations"] } })).json.school;
  const cls = (await edu(`/studio/schools/${school.id}/classes`, { body: { stream: "foundations", name: "P1", framework: "uganda_primary" } })).json.class;
  const course = (await edu(`/studio/classes/${cls.id}/courses`, { body: { title: "A real course" } })).json.course;
  const mod = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Unit 1" } })).json.module;
  await edu(`/studio/modules/${mod.id}/lessons`, { body: { title: "Lesson one" } });
  await edu(`/studio/courses/${course.id}`, { method: "PATCH", body: { status: "published" } });

  const list = (await request("/v1/education/catalog/courses?limit=50")).json.courses as Json[];
  assert.equal(list[0]!.title, "A real course", "real courses come first");
  assert.equal(list[0]!.demo, false);
  assert.ok(list.slice(1).every((c) => c.demo === true));
  assert.ok(list.length > 10);

  await setLearnSettings({ demoContentVisible: false });
  const hidden = (await request("/v1/education/catalog/courses?limit=50")).json.courses as Json[];
  assert.deepEqual(hidden.map((c) => c.title), ["A real course"]);

  // Direct links to a demo course still work for people who have one.
  const demoCourse = String((await client.execute("SELECT id FROM edu_courses WHERE id LIKE 'crs_demo_%' LIMIT 1")).rows[0]!.id);
  assert.equal((await request(`/v1/education/catalog/courses/${demoCourse}`)).status, 200);
});

test("remove: takes the demo away completely, but never deletes a payment", async () => {
  const { demo, installAll, count, store, mkUser, request, client } = await setup();
  await installAll();
  const student = await mkUser("stu_r");
  const course = String((await client.execute("SELECT id FROM edu_courses WHERE id LIKE 'crs_demo_%' LIMIT 1")).rows[0]!.id);
  const enrol = await request(`/v1/education/learn/courses/${course}/enroll`, { token: student, body: {} });
  assert.equal(enrol.status, 200, JSON.stringify(enrol.json));
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_enrollments"), 1);

  // A payment on a demo course blocks the removal.
  await client.execute({ sql: "UPDATE edu_enrollments SET price_paid_ugx = 5000 WHERE course_id = ?", args: [course] });
  const blocked = await demo({ method: "DELETE" });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.json.error, "has_payments");
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_schools"), 8);
  await client.execute({ sql: "UPDATE edu_enrollments SET price_paid_ugx = 0 WHERE course_id = ?", args: [course] });

  const gone = await demo({ method: "DELETE" });
  assert.equal(gone.status, 200, JSON.stringify(gone.json));
  assert.equal(gone.json.accountsRemoved, 8);
  for (const table of ["edu_schools", "edu_classes", "edu_courses", "edu_modules", "edu_lessons", "edu_lesson_media", "edu_enrollments", "edu_live_sessions", "edu_live_cues"]) {
    assert.equal(await count(`SELECT COUNT(*) AS n FROM ${table}`), 0, table);
  }
  assert.equal(store.size, 0, "placeholder videos are deleted from storage");
  assert.equal(await count("SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@demo.peebee.invalid'"), 0);
  assert.equal(await count("SELECT COUNT(*) AS n FROM users WHERE id = ?", ["stu_r"]), 1, "real accounts are untouched");

  await installAll();
  assert.equal((await demo()).json.installed, true, "it can be installed again");
});

test("trial classes: joined by code, run themselves on a loop, and the phone plays the placeholder video", async (t) => {
  const { installAll, mkUser, request, client } = await setup();
  await installAll();
  const student = await mkUser("stu_t");
  const total = loopLength(0);
  const base = Math.floor(Date.now() / (total * 1000)) * total * 1000;
  t.mock.timers.enable({ apis: ["Date"], now: base });
  const at = (seconds: number) => t.mock.timers.setTime(base + seconds * 1000);
  const room = (path: string, o: { method?: string; body?: unknown } = {}) => request(`/v1/education/classroom${path}`, { ...o, token: student });

  // The trial list shows both classes with their codes.
  const list = await room("/trial");
  assert.deepEqual(list.json.classes.map((c: Json) => c.code), ["111222", "222111"]);

  // Joining: wrong codes still fail, the trial code works with no tutor online.
  assert.equal((await room("/join", { body: { code: "999999" } })).status, 404);
  at(loopPosition(0, 0) + 1);
  const joined = await room("/join", { body: { code: "111222" } });
  assert.equal(joined.status, 200, JSON.stringify(joined.json));
  const id = joined.json.session.id;

  const state = async () => (await room(`/sessions/${id}/state`)).json;
  let s = await state();
  assert.equal(s.cue.kind, "announcement");

  // Lesson: the phone gets a signed link to the placeholder video.
  at(loopPosition(0, 2) + 2);
  s = await state();
  assert.equal(s.cue.kind, "lesson");
  assert.match(s.cue.media.url, /^https:\/\/api\.test\/v1\/education\/media\//);
  assert.equal(s.cue.media.contentType, "video/mp4");
  const bytes = await app.request(new URL(s.cue.media.url).pathname);
  assert.equal(bytes.status, 200);
  assert.ok((await bytes.arrayBuffer()).byteLength > 1000, "the video streams");

  // Attendance: tapping "I'm here" marks the student present.
  at(loopPosition(0, 1) + 1);
  s = await state();
  assert.equal(s.cue.kind, "attendance");
  assert.equal((await room(`/sessions/${id}/respond`, { body: { cueId: s.cue.id, answers: [] } })).status, 200);
  assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM edu_live_members WHERE session_id = ? AND present_at IS NOT NULL", args: [id] })).rows[0]!.n), 1);

  // A question: open for answers, answer hidden, then revealed.
  at(loopPosition(0, 4) + 2);
  s = await state();
  assert.equal(s.cue.kind, "question");
  assert.equal(s.cue.open, true);
  assert.equal(s.cue.revealed, false);
  assert.ok(!("reveal" in s.cue) && !JSON.stringify(s.cue).includes("correctIndex"), "no answer before the reveal");
  assert.equal((await room(`/sessions/${id}/respond`, { body: { cueId: s.cue.id, answers: [0] } })).status, 200);
  assert.equal((await room(`/sessions/${id}/respond`, { body: { cueId: s.cue.id, answers: [0] } })).status, 409, "one answer each");

  at(loopPosition(0, 4, "reveal") + 1);
  s = await state();
  assert.equal(s.cue.revealed, true);
  assert.equal(s.cue.reveal.correctIndex, 0);
  assert.equal(s.cue.reveal.correct, true);
  assert.equal((await room(`/sessions/${id}/respond`, { body: { cueId: s.cue.id, answers: [1] } })).status, 409, "closed once revealed");

  // The unchanged shortcut still works for a phone that is up to date.
  const same = (await room(`/sessions/${id}/state?since=${s.version}`)).json;
  assert.equal(same.changed, false);

  // The next time round the loop the same question opens afresh and can be answered again.
  at(total + loopPosition(0, 4) + 2);
  s = await state();
  assert.equal(s.cue.kind, "question");
  assert.equal(s.cue.open, true);
  assert.equal(s.cue.answered, false);
  assert.equal((await room(`/sessions/${id}/respond`, { body: { cueId: s.cue.id, answers: [1] } })).status, 200);

  // A poll has no right answer.
  at(total + loopPosition(0, 5) + 2);
  s = await state();
  assert.equal(s.cue.poll, true);

  // The second trial class is its own loop.
  at(loopPosition(1, 0) + 1);
  const other = await room("/join", { body: { code: "222111" } });
  assert.equal(other.status, 200);
  assert.notEqual(other.json.session.id, id);
});

test("trial classes: switched off, codes configurable, and a student can't end or run one", async (t) => {
  const { installAll, mkUser, request, admin, count } = await setup();
  await installAll();
  const student = await mkUser("stu_o");
  const room = (path: string, o: { method?: string; body?: unknown } = {}) => request(`/v1/education/classroom${path}`, { ...o, token: student });

  // Codes: six digits, and different from each other.
  const patch = (body: Json) => request("/v1/admin/learn-settings", { method: "PATCH", token: admin, body });
  assert.equal((await patch({ trialCodeA: "12345" })).status, 400);
  assert.equal((await patch({ trialCodeA: "222111" })).status, 400, "the two codes must differ");
  assert.equal((await patch({ trialCodeA: "333444" })).status, 200);
  assert.equal((await room("/join", { body: { code: "111222" } })).status, 404, "the old code no longer works");
  const joined = await room("/join", { body: { code: "333444" } });
  assert.equal(joined.status, 200);
  assert.equal((await room("/trial")).json.classes[0].code, "333444");

  // Nobody but the hosting (demo) educator can end or edit it.
  assert.equal((await room(`/sessions/${joined.json.session.id}/end`, { body: {} })).status, 404);
  assert.equal((await room(`/sessions/${joined.json.session.id}/clear`, { body: { channel: "phones" } })).status, 404);

  // Switched off: not offered and not joinable.
  assert.equal((await patch({ trialClassesEnabled: false })).status, 200);
  assert.deepEqual((await room("/trial")).json.classes, []);
  assert.equal((await room("/join", { body: { code: "222111" } })).status, 404);
  assert.equal(await count("SELECT COUNT(*) AS n FROM edu_live_sessions WHERE autopilot = 1"), 2, "the classes themselves stay installed");
});

test("trial classes: a real session never receives a trial code", () => {
  const draws = ["111222", "222111", "555555"];
  assert.equal(freeSessionCode(["111222", "222111"], () => draws.shift()!), "555555", "reserved draws are skipped");
  assert.equal(freeSessionCode(["111222"], () => "111222"), null, "gives up rather than loop forever");
  assert.equal(freeSessionCode([], () => "123456"), "123456");
});
