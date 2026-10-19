import type { ClassKind, CurriculumFramework, EducationStream } from "./types.js";

/**
 * Peebee Learn Studio — the persisted school → class → course → module → lesson
 * builder. Everything an educator creates lives in these shapes; the Admin app
 * controls the limits (see LearnSettings).
 */

export type SchoolKind = "school" | "academy" | "college" | "training_centre" | "independent_tutor";

export const SCHOOL_KINDS: { id: SchoolKind; label: string }[] = [
  { id: "school", label: "School" },
  { id: "academy", label: "Academy or institute" },
  { id: "college", label: "College or university" },
  { id: "training_centre", label: "Training centre" },
  { id: "independent_tutor", label: "Independent tutor" },
];

export type LessonContentType = "video" | "audio_story" | "reading" | "interactive_h5p" | "practical_demo";

export const LESSON_CONTENT_TYPES: { id: LessonContentType; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "reading", label: "Reading" },
  { id: "audio_story", label: "Audio story" },
  { id: "practical_demo", label: "Practical demo" },
  { id: "interactive_h5p", label: "Interactive activity" },
];

export type StudioStatus = "draft" | "published";
export type SchoolStatus = "active" | "suspended";

export interface StudioQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface StudioQuiz {
  title: string;
  passingScorePercent: number;
  questions: StudioQuizQuestion[];
}

export interface StudioSchool {
  id: string;
  name: string;
  slug: string;
  kind: SchoolKind;
  streams: EducationStream[];
  tagline: string;
  bio: string;
  location: string;
  motto: string;
  badge: string;
  contactEmail: string;
  contactPhone: string;
  status: SchoolStatus;
  createdAt: string;
  classCount: number;
  courseCount: number;
  publishedCourseCount: number;
  lessonCount: number;
}

export interface StudioClass {
  id: string;
  schoolId: string;
  stream: EducationStream;
  kind: ClassKind;
  name: string;
  level: string;
  framework: CurriculumFramework;
  academicYear: string;
  term: string;
  teacherName: string;
  capacity: number;
  summary: string;
  status: StudioStatus;
  courseCount: number;
}

export interface StudioCourse {
  id: string;
  schoolId: string;
  classId: string;
  stream: EducationStream;
  title: string;
  summary: string;
  priceUgx: number;
  framework: CurriculumFramework;
  outcomes: string[];
  status: StudioStatus;
  moduleCount: number;
  lessonCount: number;
  createdAt: string;
}

export interface StudioLesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  contentType: LessonContentType;
  durationMinutes: number;
  summary: string;
  contentUrl: string;
  position: number;
  quiz: StudioQuiz | null;
  /** The uploaded video or audio, if any. */
  media: LessonMedia | null;
}

export interface StudioModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  lessons: StudioLesson[];
}

export interface StudioCourseDetail extends StudioCourse {
  modules: StudioModule[];
}

/** Every limit and switch the Learn Studio obeys. Set in Admin → Settings → Peebee Learn. */
export interface LearnSettings {
  /** Master switch for creating schools, classes and courses. */
  enabled: boolean;
  /** Streams educators may create content in right now. */
  streams: EducationStream[];
  /** Whether masterclasses (short open programmes) can be created next to ordinary classes. */
  masterclassesEnabled: boolean;
  /** Whether courses can carry a price. When off every course is free. */
  paidCoursesEnabled: boolean;
  maxCoursePriceUgx: number;
  maxSchoolsPerUser: number;
  maxClassesPerSchool: number;
  maxCoursesPerClass: number;
  maxModulesPerCourse: number;
  maxLessonsPerModule: number;
  maxQuizQuestionsPerLesson: number;
  /** Longest single lesson, in minutes. */
  maxLessonMinutes: number;
  /** Things one educator may create per hour (schools, classes, courses, modules and lessons together). */
  createsPerHour: number;
  /** A new course starts published. When off it starts as a draft and the educator publishes it. */
  publishByDefault: boolean;
  /** Learners can enrol in published courses. */
  enrolmentsEnabled: boolean;
  /** Peebee's share of every course sale and fee payment, in percent. */
  commissionPercent: number;
  /** Educators can attach a video or audio file to a lesson. */
  videoUploadsEnabled: boolean;
  /** Largest lesson video or audio file, in megabytes. */
  maxVideoMb: number;
  /** Largest cover picture for a school or course, in megabytes. 0 switches cover uploads off. */
  maxCoverMb: number;
  /** Quiz attempts one learner may make per hour. */
  quizAttemptsPerHour: number;
  /** Schools can issue fee invoices and learners can pay them. */
  feesEnabled: boolean;
  /** Pass mark for exams that are marked automatically, in percent. */
  examPassPercent: number;
  /** Educators can run live classroom sessions on a TV and students' phones. */
  liveEnabled: boolean;
  /** Most students in one live session. */
  liveMaxParticipants: number;
  /** How often a phone or TV asks for changes, in seconds. */
  livePollSeconds: number;
  /** Most items on one session's run sheet. */
  liveMaxCuesPerSession: number;
  /** Default time to answer a live question, in seconds. */
  liveQuestionSeconds: number;
  /** Longest a live exam may run, in minutes. */
  liveMaxExamMinutes: number;
  /** Most TV screens one educator can pair. */
  maxScreensPerUser: number;
  /** How long a TV's pairing code stays valid, in minutes. */
  screenPairMinutes: number;
  /** Two practice classes that run themselves, so anyone can try the live classroom with a code and no tutor. */
  trialClassesEnabled: boolean;
  /** The 6-digit codes that open the two trial classes. */
  trialCodeA: string;
  trialCodeB: string;
  /** Show the demo schools and courses in the catalogue next to real ones. */
  demoContentVisible: boolean;
  /** TV classroom is a Pro feature. Off (the default) means every educator can use it for free. */
  tvProRequired: boolean;
  /** What Learn Pro costs for one period, in UGX, taken from the educator's wallet. 0 makes it free to claim. */
  proPriceUgx: number;
  /** How many days one Pro purchase lasts. */
  proDays: number;
}

/** An educator's access to the TV classroom, and what Learn Pro costs. */
export interface LearnProStatus {
  ok: true;
  tv: {
    /** TV is a Pro feature right now. False means it is free for everyone. */
    required: boolean;
    /** This educator has Learn Pro. */
    pro: boolean;
    /** This educator may use the TV classroom. */
    allowed: boolean;
    expiresAt: string | null;
  };
  priceUgx: number;
  days: number;
}

/** One educator with Learn Pro, as staff see it. */
export interface LearnProEducator {
  userId: string;
  name: string;
  contact: string;
  source: string;
  expiresAt: string | null;
  active: boolean;
  pricePaidUgx: number;
  note: string;
}

/** What the admin sees about the demo content: whether it is installed and what it holds. */
export interface LearnDemoStatus {
  ok: true;
  steps: number;
  ready: boolean;
  /** Hand-applied migrations the demo still needs, if any. */
  missing: string[];
  installed: boolean;
  counts: { educators: number; schools: number; classes: number; courses: number; lessons: number; videos: number; trials: number };
  expected: { educators: number; schools: number; classes: number; courses: number; lessons: number; videos: number; trials: number };
}

/** A lesson's uploaded video or audio file. */
export interface LessonMedia {
  contentType: string;
  sizeBytes: number;
}

export const STUDIO_TEXT_LIMITS = {
  name: 120,
  short: 200,
  long: 2000,
  url: 500,
} as const;

/** What the Studio uses until Admin changes it. Mirrors the server defaults; the server's saved settings always win. */
export const DEFAULT_LEARN_SETTINGS: LearnSettings = {
  enabled: true,
  streams: ["sprouts", "foundations", "academy", "compass", "skills"],
  masterclassesEnabled: true,
  paidCoursesEnabled: true,
  maxCoursePriceUgx: 5_000_000,
  maxSchoolsPerUser: 3,
  maxClassesPerSchool: 30,
  maxCoursesPerClass: 12,
  maxModulesPerCourse: 30,
  maxLessonsPerModule: 40,
  maxQuizQuestionsPerLesson: 20,
  maxLessonMinutes: 240,
  createsPerHour: 60,
  publishByDefault: false,
  enrolmentsEnabled: true,
  commissionPercent: 10,
  videoUploadsEnabled: true,
  maxVideoMb: 50,
  maxCoverMb: 2,
  quizAttemptsPerHour: 30,
  feesEnabled: true,
  examPassPercent: 50,
  liveEnabled: true,
  liveMaxParticipants: 60,
  livePollSeconds: 3,
  liveMaxCuesPerSession: 100,
  liveQuestionSeconds: 30,
  liveMaxExamMinutes: 120,
  maxScreensPerUser: 5,
  screenPairMinutes: 10,
  trialClassesEnabled: true,
  trialCodeA: "111222",
  trialCodeB: "222111",
  demoContentVisible: true,
  tvProRequired: false,
  proPriceUgx: 50000,
  proDays: 30,
};

// ---------------------------------------------------------------------------
// Learning: enrolment, progress, grading and school fees
// ---------------------------------------------------------------------------

export interface LearnEnrollment {
  id: string;
  courseId: string;
  title: string;
  stream: EducationStream;
  schoolName: string;
  enrolledAt: string;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
}

export interface LearnerQuiz {
  title: string;
  passingScorePercent: number;
  /** Questions and choices only. The answers stay on the server. */
  questions: { question: string; options: string[] }[];
}

export interface LearnerLesson {
  id: string;
  title: string;
  contentType: LessonContentType;
  durationMinutes: number;
  summary: string;
  contentUrl: string;
  hasMedia: boolean;
  completed: boolean;
  bestScorePercent: number | null;
  quiz: LearnerQuiz | null;
}

export interface LearnerCourse {
  id: string;
  title: string;
  summary: string;
  stream: EducationStream;
  schoolName: string;
  progressPercent: number;
  modules: { id: string; title: string; description: string; lessons: LearnerLesson[] }[];
}

export interface QuizResult {
  scorePercent: number;
  passed: boolean;
  passMark: number;
  /** correctIndex and explanation are present only after a pass. */
  results: { correct: boolean; correctIndex?: number; explanation?: string }[];
}

export interface FeeInvoice {
  id: string;
  schoolId: string;
  schoolName?: string;
  studentId: string;
  studentName?: string;
  title: string;
  amountUgx: number;
  paidUgx: number;
  balanceUgx: number;
  dueDate: string;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  createdAt: string;
}

export interface CourseStudent {
  userId: string;
  name: string;
  enrolledAt: string;
  paidUgx: number;
  progressPercent: number;
}

// ---------------------------------------------------------------------------
// Live classroom: TV screens, sessions and what goes where
// ---------------------------------------------------------------------------

export type CueKind = "slide" | "lesson" | "announcement" | "timer" | "question" | "exam" | "attendance";
export type CueTarget = "screen" | "phones" | "both";

/** Where each kind of item makes sense. The educator may pick any of these when pushing. */
export const CUE_TARGETS: Record<CueKind, CueTarget[]> = {
  slide: ["screen", "both"],
  lesson: ["screen", "phones", "both"],
  announcement: ["screen", "phones", "both"],
  timer: ["screen", "both"],
  question: ["screen", "phones", "both"],
  exam: ["phones", "both"],
  attendance: ["phones", "both"],
};

export const CUE_LABELS: Record<CueKind, string> = {
  slide: "Slide",
  lesson: "Lesson",
  announcement: "Announcement",
  timer: "Timer",
  question: "Question or poll",
  exam: "Exam",
  attendance: "Attendance",
};

export interface TvDevice {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
}

export interface LiveSessionSummary {
  id: string;
  title: string;
  code: string;
  status: "live" | "ended";
  schoolId: string;
  classId: string | null;
  courseId: string | null;
  screenDeviceId: string | null;
  createdAt: string;
}

export interface LiveQuestion {
  question: string;
  options: string[];
  correctIndex: number | null;
  explanation?: string;
}

export interface ConsoleCue {
  id: string;
  kind: CueKind;
  target: CueTarget;
  status: "queued" | "active" | "closed";
  revealed: boolean;
  endsAt: string | null;
  payload: Record<string, any>;
  responses: number;
  onScreen: boolean;
  onPhones: boolean;
  counts?: number[];
  lessonTitle?: string;
}

export interface ConsoleMember {
  userId: string;
  name: string;
  present: boolean;
  handRaised: boolean;
  points: number;
}

export interface ConsoleView {
  session: LiveSessionSummary & { version: number; playback: { playing: boolean; at?: number | null }; joinUrl: string };
  screen: { id: string; name: string; online: boolean } | null;
  cues: ConsoleCue[];
  members: ConsoleMember[];
  serverNow: string;
}

/** What a phone is shown. Never contains an answer until the tutor reveals it. */
export interface PhoneCue {
  id: string;
  kind: CueKind;
  endsAt: string | null;
  open: boolean;
  revealed: boolean;
  answered: boolean;
  title?: string;
  body?: string;
  imageUrl?: string | null;
  /** A lesson's video or audio, played on the phone. */
  media?: { url: string; contentType: string } | null;
  text?: string;
  label?: string;
  seconds?: number;
  question?: string;
  options?: string[];
  poll?: boolean;
  mine?: number | null;
  reveal?: { correctIndex: number | null; explanation: string; counts: number[]; correct: boolean | null };
  questions?: { question: string; options: string[] }[];
  result?: { score: number; outOf: number };
  review?: { correctIndex: number | null; explanation: string }[];
}

export type PhoneState =
  | { ok: true; changed: false; version: number }
  | { ok: true; changed: true; version: number; serverNow: string; status: "live" | "ended"; session: { title: string; hostName: string }; present: boolean; handRaised: boolean; cue: PhoneCue | null };

/** What the TV is shown. */
export interface ScreenCue {
  id: string;
  kind: CueKind;
  endsAt: string | null;
  open: boolean;
  revealed: boolean;
  title?: string;
  body?: string;
  imageUrl?: string | null;
  text?: string;
  label?: string;
  seconds?: number;
  media?: { url: string; contentType: string } | null;
  question?: string;
  options?: string[];
  poll?: boolean;
  answered?: number;
  total?: number;
  counts?: number[];
  correctIndex?: number | null;
  explanation?: string;
  leaders?: { name: string; points: number; outOf?: number }[];
  questionCount?: number;
  submitted?: number;
  average?: number | null;
  present?: number;
}

export interface ScreenState {
  ok: true;
  device: { name: string };
  pollSeconds: number;
  session: null | { id: string; title: string; code: string; joinUrl: string; participants: number; present: number; hands: number; /** A practice class that runs by itself. */ trial?: boolean };
  version?: number;
  serverNow?: string;
  playback?: { playing: boolean; at?: number | null; updatedAt?: string };
  cue?: ScreenCue | null;
}
