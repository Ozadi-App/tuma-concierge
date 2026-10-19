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

/** The two trial codes: six digits each and never the same. Anything else falls back to the defaults. */
function trialCodes(a: string | undefined, b: string | undefined): { trialCodeA: string; trialCodeB: string } {
  const ok = (v: string | undefined): v is string => typeof v === "string" && /^\d{6}$/.test(v);
  if (ok(a) && ok(b) && a !== b) return { trialCodeA: a, trialCodeB: b };
  return { trialCodeA: "111222", trialCodeB: "222111" };
}

export async function getLearnSettings(): Promise<LearnSettings> {
  const keys = [
    "learn_enabled", "learn_streams", "learn_masterclasses_enabled", "learn_paid_courses_enabled", "learn_max_course_price_ugx",
    "learn_max_schools_per_user", "learn_max_classes_per_school", "learn_max_courses_per_class", "learn_max_modules_per_course",
    "learn_max_lessons_per_module", "learn_max_quiz_questions", "learn_max_lesson_minutes", "learn_creates_per_hour", "learn_publish_by_default",
    "learn_enrolments_enabled", "learn_commission_percent", "learn_video_uploads_enabled", "learn_max_video_mb", "learn_max_cover_mb", "learn_quiz_attempts_per_hour", "learn_fees_enabled", "learn_exam_pass_percent",
    "learn_live_enabled", "learn_live_max_participants", "learn_live_poll_seconds", "learn_live_max_cues", "learn_live_question_seconds", "learn_live_max_exam_minutes", "learn_max_screens_per_user", "learn_screen_pair_minutes",
    "learn_trial_classes_enabled", "learn_trial_code_a", "learn_trial_code_b", "learn_demo_visible",
    "learn_tv_pro_required", "learn_tv_learn_enabled", "learn_pro_price_ugx", "learn_pro_days",
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
    // 0 switches cover uploads off; generated art is always available.
    maxCoverMb: int(v.learn_max_cover_mb, 2, 0, 10),
    quizAttemptsPerHour: int(v.learn_quiz_attempts_per_hour, 30, 1, 200),
    feesEnabled: v.learn_fees_enabled !== "0",
    examPassPercent: int(v.learn_exam_pass_percent, 50, 0, 100),
    liveEnabled: v.learn_live_enabled !== "0",
    liveMaxParticipants: int(v.learn_live_max_participants, 60, 1, 500),
    livePollSeconds: int(v.learn_live_poll_seconds, 3, 1, 30),
    liveMaxCuesPerSession: int(v.learn_live_max_cues, 100, 5, 500),
    liveQuestionSeconds: int(v.learn_live_question_seconds, 30, 5, 600),
    liveMaxExamMinutes: int(v.learn_live_max_exam_minutes, 120, 1, 600),
    maxScreensPerUser: int(v.learn_max_screens_per_user, 5, 1, 50),
    screenPairMinutes: int(v.learn_screen_pair_minutes, 10, 1, 60),
    trialClassesEnabled: v.learn_trial_classes_enabled !== "0",
    ...trialCodes(v.learn_trial_code_a, v.learn_trial_code_b),
    demoContentVisible: v.learn_demo_visible !== "0",
    // Free for everyone unless staff turn it on.
    tvProRequired: v.learn_tv_pro_required === "1",
    tvLearnEnabled: v.learn_tv_learn_enabled !== "0",
    proPriceUgx: int(v.learn_pro_price_ugx, 50000, 0, 100_000_000),
    proDays: int(v.learn_pro_days, 30, 1, 3650),
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
  if (next.maxCoverMb != null) put("learn_max_cover_mb", String(next.maxCoverMb));
  if (next.quizAttemptsPerHour != null) put("learn_quiz_attempts_per_hour", String(next.quizAttemptsPerHour));
  if (next.feesEnabled != null) put("learn_fees_enabled", next.feesEnabled ? "1" : "0");
  if (next.examPassPercent != null) put("learn_exam_pass_percent", String(next.examPassPercent));
  if (next.liveEnabled != null) put("learn_live_enabled", next.liveEnabled ? "1" : "0");
  if (next.liveMaxParticipants != null) put("learn_live_max_participants", String(next.liveMaxParticipants));
  if (next.livePollSeconds != null) put("learn_live_poll_seconds", String(next.livePollSeconds));
  if (next.liveMaxCuesPerSession != null) put("learn_live_max_cues", String(next.liveMaxCuesPerSession));
  if (next.liveQuestionSeconds != null) put("learn_live_question_seconds", String(next.liveQuestionSeconds));
  if (next.liveMaxExamMinutes != null) put("learn_live_max_exam_minutes", String(next.liveMaxExamMinutes));
  if (next.maxScreensPerUser != null) put("learn_max_screens_per_user", String(next.maxScreensPerUser));
  if (next.screenPairMinutes != null) put("learn_screen_pair_minutes", String(next.screenPairMinutes));
  if (next.trialClassesEnabled != null) put("learn_trial_classes_enabled", next.trialClassesEnabled ? "1" : "0");
  if (next.trialCodeA != null) put("learn_trial_code_a", next.trialCodeA);
  if (next.trialCodeB != null) put("learn_trial_code_b", next.trialCodeB);
  if (next.demoContentVisible != null) put("learn_demo_visible", next.demoContentVisible ? "1" : "0");
  if (next.tvLearnEnabled != null) put("learn_tv_learn_enabled", next.tvLearnEnabled ? "1" : "0");
  if (next.tvProRequired != null) put("learn_tv_pro_required", next.tvProRequired ? "1" : "0");
  if (next.proPriceUgx != null) put("learn_pro_price_ugx", String(next.proPriceUgx));
  if (next.proDays != null) put("learn_pro_days", String(next.proDays));
  await Promise.all(writes);
}
