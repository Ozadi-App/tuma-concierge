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
};
