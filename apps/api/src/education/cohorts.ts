import type { LearnSettings } from "@peebee/shared";
import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";

type Row = Record<string, unknown>;

export interface Cohort {
  id: string;
  courseId: string;
  name: string;
  startsAt: string;
  enrolUntil: string | null;
  capacity: number | null;
  members: number;
}

export const cohortsReady = () => hasTable("edu_cohorts");

const shape = (r: Row): Cohort => ({
  id: String(r.id),
  courseId: String(r.course_id),
  name: String(r.name),
  startsAt: String(r.starts_at),
  enrolUntil: r.enrol_until ? String(r.enrol_until) : null,
  capacity: r.capacity === null || r.capacity === undefined ? null : Number(r.capacity),
  members: Number(r.members ?? 0),
});

export async function cohortsOfCourse(courseId: string): Promise<Cohort[]> {
  if (!(await cohortsReady())) return [];
  const rows = (
    await db.execute({
      sql: "SELECT h.*, (SELECT COUNT(*) FROM edu_cohort_members m WHERE m.cohort_id = h.id) AS members FROM edu_cohorts h WHERE h.course_id = ? ORDER BY h.starts_at ASC LIMIT 100",
      args: [courseId],
    })
  ).rows as Row[];
  return rows.map(shape);
}

/** Whether new learners can still join: the window hasn't closed (it defaults to the start date) and a seat is free. */
export function isOpen(h: Cohort, now = Date.now()): boolean {
  const closes = Date.parse(h.enrolUntil ?? h.startsAt);
  return (!Number.isFinite(closes) || closes >= now) && (h.capacity === null || h.members < h.capacity);
}

/** Checks the cohort a learner picked. Courses without cohorts need none. */
export async function chooseCohort(courseId: string, cohortId: unknown, settings: LearnSettings): Promise<{ ok: true; cohort: Cohort | null } | { ok: false; message: string }> {
  if (!settings.cohortsEnabled) return { ok: true, cohort: null };
  const all = await cohortsOfCourse(courseId);
  if (all.length === 0) return { ok: true, cohort: null };
  if (typeof cohortId !== "string" || !cohortId) {
    return { ok: false, message: all.some((h) => isOpen(h)) ? "Choose a start date to join this course." : "Enrolment isn't open for this course right now." };
  }
  const picked = all.find((h) => h.id === cohortId);
  if (!picked) return { ok: false, message: "That start date isn't available." };
  if (!isOpen(picked)) return { ok: false, message: "That intake is closed or full. Choose another." };
  return { ok: true, cohort: picked };
}

/** Takes a seat for a learner. False means the last seat just went. */
export async function reserveSeat(cohort: Cohort, userId: string): Promise<boolean> {
  const res = await db.execute({
    sql: `INSERT INTO edu_cohort_members (cohort_id, user_id, course_id)
          SELECT ?, ?, ? WHERE (SELECT capacity FROM edu_cohorts WHERE id = ?) IS NULL
            OR (SELECT COUNT(*) FROM edu_cohort_members WHERE cohort_id = ?) < (SELECT capacity FROM edu_cohorts WHERE id = ?)`,
    args: [cohort.id, userId, cohort.courseId, cohort.id, cohort.id, cohort.id],
  });
  return (res.rowsAffected ?? 0) > 0;
}

export async function releaseSeat(cohort: Cohort, userId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM edu_cohort_members WHERE cohort_id = ? AND user_id = ?", args: [cohort.id, userId] });
}
