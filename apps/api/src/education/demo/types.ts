import type { ClassKind, CurriculumFramework, EducationStream, LessonContentType, SchoolKind } from "@peebee/shared";
import type { DemoVideoKey } from "../demo-media.js";

/** Everything the demo content is made of. Plain data: the installer turns it into rows. */

export interface DemoQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface DemoLesson {
  title: string;
  /** The lesson notes learners read under the video. */
  summary: string;
  type: LessonContentType;
  minutes: number;
  /** Gets the placeholder video for its stream. */
  video?: boolean;
  /** Slide lessons: the deck. */
  slides?: { title: string; body: string }[];
  quiz?: { title: string; passingScorePercent: number; questions: DemoQuestion[] };
}

export interface DemoModule {
  title: string;
  description: string;
  lessons: DemoLesson[];
}

export interface DemoCourse {
  /** Short and unique across all demo content; becomes part of the row ids. */
  key: string;
  title: string;
  summary: string;
  outcomes: string[];
  modules: DemoModule[];
}

export interface DemoClass {
  key: string;
  stream: EducationStream;
  kind: ClassKind;
  name: string;
  level: string;
  framework: CurriculumFramework;
  term: string;
  tutor: string;
  capacity: number;
  summary: string;
  courses: DemoCourse[];
}

export interface DemoEducator {
  key: string;
  name: string;
  /** The sign-in name when the admin sets a demo password. The .invalid domain can never receive mail. */
  email: string;
  phone: string;
  school: {
    name: string;
    slug: string;
    kind: SchoolKind;
    streams: EducationStream[];
    tagline: string;
    bio: string;
    location: string;
    motto: string;
    badge: string;
  };
  classes: DemoClass[];
}

/** One step of a trial class's run sheet. It holds the screen for `open` seconds, then (for a question) shows the answer for `reveal` seconds. */
export type DemoTrialCue =
  | { kind: "announcement"; text: string; open: number }
  | { kind: "attendance"; open: number }
  | { kind: "slide"; title: string; body: string; open: number }
  | { kind: "lesson"; course: string; lessonIndex: number; open: number }
  | ({ kind: "question"; open: number; reveal: number } & DemoQuestion & { poll?: boolean });

export interface DemoTrial {
  slot: "a" | "b";
  title: string;
  /** Educator key, and the course whose first lesson plays. */
  educator: string;
  course: string;
  video: DemoVideoKey;
  cues: DemoTrialCue[];
}

// ---------------------------------------------------------------------------
// Small builders so the content below reads like the content, not the plumbing.
// ---------------------------------------------------------------------------

export const Q = (question: string, options: string[], correctIndex: number, explanation?: string): DemoQuestion => ({ question, options, correctIndex, explanation });

export const quiz = (title: string, ...questions: DemoQuestion[]) => ({ title, passingScorePercent: 60, questions });

type LessonOptions = { minutes?: number; quiz?: DemoLesson["quiz"] };

/** A lesson with the placeholder video. */
export const V = (title: string, summary: string, o: LessonOptions = {}): DemoLesson => ({ title, summary, type: "video", minutes: o.minutes ?? 8, video: true, quiz: o.quiz });
/** A reading lesson. */
export const R = (title: string, summary: string, o: LessonOptions = {}): DemoLesson => ({ title, summary, type: "text", minutes: o.minutes ?? 6, quiz: o.quiz });
/** A slide lesson: the summary is the short description, the slides are the deck. */
export const S = (title: string, summary: string, slides: { title: string; body: string }[], o: LessonOptions = {}): DemoLesson => ({ title, summary, type: "slides", minutes: o.minutes ?? 7, slides, quiz: o.quiz });
/** A hands-on practical. */
export const P = (title: string, summary: string, o: LessonOptions = {}): DemoLesson => ({ title, summary, type: "text", minutes: o.minutes ?? 12, quiz: o.quiz });

export const M = (title: string, description: string, ...lessons: DemoLesson[]): DemoModule => ({ title, description, lessons });
