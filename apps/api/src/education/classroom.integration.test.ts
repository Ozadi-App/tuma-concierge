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
import { resetLiveCache } from "./classroom.js";
import { setLearnSettings } from "./settings.js";
import { resetStudioCache } from "./studio.js";

process.env.JWT_SECRET = "classroom-test-only-secret";
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
  setD1Binding({ prepare, async batch() { return []; } } as unknown as D1Database);
}

async function setup(skip: string[] = []) {
  resetSchemaCache();
  resetStudioCache();
  resetLiveCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    if (skip.some((s) => file.startsWith(s))) continue;
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const store = new Map<string, Uint8Array>();
  setR2Binding({
    async put(k: string, v: unknown) { store.set(k, new Uint8Array(await new Response(v as ReadableStream).arrayBuffer())); },
    async get(k: string) { const b = store.get(k); return b ? { body: new Blob([b as BlobPart]).stream(), httpMetadata: { contentType: "video/mp4" }, size: b.length } : null; },
    async delete(k: string) { store.delete(k); },
  } as unknown as R2Bucket);
  await setLearnSettings({ createsPerHour: 1000 });

  let n = 0;
  const mkUser = async (id: string) => {
    n += 1;
    await client.execute({
      sql: "INSERT INTO users (id, phone, name, role, password_hash, email_verified_at) VALUES (?, ?, ?, 'customer', 'x', datetime('now'))",
      args: [id, `+25673000${String(n).padStart(4, "0")}`, `${id.split("_")[0]} Person${n}`],
    });
    return signToken({ sub: id, role: "customer" });
  };
  const request = async (path: string, opts: { method?: string; token?: string; device?: string; body?: unknown } = {}) => {
    const res = await app.request(`/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.device ? { Authorization: `Device ${opts.device}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  };
  const room = (path: string, o: Parameters<typeof request>[1] = {}) => request(`/education/classroom${path}`, o);
  const tv = (path: string, o: Parameters<typeof request>[1] = {}) => request(`/tv${path}`, o);

  /** A TV that is switched on and paired to `ownerToken`'s account. */
  const pairTv = async (ownerToken: string, name = "Hall TV") => {
    const started = await tv("/pair/start", { method: "POST", body: {} });
    assert.equal(started.status, 201, JSON.stringify(started.json));
    const claim = await tv("/pair", { token: ownerToken, body: { code: started.json.code, name } });
    assert.equal(claim.status, 201, JSON.stringify(claim.json));
    return { deviceId: started.json.deviceId as string, secret: started.json.secret as string };
  };
  /** A published course with a lesson that has two quiz questions, owned by `ownerToken`. */
  const makeCourse = async (ownerToken: string) => {
    const edu = (p: string, o: Parameters<typeof request>[1] = {}) => request(`/education${p}`, { ...o, token: ownerToken });
    const school = (await edu("/studio/schools", { body: { name: "Hilltop", kind: "school", streams: ["foundations"] } })).json.school;
    const cls = (await edu(`/studio/schools/${school.id}/classes`, { body: { stream: "foundations", name: "P4", framework: "uganda_primary" } })).json.class;
    const course = (await edu(`/studio/classes/${cls.id}/courses`, { body: { title: "Fractions" } })).json.course;
    const mod = (await edu(`/studio/courses/${course.id}/modules`, { body: { title: "Unit 1" } })).json.module;
    const lesson = (
      await edu(`/studio/modules/${mod.id}/lessons`, {
        body: {
          title: "Halves",
          summary: "Half of something",
          quiz: { title: "Q", passingScorePercent: 50, questions: [
            { question: "1/2 of 10?", options: ["5", "2"], correctIndex: 0, explanation: "Ten shared by two" },
            { question: "1/4 of 8?", options: ["4", "2"], correctIndex: 1 },
          ] },
        },
      })
    ).json.lesson;
    return { school, cls, course, lesson };
  };
  return { client, store, request, room, tv, mkUser, pairTv, makeCourse };
}

test("tv: a screen pairs with a short code, only the educator who types it owns it, and the secret is never stored", async () => {
  const { tv, mkUser, client } = await setup();
  const owner = await mkUser("own_1");
  const other = await mkUser("oth_1");

  const started = await tv("/pair/start", { method: "POST", body: {} });
  assert.equal(started.status, 201);
  assert.match(started.json.code, /^[A-HJ-NP-Z2-9]{6}$/, "no 0/O/1/I confusion on a TV across the room");
  assert.ok(started.json.secret.length >= 64);
  const hash = String((await client.execute("SELECT secret_hash FROM tv_devices")).rows[0].secret_hash);
  assert.notEqual(hash, started.json.secret, "only a hash is stored");

  const waiting = await tv("/me", { device: started.json.secret });
  assert.equal(waiting.json.status, "unpaired");
  assert.equal(waiting.json.code, started.json.code);
  assert.equal((await tv("/me")).status, 401);
  assert.equal((await tv("/me", { device: "x".repeat(64) })).status, 401);
  assert.equal((await tv("/me", { token: owner })).status, 401, "a person's login is not a screen's key");

  assert.equal((await tv("/pair", { token: owner, body: { code: "ZZZZZZ" } })).status, 404);
  assert.equal((await tv("/pair", { token: owner, body: { code: "abc" } })).status, 400);
  const claimed = await tv("/pair", { token: owner, body: { code: started.json.code.toLowerCase(), name: "Staff room TV" } });
  assert.equal(claimed.status, 201);
  assert.equal((await tv("/pair", { token: other, body: { code: started.json.code } })).status, 404, "a code works once");

  const paired = await tv("/me", { device: started.json.secret });
  assert.equal(paired.json.status, "paired");
  assert.equal(paired.json.name, "Staff room TV");
  const mine = await tv("/devices", { token: owner });
  assert.equal(mine.json.devices.length, 1);
  assert.equal(mine.json.devices[0].online, true);
  assert.equal((await tv("/devices", { token: other })).json.devices.length, 0);
  assert.equal((await tv(`/devices/${mine.json.devices[0].id}`, { method: "PATCH", token: other, body: { name: "Mine now" } })).status, 404);
  assert.equal((await tv(`/devices/${mine.json.devices[0].id}`, { method: "DELETE", token: other })).status, 404);
  assert.equal((await tv(`/devices/${mine.json.devices[0].id}`, { method: "DELETE", token: owner })).status, 200);
  assert.equal((await tv("/me", { device: started.json.secret })).status, 401, "a removed screen is signed out");

  // A TV can also remove itself.
  const second = await tv("/pair/start", { method: "POST", body: {} });
  await tv("/pair", { token: owner, body: { code: second.json.code } });
  assert.equal((await tv("/me", { method: "DELETE", device: second.json.secret })).status, 200);
  assert.equal((await tv("/devices", { token: owner })).json.devices.length, 0);
});

test("tv: expired codes are replaced, wrong codes are rate limited, and the number of screens is capped", async () => {
  const { tv, mkUser, client, pairTv } = await setup();
  const owner = await mkUser("own_2");
  const started = await tv("/pair/start", { method: "POST", body: {} });
  await client.execute("UPDATE tv_devices SET pair_expires_at = datetime('now', '-1 minute')");
  assert.equal((await tv("/pair", { token: owner, body: { code: started.json.code } })).status, 404, "an expired code is refused");
  const fresh = await tv("/me", { device: started.json.secret });
  assert.notEqual(fresh.json.code, started.json.code, "the TV is given a new code");
  assert.equal((await tv("/pair", { token: owner, body: { code: fresh.json.code } })).status, 201);

  let last = 0;
  for (let i = 0; i < 12; i += 1) last = (await tv("/pair", { token: owner, body: { code: "AAAAAA" } })).status;
  assert.equal(last, 429, "guessing codes locks you out");

  const { mkUser: mk2, tv: tv2 } = await setup();
  const rich = await mk2("own_2b");
  await setLearnSettings({ maxScreensPerUser: 1 });
  const s1 = await tv2("/pair/start", { method: "POST", body: {} });
  assert.equal((await tv2("/pair", { token: rich, body: { code: s1.json.code } })).status, 201);
  const s2 = await tv2("/pair/start", { method: "POST", body: {} });
  assert.equal((await tv2("/pair", { token: rich, body: { code: s2.json.code } })).json.error, "limit_reached");
  void pairTv;
});

test("session: built from a course, one screen per live session, only the school's owner can run it", async () => {
  const { room, tv, mkUser, pairTv, makeCourse } = await setup();
  const host = await mkUser("host_3");
  const intruder = await mkUser("int_3");
  const { course, school } = await makeCourse(host);
  const screen = await pairTv(host);

  assert.equal((await room("/sessions", { token: intruder, body: { title: "Not mine", courseId: course.id } })).status, 404);
  const made = await room("/sessions", { token: host, body: { title: "Fractions live", courseId: course.id, screenDeviceId: screen.deviceId } });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  assert.match(made.json.session.code, /^\d{6}$/);
  const id = made.json.session.id;

  await tv("/me", { device: screen.secret });
  const detail = await room(`/sessions/${id}`, { token: host });
  assert.deepEqual(detail.json.cues.map((c: Json) => c.kind), ["lesson", "question", "question"], "a lesson, then its two quiz questions");
  assert.equal(detail.json.cues[1].payload.correctIndex, 0, "the host sees the answers");
  assert.equal(detail.json.screen.online, true);
  assert.equal((await room(`/sessions/${id}`, { token: intruder })).status, 404);

  const second = await room("/sessions", { token: host, body: { title: "Another", schoolId: school.id, screenDeviceId: screen.deviceId, autoCues: false } });
  assert.equal(second.json.error, "screen_busy");
  const plain = await room("/sessions", { token: host, body: { title: "No TV", schoolId: school.id, autoCues: false } });
  assert.equal(plain.status, 201);
  assert.equal((await room(`/sessions/${plain.json.session.id}`, { method: "PATCH", token: host, body: { screenDeviceId: screen.deviceId } })).json.error, "screen_busy");
  assert.equal((await room(`/sessions/${id}/end`, { token: host, body: {} })).status, 200);
  assert.equal((await room(`/sessions/${plain.json.session.id}`, { method: "PATCH", token: host, body: { screenDeviceId: screen.deviceId } })).status, 200, "free once the other session ends");
  assert.equal((await room("/sessions", { token: host })).json.sessions.length, 2);
});

test("push: the educator chooses where each item goes, and no answer reaches a phone or the TV before the reveal", async () => {
  const { room, tv, mkUser, pairTv, makeCourse } = await setup();
  const host = await mkUser("host_4");
  const amina = await mkUser("amina_4");
  const brian = await mkUser("brian_4");
  const { course } = await makeCourse(host);
  const screen = await pairTv(host);
  const session = (await room("/sessions", { token: host, body: { title: "Live", courseId: course.id, screenDeviceId: screen.deviceId } })).json.session;
  const cues = (await room(`/sessions/${session.id}`, { token: host })).json.cues as Json[];
  const [lessonCue, q1, q2] = cues;

  const joined = await room("/join", { token: amina, body: { code: session.code } });
  assert.equal(joined.status, 200);
  await room("/join", { token: brian, body: { code: session.code } });
  const phone = (token: string, since?: number) => room(`/sessions/${session.id}/state${since ? `?since=${since}` : ""}`, { token });
  const screenState = () => tv("/screen/state", { device: screen.secret });

  // Nothing pushed yet.
  assert.equal((await screenState()).json.session.code, session.code);
  assert.equal((await screenState()).json.cue, null);
  assert.equal((await phone(amina)).json.cue, null);

  // The lesson goes to the screen only.
  assert.equal((await room(`/cues/${lessonCue.id}/push`, { token: host, body: { target: "screen" } })).status, 200);
  assert.equal((await screenState()).json.cue.kind, "lesson");
  assert.equal((await screenState()).json.cue.title, "Halves");
  assert.equal((await phone(amina)).json.cue, null, "the phones are untouched");

  // The question goes to both. Nobody but the host can see the answer.
  assert.equal((await room(`/cues/${q1.id}/push`, { token: host, body: { target: "both" } })).status, 200);
  const tvQ = (await screenState()).json.cue;
  const phoneQ = (await phone(amina)).json.cue;
  assert.equal(tvQ.kind, "question");
  assert.equal(phoneQ.question, "1/2 of 10?");
  for (const view of [tvQ, phoneQ]) {
    const raw = JSON.stringify(view);
    assert.ok(!raw.includes("correctIndex") && !raw.includes("Ten shared by two"), "the answer is not in what is sent");
  }
  assert.equal(tvQ.counts, undefined, "votes stay hidden on the TV until the reveal");

  const answer = (token: string, choice: number, cueId = q1.id) => room(`/sessions/${session.id}/respond`, { token, body: { cueId, answers: [choice] } });
  assert.equal((await answer(amina, 0)).json.accepted, true);
  assert.equal((await answer(amina, 1)).json.error, "already_answered");
  assert.equal((await answer(brian, 1)).status, 200);
  assert.equal((await screenState()).json.cue.answered, 2, "the TV shows how many answered, not what");
  assert.equal((await phone(amina)).json.cue.answered, true);
  assert.equal((await answer(amina, 0, q2.id)).json.error, "not_current");
  assert.equal((await answer(amina, 9)).status, 400);

  // Reveal: now the answer, counts and a leaderboard appear, with names shortened.
  assert.equal((await room(`/cues/${q1.id}/reveal`, { token: host, body: {} })).status, 200);
  const revealedTv = (await screenState()).json.cue;
  assert.equal(revealedTv.correctIndex, 0);
  assert.deepEqual(revealedTv.counts, [1, 1]);
  assert.equal(revealedTv.leaders[0].name, "amina P.");
  assert.equal(revealedTv.leaders[0].points, 1);
  const revealedPhone = (await phone(amina)).json.cue;
  assert.equal(revealedPhone.reveal.correctIndex, 0);
  assert.equal(revealedPhone.reveal.correct, true);
  assert.equal((await phone(brian)).json.cue.reveal.correct, false);
  assert.equal((await answer(brian, 0)).json.error, "closed", "once revealed, no more answers");
  const late = await mkUser("late_4");
  void late;

  // Where an item may go is checked: an exam is for phones only.
  const exam = await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "exam", payload: { title: "Test", minutes: 10, questions: [{ question: "2+2?", options: ["3", "4"], correctIndex: 1 }] } } });
  assert.equal(exam.status, 201);
  assert.equal((await room(`/cues/${exam.json.cueId}/push`, { token: host, body: { target: "screen" } })).json.error, "bad_target");
});

test("push: items that need a TV say so; phones-only works without one; closing and clearing take things down", async () => {
  const { room, mkUser, makeCourse } = await setup();
  const host = await mkUser("host_5");
  const student = await mkUser("stu_5");
  const { school } = await makeCourse(host);
  const session = (await room("/sessions", { token: host, body: { title: "No TV class", schoolId: school.id } })).json.session;
  await room("/join", { token: student, body: { code: session.code } });
  const add = async (body: Json) => (await room(`/sessions/${session.id}/cues`, { token: host, body })).json.cueId as string;
  const note = await add({ kind: "announcement", payload: { text: "Open your books" } });

  assert.equal((await room(`/cues/${note}/push`, { token: host, body: { target: "both" } })).json.error, "no_screen");
  assert.equal((await room(`/cues/${note}/push`, { token: host, body: { target: "phones" } })).status, 200);
  const state = await room(`/sessions/${session.id}/state`, { token: student });
  assert.equal(state.json.cue.text, "Open your books");
  assert.equal((await room(`/sessions/${session.id}/state?since=${state.json.version}`, { token: student })).json.changed, false, "nothing new: a tiny reply");
  await room(`/cues/${note}/close`, { token: host, body: {} });
  const after = await room(`/sessions/${session.id}/state?since=${state.json.version}`, { token: student });
  assert.equal(after.json.changed, true);
  assert.equal(after.json.cue, null);
  assert.equal((await room(`/cues/${note}`, { method: "DELETE", token: host })).status, 200);
  assert.equal((await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "slide", payload: { title: "x", imageUrl: "javascript:alert(1)" } } })).status, 400);
  assert.equal((await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "question", payload: { question: "?", options: ["a", "b"], correctIndex: 5 } } })).status, 400);
  assert.equal((await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "lesson", payload: { lessonId: "les_nope" } } })).status, 404);
  assert.equal((await room(`/sessions/${session.id}/clear`, { token: host, body: { channel: "both" } })).status, 200);
});

test("exam: phones take it privately, the server marks it, the TV only shows progress until the reveal", async () => {
  const { room, tv, mkUser, pairTv, makeCourse, client } = await setup();
  const host = await mkUser("host_6");
  const a = await mkUser("ann_6");
  const b = await mkUser("ben_6");
  const { school } = await makeCourse(host);
  const screen = await pairTv(host);
  const session = (await room("/sessions", { token: host, body: { title: "Exam day", schoolId: school.id, screenDeviceId: screen.deviceId } })).json.session;
  await room("/join", { token: a, body: { code: session.code } });
  await room("/join", { token: b, body: { code: session.code } });
  const cueId = (await room(`/sessions/${session.id}/cues`, {
    token: host,
    body: { kind: "exam", payload: { title: "Fractions test", minutes: 20, questions: [
      { question: "1/2 of 10?", options: ["5", "2"], correctIndex: 0 },
      { question: "1/4 of 8?", options: ["4", "2"], correctIndex: 1 },
      { question: "3/3 is?", options: ["0", "1"], correctIndex: 1 },
    ] } },
  })).json.cueId;
  assert.equal((await room(`/cues/${cueId}/push`, { token: host, body: { target: "both" } })).status, 200);

  const phone = (await room(`/sessions/${session.id}/state`, { token: a })).json.cue;
  assert.equal(phone.kind, "exam");
  assert.equal(phone.questions.length, 3);
  assert.ok(!JSON.stringify(phone).includes("correctIndex"));
  assert.ok(Date.parse(phone.endsAt) > Date.now() + 19 * 60_000, "a 20-minute timer");

  const submit = (token: string, answers: number[]) => room(`/sessions/${session.id}/respond`, { token, body: { cueId, answers } });
  assert.equal((await submit(a, [0, 1])).status, 400, "every question must be answered");
  assert.equal((await submit(a, [0, 1, 1])).status, 200);
  assert.equal((await submit(b, [1, 0, 1])).status, 200);
  assert.equal((await submit(b, [1, 1, 1])).json.error, "already_answered");
  assert.equal((await room(`/sessions/${session.id}/state`, { token: a })).json.cue.result.score, 3, "a learner sees their own mark");
  const tvBefore = (await tv("/screen/state", { device: screen.secret })).json.cue;
  assert.equal(tvBefore.submitted, 2);
  assert.equal(tvBefore.leaders, undefined, "no marks on the TV before the reveal");

  await room(`/cues/${cueId}/reveal`, { token: host, body: {} });
  const tvAfter = (await tv("/screen/state", { device: screen.secret })).json.cue;
  assert.equal(tvAfter.leaders[0].points, 3);
  assert.equal(tvAfter.average, 67, "(3 + 1) of 6 points");
  assert.ok((await room(`/sessions/${session.id}/state`, { token: b })).json.cue.review, "answers are shown to students after the reveal");

  // Time's up: answers after the deadline are refused.
  const late = await mkUser("late_6");
  await room("/join", { token: late, body: { code: session.code } });
  await client.execute({ sql: "UPDATE edu_live_cues SET revealed = 0, ends_at = ? WHERE id = ?", args: [new Date(Date.now() - 60_000).toISOString(), cueId] });
  assert.equal((await submit(late, [0, 1, 1])).json.error, "closed");
});

test("attendance and hands: students check in and raise a hand; the educator sees and lowers them", async () => {
  const { room, tv, mkUser, pairTv, makeCourse } = await setup();
  const host = await mkUser("host_7");
  const a = await mkUser("ann_7");
  const b = await mkUser("ben_7");
  const { school } = await makeCourse(host);
  const screen = await pairTv(host);
  const session = (await room("/sessions", { token: host, body: { title: "Roll call", schoolId: school.id, screenDeviceId: screen.deviceId } })).json.session;
  await room("/join", { token: a, body: { code: session.code } });
  await room("/join", { token: b, body: { code: session.code } });
  const cueId = (await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "attendance", payload: {} } })).json.cueId;
  await room(`/cues/${cueId}/push`, { token: host, body: { target: "both" } });
  assert.equal((await room(`/sessions/${session.id}/respond`, { token: a, body: { cueId, answers: [] } })).status, 200);
  assert.equal((await tv("/screen/state", { device: screen.secret })).json.cue.present, 1);
  assert.equal((await room(`/sessions/${session.id}/state`, { token: a })).json.present, true);

  await room(`/sessions/${session.id}/hand`, { token: b, body: { raised: true } });
  let detail = (await room(`/sessions/${session.id}`, { token: host })).json;
  assert.equal(detail.members.find((m: Json) => m.userId === "ben_7").handRaised, true);
  assert.equal(detail.members.find((m: Json) => m.userId === "ann_7").present, true);
  assert.equal((await tv("/screen/state", { device: screen.secret })).json.session.hands, 1);
  assert.equal((await room(`/sessions/${session.id}/hands/ben_7/clear`, { token: a, body: {} })).status, 404, "only the host lowers a hand");
  await room(`/sessions/${session.id}/hands/ben_7/clear`, { token: host, body: {} });
  detail = (await room(`/sessions/${session.id}`, { token: host })).json;
  assert.equal(detail.members.find((m: Json) => m.userId === "ben_7").handRaised, false);
});

test("lesson on the TV: the video plays through a signed link, and the tutor's pause reaches the screen", async () => {
  const { room, tv, request, mkUser, pairTv, makeCourse, store } = await setup();
  const host = await mkUser("host_8");
  const { course, lesson } = await makeCourse(host);
  const screen = await pairTv(host);
  const bytes = new Uint8Array(100);
  bytes.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
  const up = await app.request(`/v1/education/studio/lessons/${lesson.id}/media`, { method: "PUT", headers: { Authorization: `Bearer ${host}`, "Content-Length": String(bytes.length) }, body: bytes });
  assert.equal(up.status, 201);
  assert.equal(store.size, 1);
  const session = (await room("/sessions", { token: host, body: { title: "Video lesson", courseId: course.id, screenDeviceId: screen.deviceId } })).json.session;
  const lessonCue = ((await room(`/sessions/${session.id}`, { token: host })).json.cues as Json[])[0];
  await room(`/cues/${lessonCue.id}/push`, { token: host, body: { target: "screen" } });
  const state = (await tv("/screen/state", { device: screen.secret })).json;
  assert.equal(state.cue.media.contentType, "video/mp4");
  assert.ok(state.cue.media.url.startsWith("https://api.test/v1/education/media/"));
  assert.equal(state.playback.playing, true);
  const played = await request(state.cue.media.url.replace("https://api.test/v1", ""));
  assert.equal(played.status, 200, "the TV can fetch the video with that link alone");

  await room(`/sessions/${session.id}/playback`, { token: host, body: { playing: false, at: 12 } });
  const paused = (await tv("/screen/state", { device: screen.secret })).json.playback;
  assert.equal(paused.playing, false);
  assert.equal(paused.at, 12);
  assert.equal(state.session.joinUrl, `https://customer.test/learn/live?code=${session.code}`);
});

test("joining: wrong codes, a full class, the host themselves and strangers are all refused", async () => {
  const { room, mkUser, makeCourse } = await setup();
  const host = await mkUser("host_9");
  const a = await mkUser("ann_9");
  const b = await mkUser("ben_9");
  const stranger = await mkUser("str_9");
  const { school } = await makeCourse(host);
  const session = (await room("/sessions", { token: host, body: { title: "Small class", schoolId: school.id } })).json.session;
  assert.equal((await room("/join", { token: a, body: { code: "000000" } })).json.error, "bad_code");
  assert.equal((await room("/join", { token: a, body: { code: "12" } })).status, 400);
  assert.equal((await room("/join", { token: host, body: { code: session.code } })).json.error, "own_session");
  await setLearnSettings({ liveMaxParticipants: 1 });
  assert.equal((await room("/join", { token: a, body: { code: session.code } })).status, 200);
  assert.equal((await room("/join", { token: a, body: { code: session.code } })).status, 200, "rejoining is fine");
  assert.equal((await room("/join", { token: b, body: { code: session.code } })).json.error, "session_full");
  assert.equal((await room(`/sessions/${session.id}/state`, { token: stranger })).status, 404, "you have to have joined");
  assert.equal((await room(`/sessions/${session.id}/respond`, { token: stranger, body: { cueId: "x", answers: [] } })).status, 404);

  // Ending the session ends it for everyone and frees its code.
  await room(`/sessions/${session.id}/end`, { token: host, body: {} });
  assert.equal((await room(`/sessions/${session.id}/state`, { token: a })).json.status, "ended");
  assert.equal((await room("/join", { token: b, body: { code: session.code } })).json.error, "bad_code");
  assert.equal((await room(`/sessions/${session.id}/cues`, { token: host, body: { kind: "announcement", payload: { text: "hi" } } })).json.error, "session_ended");
});

test("the admin switch and 'upgrade pending' both stop the classroom cleanly", async () => {
  const a = await setup();
  const host = await a.mkUser("host_10");
  const { school } = await a.makeCourse(host);
  await setLearnSettings({ liveEnabled: false });
  assert.equal((await a.room("/sessions", { token: host, body: { title: "Closed", schoolId: school.id } })).status, 503);
  assert.equal((await a.tv("/pair/start", { method: "POST", body: {} })).status, 201, "a TV can still show its code");
  const started = await a.tv("/pair/start", { method: "POST", body: {} });
  assert.equal((await a.tv("/pair", { token: host, body: { code: started.json.code } })).status, 503);

  const b = await setup(["0112_", "0113_"]);
  const user = await b.mkUser("host_11");
  assert.equal((await b.room("/sessions", { token: user })).status, 503);
  assert.equal((await b.tv("/pair/start", { method: "POST", body: {} })).json.error, "classroom_upgrade_pending");
  assert.equal((await b.request("/education/studio/schools", { token: user })).status, 200, "the Studio is unaffected");
});

test("deleting a course, class or school takes its live sessions with it instead of failing", async () => {
  const { room, request, mkUser, makeCourse, client } = await setup();
  const host = await mkUser("host_del");
  const { school, cls, course } = await makeCourse(host);
  const made = await room("/sessions", { token: host, body: { title: "Live", courseId: course.id } });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  const del = (p: string) => request(`/education/studio${p}`, { method: "DELETE", token: host });

  assert.equal((await del(`/courses/${course.id}`)).status, 200);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM edu_live_sessions")).rows[0]!.n), 0);

  const again = await makeCourse(host);
  await room("/sessions", { token: host, body: { title: "Two", schoolId: again.school.id, autoCues: false } });
  assert.equal((await del(`/schools/${again.school.id}`)).status, 200);
  assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM edu_live_sessions")).rows[0]!.n), 0);
  void school; void cls;
});
