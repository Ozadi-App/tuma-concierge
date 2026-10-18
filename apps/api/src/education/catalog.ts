import { Hono } from "hono";
import { EDUCATION_STREAM_IDS } from "@peebee/shared";
import { db } from "../db/client.js";
import { clientIp, consume, tooManyRequests } from "../lib/ratelimit.js";
import { studioReady } from "./studio.js";

/**
 * What learners can browse: published courses from schools that are in good
 * standing. Public and read-only. Quiz answers and explanations are never
 * included here; they are only ever shown to the educator who wrote them.
 */
export const catalogRoutes = new Hono();

type Row = Record<string, unknown>;

catalogRoutes.use("*", async (c, next) => {
  const quota = await consume(`learn-catalog:${clientIp(c)}`, 120, 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "Too many requests. Try again in a moment.");
  await next();
});

function outcomes(raw: unknown): string[] {
  try {
    const list = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

catalogRoutes.get("/courses", async (c) => {
  if (!(await studioReady())) return c.json({ ok: true, courses: [] });
  const stream = c.req.query("stream");
  const limit = Math.max(1, Math.min(50, Number(c.req.query("limit")) || 24));
  const filtered = stream && (EDUCATION_STREAM_IDS as readonly string[]).includes(stream);
  const res = await db.execute({
    sql: `SELECT c.id, c.stream, c.title, c.summary, c.price_ugx, c.framework, c.outcomes_json,
                 s.name AS school_name, s.slug AS school_slug, k.name AS class_name, k.kind AS class_kind, k.level AS class_level,
                 (SELECT COUNT(*) FROM edu_lessons l WHERE l.course_id = c.id) AS lesson_count
          FROM edu_courses c
          JOIN edu_schools s ON s.id = c.school_id AND s.status = 'active'
          JOIN edu_classes k ON k.id = c.class_id
          WHERE c.status = 'published' ${filtered ? "AND c.stream = ?" : ""}
          ORDER BY c.updated_at DESC LIMIT ?`,
    args: (filtered ? [stream, limit] : [limit]) as never,
  });
  return c.json({
    ok: true,
    courses: (res.rows as Row[]).map((r) => ({
      id: String(r.id),
      stream: String(r.stream),
      title: String(r.title),
      summary: String(r.summary ?? ""),
      priceUgx: Number(r.price_ugx ?? 0),
      framework: String(r.framework),
      outcomes: outcomes(r.outcomes_json),
      schoolName: String(r.school_name),
      schoolSlug: String(r.school_slug),
      className: String(r.class_name),
      classKind: String(r.class_kind),
      classLevel: String(r.class_level ?? ""),
      lessonCount: Number(r.lesson_count ?? 0),
    })),
  });
});

catalogRoutes.get("/courses/:id", async (c) => {
  if (!(await studioReady())) return c.json({ error: "not_found", message: "That course wasn't found." }, 404);
  const course = (
    await db.execute({
      sql: `SELECT c.*, s.name AS school_name, k.name AS class_name
            FROM edu_courses c
            JOIN edu_schools s ON s.id = c.school_id AND s.status = 'active'
            JOIN edu_classes k ON k.id = c.class_id
            WHERE c.id = ? AND c.status = 'published'`,
      args: [c.req.param("id")],
    })
  ).rows[0] as Row | undefined;
  if (!course) return c.json({ error: "not_found", message: "That course wasn't found." }, 404);

  const modules = (await db.execute({ sql: "SELECT * FROM edu_modules WHERE course_id = ? ORDER BY position ASC LIMIT 500", args: [course.id as string] })).rows as Row[];
  const lessons = (await db.execute({ sql: "SELECT * FROM edu_lessons WHERE course_id = ? ORDER BY position ASC LIMIT 5000", args: [course.id as string] })).rows as Row[];
  return c.json({
    ok: true,
    course: {
      id: String(course.id),
      stream: String(course.stream),
      title: String(course.title),
      summary: String(course.summary ?? ""),
      priceUgx: Number(course.price_ugx ?? 0),
      framework: String(course.framework),
      outcomes: outcomes(course.outcomes_json),
      schoolName: String(course.school_name),
      className: String(course.class_name),
      modules: modules.map((m) => ({
        id: String(m.id),
        title: String(m.title),
        description: String(m.description ?? ""),
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => {
            let questionCount = 0;
            try {
              questionCount = JSON.parse(String(l.quiz_json ?? "null"))?.questions?.length ?? 0;
            } catch {
              questionCount = 0;
            }
            return {
              id: String(l.id),
              title: String(l.title),
              contentType: String(l.content_type),
              durationMinutes: Number(l.duration_minutes ?? 0),
              summary: String(l.summary ?? ""),
              questionCount,
            };
          }),
      })),
    },
  });
});
