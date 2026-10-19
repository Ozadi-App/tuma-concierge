import { Hono } from "hono";
import { z } from "zod";
import { EDUCATION_STREAM_IDS } from "@peebee/shared";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { clientIp } from "../lib/ratelimit.js";
import { getLearnSettings, setLearnSettings } from "./settings.js";
import { studioReady } from "./studio.js";

/** Staff controls for Peebee Learn: the settings, and suspending a school that breaks the rules. Mounted at /v1. */
export const educationAdminRoutes = new Hono();

educationAdminRoutes.use("/admin/learn-settings", requireAuth, requireRole("admin"));
educationAdminRoutes.use("/admin/learn-schools", requireAuth, requireRole("admin"));
educationAdminRoutes.use("/admin/learn-schools/*", requireAuth, requireRole("admin"));

const STREAMS = EDUCATION_STREAM_IDS as readonly [string, ...string[]];

const settingsPatch = z
  .object({
    enabled: z.boolean(),
    streams: z.array(z.enum(STREAMS)),
    masterclassesEnabled: z.boolean(),
    paidCoursesEnabled: z.boolean(),
    maxCoursePriceUgx: z.number().int().min(0).max(1_000_000_000),
    maxSchoolsPerUser: z.number().int().min(1).max(100),
    maxClassesPerSchool: z.number().int().min(1).max(500),
    maxCoursesPerClass: z.number().int().min(1).max(200),
    maxModulesPerCourse: z.number().int().min(1).max(200),
    maxLessonsPerModule: z.number().int().min(1).max(200),
    maxQuizQuestionsPerLesson: z.number().int().min(0).max(100),
    maxLessonMinutes: z.number().int().min(1).max(1440),
    createsPerHour: z.number().int().min(1).max(1000),
    publishByDefault: z.boolean(),
    enrolmentsEnabled: z.boolean(),
    commissionPercent: z.number().int().min(0).max(60),
    videoUploadsEnabled: z.boolean(),
    maxVideoMb: z.number().int().min(1).max(100),
    quizAttemptsPerHour: z.number().int().min(1).max(200),
    feesEnabled: z.boolean(),
    examPassPercent: z.number().int().min(0).max(100),
  })
  .partial();

educationAdminRoutes.get("/admin/learn-settings", requirePermission("settings.view"), async (c) => {
  return c.json({ learn: await getLearnSettings() });
});

educationAdminRoutes.patch("/admin/learn-settings", requirePermission("settings.manage"), async (c) => {
  const parsed = settingsPatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const before = await getLearnSettings();
  await setLearnSettings(parsed.data as never);
  const after = await getLearnSettings();
  await logActivity({
    actor: c.get("user"),
    action: "settings.update",
    entityType: "settings",
    summary: "Updated Peebee Learn settings",
    before: { learn: before },
    after: { learn: after },
    ip: clientIp(c),
  });
  return c.json({ learn: after });
});

educationAdminRoutes.get("/admin/learn-schools", requirePermission("settings.view"), async (c) => {
  if (!(await studioReady())) return c.json({ ok: true, schools: [] });
  const res = await db.execute({
    sql: `SELECT s.*, u.name AS owner_name,
                 (SELECT COUNT(*) FROM edu_classes c WHERE c.school_id = s.id) AS class_count,
                 (SELECT COUNT(*) FROM edu_courses c WHERE c.school_id = s.id) AS course_count
          FROM edu_schools s JOIN users u ON u.id = s.owner_id
          ORDER BY s.created_at DESC LIMIT 200`,
    args: [],
  });
  return c.json({
    ok: true,
    schools: (res.rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      ownerId: String(r.owner_id),
      ownerName: String(r.owner_name),
      name: String(r.name),
      slug: String(r.slug),
      kind: String(r.kind),
      streams: String(r.streams).split(",").filter(Boolean),
      tagline: String(r.tagline ?? ""),
      bio: String(r.bio ?? ""),
      location: String(r.location ?? ""),
      motto: String(r.motto ?? ""),
      badge: String(r.badge ?? ""),
      contactEmail: String(r.contact_email ?? ""),
      contactPhone: String(r.contact_phone ?? ""),
      status: r.status === "suspended" ? "suspended" : "active",
      createdAt: String(r.created_at),
      classCount: Number(r.class_count ?? 0),
      courseCount: Number(r.course_count ?? 0),
      publishedCourseCount: 0,
      lessonCount: 0,
    })),
  });
});

educationAdminRoutes.post("/admin/learn-schools/:id/status", requirePermission("settings.manage"), async (c) => {
  const parsed = z.object({ status: z.enum(["active", "suspended"]) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  if (!(await studioReady())) return c.json({ error: "learn_upgrade_pending", message: "Peebee Learn Studio is being set up." }, 503);

  const id = c.req.param("id") ?? "";
  const school = (await db.execute({ sql: "SELECT id, name, status FROM edu_schools WHERE id = ?", args: [id] })).rows[0] as Record<string, unknown> | undefined;
  if (!school) return c.json({ error: "not_found", message: "That school wasn't found." }, 404);

  await db.execute({ sql: "UPDATE edu_schools SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [parsed.data.status, id] });
  await logActivity({
    actor: c.get("user"),
    action: parsed.data.status === "suspended" ? "learn.school_suspend" : "learn.school_restore",
    entityType: "learn_school",
    entityId: id,
    summary: `${parsed.data.status === "suspended" ? "Suspended" : "Restored"} school “${String(school.name)}”`,
    before: { status: school.status },
    after: { status: parsed.data.status },
    ip: clientIp(c),
  });
  return c.json({ ok: true, status: parsed.data.status });
});
