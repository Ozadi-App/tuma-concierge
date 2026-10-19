import { EDUCATION_STREAM_IDS, type EducationStream, type LearnSettings } from "@peebee/shared";
import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Peebee Learn is controlled from Admin: whether educators can build at all,
 * which streams are open, whether courses may be paid for, and every limit on
 * how much one educator can create. Nothing here is a constant in the code
 * beyond structural safety rails.
 */

const int = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== "" ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

function streams(raw: string | undefined): EducationStream[] {
  const wanted = new Set((raw ?? "").split(",").map((v) => v.trim()));
  return EDUCATION_STREAM_IDS.filter((s) => wanted.has(s));
}

export async function getLearnSettings(): Promise<LearnSettings> {
  const keys = [
    "learn_enabled", "learn_streams", "learn_masterclasses_enabled", "learn_paid_courses_enabled", "learn_max_course_price_ugx",
    "learn_max_schools_per_user", "learn_max_classes_per_school", "learn_max_courses_per_class", "learn_max_modules_per_course",
    "learn_max_lessons_per_module", "learn_max_quiz_questions", "learn_max_lesson_minutes", "learn_creates_per_hour", "learn_publish_by_default",
    "learn_enrolments_enabled", "learn_commission_percent", "learn_video_uploads_enabled", "learn_max_video_mb", "learn_quiz_attempts_per_hour", "learn_fees_enabled", "learn_exam_pass_percent",
  ] as const;
  const v = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)]))) as Record<(typeof keys)[number], string>;
  return {
    enabled: v.learn_enabled !== "0",
    streams: streams(v.learn_streams),
    masterclassesEnabled: v.learn_masterclasses_enabled !== "0",
    paidCoursesEnabled: v.learn_paid_courses_enabled !== "0",
    maxCoursePriceUgx: int(v.learn_max_course_price_ugx, 5_000_000, 0, 1_000_000_000),
    maxSchoolsPerUser: int(v.learn_max_schools_per_user, 3, 1, 100),
    maxClassesPerSchool: int(v.learn_max_classes_per_school, 30, 1, 500),
    maxCoursesPerClass: int(v.learn_max_courses_per_class, 12, 1, 200),
    maxModulesPerCourse: int(v.learn_max_modules_per_course, 30, 1, 200),
    maxLessonsPerModule: int(v.learn_max_lessons_per_module, 40, 1, 200),
    maxQuizQuestionsPerLesson: int(v.learn_max_quiz_questions, 20, 0, 100),
    maxLessonMinutes: int(v.learn_max_lesson_minutes, 240, 1, 1440),
    createsPerHour: int(v.learn_creates_per_hour, 60, 1, 1000),
    publishByDefault: v.learn_publish_by_default === "1",
    enrolmentsEnabled: v.learn_enrolments_enabled !== "0",
    commissionPercent: int(v.learn_commission_percent, 10, 0, 60),
    videoUploadsEnabled: v.learn_video_uploads_enabled !== "0",
    // 100 MB is the largest request body a Worker accepts, so it is the structural ceiling.
    maxVideoMb: int(v.learn_max_video_mb, 50, 1, 100),
    quizAttemptsPerHour: int(v.learn_quiz_attempts_per_hour, 30, 1, 200),
    feesEnabled: v.learn_fees_enabled !== "0",
    examPassPercent: int(v.learn_exam_pass_percent, 50, 0, 100),
  };
}

export async function setLearnSettings(next: Partial<LearnSettings>): Promise<void> {
  const writes: Promise<void>[] = [];
  const put = (key: Parameters<typeof setSetting>[0], value: string) => writes.push(setSetting(key, value));
  if (next.enabled != null) put("learn_enabled", next.enabled ? "1" : "0");
  if (next.streams) put("learn_streams", next.streams.join(","));
  if (next.masterclassesEnabled != null) put("learn_masterclasses_enabled", next.masterclassesEnabled ? "1" : "0");
  if (next.paidCoursesEnabled != null) put("learn_paid_courses_enabled", next.paidCoursesEnabled ? "1" : "0");
  if (next.maxCoursePriceUgx != null) put("learn_max_course_price_ugx", String(next.maxCoursePriceUgx));
  if (next.maxSchoolsPerUser != null) put("learn_max_schools_per_user", String(next.maxSchoolsPerUser));
  if (next.maxClassesPerSchool != null) put("learn_max_classes_per_school", String(next.maxClassesPerSchool));
  if (next.maxCoursesPerClass != null) put("learn_max_courses_per_class", String(next.maxCoursesPerClass));
  if (next.maxModulesPerCourse != null) put("learn_max_modules_per_course", String(next.maxModulesPerCourse));
  if (next.maxLessonsPerModule != null) put("learn_max_lessons_per_module", String(next.maxLessonsPerModule));
  if (next.maxQuizQuestionsPerLesson != null) put("learn_max_quiz_questions", String(next.maxQuizQuestionsPerLesson));
  if (next.maxLessonMinutes != null) put("learn_max_lesson_minutes", String(next.maxLessonMinutes));
  if (next.createsPerHour != null) put("learn_creates_per_hour", String(next.createsPerHour));
  if (next.publishByDefault != null) put("learn_publish_by_default", next.publishByDefault ? "1" : "0");
  if (next.enrolmentsEnabled != null) put("learn_enrolments_enabled", next.enrolmentsEnabled ? "1" : "0");
  if (next.commissionPercent != null) put("learn_commission_percent", String(next.commissionPercent));
  if (next.videoUploadsEnabled != null) put("learn_video_uploads_enabled", next.videoUploadsEnabled ? "1" : "0");
  if (next.maxVideoMb != null) put("learn_max_video_mb", String(next.maxVideoMb));
  if (next.quizAttemptsPerHour != null) put("learn_quiz_attempts_per_hour", String(next.quizAttemptsPerHour));
  if (next.feesEnabled != null) put("learn_fees_enabled", next.feesEnabled ? "1" : "0");
  if (next.examPassPercent != null) put("learn_exam_pass_percent", String(next.examPassPercent));
  await Promise.all(writes);
}
