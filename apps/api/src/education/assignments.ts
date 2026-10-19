import type { LearnerAssignment, StudioAssignment } from "@peebee/shared";
import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";

type Row = Record<string, unknown>;

export const assignmentsReady = () => hasTable("edu_assignments");

const shape = (r: Row): StudioAssignment => ({
  maxPoints: Number(r.max_points),
  passPercent: Number(r.pass_percent),
  dueAt: r.due_at ? String(r.due_at) : null,
  allowResubmit: Number(r.allow_resubmit) !== 0,
});

/** The assignment settings of every assignment item in a course, by lesson id. */
export async function assignmentsOfCourse(courseId: string): Promise<Map<string, StudioAssignment>> {
  if (!(await assignmentsReady())) return new Map();
  const rows = (await db.execute({ sql: "SELECT a.* FROM edu_assignments a JOIN edu_lessons l ON l.id = a.lesson_id WHERE l.course_id = ?", args: [courseId] })).rows as Row[];
  return new Map(rows.map((r) => [String(r.lesson_id), shape(r)]));
}

export async function assignmentOf(lessonId: string): Promise<StudioAssignment | null> {
  if (!(await assignmentsReady())) return null;
  const r = (await db.execute({ sql: "SELECT * FROM edu_assignments WHERE lesson_id = ?", args: [lessonId] })).rows[0] as Row | undefined;
  return r ? shape(r) : null;
}

export async function saveAssignment(lessonId: string, a: StudioAssignment): Promise<void> {
  await db.execute({
    sql: `INSERT INTO edu_assignments (lesson_id, max_points, pass_percent, due_at, allow_resubmit) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(lesson_id) DO UPDATE SET max_points = excluded.max_points, pass_percent = excluded.pass_percent, due_at = excluded.due_at, allow_resubmit = excluded.allow_resubmit`,
    args: [lessonId, a.maxPoints, a.passPercent, a.dueAt, a.allowResubmit ? 1 : 0],
  });
}

export const pastDue = (a: StudioAssignment, now = Date.now()) => !!a.dueAt && Date.parse(a.dueAt) < now;

export type SubmissionRow = { body: string; link: string; status: "submitted" | "graded"; score: number | null; feedback: string; submittedAt: string };

export const submissionShape = (r: Row): SubmissionRow => ({
  body: String(r.body ?? ""),
  link: String(r.link ?? ""),
  status: r.status === "graded" ? "graded" : "submitted",
  score: r.score === null || r.score === undefined ? null : Number(r.score),
  feedback: String(r.feedback ?? ""),
  submittedAt: String(r.submitted_at),
});

/** What a learner sees about an assignment: its rules and their own work. */
export function learnerAssignment(a: StudioAssignment, sub: SubmissionRow | null): LearnerAssignment {
  const graded = sub?.status === "graded";
  const canTryAgain = !sub || (a.allowResubmit && !(graded && sub.score !== null && Math.round((sub.score / a.maxPoints) * 100) >= a.passPercent));
  return { ...a, open: !pastDue(a) && canTryAgain, submission: sub };
}

export async function submissionsOfUser(userId: string, courseId: string): Promise<Map<string, SubmissionRow>> {
  if (!(await assignmentsReady())) return new Map();
  const rows = (await db.execute({ sql: "SELECT * FROM edu_submissions WHERE user_id = ? AND course_id = ?", args: [userId, courseId] })).rows as Row[];
  return new Map(rows.map((r) => [String(r.lesson_id), submissionShape(r)]));
}
