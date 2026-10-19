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
import { drawArt, wrapTitle } from "./art.js";
import { sniffImage } from "./learning.js";
import { setLearnSettings } from "./settings.js";
import { resetStudioCache } from "./studio.js";

process.env.JWT_SECRET = "art-test-only-secret";
process.env.PUBLIC_API_URL = "https://api.test";

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

function fakeR2() {
  const store = new Map<string, { bytes: Uint8Array; type?: string }>();
  const bucket: R2Bucket = {
    async put(key, value, options) {
      const bytes = value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : new Uint8Array(value as ArrayBuffer);
      store.set(key, { bytes, type: options?.httpMetadata?.contentType });
    },
    async get(key) {
      const item = store.get(key);
      return item ? { body: new Blob([item.bytes as BlobPart]).stream(), httpMetadata: { contentType: item.type }, size: item.bytes.length } : null;
    },
    async delete(key) {
      store.delete(key);
    },
  };
  return { bucket, store };
}

const PNG = (extra = 32) => {
  const bytes = new Uint8Array(8 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
};

async function setup(skipCoverMigration = false) {
  resetSchemaCache();
  resetStudioCache();
  const client = createClient({ url: "file::memory:" });
  const migrations = join(process.cwd(), "src/db/migrations");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    if (skipCoverMigration && file.startsWith("0115_")) continue;
    for (const sql of splitSqlStatements(readFileSync(join(migrations, file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  const r2 = fakeR2();
  setR2Binding(r2.bucket);
  await setLearnSettings({ createsPerHour: 1000, maxCoverMb: 2 });
  await client.execute({ sql: "INSERT INTO users (id, phone, name, role, password_hash, email_verified_at) VALUES ('own', '+256720000001', 'Owner', 'customer', 'x', datetime('now')), ('oth', '+256720000002', 'Other', 'customer', 'x', datetime('now'))", args: [] });
  const owner = await signToken({ sub: "own", role: "customer" });
  const other = await signToken({ sub: "oth", role: "customer" });
  const raw = (path: string, opts: { method?: string; token?: string; body?: BodyInit | Uint8Array; headers?: Record<string, string> } = {}) =>
    app.request(`/v1${path}`, { method: opts.method ?? "GET", headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...opts.headers }, body: opts.body as BodyInit | undefined });
  const call = async (path: string, opts: { method?: string; token?: string; body?: unknown } = {}) => {
    const res = await raw(`/education${path}`, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), token: opts.token, headers: { "Content-Type": "application/json" }, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  };
  const school = (await call("/studio/schools", { token: owner, body: { name: "Hilltop <School> & Co", kind: "school", streams: ["foundations"] } })).json.school;
  const cls = (await call(`/studio/schools/${school.id}/classes`, { token: owner, body: { stream: "foundations", name: "P4", framework: "uganda_primary" } })).json.class;
  const course = (await call(`/studio/classes/${cls.id}/courses`, { token: owner, body: { title: "Fractions made easy for everyone in primary four" } })).json.course;
  const mod = (await call(`/studio/courses/${course.id}/modules`, { token: owner, body: { title: "Unit 1" } })).json.module;
  const lesson = (await call(`/studio/modules/${mod.id}/lessons`, { token: owner, body: { title: "Intro lesson" } })).json.lesson;
  const publish = () => call(`/studio/courses/${course.id}`, { method: "PATCH", token: owner, body: { status: "published" } });
  return { client, r2, raw, call, owner, other, school, course, lesson, publish };
}

const put = (t: Awaited<ReturnType<typeof setup>>, path: string, token: string, bytes: Uint8Array) =>
  t.raw(`/education/studio${path}`, { method: "PUT", token, body: bytes, headers: { "Content-Length": String(bytes.length), "Content-Type": "image/png" } });

test("pure helpers: titles wrap and are escaped, images are identified by their bytes", () => {
  assert.deepEqual(wrapTitle("Fractions made easy"), ["Fractions made easy"]);
  const long = wrapTitle("Fractions made easy for everyone in primary four and beyond, forever and ever");
  assert.ok(long.length <= 3 && long.at(-1)!.endsWith("…"));
  const art = drawArt({ stream: "academy", title: `<script>alert("x")</script> & more`, label: "A&B", seed: "s" });
  assert.ok(!art.includes("<script>") && art.includes("&lt;script&gt;") && art.includes("&amp;"));
  assert.equal(sniffImage(PNG())?.type, "image/png");
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))?.ext, "jpg");
  assert.equal(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.ext, "webp");
  assert.equal(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>")), null);
});

test("a published course, school and lesson get a drawn picture; drafts reveal nothing", async () => {
  const t = await setup();
  const draft = await t.raw(`/education/art/course/${t.course.id}`);
  assert.equal(draft.status, 200);
  const draftSvg = await draft.text();
  assert.ok(!draftSvg.includes("Fractions"), "a draft course's title must not leak");

  await t.publish();
  for (const [kind, id, text] of [["course", t.course.id, "Fractions"], ["school", t.school.id, "Hilltop &lt;School&gt; &amp; Co"], ["lesson", t.lesson.id, "Intro lesson"]] as const) {
    const res = await t.raw(`/education/art/${kind}/${id}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok((await res.text()).includes(text), `${kind} art shows its title`);
  }
  assert.equal((await t.raw("/education/art/course/nope")).status, 200, "unknown ids still draw a plain picture");
  assert.equal((await t.raw("/education/art/stream/sprouts")).status, 200);
});

test("an educator can set, replace and remove a cover; others can't; bad files are refused", async () => {
  const t = await setup();
  await t.publish();
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.other, PNG())).status, 404, "not the owner");
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, new TextEncoder().encode("<svg onload=alert(1)></svg>"))).status, 400, "svg refused");
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, new Uint8Array(3 * 1024 * 1024))).status, 413, "over the limit");

  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, PNG())).status, 201);
  const shown = await t.raw(`/education/art/course/${t.course.id}`);
  assert.equal(shown.headers.get("content-type"), "image/png");
  assert.equal((await shown.arrayBuffer()).byteLength, 40);
  assert.equal(t.r2.store.size, 1);

  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, PNG(64))).status, 201);
  assert.equal(t.r2.store.size, 1, "the old picture is deleted when replaced");

  assert.equal((await put(t, `/schools/${t.school.id}/cover`, t.owner, PNG())).status, 201);
  assert.equal(t.r2.store.size, 2);
  assert.equal((await t.raw(`/education/art/school/${t.school.id}`)).headers.get("content-type"), "image/png");

  assert.equal((await t.raw(`/education/studio/courses/${t.course.id}/cover`, { method: "DELETE", token: t.other })).status, 404);
  assert.equal((await t.raw(`/education/studio/courses/${t.course.id}/cover`, { method: "DELETE", token: t.owner })).status, 200);
  assert.match((await t.raw(`/education/art/course/${t.course.id}`)).headers.get("content-type") ?? "", /svg/, "back to the drawn picture");
  assert.equal(t.r2.store.size, 1);
});

test("an uploaded cover stays hidden while the course is a draft, and admin can switch uploads off", async () => {
  const t = await setup();
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, PNG())).status, 201);
  assert.match((await t.raw(`/education/art/course/${t.course.id}`)).headers.get("content-type") ?? "", /svg/, "draft: the uploaded picture is not served publicly");
  await setLearnSettings({ maxCoverMb: 0 });
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, PNG())).status, 503);
});

test("before migration 0115 the pictures are still drawn and uploads say 'being set up'", async () => {
  const t = await setup(true);
  await t.publish();
  assert.equal((await t.raw(`/education/art/course/${t.course.id}`)).status, 200);
  assert.equal((await t.raw(`/education/art/school/${t.school.id}`)).status, 200);
  assert.equal((await put(t, `/courses/${t.course.id}/cover`, t.owner, PNG())).status, 503);
});
