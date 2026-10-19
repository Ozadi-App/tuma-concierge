"use client";

import type { LearnerCourse, LearnerLesson } from "@peebee/shared";
import { AudioLines, BookOpenText, CheckCircle2, Circle, ClipboardCheck, GraduationCap, Play, Presentation, Radio, Video } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Message, Screen } from "../../../components/Screen";
import { TvHttpError, courseArt, tvApi, type CatalogPreview } from "../../../lib/api";
import { useDevice } from "../../../lib/device";
import { useAutoFocus } from "../../../lib/dpad";
import { useLoad } from "../../../lib/useLoad";

type View = { kind: "enrolled"; course: LearnerCourse } | { kind: "preview"; preview: CatalogPreview };

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

function lessonIcon(l: LearnerLesson) {
  switch (l.contentType) {
    case "quiz": return ClipboardCheck;
    case "exam": return GraduationCap;
    case "slides": return Presentation;
    case "audio": return AudioLines;
    case "live": return Radio;
    case "text": return BookOpenText;
    default: return Video;
  }
}

const meta = (l: LearnerLesson) => (l.quiz && (l.contentType === "quiz" || l.contentType === "exam") ? `${l.quiz.questionCount} questions` : `${l.durationMinutes} min`);

function Picture({ id }: { id: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="aspect-video w-[22rem] shrink-0 overflow-hidden rounded-[1.2rem] bg-[rgb(var(--surface-muted))]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!broken && <img src={courseArt(id)} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />}
    </div>
  );
}

/** A course: its lessons if you're taking it, or a preview with a way in if you aren't. */
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { secret } = useDevice();
  const { data, error, loading, reload } = useLoad<View>(async (s) => {
    try {
      return { kind: "enrolled", course: (await tvApi.course(s, id)).course };
    } catch (err) {
      if (err instanceof TvHttpError && err.status === 403 && err.code === "not_enrolled") return { kind: "preview", preview: (await tvApi.catalogCourse(id)).course };
      throw err;
    }
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);
  useAutoFocus(!loading && !!data, "[data-primary]");

  async function enrol() {
    if (!secret) return;
    setBusy(true);
    setEnrolError(null);
    try {
      await tvApi.enrol(secret, id);
      reload();
    } catch (err) {
      setEnrolError(err instanceof Error ? err.message : "Couldn't enrol.");
    } finally {
      setBusy(false);
    }
  }

  const title = data?.kind === "enrolled" ? data.course.title : data?.kind === "preview" ? data.preview.title : "Course";
  return (
    <Screen title={title} kicker={data?.kind === "enrolled" ? data.course.schoolName : data?.kind === "preview" ? data.preview.schoolName : undefined} backTo="/courses">
      {loading && <Message>Opening the course…</Message>}
      {error && <Message tone="error">{error.message}</Message>}

      {data?.kind === "enrolled" && (() => {
        const course = data.course;
        const lessons = course.modules.flatMap((m) => m.lessons);
        const next = lessons.find((l) => !l.completed) ?? lessons[0];
        return (
          <div className="space-y-[1.6rem]">
            <div className="flex items-center gap-[1.6rem]">
              <Picture id={course.id} />
              <div className="min-w-0 flex-1 space-y-[0.8rem]">
                {course.summary && <p className="line-clamp-3 text-[1.2rem] leading-snug text-ink-500">{course.summary}</p>}
                <div className="h-[0.6rem] max-w-[26rem] overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuenow={course.progressPercent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-gold" style={{ width: `${course.progressPercent}%` }} />
                </div>
                <p className="text-[1rem] text-ink-500">
                  {course.progressPercent}% done · {lessons.filter((l) => l.completed).length} of {lessons.length} lessons
                </p>
                {next && (
                  <Link
                    href={`/course/${course.id}/lesson/${next.id}`}
                    data-focusable
                    data-primary
                    className="inline-flex items-center gap-[0.6rem] rounded-full bg-gold px-[1.8rem] py-[0.7rem] text-[1.3rem] font-bold text-ink-gold"
                  >
                    <Play className="h-[1.2rem] w-[1.2rem]" aria-hidden /> {course.progressPercent === 0 ? "Start the course" : course.progressPercent === 100 ? "Watch again" : "Continue"}
                  </Link>
                )}
              </div>
            </div>
            {lessons.length === 0 && <Message>This course has no lessons yet.</Message>}
            {course.modules.map((m, mi) => (
              <section key={m.id} aria-label={m.title} className="space-y-[0.6rem]">
                <h2 className="text-[1rem] font-bold uppercase tracking-[0.18em] text-gold">
                  {mi + 1}. {m.title}
                </h2>
                <ul className="grid grid-cols-2 gap-[0.7rem]">
                  {m.lessons.map((l) => {
                    const Icon = lessonIcon(l);
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/course/${course.id}/lesson/${l.id}`}
                          data-focusable
                          className="flex items-center gap-[0.9rem] rounded-[1rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-[1.1rem] py-[0.8rem] focus:bg-gold focus:text-ink-gold"
                        >
                          {l.completed ? <CheckCircle2 className="h-[1.5rem] w-[1.5rem] shrink-0 text-green" aria-label="Done" /> : <Circle className="h-[1.5rem] w-[1.5rem] shrink-0 opacity-50" aria-label="Not done" />}
                          <span className="min-w-0 flex-1 truncate text-[1.2rem] font-bold">{l.title}</span>
                          <Icon className="h-[1.2rem] w-[1.2rem] shrink-0 opacity-70" aria-hidden />
                          <span className="shrink-0 text-[0.95rem] opacity-70">{meta(l)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        );
      })()}

      {data?.kind === "preview" && (
        <div className="space-y-[1.4rem]">
          <div className="flex items-start gap-[1.6rem]">
            <Picture id={data.preview.id} />
            <div className="min-w-0 flex-1 space-y-[0.8rem]">
              {data.preview.summary && <p className="text-[1.3rem] leading-snug text-ink-500">{data.preview.summary}</p>}
              <p className="text-[1.1rem] text-ink-500">
                {data.preview.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons · <strong className="text-ink">{data.preview.priceUgx > 0 ? ugx(data.preview.priceUgx) : "Free"}</strong>
              </p>
              {data.preview.outcomes.length > 0 && (
                <ul className="list-disc space-y-[0.2rem] pl-[1.4rem] text-[1.1rem] text-ink">
                  {data.preview.outcomes.slice(0, 4).map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {data.preview.priceUgx === 0 ? (
            <button
              type="button"
              data-focusable
              data-primary
              disabled={busy}
              onClick={() => void enrol()}
              className="rounded-full bg-gold px-[2rem] py-[0.8rem] text-[1.4rem] font-bold text-ink-gold disabled:opacity-60"
            >
              {busy ? "Enrolling…" : "Enrol for free"}
            </button>
          ) : (
            <div className="max-w-[52rem] space-y-[0.5rem] rounded-[1.2rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1.2rem]">
              <p className="text-[1.3rem] font-black text-ink">Buy this course on your phone</p>
              <p className="text-[1.1rem] leading-snug text-ink-500">
                Open the Peebee app, go to Learn, find <strong className="text-ink">{data.preview.title}</strong> and enrol. Payment always happens on your phone. The course then appears under My courses on this TV.
              </p>
              <button type="button" data-focusable data-primary onClick={reload} className="mt-[0.4rem] rounded-full border border-[var(--border-faint)] px-[1.4rem] py-[0.5rem] text-[1.1rem] font-bold text-ink focus:bg-gold focus:text-ink-gold">
                I&apos;ve enrolled. Check again
              </button>
            </div>
          )}
          {enrolError && <Message tone="error">{enrolError}</Message>}
        </div>
      )}
    </Screen>
  );
}
