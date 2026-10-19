import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume, tooManyRequests } from "../lib/ratelimit.js";
import { hasTable } from "../lib/schema.js";
import { resolveCustomerByIdentifier } from "../wallet/service.js";
import { cohortsOfCourse, cohortsReady } from "./cohorts.js";
import { courseAccess } from "./learning.js";
import { getLearnSettings } from "./settings.js";
import { body as readBody, count, fail, gate, isResponse, notFound, one, ownedCourse, ownedSchool } from "./studio.js";

type Row = Record<string, unknown>;

/** Reviews, Q&A, announcements, extra teachers and cohorts come with migration 0120. */
export const communityReady = () => hasTable("edu_reviews");

const text = (max: number, min = 0) => z.string().transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()).pipe(z.string().min(min).max(max));
const upgradePending = (c: Parameters<typeof fail>[0]) => fail(c, { status: 503, error: "upgrade_pending", message: "This isn't available yet. Try again shortly." });

// ---------------------------------------------------------------------------
// Reviews (readable by anyone through the catalogue)
// ---------------------------------------------------------------------------

export async function ratingOf(courseId: string): Promise<{ average: number | null; count: number }> {
  if (!(await communityReady())) return { average: null, count: 0 };
  const r = (await db.execute({ sql: "SELECT AVG(rating) AS a, COUNT(*) AS n FROM edu_reviews WHERE course_id = ?", args: [courseId] })).rows[0] as Row;
  const n = Number(r.n);
  return { average: n ? Math.round(Number(r.a) * 10) / 10 : null, count: n };
}

export async function reviewsOf(courseId: string, limit = 20) {
  if (!(await communityReady())) return [];
  const rows = (
    await db.execute({
      sql: "SELECT r.*, u.name FROM edu_reviews r JOIN users u ON u.id = r.user_id WHERE r.course_id = ? ORDER BY r.created_at DESC LIMIT ?",
      args: [courseId, limit],
    })
  ).rows as Row[];
  return rows.map((r) => ({
    userId: String(r.user_id),
    name: String(r.name ?? "Learner").split(" ")[0],
    rating: Number(r.rating),
    body: String(r.body ?? ""),
    reply: String(r.reply ?? ""),
    createdAt: String(r.created_at),
  }));
}

export async function openCohorts(courseId: string) {
  const { isOpen } = await import("./cohorts.js");
  return (await cohortsOfCourse(courseId)).filter((h) => isOpen(h)).map((h) => ({ id: h.id, name: h.name, startsAt: h.startsAt, enrolUntil: h.enrolUntil, seatsLeft: h.capacity === null ? null : Math.max(0, h.capacity - h.members) }));
}

// ---------------------------------------------------------------------------
// Learner routes
// ---------------------------------------------------------------------------

export const communityLearnRoutes = new Hono();

communityLearnRoutes.get("/courses/:id/review", async (c) => {
  if (!(await communityReady())) return c.json({ ok: true, review: null });
  const r = await one("SELECT * FROM edu_reviews WHERE course_id = ? AND user_id = ?", [c.req.param("id"), c.get("user").sub]);
  return c.json({ ok: true, review: r ? { rating: Number(r.rating), body: String(r.body), reply: String(r.reply ?? "") } : null });
});

communityLearnRoutes.post("/courses/:id/review", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.reviewsEnabled) return fail(c, { status: 503, error: "reviews_off", message: "Reviews are switched off right now." });
  if (!(await communityReady())) return upgradePending(c);
  const access = await courseAccess(user.sub, c.req.param("id"));
  if (!access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to review it." });
  if (access.owner) return fail(c, { status: 400, error: "own_course", message: "You can't review your own course." });
  const parsed = await readBody(c, z.object({ rating: z.number().int().min(1).max(5), body: text(settings.maxQaChars).default("") }));
  if (!parsed.ok) return parsed.res;
  const id = String(access.course.id);
  const total = await count("SELECT COUNT(*) AS n FROM edu_lessons WHERE course_id = ?", [id]);
  const done = await count("SELECT COUNT(*) AS n FROM edu_lesson_progress WHERE user_id = ? AND course_id = ?", [user.sub, id]);
  const percent = total ? Math.round((done / total) * 100) : 0;
  if (percent < settings.reviewMinProgressPercent) {
    return fail(c, { status: 409, error: "too_early", message: `Get ${settings.reviewMinProgressPercent}% of the way through the course before you review it. You're at ${percent}%.` });
  }
  const d = parsed.data as { rating: number; body: string };
  await db.execute({
    sql: `INSERT INTO edu_reviews (course_id, user_id, rating, body) VALUES (?, ?, ?, ?)
          ON CONFLICT(course_id, user_id) DO UPDATE SET rating = excluded.rating, body = excluded.body`,
    args: [id, user.sub, d.rating, d.body],
  });
  return c.json({ ok: true });
});

communityLearnRoutes.delete("/courses/:id/review", async (c) => {
  if (!(await communityReady())) return c.json({ ok: true });
  await db.execute({ sql: "DELETE FROM edu_reviews WHERE course_id = ? AND user_id = ?", args: [c.req.param("id"), c.get("user").sub] });
  return c.json({ ok: true });
});

// ---- Q&A ------------------------------------------------------------------

async function thread(courseId: string, lessonId: string | null, userId: string, teacher: boolean) {
  const questions = (
    await db.execute({
      sql: `SELECT q.*, u.name FROM edu_questions q JOIN users u ON u.id = q.user_id
            WHERE q.course_id = ? AND (? IS NULL OR q.lesson_id = ?) ORDER BY q.created_at DESC LIMIT 100`,
      args: [courseId, lessonId, lessonId],
    })
  ).rows as Row[];
  const ids = questions.map((q) => String(q.id));
  const answers = ids.length
    ? ((await db.execute({ sql: `SELECT a.*, u.name FROM edu_answers a JOIN users u ON u.id = a.user_id WHERE a.question_id IN (${ids.map(() => "?").join(",")}) ORDER BY a.created_at ASC`, args: ids })).rows as Row[])
    : [];
  const first = (n: unknown) => String(n ?? "Learner").split(" ")[0];
  return questions.map((q) => ({
    id: String(q.id),
    lessonId: q.lesson_id ? String(q.lesson_id) : null,
    askedBy: first(q.name),
    body: String(q.body),
    createdAt: String(q.created_at),
    mine: q.user_id === userId,
    canDelete: teacher || q.user_id === userId,
    answers: answers
      .filter((a) => a.question_id === q.id)
      .map((a) => ({ id: String(a.id), by: first(a.name), byTeacher: Number(a.by_teacher) === 1, body: String(a.body), createdAt: String(a.created_at), mine: a.user_id === userId, canDelete: teacher || a.user_id === userId })),
  }));
}

communityLearnRoutes.get("/courses/:id/qa", async (c) => {
  const user = c.get("user");
  if (!(await communityReady())) return c.json({ ok: true, questions: [] });
  const access = await courseAccess(user.sub, c.req.param("id"));
  if (!access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to see its questions." });
  const lessonId = c.req.query("lessonId") || null;
  return c.json({ ok: true, questions: await thread(String(access.course.id), lessonId, user.sub, access.owner) });
});

async function postQuota(c: Parameters<typeof tooManyRequests>[0], userId: string, perHour: number) {
  const quota = await consume(`learn-qa:${userId}`, perHour, 60 * 60);
  return quota.allowed ? null : tooManyRequests(c, quota, "You're posting a lot. Take a short break and try again.");
}

communityLearnRoutes.post("/courses/:id/qa", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.qaEnabled) return fail(c, { status: 503, error: "qa_off", message: "Questions are switched off right now." });
  if (!(await communityReady())) return upgradePending(c);
  const access = await courseAccess(user.sub, c.req.param("id"));
  if (!access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to ask a question." });
  const slow = await postQuota(c, user.sub, settings.qaPostsPerHour);
  if (slow) return slow;
  const parsed = await readBody(c, z.object({ body: text(settings.maxQaChars, 3), lessonId: z.string().max(80).nullable().default(null) }));
  if (!parsed.ok) return parsed.res;
  const d = parsed.data as { body: string; lessonId: string | null };
  if (d.lessonId && !(await one("SELECT 1 AS y FROM edu_lessons WHERE id = ? AND course_id = ?", [d.lessonId, access.course.id]))) return notFound(c, "lesson");
  const id = newId("qst");
  await db.execute({ sql: "INSERT INTO edu_questions (id, course_id, lesson_id, user_id, body) VALUES (?, ?, ?, ?, ?)", args: [id, access.course.id as string, d.lessonId, user.sub, d.body] });
  return c.json({ ok: true, id }, 201);
});

communityLearnRoutes.post("/qa/:id/answers", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.qaEnabled) return fail(c, { status: 503, error: "qa_off", message: "Questions are switched off right now." });
  if (!(await communityReady())) return upgradePending(c);
  const q = await one("SELECT * FROM edu_questions WHERE id = ?", [c.req.param("id")]);
  const access = q ? await courseAccess(user.sub, String(q.course_id)) : null;
  if (!q || !access) return notFound(c, "question");
  const slow = await postQuota(c, user.sub, settings.qaPostsPerHour);
  if (slow) return slow;
  const parsed = await readBody(c, z.object({ body: text(settings.maxQaChars, 2) }));
  if (!parsed.ok) return parsed.res;
  const id = newId("ans");
  await db.execute({ sql: "INSERT INTO edu_answers (id, question_id, user_id, body, by_teacher) VALUES (?, ?, ?, ?, ?)", args: [id, q.id as string, user.sub, (parsed.data as { body: string }).body, access.owner ? 1 : 0] });
  return c.json({ ok: true, id }, 201);
});

communityLearnRoutes.delete("/qa/:id", async (c) => {
  const user = c.get("user");
  if (!(await communityReady())) return c.json({ ok: true });
  const q = await one("SELECT * FROM edu_questions WHERE id = ?", [c.req.param("id")]);
  const access = q ? await courseAccess(user.sub, String(q.course_id)) : null;
  if (!q || !access || (q.user_id !== user.sub && !access.owner)) return notFound(c, "question");
  await db.execute({ sql: "DELETE FROM edu_answers WHERE question_id = ?", args: [q.id as string] });
  await db.execute({ sql: "DELETE FROM edu_questions WHERE id = ?", args: [q.id as string] });
  return c.json({ ok: true });
});

communityLearnRoutes.delete("/qa/answers/:id", async (c) => {
  const user = c.get("user");
  if (!(await communityReady())) return c.json({ ok: true });
  const a = await one("SELECT a.*, q.course_id FROM edu_answers a JOIN edu_questions q ON q.id = a.question_id WHERE a.id = ?", [c.req.param("id")]);
  const access = a ? await courseAccess(user.sub, String(a.course_id)) : null;
  if (!a || !access || (a.user_id !== user.sub && !access.owner)) return notFound(c, "answer");
  await db.execute({ sql: "DELETE FROM edu_answers WHERE id = ?", args: [a.id as string] });
  return c.json({ ok: true });
});

communityLearnRoutes.get("/courses/:id/announcements", async (c) => {
  if (!(await communityReady())) return c.json({ ok: true, announcements: [] });
  const access = await courseAccess(c.get("user").sub, c.req.param("id"));
  if (!access) return fail(c, { status: 403, error: "not_enrolled", message: "Enrol in this course to see its announcements." });
  const rows = (await db.execute({ sql: "SELECT * FROM edu_announcements WHERE course_id = ? ORDER BY created_at DESC LIMIT 20", args: [access.course.id as string] })).rows as Row[];
  return c.json({ ok: true, announcements: rows.map((r) => ({ id: String(r.id), title: String(r.title), body: String(r.body), createdAt: String(r.created_at) })) });
});

// ---------------------------------------------------------------------------
// Educator routes (mounted under /studio)
// ---------------------------------------------------------------------------

export const communityStudioRoutes = new Hono();

communityStudioRoutes.get("/shared-courses", async (c) => {
  if (!(await communityReady())) return c.json({ ok: true, courses: [] });
  const rows = (
    await db.execute({
      sql: `SELECT c.id, c.title, c.stream, c.status, s.name AS school_name FROM edu_course_instructors i JOIN edu_courses c ON c.id = i.course_id JOIN edu_schools s ON s.id = c.school_id
            WHERE i.user_id = ? ORDER BY c.title ASC LIMIT 100`,
      args: [c.get("user").sub],
    })
  ).rows as Row[];
  return c.json({ ok: true, courses: rows.map((r) => ({ id: String(r.id), title: String(r.title), stream: String(r.stream), status: String(r.status), schoolName: String(r.school_name) })) });
});

communityStudioRoutes.get("/courses/:id/community", async (c) => {
  const userId = c.get("user").sub;
  const course = await ownedCourse(userId, c.req.param("id"));
  if (!course) return notFound(c, "course");
  const id = String(course.id);
  const owner = !!(await ownedSchool(userId, String(course.school_id)));
  if (!(await communityReady())) return c.json({ ok: true, ready: false, owner, instructors: [], cohorts: [], reviews: [], rating: { average: null, count: 0 }, announcements: [], openQuestions: 0 });
  const instructors = (await db.execute({ sql: "SELECT i.user_id, u.name FROM edu_course_instructors i JOIN users u ON u.id = i.user_id WHERE i.course_id = ? ORDER BY i.added_at ASC", args: [id] })).rows as Row[];
  const reviews = (await db.execute({ sql: "SELECT r.*, u.name FROM edu_reviews r JOIN users u ON u.id = r.user_id WHERE r.course_id = ? ORDER BY r.created_at DESC LIMIT 100", args: [id] })).rows as Row[];
  const announcements = (await db.execute({ sql: "SELECT * FROM edu_announcements WHERE course_id = ? ORDER BY created_at DESC LIMIT 50", args: [id] })).rows as Row[];
  const open = await count("SELECT COUNT(*) AS n FROM edu_questions q WHERE q.course_id = ? AND NOT EXISTS (SELECT 1 FROM edu_answers a WHERE a.question_id = q.id AND a.by_teacher = 1)", [id]);
  return c.json({
    ok: true,
    ready: true,
    owner,
    instructors: instructors.map((r) => ({ userId: String(r.user_id), name: String(r.name ?? "Teacher") })),
    cohorts: await cohortsOfCourse(id),
    reviews: reviews.map((r) => ({ userId: String(r.user_id), name: String(r.name ?? "Learner"), rating: Number(r.rating), body: String(r.body), reply: String(r.reply ?? ""), createdAt: String(r.created_at) })),
    rating: await ratingOf(id),
    announcements: announcements.map((r) => ({ id: String(r.id), title: String(r.title), body: String(r.body), createdAt: String(r.created_at) })),
    openQuestions: open,
  });
});

communityStudioRoutes.post("/courses/:id/instructors", async (c) => {
  const g = await gate(c);
  if (isResponse(g)) return g;
  const course = await ownedCourse(g.userId, c.req.param("id"));
  if (!course) return notFound(c, "course");
  if (!(await ownedSchool(g.userId, String(course.school_id)))) return fail(c, { status: 403, error: "owner_only", message: "Only the school owner can add teachers." });
  if (!g.settings.instructorsEnabled) return fail(c, { status: 403, error: "instructors_off", message: "Adding teachers is switched off right now." });
  if (!(await communityReady())) return upgradePending(c);
  const parsed = await readBody(c, z.object({ identifier: text(120, 3) }));
  if (!parsed.ok) return parsed.res;
  const person = await resolveCustomerByIdentifier((parsed.data as { identifier: string }).identifier);
  if (!person) return fail(c, { status: 404, error: "person_not_found", message: "No Peebee account has that phone number or email." });
  if (person.id === g.userId) return fail(c, { status: 400, error: "own_account", message: "You already own this course." });
  const have = await count("SELECT COUNT(*) AS n FROM edu_course_instructors WHERE course_id = ?", [course.id]);
  if (have >= g.settings.maxInstructorsPerCourse) return fail(c, { status: 409, error: "limit_reached", message: `A course can have up to ${g.settings.maxInstructorsPerCourse} extra teachers.` });
  await db.execute({ sql: "INSERT OR IGNORE INTO edu_course_instructors (course_id, user_id, added_by) VALUES (?, ?, ?)", args: [course.id as string, person.id, g.userId] });
  return c.json({ ok: true, userId: person.id, name: person.name ?? "" }, 201);
});

communityStudioRoutes.delete("/courses/:id/instructors/:userId", async (c) => {
  const userId = c.get("user").sub;
  const course = await ownedCourse(userId, c.req.param("id"));
  if (!course) return notFound(c, "course");
  const owner = !!(await ownedSchool(userId, String(course.school_id)));
  // The owner can remove anyone; a teacher can step down.
  if (!owner && c.req.param("userId") !== userId) return fail(c, { status: 403, error: "owner_only", message: "Only the school owner can remove other teachers." });
  if (await communityReady()) await db.execute({ sql: "DELETE FROM edu_course_instructors WHERE course_id = ? AND user_id = ?", args: [course.id as string, c.req.param("userId")] });
  return c.json({ ok: true });
});

const cohortBody = z.object({
  name: text(80, 2),
  startsAt: z.string().datetime({ offset: true }),
  enrolUntil: z.string().datetime({ offset: true }).nullable().default(null),
  capacity: z.number().int().min(1).max(100_000).nullable().default(null),
});

communityStudioRoutes.post("/courses/:id/cohorts", async (c) => {
  const g = await gate(c);
  if (isResponse(g)) return g;
  const course = await ownedCourse(g.userId, c.req.param("id"));
  if (!course) return notFound(c, "course");
  if (!g.settings.cohortsEnabled) return fail(c, { status: 403, error: "cohorts_off", message: "Cohorts are switched off right now." });
  if (!(await cohortsReady())) return upgradePending(c);
  const parsed = await readBody(c, cohortBody);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data as z.infer<typeof cohortBody>;
  if (d.enrolUntil && Date.parse(d.enrolUntil) < Date.parse(d.startsAt) - 365 * 86_400_000) return fail(c, { status: 400, error: "bad_dates", message: "Check the enrolment deadline." });
  const id = newId("coh");
  await db.execute({ sql: "INSERT INTO edu_cohorts (id, course_id, name, starts_at, enrol_until, capacity) VALUES (?, ?, ?, ?, ?, ?)", args: [id, course.id as string, d.name, d.startsAt, d.enrolUntil, d.capacity] });
  return c.json({ ok: true, id }, 201);
});

async function ownedCohort(userId: string, id: string) {
  if (!(await cohortsReady())) return null;
  const h = await one("SELECT * FROM edu_cohorts WHERE id = ?", [id]);
  return h && (await ownedCourse(userId, String(h.course_id))) ? h : null;
}

communityStudioRoutes.put("/cohorts/:id", async (c) => {
  const h = await ownedCohort(c.get("user").sub, c.req.param("id"));
  if (!h) return notFound(c, "cohort");
  const parsed = await readBody(c, cohortBody);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data as z.infer<typeof cohortBody>;
  const members = await count("SELECT COUNT(*) AS n FROM edu_cohort_members WHERE cohort_id = ?", [h.id]);
  if (d.capacity !== null && d.capacity < members) return fail(c, { status: 409, error: "capacity_low", message: `${members} learners have already joined, so the seat limit can't be lower than that.` });
  await db.execute({ sql: "UPDATE edu_cohorts SET name = ?, starts_at = ?, enrol_until = ?, capacity = ? WHERE id = ?", args: [d.name, d.startsAt, d.enrolUntil, d.capacity, h.id as string] });
  return c.json({ ok: true });
});

communityStudioRoutes.delete("/cohorts/:id", async (c) => {
  const h = await ownedCohort(c.get("user").sub, c.req.param("id"));
  if (!h) return notFound(c, "cohort");
  if ((await count("SELECT COUNT(*) AS n FROM edu_cohort_members WHERE cohort_id = ?", [h.id])) > 0) return fail(c, { status: 409, error: "has_members", message: "Learners have joined this intake, so it can't be deleted." });
  await db.execute({ sql: "DELETE FROM edu_cohorts WHERE id = ?", args: [h.id as string] });
  return c.json({ ok: true });
});

communityStudioRoutes.put("/courses/:id/reviews/:userId/reply", async (c) => {
  const course = await ownedCourse(c.get("user").sub, c.req.param("id"));
  if (!course || !(await communityReady())) return notFound(c, "review");
  const parsed = await readBody(c, z.object({ reply: text(1500) }));
  if (!parsed.ok) return parsed.res;
  const res = await db.execute({ sql: "UPDATE edu_reviews SET reply = ?, replied_at = datetime('now') WHERE course_id = ? AND user_id = ?", args: [(parsed.data as { reply: string }).reply, course.id as string, c.req.param("userId")] });
  return (res.rowsAffected ?? 0) > 0 ? c.json({ ok: true }) : notFound(c, "review");
});

communityStudioRoutes.post("/courses/:id/announcements", async (c) => {
  const g = await gate(c);
  if (isResponse(g)) return g;
  const course = await ownedCourse(g.userId, c.req.param("id"));
  if (!course) return notFound(c, "course");
  if (!g.settings.announcementsEnabled) return fail(c, { status: 403, error: "announcements_off", message: "Announcements are switched off right now." });
  if (!(await communityReady())) return upgradePending(c);
  const parsed = await readBody(c, z.object({ title: text(120, 2), body: text(g.settings.maxQaChars).default("") }));
  if (!parsed.ok) return parsed.res;
  const d = parsed.data as { title: string; body: string };
  const id = newId("ann");
  await db.execute({ sql: "INSERT INTO edu_announcements (id, course_id, user_id, title, body) VALUES (?, ?, ?, ?, ?)", args: [id, course.id as string, g.userId, d.title, d.body] });
  return c.json({ ok: true, id }, 201);
});

communityStudioRoutes.delete("/announcements/:id", async (c) => {
  if (!(await communityReady())) return notFound(c, "announcement");
  const a = await one("SELECT * FROM edu_announcements WHERE id = ?", [c.req.param("id")]);
  if (!a || !(await ownedCourse(c.get("user").sub, String(a.course_id)))) return notFound(c, "announcement");
  await db.execute({ sql: "DELETE FROM edu_announcements WHERE id = ?", args: [a.id as string] });
  return c.json({ ok: true });
});
