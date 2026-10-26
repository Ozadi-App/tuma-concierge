import { db } from "../db/client.js";
import { getOptions } from "../lib/option-settings.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { isHttpsUrl } from "../lib/validation.js";
import type { CourseInput } from "./digital-input.js";

/** Whether `url` is https and on (or under) one of the approved hosts. */
export function hostAllowed(url: string, hosts: string[]): boolean {
  if (!isHttpsUrl(url)) return false;
  const host = new URL(url).hostname.toLowerCase();
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Lesson media must come from approved places when content protection is on, so a course can't point students at an
 * arbitrary site. Returns the first problem, or null.
 */
export async function lessonHostProblem(modules: CourseInput["modules"]): Promise<string | null> {
  const o = await getOptions(["lms_content_protection", "lms_allowed_video_hosts"]);
  if (o.lms_content_protection === "none") return null;
  const hosts = o.lms_allowed_video_hosts as string[];
  for (const mod of modules ?? []) {
    for (const les of mod.lessons) {
      if (les.content_url && !hostAllowed(les.content_url, hosts)) {
        const host = (() => { try { return new URL(les.content_url).hostname; } catch { return les.content_url; } })();
        return `"${les.title}": videos and files can only come from ${hosts.slice(0, 5).join(", ")}${hosts.length > 5 ? " …" : ""} (not ${host}). Upload it to Peebee Learn instead.`;
      }
    }
  }
  return null;
}

/** 1 when a course should show in the Peebee Learn catalogue, 0 when the store sells it on its own. */
export async function catalogListingFor(status: string): Promise<number> {
  if (status !== "published") return 0;
  const { lms_learn_sync_mode: mode } = await getOptions(["lms_learn_sync_mode"]);
  return mode === "two_way_auto" ? 1 : 0;
}

/**
 * What a brand-new course starts with, from the admin options: whether it issues certificates by itself, and how its
 * lessons are released. Courses that already exist are never reset by a later edit.
 */
export async function applyNewCourseDefaults(courseId: string, moduleIds: string[]): Promise<void> {
  const o = await getOptions(["lms_certificates", "lms_drip_default"]);
  if (await hasTable("edu_course_rules")) {
    await db.execute({
      sql: `INSERT INTO edu_course_rules (course_id, certificate_enabled) VALUES (?, ?)
            ON CONFLICT(course_id) DO UPDATE SET certificate_enabled = excluded.certificate_enabled, updated_at = datetime('now')`,
      args: [courseId, o.lms_certificates === "auto_on_completion" ? 1 : 0],
    });
  }
  if (o.lms_drip_default === "weekly" && (await hasTable("edu_module_drip"))) {
    for (const [i, moduleId] of moduleIds.entries()) {
      if (i === 0) continue;
      await db.execute({
        sql: "INSERT INTO edu_module_drip (module_id, drip_days) VALUES (?, ?) ON CONFLICT(module_id) DO UPDATE SET drip_days = excluded.drip_days",
        args: [moduleId, i * 7],
      });
    }
  }
}

/** A merchant-chosen release day for a module, honoured when admin lets merchants set a schedule. */
export async function applyModuleDrip(moduleId: string, days: number | undefined): Promise<void> {
  if (days === undefined || !(await hasTable("edu_module_drip"))) return;
  const { lms_drip_default: mode } = await getOptions(["lms_drip_default"]);
  if (mode !== "custom") return;
  await db.execute({
    sql: "INSERT INTO edu_module_drip (module_id, drip_days) VALUES (?, ?) ON CONFLICT(module_id) DO UPDATE SET drip_days = excluded.drip_days",
    args: [moduleId, days],
  });
}

export async function catalogListedColumn(): Promise<boolean> {
  return hasColumn("edu_courses", "catalog_listed");
}
