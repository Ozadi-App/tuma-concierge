import type { LearnerLesson, LessonContentType } from "@peebee/shared";
import { AudioLines, BookOpenText, ClipboardCheck, GraduationCap, Presentation, Radio, Video, type LucideIcon } from "lucide-react";

export const KIND_ICON: Record<LessonContentType, LucideIcon> = {
  text: BookOpenText,
  slides: Presentation,
  audio: AudioLines,
  video: Video,
  live: Radio,
  quiz: ClipboardCheck,
  exam: GraduationCap,
};

export const KIND_LABEL: Record<LessonContentType, string> = {
  text: "Reading",
  slides: "Slides",
  audio: "Audio",
  video: "Video",
  live: "Live video",
  quiz: "Quiz",
  exam: "Exam",
};

export function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-UG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The line under an item's title: how long it is, or what it asks of you. */
export function metaLine(l: LearnerLesson): string {
  if (l.quiz && (l.contentType === "quiz" || l.contentType === "exam")) {
    const bits = [`${l.quiz.questionCount} question${l.quiz.questionCount === 1 ? "" : "s"}`];
    if (l.quiz.timeLimitMinutes > 0) bits.push(`${l.quiz.timeLimitMinutes} min`);
    bits.push(`pass ${l.quiz.passingScorePercent}%`);
    return bits.join(" · ");
  }
  if (l.contentType === "live" && l.live) return whenLabel(l.live.startsAt);
  if (l.contentType === "slides" && l.slideCount) return `${l.slideCount} slides`;
  return `${l.durationMinutes} min`;
}
