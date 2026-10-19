import { Hono, type Context } from "hono";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { LearnSettings } from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume, tooManyRequests } from "../lib/ratelimit.js";
import { getPlatformEnvironment, type PlatformEnvironment } from "../lib/settings.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";
import { creditWallet, debitWallet, resolveCustomerByIdentifier } from "../wallet/service.js";
import { getLearnSettings } from "./settings.js";
import {
  body as readBody,
  count,
  fail,
  gate,
  isResponse,
  learningReady,
  notFound,
  one,
  ownedCourse,
  ownedLesson,
  ownedSchool,
  studioReady,
  suspended,
  throttle,
} from "./studio.js";

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const upgradePending = (c: Context) =>
  c.json({ error: "learn_upgrade_pending", message: "This part of Peebee Learn is being set up. Try again shortly." }, 503);

async function ready(): Promise<boolean> {
  return (await studioReady()) && (await learningReady());
}

/** Splits a sale between the educator and Peebee. The commission is rounded down, so the educator never gets less than their share. */
export function splitPayment(amount: number, commissionPercent: number): { commission: number; payout: number } {
  const commission = Math.floor((amount * commissionPercent) / 100);
  return { commission, payout: amount - commission };
}

/**
 * Takes `amount` from the payer's wallet and pays the educator their share.
 * If paying the educator fails after the payer was charged, the payer is refunded,
 * so money is never left half-moved.
 */
async function chargeAndPayOut(input: {
  payerId: string;
  ownerId: string;
  amount: number;
  commissionPercent: number;
  environment: PlatformEnvironment;
  note: string;
}): Promise<{ ok: true; commission: number } | { ok: false }> {
  const balance = await debitWallet(input.payerId, input.amount, { type: "order_payment", environment: input.environment, counterpartyId: input.ownerId, note: input.note });
  if (balance === null) return { ok: false };
  const { commission, payout } = splitPayment(input.amount, input.commissionPercent);
  try {
    if (payout > 0) await creditWallet(input.ownerId, payout, { type: "adjustment", environment: input.environment, counterpartyId: input.payerId, note: input.note });
  } catch (err) {
    await creditWallet(input.payerId, input.amount, { type: "refund", environment: input.environment, note: `Refund: ${input.note}` });
    throw err;
  }
  return { ok: true, commission };
}

const money = z.number().int().min(1);

// ---------------------------------------------------------------------------
// Media: signed links so a <video> tag can play a file without a bearer header
// ---------------------------------------------------------------------------

const MEDIA_AUDIENCE = "peebee-learn-media";
const MEDIA_TTL = "2h";
const key = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export async function signMediaToken(userId: string, lessonId: string): Promise<string> {
  return new SignJWT({ lid: lessonId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("peebee-api")
    .setAudience(MEDIA_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(MEDIA_TTL)
    .sign(key());
}

/** Looks at the first bytes: the declared type came from the client, the bytes decide. */
export function sniffMedia(head: Uint8Array): { ext: string; type: string } | null {
  const is = (...sig: number[]) => sig.every((b, i) => head[i] === b);
  const text = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head.length >= 12 && text(4, 8) === "ftyp") {
    const brand = text(8, 12);
    if (brand === "qt  ") return { ext: "mov", type: "video/quicktime" };
    if (brand === "M4A " || brand === "M4B ") return { ext: "m4a", type: "audio/mp4" };
    return { ext: "mp4", type: "video/mp4" };
  }
  if (is(0x1a, 0x45, 0xdf, 0xa3)) return { ext: "webm", type: "video/webm" };
  if (text(0, 3) === "ID3" || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return { ext: "mp3", type: "audio/mpeg" };
  return null;
}

async function readHead(stream: ReadableStream<Uint8Array>, want = 16): Promise<Uint8Array> {
  const reader = stream.getReader();
  let head = new Uint8Array(0);
  try {
    while (head.length < want) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const next = new Uint8Array(head.length + value.length);
      next.set(head);
      next.set(value, head.length);
      head = next;
    }
  } finally {
    // Not awaited: a tee'd branch's cancel only settles once the other branch is cancelled too.
    void reader.cancel().catch(() => undefined);
  }
  return head;
}

/** R2 needs a stream of known length; Workers provide FixedLengthStream for exactly that. */
function withKnownLength(stream: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
  const Fixed = (globalThis as unknown as { FixedLengthStream?: new (n: number) => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> } }).FixedLengthStream;
  if (!Fixed) return stream;
  const { readable, writable } = new Fixed(length);
  void stream.pipeTo(writable).catch(() => undefined);
  return readable;
}

function parseRange(header: string | undefined, size: number): { offset: number; length: number } | "invalid" | null {
  if (!header) return null;
  const m = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || start >= size || end < start) return "invalid";
  return { offset: start, length: end - start + 1 };
}

/** Public, token-gated. The token says who may watch which lesson and for how long. */
export const mediaRoutes = new Hono();

mediaRoutes.get("/media/:token", async (c) => {
  let lessonId: string;
  try {
    const { payload } = await jwtVerify(c.req.param("token"), key(), { issuer: "peebee-api", audience: MEDIA_AUDIENCE });
    lessonId = String(payload.lid);
  } catch {
    return c.json({ error: "link_expired", message: "This video link has expired. Reload the lesson." }, 401);
  }
  if (!(await ready())) return upgradePending(c);
  const row = await one("SELECT r2_key, content_type, size_bytes FROM edu_lesson_media WHERE lesson_id = ?", [lessonId]);
  if (!row) return c.json({ error: "not_found", message: "This lesson has no video." }, 404);
  const size = Number(row.size_bytes);
  const range = parseRange(c.req.header("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });

  const object = await getR2Bucket().get(String(row.r2_key), range ? { range } : undefined);
  if (!object) return c.json({ error: "not_found", message: "This video is no longer available." }, 404);
  const headers: Record<string, string> = {
    ...uploadResponseHeaders(String(row.content_type), "application/octet-stream"),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  };
  if (range) {
    headers["Content-Range"] = `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`;
    headers["Content-Length"] = String(range.length);
    return new Response(object.body, { status: 206, headers });
  }
  headers["Content-Length"] = String(size);
  return new Response(object.body, { status: 200, headers });
});

// ---------------------------------------------------------------------------
// Educator side: uploads, students, fees
// ---------------------------------------------------------------------------

export const studioLearningRoutes = new Hono();

studioLearningRoutes.use("*", async (c, next) => {
  if (!(await learningReady())) return upgradePending(c);
  await next();
});

studioLearningRoutes.put("/lessons/:id/media", async (c) => {
  const g = await gate(c);
  if (isResponse(g)) return g;
  if (!g.settings.videoUploadsEnabled) return fail(c, { status: 503, error: "uploads_off", message: "Video uploads are switched off right now." });
  const lesson = await ownedLesson(g.userId, c.req.param("id"));
  if (!lesson) return notFound(c, "lesson");
  const course = await ownedCourse(g.userId, String(lesson.course_id));
  const school = course ? await ownedSchool(g.userId, String(course.school_id)) : null;
  if (school?.status === "suspended") return suspended(c);

  const length = Number(c.req.header("content-length"));
  if (!Number.isFinite(length) || length <= 0) return c.json({ error: "length_required", message: "Send the file with its size." }, 411);
  const limit = g.settings.maxVideoMb * 1024 * 1024;
  if (length > limit) return c.json({ error: "file_too_large", message: `Files can be up to ${g.settings.maxVideoMb} MB.` }, 413);
  const stream = c.req.raw.body;
  if (!stream) return c.json({ error: "missing_file", message: "Choose a video or audio file." }, 400);

  const slow = await throttle(c, g.userId, g.settings);
  if (slow) return slow;

  // One branch is read for the file's first bytes, the other goes to storage, so the file is never held in memory.
  const [probe, upload] = stream.tee();
  const detected = sniffMedia(await readHead(probe));
  if (!detected) {
    void upload.cancel().catch(() => undefined);
    return c.json({ error: "unsupported_file_type", message: "Use an MP4, MOV, WebM, M4A or MP3 file." }, 400);
  }

  const r2Key = `learn/${lesson.id}/${crypto.randomUUID()}.${detected.ext}`;
  await getR2Bucket().put(r2Key, withKnownLength(upload, length), { httpMetadata: { contentType: detected.type } });

  const previous = await one("SELECT r2_key FROM edu_lesson_media WHERE lesson_id = ?", [lesson.id]);
  await db.execute({
    sql: `INSERT INTO edu_lesson_media (lesson_id, r2_key, content_type, size_bytes, uploaded_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(lesson_id) DO UPDATE SET r2_key = excluded.r2_key, content_type = excluded.content_type,
            size_bytes = excluded.size_bytes, uploaded_by = excluded.uploaded_by, created_at = datetime('now')`,
    args: [lesson.id as string, r2Key, detected.type, length, g.userId],
  });
  if (previous?.r2_key) await getR2Bucket().delete(String(previous.r2_key)).catch(() => undefined);
  return c.json({ ok: true, media: { contentType: detected.type, sizeBytes: length } }, 201);
});

studioLearningRoutes.delete("/lessons/:id/media", async (c) => {
  const lesson = await ownedLesson(c.get("user").sub, c.req.param("id"));
  if (!lesson) return notFound(c, "lesson");
  const row = await one("SELECT r2_key FROM edu_lesson_media WHERE lesson_id = ?", [lesson.id]);
  if (row) {
    await db.execute({ sql: "DELETE FROM edu_lesson_media WHERE lesson_id = ?", args: [lesson.id as string] });
    await getR2Bucket().delete(String(row.r2_key)).catch(() => undefined);
  }
  return c.json({ ok: true });
});

studioLearningRoutes.get("/courses/:id/students", async (c) => {
  const course = await ownedCourse(c.get("user").sub, c.req.param("id"));
  if (!course) return notFound(c, "course");
  const total = await count("SELECT COUNT(*) AS n FROM edu_lessons WHERE course_id = ?", [course.id]);
  const res = await db.execute({
    sql: `SELECT e.id, e.user_id, e.price_paid_ugx, e.created_at, u.name,
                 (SELECT COUNT(*) FROM edu_lesson_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id) AS done
          FROM edu_enrollments e JOIN users u ON u.id = e.user_id
          WHERE e.course_id = ? AND e.status = 'active' ORDER BY e.created_at DESC LIMIT 500`,
    args: [course.id as string],
  });
  return c.json({
    ok: true,
    students: (res.rows as Row[]).map((r) => ({
      userId: String(r.user_id),
      name: String(r.name),
      enrolledAt: String(r.created_at),
      paidUgx: Number(r.price_paid_ugx),
      progressPercent: total ? Math.round((Number(r.done) / total) * 100) : 0,
    })),
  });
});

const invoiceBody = z.object({
  student: z.string().trim().min(3).max(120),
  title: z.string().trim().min(2).max(120),
  amountUgx: money,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
});

const invoiceShape = (r: Row) => ({
  id: String(r.id),
  schoolId: String(r.school_id),
  schoolName: r.school_name === undefined ? undefined : String(r.school_name),
  studentId: String(r.student_id),
  studentName: r.student_name === undefined ? undefined : String(r.student_name),
  title: String(r.title),
  amountUgx: Number(r.amount_ugx),
  paidUgx: Number(r.paid_ugx),
  balanceUgx: Number(r.amount_ugx) - Number(r.paid_ugx),
  dueDate: String(r.due_date ?? ""),
  status: String(r.status),
  createdAt: String(r.created_at),
});

studioLearningRoutes.get("/schools/:id/invoices", async (c) => {
  const school = await ownedSchool(c.get("user").sub, c.req.param("id"));
  if (!school) return notFound(c, "school");
  const res = await db.execute({
    sql: `SELECT i.*, u.name AS student_name FROM edu_fee_invoices i JOIN users u ON u.id = i.student_id
          WHERE i.school_id = ? ORDER BY i.created_at DESC LIMIT 500`,
    args: [school.id as string],
  });
  return c.json({ ok: true, invoices: (res.rows as Row[]).map(invoiceShape) });
});

studioLearningRoutes.post("/schools/:id/invoices", async (c) => {
  const g = await gate(c);
  if (isResponse(g)) return g;
  if (!g.settings.feesEnabled) return fail(c, { status: 503, error: "fees_off", message: "School fees are switched off right now." });
  const school = await ownedSchool(g.userId, c.req.param("id"));
  if (!school) return notFound(c, "school");
  if (school.status === "suspended") return suspended(c);
  const parsed = await readBody(c, invoiceBody);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;
  if (d.amountUgx > g.settings.maxCoursePriceUgx * 10) {
    return fail(c, { status: 400, error: "amount_too_high", message: "That amount is higher than Peebee allows for one invoice." });
  }
  const slow = await throttle(c, g.userId, g.settings);
  if (slow) return slow;

  const student = await resolveCustomerByIdentifier(d.student);
  if (!student) return fail(c, { status: 404, error: "student_not_found", message: "No Peebee account has that phone number or email." });
  if (student.id === g.userId) return fail(c, { status: 400, error: "own_account", message: "You can't invoice your own account." });

  const id = newId("inv");
  await db.execute({
    sql: `INSERT INTO edu_fee_invoices (id, school_id, student_id, title, amount_ugx, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, school.id as string, student.id, d.title, d.amountUgx, d.dueDate, g.userId],
  });
  const row = await one("SELECT i.*, u.name AS student_name FROM edu_fee_invoices i JOIN users u ON u.id = i.student_id WHERE i.id = ?", [id]);
  return c.json({ ok: true, invoice: invoiceShape(row!) }, 201);
});

studioLearningRoutes.post("/invoices/:id/cancel", async (c) => {
  const userId = c.get("user").sub;
  const row = await one(
    `SELECT i.* FROM edu_fee_invoices i JOIN edu_schools s ON s.id = i.school_id WHERE i.id = ? AND s.owner_id = ?`,
    [c.req.param("id"), userId],
  );
  if (!row) return notFound(c, "invoice");
  if (Number(row.paid_ugx) > 0) return fail(c, { status: 409, error: "already_paid", message: "Part of this invoice has been paid, so it can't be cancelled." });
  await db.execute({ sql: "UPDATE edu_fee_invoices SET status = 'cancelled' WHERE id = ? AND paid_ugx = 0", args: [row.id as string] });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Learner side
// ---------------------------------------------------------------------------

export const learnRoutes = new Hono();

learnRoutes.use("*", async (c, next) => {
  if (!(await ready())) return upgradePending(c);
  await next();
});

type Access = { course: Row; school: Row; owner: boolean };

/** The course, if this person may study it: the owner, or someone enrolled in a published course from a school in good standing. */
async function courseAccess(userId: string, courseId: string): Promise<Access | null> {
  const course = await one("SELECT * FROM edu_courses WHERE id = ?", [courseId]);
  if (!course) return null;
  const school = await one("SELECT * FROM edu_schools WHERE id = ?", [course.school_id]);
  if (!school) return null;
  if (school.owner_id === userId) return { course, school, owner: true };
  if (course.status !== "published" || school.status !== "active") return null;
  const enrolled = await one("SELECT 1 AS yes FROM edu_enrollments WHERE course_id = ? AND user_id = ? AND status = 'active'", [courseId, userId]);
  return enrolled ? { course, school, owner: false } : null;
}

function quizOf(raw: unknown): { title: string; passingScorePercent: number; questions: { question: string; options: string[]; correctIndex: number; explanation?: string }[] } | null {
  try {
    const quiz = JSON.parse(String(raw ?? "null"));
    return quiz && Array.isArray(quiz.questions) && quiz.questions.length ? quiz : null;
  } catch {
    return null;
  }
}

learnRoutes.get("/enrollments", async (c) => {
  const res = await db.execute({
    sql: `SELECT e.id, e.course_id, e.created_at, c.title, c.stream, c.status AS course_status, s.name AS school_name,
                 (SELECT COUNT(*) FROM edu_lessons l WHERE l.course_id = c.id) AS lessons,
                 (SELECT COUNT(*) FROM edu_lesson_progress p WHERE p.user_id = e.user_id AND p.course_id = c.id) AS done
          FROM edu_enrollments e JOIN edu_courses c ON c.id = e.course_id JOIN edu_schools s ON s.id = c.school_id
          WHERE e.user_id = ? AND e.status = 'active' ORDER BY e.created_at DESC LIMIT 200`,
    args: [c.get("user").sub],
  });
  return c.json({
    ok: true,
    enrollments: (res.rows as Row[]).map((r) => ({
      id: String(r.id),
      courseId: String(r.course_id),
      title: String(r.title),
      stream: String(r.stream),
      schoolName: String(r.school_name),
      enrolledAt: String(r.created_at),
      lessonCount: Number(r.lessons),
      completedLessons: Number(r.done),
      progressPercent: Number(r.lessons) ? Math.round((Number(r.done) / Number(r.lessons)) * 100) : 0,
    })),
  });
});

learnRoutes.post("/courses/:id/enroll", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.enrolmentsEnabled) return fail(c, { status: 503, error: "enrolments_off", message: "Enrolment is switched off right now." });
  const quota = await consume(`learn-enroll:${user.sub}`, 20, 60 * 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "You're enrolling very quickly. Try again in a little while.");

  const course = await one("SELECT * FROM edu_courses WHERE id = ? AND status = 'published'", [c.req.param("id")]);
  const school = course ? await one("SELECT * FROM edu_schools WHERE id = ? AND status = 'active'", [course.school_id]) : null;
  if (!course || !school) return notFound(c, "course");
  if (school.owner_id === user.sub) return fail(c, { status: 400, error: "own_course", message: "This is your own course. You can already open it." });

  const price = Number(course.price_ugx);
  if (price > 0 && !settings.paidCoursesEnabled) {
    return fail(c, { status: 503, error: "paid_courses_off", message: "Paid courses aren't available right now." });
  }
  const environment = await getPlatformEnvironment();

  // Claim the seat first. The unique (course, learner) pair makes a double tap or a race lose cleanly.
  const claim = await db.execute({
    sql: `INSERT OR IGNORE INTO edu_enrollments (id, course_id, school_id, user_id, status, environment) VALUES (?, ?, ?, ?, 'pending', ?)`,
    args: [newId("enr"), course.id as string, school.id as string, user.sub, environment],
  });
  if ((claim.rowsAffected ?? 0) === 0) {
    const existing = await one("SELECT status FROM edu_enrollments WHERE course_id = ? AND user_id = ?", [course.id, user.sub]);
    if (existing?.status === "active") return fail(c, { status: 409, error: "already_enrolled", message: "You're already enrolled in this course." });
    // Someone (this learner, a moment ago) is already taking the payment. Only a claim that has sat unfinished
    // for a couple of minutes, because that attempt died midway, may be taken over.
    const reclaimed = await db.execute({
      sql: "UPDATE edu_enrollments SET created_at = datetime('now') WHERE course_id = ? AND user_id = ? AND status = 'pending' AND created_at < datetime('now', '-2 minutes')",
      args: [course.id as string, user.sub],
    });
    if ((reclaimed.rowsAffected ?? 0) === 0) {
      return fail(c, { status: 409, error: "in_progress", message: "Your enrolment is already being processed." });
    }
  }

  let commission = 0;
  if (price > 0) {
    const paid = await chargeAndPayOut({
      payerId: user.sub,
      ownerId: String(school.owner_id),
      amount: price,
      commissionPercent: settings.commissionPercent,
      environment,
      note: `Peebee Learn: ${String(course.title)}`,
    }).catch(() => null);
    if (!paid || !paid.ok) {
      await db.execute({ sql: "DELETE FROM edu_enrollments WHERE course_id = ? AND user_id = ? AND status = 'pending'", args: [course.id as string, user.sub] });
      return c.json({ error: "insufficient_wallet", message: `Add UGX ${price.toLocaleString("en-UG")} to your Peebee wallet to enrol.` }, 402);
    }
    commission = paid.commission;
  }
  await db.execute({
    sql: "UPDATE edu_enrollments SET status = 'active', price_paid_ugx = ?, commission_ugx = ? WHERE course_id = ? AND user_id = ?",
    args: [price, commission, course.id as string, user.sub],
  });
  return c.json({ ok: true, enrolled: true, paidUgx: price });
});

learnRoutes.get("/courses/:id", async (c) => {
  const user = c.get("user");
  const access = await courseAccess(user.sub, c.req.param("id"));
  if (!access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to open its lessons." });
  const id = String(access.course.id);
  const modules = (await db.execute({ sql: "SELECT * FROM edu_modules WHERE course_id = ? ORDER BY position ASC LIMIT 500", args: [id] })).rows as Row[];
  const lessons = (await db.execute({ sql: "SELECT * FROM edu_lessons WHERE course_id = ? ORDER BY position ASC LIMIT 5000", args: [id] })).rows as Row[];
  const progress = (await db.execute({ sql: "SELECT lesson_id, best_score_percent FROM edu_lesson_progress WHERE user_id = ? AND course_id = ?", args: [user.sub, id] })).rows as Row[];
  const done = new Map(progress.map((p) => [String(p.lesson_id), p.best_score_percent === null ? null : Number(p.best_score_percent)]));
  const media = new Set(
    ((await db.execute({ sql: "SELECT m.lesson_id FROM edu_lesson_media m JOIN edu_lessons l ON l.id = m.lesson_id WHERE l.course_id = ?", args: [id] })).rows as Row[]).map((r) => String(r.lesson_id)),
  );
  return c.json({
    ok: true,
    owner: access.owner,
    course: {
      id,
      title: String(access.course.title),
      summary: String(access.course.summary ?? ""),
      stream: String(access.course.stream),
      schoolName: String(access.school.name),
      progressPercent: lessons.length ? Math.round((done.size / lessons.length) * 100) : 0,
      modules: modules.map((m) => ({
        id: String(m.id),
        title: String(m.title),
        description: String(m.description ?? ""),
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => {
            const quiz = quizOf(l.quiz_json);
            return {
              id: String(l.id),
              title: String(l.title),
              contentType: String(l.content_type),
              durationMinutes: Number(l.duration_minutes),
              summary: String(l.summary ?? ""),
              contentUrl: String(l.content_url ?? ""),
              hasMedia: media.has(String(l.id)),
              completed: done.has(String(l.id)),
              bestScorePercent: done.get(String(l.id)) ?? null,
              // The questions and choices, never the answers.
              quiz: quiz
                ? { title: quiz.title, passingScorePercent: quiz.passingScorePercent, questions: quiz.questions.map((q) => ({ question: q.question, options: q.options })) }
                : null,
            };
          }),
      })),
    },
  });
});

learnRoutes.post("/lessons/:id/media-url", async (c) => {
  const user = c.get("user");
  const lesson = await one("SELECT id, course_id FROM edu_lessons WHERE id = ?", [c.req.param("id")]);
  const access = lesson ? await courseAccess(user.sub, String(lesson.course_id)) : null;
  if (!lesson || !access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to watch its lessons." });
  const has = await one("SELECT 1 AS yes FROM edu_lesson_media WHERE lesson_id = ?", [lesson.id]);
  if (!has) return notFound(c, "video");
  const base = (process.env.PUBLIC_API_URL ?? "").replace(/\/$/, "");
  return c.json({ ok: true, url: `${base}/v1/education/media/${await signMediaToken(user.sub, String(lesson.id))}` });
});

learnRoutes.post("/lessons/:id/quiz", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  const quota = await consume(`learn-quiz:${user.sub}`, settings.quizAttemptsPerHour, 60 * 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "That's a lot of attempts. Take a short break and try again.");

  const lesson = await one("SELECT * FROM edu_lessons WHERE id = ?", [c.req.param("id")]);
  const access = lesson ? await courseAccess(user.sub, String(lesson.course_id)) : null;
  if (!lesson || !access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to take its quizzes." });
  const quiz = quizOf(lesson.quiz_json);
  if (!quiz) return fail(c, { status: 404, error: "no_quiz", message: "This lesson has no quiz." });

  const parsed = await readBody(c, z.object({ answers: z.array(z.number().int().min(-1).max(20)).length(quiz.questions.length) }));
  if (!parsed.ok) return parsed.res;
  const answers: number[] = parsed.data.answers;

  const correct = quiz.questions.map((q, i) => answers[i] === q.correctIndex);
  const right = correct.filter(Boolean).length;
  const scorePercent = Math.round((right / quiz.questions.length) * 100);
  const passed = scorePercent >= quiz.passingScorePercent;

  await db.execute({
    sql: "INSERT INTO edu_quiz_attempts (id, user_id, lesson_id, course_id, score_percent, passed, answers_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [newId("qza"), user.sub, lesson.id as string, lesson.course_id as string, scorePercent, passed ? 1 : 0, JSON.stringify(answers)],
  });
  if (passed && !access.owner) {
    await db.execute({
      sql: `INSERT INTO edu_lesson_progress (user_id, lesson_id, course_id, best_score_percent) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, lesson_id) DO UPDATE SET best_score_percent = MAX(COALESCE(best_score_percent, 0), excluded.best_score_percent)`,
      args: [user.sub, lesson.id as string, lesson.course_id as string, scorePercent],
    });
  }
  return c.json({
    ok: true,
    scorePercent,
    passed,
    passMark: quiz.passingScorePercent,
    // What was right or wrong is always shown. The correct answer and the reason are shown once the learner has passed.
    results: quiz.questions.map((q, i) => ({
      correct: correct[i],
      ...(passed ? { correctIndex: q.correctIndex, explanation: q.explanation ?? "" } : {}),
    })),
  });
});

learnRoutes.post("/lessons/:id/complete", async (c) => {
  const user = c.get("user");
  const lesson = await one("SELECT * FROM edu_lessons WHERE id = ?", [c.req.param("id")]);
  const access = lesson ? await courseAccess(user.sub, String(lesson.course_id)) : null;
  if (!lesson || !access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to track your progress." });
  if (quizOf(lesson.quiz_json)) return fail(c, { status: 409, error: "pass_quiz_first", message: "Pass this lesson's quiz to complete it." });
  if (!access.owner) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO edu_lesson_progress (user_id, lesson_id, course_id) VALUES (?, ?, ?)",
      args: [user.sub, lesson.id as string, lesson.course_id as string],
    });
  }
  return c.json({ ok: true });
});

// ---- School fees, paid from the learner's wallet ---------------------------

learnRoutes.get("/invoices", async (c) => {
  const res = await db.execute({
    sql: `SELECT i.*, s.name AS school_name FROM edu_fee_invoices i JOIN edu_schools s ON s.id = i.school_id
          WHERE i.student_id = ? AND i.status != 'cancelled' ORDER BY i.created_at DESC LIMIT 200`,
    args: [c.get("user").sub],
  });
  return c.json({ ok: true, invoices: (res.rows as Row[]).map(invoiceShape) });
});

learnRoutes.post("/invoices/:id/pay", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.feesEnabled) return fail(c, { status: 503, error: "fees_off", message: "School fees are switched off right now." });
  const quota = await consume(`learn-pay:${user.sub}`, 20, 60 * 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "Too many payments in a short time. Try again later.");
  const parsed = await readBody(c, z.object({ amountUgx: money }));
  if (!parsed.ok) return parsed.res;
  const amount: number = parsed.data.amountUgx;

  const invoice = await one(
    `SELECT i.*, s.owner_id, s.name AS school_name, s.status AS school_status FROM edu_fee_invoices i JOIN edu_schools s ON s.id = i.school_id WHERE i.id = ? AND i.student_id = ?`,
    [c.req.param("id"), user.sub],
  );
  if (!invoice || invoice.status === "cancelled") return notFound(c, "invoice");
  if (invoice.school_status !== "active") return fail(c, { status: 403, error: "school_suspended", message: "This school isn't taking payments right now." });
  if (invoice.status === "paid") return fail(c, { status: 409, error: "already_paid", message: "This invoice is already paid." });
  const environment = await getPlatformEnvironment();

  // Reserve the amount first. The condition stops two taps from paying more than is owed.
  const reserve = await db.execute({
    sql: `UPDATE edu_fee_invoices SET paid_ugx = paid_ugx + ?,
            status = CASE WHEN paid_ugx + ? >= amount_ugx THEN 'paid' ELSE 'partial' END
          WHERE id = ? AND student_id = ? AND status IN ('unpaid', 'partial') AND paid_ugx + ? <= amount_ugx`,
    args: [amount, amount, invoice.id as string, user.sub, amount],
  });
  if ((reserve.rowsAffected ?? 0) === 0) {
    return fail(c, { status: 400, error: "amount_too_high", message: "That's more than the balance on this invoice." });
  }

  const undo = () =>
    db.execute({
      sql: `UPDATE edu_fee_invoices SET paid_ugx = paid_ugx - ?, status = CASE WHEN paid_ugx - ? <= 0 THEN 'unpaid' ELSE 'partial' END WHERE id = ?`,
      args: [amount, amount, invoice.id as string],
    });

  let paid: Awaited<ReturnType<typeof chargeAndPayOut>>;
  try {
    paid = await chargeAndPayOut({
      payerId: user.sub,
      ownerId: String(invoice.owner_id),
      amount,
      commissionPercent: settings.commissionPercent,
      environment,
      note: `School fees: ${String(invoice.title)} (${String(invoice.school_name)})`,
    });
  } catch {
    // The payer was already refunded by chargeAndPayOut; release the reserved amount.
    await undo();
    return c.json({ error: "payment_failed", message: "The payment didn't go through and you haven't been charged. Try again." }, 502);
  }
  if (!paid.ok) {
    await undo();
    return c.json({ error: "insufficient_wallet", message: `Add UGX ${amount.toLocaleString("en-UG")} to your Peebee wallet to pay this.` }, 402);
  }
  const receiptId = newId("rcp");
  await db.execute({
    sql: "INSERT INTO edu_fee_payments (id, invoice_id, payer_id, amount_ugx, commission_ugx, environment) VALUES (?, ?, ?, ?, ?, ?)",
    args: [receiptId, invoice.id as string, user.sub, amount, paid.commission, environment],
  });
  const fresh = await one("SELECT i.*, s.name AS school_name FROM edu_fee_invoices i JOIN edu_schools s ON s.id = i.school_id WHERE i.id = ?", [invoice.id]);
  return c.json({ ok: true, receiptId, invoice: invoiceShape(fresh!) });
});

export type { LearnSettings };
