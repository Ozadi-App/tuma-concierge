import type { EducationStream } from "@peebee/shared";
import type { DemoVideoKey } from "../demo-media.js";
import { EARLY_EDUCATORS } from "./early.js";
import { SENIOR_EDUCATORS } from "./senior.js";
import { SKILLS_EDUCATORS } from "./skills.js";
import type { DemoCourse, DemoEducator, DemoTrial } from "./types.js";

export * from "./types.js";

/** Eight educator accounts: four institutions with several classes and tutors each, and four individual tutors. */
export const DEMO_EDUCATORS: DemoEducator[] = [...EARLY_EDUCATORS, ...SENIOR_EDUCATORS, ...SKILLS_EDUCATORS];

export const VIDEO_BY_STREAM: Record<EducationStream, DemoVideoKey> = {
  sprouts: "sprouts",
  foundations: "foundations",
  academy: "academy",
  compass: "compass",
  skills: "skills",
};

// Row ids are derived from the content keys, so installing twice never duplicates anything.
export const demoIds = {
  user: (educator: string) => `usr_demo_${educator}`,
  school: (educator: string) => `sch_demo_${educator}`,
  class: (educator: string, cls: string) => `cls_demo_${educator}_${cls}`,
  course: (course: string) => `crs_demo_${course}`,
  module: (course: string, m: number) => `mod_demo_${course}_${m}`,
  lesson: (course: string, m: number, l: number) => `les_demo_${course}_${m}_${l}`,
  mediaKey: (lessonId: string) => `learn/demo/${lessonId}.mp4`,
  session: (slot: "a" | "b") => `liv_demo_${slot}`,
  cue: (slot: "a" | "b", i: number) => `lcu_demo_${slot}_${i}`,
};

export function findCourse(key: string): { educator: DemoEducator; course: DemoCourse; streamKey: EducationStream; classKey: string } {
  for (const educator of DEMO_EDUCATORS) {
    for (const cls of educator.classes) {
      const course = cls.courses.find((c) => c.key === key);
      if (course) return { educator, course, streamKey: cls.stream, classKey: cls.key };
    }
  }
  throw new Error(`Unknown demo course ${key}`);
}

/**
 * The two trial classes. Each plays a looping run sheet with a placeholder video, a few slides and questions,
 * so a visitor with the code sees a class in progress without any tutor being online.
 */
export const DEMO_TRIALS: DemoTrial[] = [
  {
    slot: "a",
    title: "Trial class: Fractions with Coach Brian",
    educator: "brian",
    course: "fractions",
    video: "live",
    cues: [
      { kind: "announcement", text: "Welcome! This is a practice class. It runs by itself, so you can join at any point.", open: 8 },
      { kind: "attendance", open: 10 },
      { kind: "lesson", course: "fractions", lessonIndex: 0, open: 16 },
      { kind: "slide", title: "A fraction is a part of a whole", body: "The bottom number says how many equal parts. The top number says how many parts we have. 3/4 means 3 of 4 equal parts.", open: 12 },
      { kind: "question", question: "Which fraction is bigger?", options: ["1/2", "1/4"], correctIndex: 0, explanation: "Halves are bigger pieces than quarters. 1/2 is bigger than 1/4.", open: 15, reveal: 8 },
      { kind: "question", question: "How do you feel about fractions today?", options: ["Confident", "A little unsure", "Lost"], correctIndex: -1, poll: true, open: 12, reveal: 6 },
      { kind: "question", question: "What is 1/5 + 2/5?", options: ["3/5", "3/10", "2/5"], correctIndex: 0, explanation: "Same bottom number: add the tops, keep the bottom. 1 + 2 = 3, so 3/5.", open: 15, reveal: 8 },
      { kind: "announcement", text: "Thank you for joining. The class starts again in a moment.", open: 6 },
    ],
  },
  {
    slot: "b",
    title: "Trial class: Study Smarter with Dr. Lydia",
    educator: "lydia",
    course: "studyskills",
    video: "live",
    cues: [
      { kind: "announcement", text: "Welcome to a practice class. It plays on a loop, so jump in any time.", open: 8 },
      { kind: "attendance", open: 10 },
      { kind: "lesson", course: "studyskills", lessonIndex: 0, open: 16 },
      { kind: "slide", title: "Review within 24 hours", body: "Look over a lecture the same day. A quick ten-minute review can double how much you remember a week later.", open: 12 },
      { kind: "question", question: "When is the best time to review a lecture?", options: ["Within 24 hours", "The night before the exam", "Never"], correctIndex: 0, explanation: "A review within 24 hours stops you forgetting most of it.", open: 15, reveal: 8 },
      { kind: "question", question: "How many hours do you study on a normal day?", options: ["Under 1", "1 to 3", "More than 3"], correctIndex: -1, poll: true, open: 12, reveal: 6 },
      { kind: "question", question: "Which note-taking method uses a question column and a summary box?", options: ["Cornell notes", "Highlighting everything", "Copying slides"], correctIndex: 0, explanation: "Cornell notes: questions on the left, notes on the right, a summary at the bottom.", open: 15, reveal: 8 },
      { kind: "announcement", text: "That's the end of the trial. It restarts in a moment, so you can try it again.", open: 6 },
    ],
  },
];
