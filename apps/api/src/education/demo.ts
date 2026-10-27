import bcrypt from "bcryptjs";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getR2Bucket } from "../storage/r2.js";
import { liveReady } from "./classroom.js";
import { demoVideoBytes } from "./demo-media.js";
import { DEMO_EDUCATORS, DEMO_TRIALS, VIDEO_BY_STREAM, demoIds, findCourse, type DemoEducator, type DemoLesson, type DemoTrial } from "./demo/index.js";
import { getLearnSettings } from "./settings.js";
import { learningReady, studioReady } from "./studio.js";

/**
 * Installing and removing the demo content: eight educator accounts (four institutions with several classes and
 * tutors, four individual tutors), their classes, free courses with lessons, quizzes and placeholder videos, and
 * two trial live classes that run themselves.
 *
 * Everything has a fixed id, so installing again updates the content in place and never duplicates it. Demo
 * courses are always free and the demo accounts have no usable password unless the admin sets one, so nobody can
 * be charged, and nobody can sign in as a demo educator by accident.
 */

type Row = Record<string, unknown>;

const DEMO_EMAIL_SUFFIX = "@demo.peebee.invalid";
/** Not a bcrypt hash, so no password can ever match it. */
const LOCKED_HASH = "!locked-demo-account";

export const DEMO_STEPS = DEMO_EDUCATORS.length + 1;

async function one(sql: string, args: unknown[] = []): Promise<Row | null> {
  return ((await db.execute({ sql, args: args as never })).rows[0] as Row | undefined) ?? null;
}

async function count(sql: string, args: unknown[] = []): Promise<number> {
  return Number((await one(sql, args))?.n ?? 0);
}

/** Which hand-applied migrations the demo content still needs. */
export async function demoMissing(): Promise<string[]> {
  const missing: string[] = [];
  if (!(await studioReady())) missing.push("0109_education_studio.sql");
  if (!(await learningReady())) missing.push("0111_education_learning.sql");
  if (!(await liveReady())) missing.push("0112_live_classroom.sql");
  if (!(await hasColumn("edu_schools", "is_demo")) || !(await hasColumn("edu_live_sessions", "autopilot"))) missing.push("0113_learn_demo_content.sql");
  return missing;
}

export interface DemoStatus {
  ready: boolean;
  missing: string[];
  installed: boolean;
  counts: { educators: number; schools: number; classes: number; courses: number; lessons: number; videos: number; trials: number };
  expected: { educators: number; schools: number; classes: number; courses: number; lessons: number; videos: number; trials: number };
}

function expectedCounts(wide: boolean) {
  let classes = 0;
  let courses = 0;
  let lessons = 0;
  let videos = 0;
  for (const e of DEMO_EDUCATORS) {
    classes += e.classes.length;
    for (const cls of e.classes) {
      courses += cls.courses.length;
      for (const c of cls.courses) for (const m of c.modules) for (const l of m.lessons) {
        lessons += wide && l.quiz ? 2 : 1;
        if (l.video) videos += 1;
      }
    }
  }
  return { educators: DEMO_EDUCATORS.length, schools: DEMO_EDUCATORS.length, classes, courses, lessons, videos, trials: DEMO_TRIALS.length };
}

export async function demoStatus(): Promise<DemoStatus> {
  const missing = await demoMissing();
  const expected = expectedCounts(await hasColumn("edu_lessons", "body"));
  const empty = { educators: 0, schools: 0, classes: 0, courses: 0, lessons: 0, videos: 0, trials: 0 };
  if (missing.length > 0) return { ready: false, missing, installed: false, counts: empty, expected };
  const schools = "SELECT id FROM edu_schools WHERE is_demo = 1";
  const counts = {
    educators: await count("SELECT COUNT(DISTINCT owner_id) AS n FROM edu_schools WHERE is_demo = 1"),
    schools: await count("SELECT COUNT(*) AS n FROM edu_schools WHERE is_demo = 1"),
    classes: await count(`SELECT COUNT(*) AS n FROM edu_classes WHERE school_id IN (${schools})`),
    courses: await count(`SELECT COUNT(*) AS n FROM edu_courses WHERE school_id IN (${schools})`),
    lessons: await count(`SELECT COUNT(*) AS n FROM edu_lessons WHERE course_id IN (SELECT id FROM edu_courses WHERE school_id IN (${schools}))`),
    videos: await count(`SELECT COUNT(*) AS n FROM edu_lesson_media WHERE lesson_id IN (SELECT id FROM edu_lessons WHERE course_id IN (SELECT id FROM edu_courses WHERE school_id IN (${schools})))`),
    trials: await count("SELECT COUNT(*) AS n FROM edu_live_sessions WHERE autopilot = 1"),
  };
  return { ready: true, missing: [], installed: counts.schools >= expected.schools && counts.trials >= expected.trials, counts, expected };
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

function educatorStatements(e: DemoEducator, passwordHash: string | null, wide: boolean): { statements: DbStatement[]; videos: { lessonId: string; stream: keyof typeof VIDEO_BY_STREAM }[] } {
  const statements: DbStatement[] = [];
  const videos: { lessonId: string; stream: keyof typeof VIDEO_BY_STREAM }[] = [];
  const userId = demoIds.user(e.key);
  const schoolId = demoIds.school(e.key);

  statements.push({
    sql: `INSERT OR IGNORE INTO users (id, phone, email, name, password_hash, role, phone_verified_at, email_verified_at)
          VALUES (?, ?, ?, ?, ?, 'customer', datetime('now'), datetime('now'))`,
    args: [userId, e.phone, e.email, e.name, passwordHash ?? LOCKED_HASH],
  });
  // Setting a demo password is a deliberate admin choice; installing without one leaves existing accounts as they are.
  if (passwordHash) statements.push({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [passwordHash, userId] });

  statements.push({
    sql: `INSERT INTO edu_schools (id, owner_id, name, slug, kind, streams, tagline, bio, location, motto, badge, status, is_demo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, streams = excluded.streams, tagline = excluded.tagline,
            bio = excluded.bio, location = excluded.location, motto = excluded.motto, badge = excluded.badge, is_demo = 1, updated_at = datetime('now')`,
    args: [schoolId, userId, e.school.name, e.school.slug, e.school.kind, e.school.streams.join(","), e.school.tagline, e.school.bio, e.school.location, e.school.motto, e.school.badge],
  });

  for (const cls of e.classes) {
    const classId = demoIds.class(e.key, cls.key);
    statements.push({
      sql: `INSERT INTO edu_classes (id, school_id, stream, kind, name, level, framework, academic_year, term, teacher_name, capacity, summary, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, '2026', ?, ?, ?, ?, 'published')
            ON CONFLICT(id) DO UPDATE SET stream = excluded.stream, kind = excluded.kind, name = excluded.name, level = excluded.level, framework = excluded.framework,
              term = excluded.term, teacher_name = excluded.teacher_name, capacity = excluded.capacity, summary = excluded.summary, status = 'published', updated_at = datetime('now')`,
      args: [classId, schoolId, cls.stream, cls.kind, cls.name, cls.level, cls.framework, cls.term, cls.tutor, cls.capacity, cls.summary],
    });
    for (const course of cls.courses) {
      const courseId = demoIds.course(course.key);
      statements.push({
        sql: `INSERT INTO edu_courses (id, school_id, class_id, stream, title, summary, price_ugx, framework, outcomes_json, status)
              VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'published')
              ON CONFLICT(id) DO UPDATE SET stream = excluded.stream, title = excluded.title, summary = excluded.summary, price_ugx = 0,
                framework = excluded.framework, outcomes_json = excluded.outcomes_json, status = 'published', updated_at = datetime('now')`,
        args: [courseId, schoolId, classId, cls.stream, course.title, course.summary, cls.framework, JSON.stringify(course.outcomes)],
      });
      course.modules.forEach((module, mi) => {
        const moduleId = demoIds.module(course.key, mi);
        statements.push({
          sql: `INSERT INTO edu_modules (id, course_id, title, description, position) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, position = excluded.position`,
          args: [moduleId, courseId, module.title, module.description, mi],
        });
        // Lessons first, then each lesson's quiz as an item of its own at the end of the section.
        const quizzes: { id: string; title: string; quiz: NonNullable<DemoLesson["quiz"]> }[] = [];
        module.lessons.forEach((lesson, li) => {
          const lessonId = demoIds.lesson(course.key, mi, li);
          const isText = lesson.type === "text";
          statements.push({
            sql: wide
              ? `INSERT INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, content_url, position, quiz_json, body, slides_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, NULL, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_type = excluded.content_type, duration_minutes = excluded.duration_minutes,
                   summary = excluded.summary, position = excluded.position, quiz_json = NULL, body = excluded.body, slides_json = excluded.slides_json`
              : `INSERT INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, content_url, position, quiz_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)
                 ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_type = excluded.content_type, duration_minutes = excluded.duration_minutes,
                   summary = excluded.summary, position = excluded.position, quiz_json = excluded.quiz_json`,
            args: wide
              ? [lessonId, moduleId, courseId, lesson.title, lesson.type, lesson.minutes, lesson.summary, li, isText ? lesson.summary : "", lesson.slides ? JSON.stringify(lesson.slides.map((s) => ({ ...s, imageUrl: "" }))) : null]
              : [lessonId, moduleId, courseId, lesson.title, lesson.type === "text" || lesson.type === "slides" ? "reading" : lesson.type, lesson.minutes, lesson.summary, li, lesson.quiz ? JSON.stringify(quizJson(lesson.quiz)) : null],
          });
          if (wide && lesson.quiz) quizzes.push({ id: `${lessonId}_q`, title: lesson.title, quiz: lesson.quiz });
          if (lesson.video) videos.push({ lessonId, stream: cls.stream });
        });
        quizzes.forEach((item, qi) => {
          statements.push({
            sql: `INSERT INTO edu_lessons (id, module_id, course_id, title, content_type, duration_minutes, summary, content_url, position, quiz_json, body)
                  VALUES (?, ?, ?, ?, 'quiz', 5, '', '', ?, ?, '')
                  ON CONFLICT(id) DO UPDATE SET title = excluded.title, content_type = 'quiz', duration_minutes = 5,
                    position = excluded.position, quiz_json = excluded.quiz_json`,
            args: [item.id, moduleId, courseId, `Quiz: ${item.title}`, module.lessons.length + qi, JSON.stringify(quizJson(item.quiz))],
          });
        });
      });
    }
  }
  return { statements, videos };
}

function quizJson(quiz: NonNullable<DemoLesson["quiz"]>) {
  return {
    title: quiz.title,
    passingScorePercent: quiz.passingScorePercent,
    questions: quiz.questions.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex, ...(q.explanation ? { explanation: q.explanation } : {}) })),
  };
}

async function installEducator(e: DemoEducator, password: string | undefined): Promise<void> {
  const hash = password ? await bcrypt.hash(password, 10) : null;
  const { statements, videos } = educatorStatements(e, hash, await hasColumn("edu_lessons", "body"));
  await executeBatch(statements);

  // Videos: one tiny placeholder per lesson that has one. Skip those already stored so a second install is quick.
  if (videos.length === 0) return;
  // Without a file store (local development, tests) the lessons simply have no video.
  try { getR2Bucket(); } catch { return; }
  const placeholders = videos.map(() => "?").join(",");
  const have = new Set(((await db.execute({ sql: `SELECT lesson_id FROM edu_lesson_media WHERE lesson_id IN (${placeholders})`, args: videos.map((v) => v.lessonId) as never })).rows as Row[]).map((r) => String(r.lesson_id)));
  const rows: DbStatement[] = [];
  for (const v of videos) {
    if (have.has(v.lessonId)) continue;
    const bytes = demoVideoBytes(VIDEO_BY_STREAM[v.stream]);
    const key = demoIds.mediaKey(v.lessonId);
    await getR2Bucket().put(key, bytes, { httpMetadata: { contentType: "video/mp4" } });
    rows.push({
      sql: "INSERT OR IGNORE INTO edu_lesson_media (lesson_id, r2_key, content_type, size_bytes, uploaded_by) VALUES (?, ?, 'video/mp4', ?, ?)",
      args: [v.lessonId, key, bytes.length, demoIds.user(e.key)],
    });
  }
  await executeBatch(rows);
}

function trialStatements(trial: DemoTrial, code: string): DbStatement[] {
  const { educator, course } = findCourse(trial.course);
  const sessionId = demoIds.session(trial.slot);
  const owner = DEMO_EDUCATORS.find((e) => e.key === trial.educator)!;
  const classKey = findCourse(trial.course).classKey;
  const statements: DbStatement[] = [
    // Start the session's run sheet from scratch: answers, then cues, then the session's pointers to them.
    { sql: "DELETE FROM edu_live_responses WHERE session_id = ?", args: [sessionId] },
    { sql: "UPDATE edu_live_sessions SET screen_cue_id = NULL, phones_cue_id = NULL WHERE id = ?", args: [sessionId] },
    { sql: "DELETE FROM edu_live_cues WHERE session_id = ?", args: [sessionId] },
    {
      sql: `INSERT INTO edu_live_sessions (id, school_id, class_id, course_id, host_id, title, code, status, autopilot, autopilot_step)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'live', 1, NULL)
            ON CONFLICT(id) DO UPDATE SET school_id = excluded.school_id, class_id = excluded.class_id, course_id = excluded.course_id, host_id = excluded.host_id,
              title = excluded.title, code = excluded.code, status = 'live', ended_at = NULL, autopilot = 1, autopilot_step = NULL, version = version + 1`,
      args: [sessionId, demoIds.school(owner.key), demoIds.class(educator.key, classKey), demoIds.course(course.key), demoIds.user(owner.key), trial.title, code],
    },
  ];
  trial.cues.forEach((cue, i) => {
    let kind: string = cue.kind;
    let target = "phones";
    let payload: Record<string, unknown>;
    switch (cue.kind) {
      case "announcement":
        payload = { text: cue.text, autopilot: { open: cue.open, reveal: 0 } };
        break;
      case "attendance":
        payload = { autopilot: { open: cue.open, reveal: 0 } };
        break;
      case "slide":
        target = "both"; // slides can't be phones-only in a real class; the trial has no TV, so they simply show on the phone
        payload = { title: cue.title, body: cue.body, autopilot: { open: cue.open, reveal: 0 } };
        break;
      case "lesson":
        payload = { lessonId: demoIds.lesson(cue.course, 0, cue.lessonIndex), autopilot: { open: cue.open, reveal: 0 } };
        break;
      case "question":
        kind = "question";
        payload = {
          question: cue.question,
          options: cue.options,
          correctIndex: cue.poll ? null : cue.correctIndex,
          explanation: cue.explanation ?? "",
          autopilot: { open: cue.open, reveal: cue.reveal },
        };
        break;
    }
    statements.push({
      sql: "INSERT INTO edu_live_cues (id, session_id, position, kind, target, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
      args: [demoIds.cue(trial.slot, i), sessionId, i, kind, target, JSON.stringify(payload)],
    });
  });
  return statements;
}

export interface InstallResult {
  step: number;
  total: number;
  label: string;
  done: boolean;
}

/** One step of the install: step 0 to N-1 are the educators, the last step sets up the two trial classes. */
export async function installDemoStep(step: number, password?: string): Promise<InstallResult> {
  const total = DEMO_STEPS;
  if (step < DEMO_EDUCATORS.length) {
    const educator = DEMO_EDUCATORS[step]!;
    await installEducator(educator, password);
    return { step, total, label: educator.school.name, done: false };
  }
  const settings = await getLearnSettings();
  const codes = { a: settings.trialCodeA, b: settings.trialCodeB };
  for (const trial of DEMO_TRIALS) {
    try {
      await executeBatch(trialStatements(trial, codes[trial.slot]));
    } catch (err) {
      if (/UNIQUE|constraint/i.test(String(err))) {
        throw new DemoError("code_in_use", `A live class is already using the code ${codes[trial.slot]}. End it, or choose a different trial code in the Learn settings, then install again.`);
      }
      throw err;
    }
  }
  return { step, total, label: "Trial live classes", done: true };
}

export class DemoError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

export interface RemoveResult {
  schools: number;
  accountsRemoved: number;
  accountsKept: number;
}

export async function removeDemo(): Promise<RemoveResult> {
  const schools = "SELECT id FROM edu_schools WHERE is_demo = 1";
  const courses = `SELECT id FROM edu_courses WHERE school_id IN (${schools})`;
  const lessons = `SELECT id FROM edu_lessons WHERE course_id IN (${courses})`;
  const sessions = `SELECT id FROM edu_live_sessions WHERE school_id IN (${schools})`;

  // Real money must never be deleted with the demo: stop if a demo school or course took a payment.
  const paidEnrolments = await count(`SELECT COUNT(*) AS n FROM edu_enrollments WHERE course_id IN (${courses}) AND price_paid_ugx > 0`);
  const feePayments = await count(`SELECT COUNT(*) AS n FROM edu_fee_payments WHERE invoice_id IN (SELECT id FROM edu_fee_invoices WHERE school_id IN (${schools}))`);
  if (paidEnrolments > 0 || feePayments > 0) {
    throw new DemoError("has_payments", "A demo school or course has taken a payment, so it can't be removed. Unpublish it from the Educator Studio instead.");
  }

  const keys = ((await db.execute({ sql: `SELECT r2_key FROM edu_lesson_media WHERE lesson_id IN (${lessons})`, args: [] })).rows as Row[]).map((r) => String(r.r2_key));
  const schoolCount = await count("SELECT COUNT(*) AS n FROM edu_schools WHERE is_demo = 1");

  if (await hasTable("edu_reviews")) {
    await db.execute({ sql: `DELETE FROM edu_answers WHERE question_id IN (SELECT id FROM edu_questions WHERE course_id IN (${courses}))`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_questions WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_reviews WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_announcements WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_cohort_members WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_cohorts WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_course_instructors WHERE course_id IN (${courses})`, args: [] });
  }
  if (await hasTable("edu_certificates")) {
    await db.execute({ sql: `DELETE FROM edu_certificates WHERE course_id IN (${courses})`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_module_drip WHERE module_id IN (SELECT id FROM edu_modules WHERE course_id IN (${courses}))`, args: [] });
    await db.execute({ sql: `DELETE FROM edu_course_rules WHERE course_id IN (${courses})`, args: [] });
  }
  if (await hasColumn("edu_lessons", "body")) await db.execute({ sql: `DELETE FROM edu_live_attendance WHERE course_id IN (${courses})`, args: [] });
  await executeBatch([
    { sql: `DELETE FROM edu_live_responses WHERE session_id IN (${sessions})` },
    { sql: `DELETE FROM edu_live_members WHERE session_id IN (${sessions})` },
    { sql: `DELETE FROM edu_live_cues WHERE session_id IN (${sessions})` },
    { sql: `DELETE FROM edu_live_sessions WHERE school_id IN (${schools})` },
    { sql: `DELETE FROM edu_lesson_progress WHERE course_id IN (${courses})` },
    { sql: `DELETE FROM edu_quiz_attempts WHERE course_id IN (${courses})` },
    { sql: `DELETE FROM edu_enrollments WHERE course_id IN (${courses})` },
    { sql: `DELETE FROM edu_fee_invoices WHERE school_id IN (${schools})` },
    { sql: `DELETE FROM edu_lesson_media WHERE lesson_id IN (${lessons})` },
    { sql: `DELETE FROM edu_lessons WHERE course_id IN (${courses})` },
    { sql: `DELETE FROM edu_modules WHERE course_id IN (${courses})` },
    { sql: `DELETE FROM edu_courses WHERE school_id IN (${schools})` },
    { sql: `DELETE FROM edu_classes WHERE school_id IN (${schools})` },
    { sql: `DELETE FROM edu_schools WHERE is_demo = 1` },
  ]);
  // The real R2 binding deletes many keys in one call; the local type only describes the single-key form.
  if (keys.length > 0) await (getR2Bucket() as unknown as { delete(keys: string[]): Promise<void> }).delete(keys).catch(() => undefined);

  // The accounts go too, unless an admin who signed in as one built something else under it.
  let removed = 0;
  let kept = 0;
  for (const e of DEMO_EDUCATORS) {
    try {
      const res = await db.execute({ sql: "DELETE FROM users WHERE id = ? AND email LIKE ?", args: [demoIds.user(e.key), `%${DEMO_EMAIL_SUFFIX}`] });
      removed += res.rowsAffected ?? 0;
    } catch {
      kept += 1;
    }
  }
  return { schools: schoolCount, accountsRemoved: removed, accountsKept: kept };
}
