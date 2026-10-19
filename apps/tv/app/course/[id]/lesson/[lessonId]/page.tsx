"use client";

import type { LearnerLesson, LearnerLessonDetail } from "@peebee/shared";
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, ListChecks, Radio } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LessonMedia } from "../../../../../components/LessonMedia";
import { Qr } from "../../../../../components/JoinCard";
import { Quiz } from "../../../../../components/Quiz";
import { Message, Screen } from "../../../../../components/Screen";
import { tvApi } from "../../../../../lib/api";
import { useDevice } from "../../../../../lib/device";
import { useAutoFocus } from "../../../../../lib/dpad";
import { stepBack } from "../../../../../lib/nav";
import { useLoad } from "../../../../../lib/useLoad";

const CUSTOMER_URL = (process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "https://peebee.online").replace(/\/$/, "");

/** Splits a long text into screens a person can read from the sofa: whole paragraphs, about 650 characters a screen. */
function pages(text: string): string[] {
  const out: string[] = [];
  let page = "";
  for (const paragraph of text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean)) {
    if (page && page.length + paragraph.length > 650) {
      out.push(page);
      page = "";
    }
    page = page ? `${page}\n\n${paragraph}` : paragraph;
  }
  if (page) out.push(page);
  return out.length ? out : [""];
}

/** One lesson: watch or listen to it, read it, flip through its slides, take its quiz, tick it off, move on. */
export default function LessonPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();
  const { secret } = useDevice();
  const { data, error, loading, reload } = useLoad((s) => tvApi.course(s, id), [id]);
  const course = data?.course ?? null;

  const lessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);
  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson: LearnerLesson | null = index >= 0 ? lessons[index]! : null;
  const upNext = index >= 0 ? lessons[index + 1] ?? null : null;

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [detail, setDetail] = useState<LearnerLessonDetail | null>(null);
  const [page, setPage] = useState(0);
  const [marked, setMarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actions = useRef<HTMLDivElement>(null);

  // A new lesson starts clean.
  useEffect(() => {
    setMediaUrl(null);
    setMediaError(null);
    setQuizOpen(false);
    setDetail(null);
    setPage(0);
    setMarked(false);
    setActionError(null);
  }, [lessonId]);

  // The video's address is asked for once per lesson, and only when the lesson has one.
  const hasMedia = !!lesson?.hasMedia;
  useEffect(() => {
    if (!secret || !hasMedia) return;
    let cancelled = false;
    tvApi
      .mediaUrl(secret, lessonId)
      .then((res) => !cancelled && setMediaUrl(res.url))
      .catch((err: unknown) => !cancelled && setMediaError(err instanceof Error ? err.message : "Couldn't load the video."));
    return () => {
      cancelled = true;
    };
  }, [secret, lessonId, hasMedia]);

  // Written lessons and slides come from the lesson itself; the course view only lists them.
  const kind = lesson?.contentType;
  const needsDetail = kind === "text" || kind === "slides" || kind === "quiz" || kind === "exam" || !!lesson?.quiz;
  useEffect(() => {
    if (!secret || !needsDetail) return;
    let cancelled = false;
    tvApi
      .lesson(secret, lessonId)
      .then((res) => !cancelled && setDetail(res.lesson))
      .catch((err: unknown) => !cancelled && setActionError(err instanceof Error ? err.message : "Couldn't load the lesson."));
    return () => {
      cancelled = true;
    };
  }, [secret, lessonId, needsDetail, lesson?.completed]);

  const textPages = useMemo(() => pages(detail?.body || lesson?.summary || ""), [detail, lesson?.summary]);
  const slides = detail?.slides ?? [];
  const steps = kind === "slides" ? slides.length : kind === "text" ? textPages.length : 1;
  const assessment = kind === "quiz" || kind === "exam";
  const done = marked || !!lesson?.completed;
  const goNext = useCallback(() => {
    // Replace, so the history stays "course, then this lesson" and Back from any lesson returns to the course however many were watched.
    if (upNext) router.replace(`/course/${id}/lesson/${upNext.id}`);
    else stepBack(router, `/course/${id}`);
  }, [router, id, upNext]);

  const complete = useCallback(async () => {
    if (!secret || !lesson || done || lesson.quiz || kind === "live") return;
    setBusy(true);
    setActionError(null);
    try {
      await tvApi.complete(secret, lesson.id);
      setMarked(true);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't save your progress.");
    } finally {
      setBusy(false);
    }
  }, [secret, lesson, done, reload]);

  useAutoFocus(!loading && !!lesson && !quizOpen, mediaUrl ? "video[data-focusable], audio[data-focusable]" : "[data-primary]");

  if (loading && !course) return <Screen title="Lesson" backTo={`/course/${id}`}><Message>Opening the lesson…</Message></Screen>;
  if (error) {
    return (
      <Screen title="Lesson" backTo={`/course/${id}`}>
        <Message tone="error">{error.message}</Message>
      </Screen>
    );
  }
  if (!course || !lesson) {
    return (
      <Screen title="Lesson" backTo={`/course/${id}`}>
        <Message tone="error">That lesson wasn&apos;t found.</Message>
      </Screen>
    );
  }

  const nextLabel = upNext ? "Next lesson" : "Finish the course";
  const kicker = `${course.title} · Lesson ${index + 1} of ${lessons.length}`;

  if (quizOpen && lesson.quiz && detail) {
    return (
      <Screen title={lesson.title} kicker={kicker} backTo={`/course/${id}`}>
        <Quiz lesson={detail} phoneUrl={`${CUSTOMER_URL}/learn/course/${id}/lesson/${lesson.id}`} onPassed={reload} onClose={() => setQuizOpen(false)} next={{ label: nextLabel, go: goNext }} />
      </Screen>
    );
  }

  const audio = lesson.contentType === "audio";
  const lastStep = page >= steps - 1;
  return (
    <Screen title={lesson.title} kicker={kicker} backTo={`/course/${id}`}>
      <div className="space-y-[1.2rem]">
        {hasMedia && !mediaUrl && !mediaError && <Message>Loading the {audio ? "audio" : "video"}…</Message>}
        {mediaError && <Message tone="error">{mediaError}</Message>}
        {mediaUrl && <LessonMedia key={mediaUrl} url={mediaUrl} audio={audio} onEnded={() => void complete()} onLeaveDown={() => actions.current?.querySelector<HTMLElement>("button")?.focus()} />}

        {/* Under the player, so Down on the remote reaches them: Left and Right belong to the video while it has focus. */}
        <div ref={actions} className="flex flex-wrap items-center gap-[1rem]" role="group" aria-label="Lesson actions">
          {steps > 1 && (
            <>
              <button type="button" data-focusable disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="flex items-center gap-[0.6rem] rounded-full border border-[var(--border-faint)] px-[1.4rem] py-[0.7rem] text-[1.25rem] font-bold text-ink focus:bg-gold focus:text-ink-gold disabled:opacity-40">
                <ArrowLeft className="h-[1.3rem] w-[1.3rem]" aria-hidden /> Back
              </button>
              <button
                type="button"
                data-focusable
                data-primary
                disabled={lastStep}
                onClick={() => {
                  const to = Math.min(steps - 1, page + 1);
                  setPage(to);
                  if (to === steps - 1) void complete();
                }}
                className="flex items-center gap-[0.6rem] rounded-full bg-gold px-[1.6rem] py-[0.7rem] text-[1.25rem] font-bold text-ink-gold disabled:opacity-40"
              >
                {kind === "slides" ? "Next slide" : "Keep reading"} <ArrowRight className="h-[1.3rem] w-[1.3rem]" aria-hidden />
              </button>
              <span className="text-[1.1rem] text-ink-500">
                {page + 1} of {steps}
              </span>
            </>
          )}
          {lesson.quiz && (
            <button
              type="button"
              data-focusable
              data-primary={!hasMedia && steps <= 1 ? true : undefined}
              disabled={!detail}
              onClick={() => setQuizOpen(true)}
              className="flex items-center gap-[0.6rem] rounded-full bg-gold px-[1.6rem] py-[0.7rem] text-[1.25rem] font-bold text-ink-gold"
            >
              <HelpCircle className="h-[1.3rem] w-[1.3rem]" aria-hidden /> {done ? (assessment ? "Take it again" : "Take the quiz again") : assessment ? (kind === "exam" ? "Start the exam" : "Start the quiz") : "Take the quiz"}
            </button>
          )}
          {!lesson.quiz && !done && kind !== "live" && steps <= 1 && (
            <button
              type="button"
              data-focusable
              data-primary={!hasMedia ? true : undefined}
              disabled={busy}
              onClick={() => void complete()}
              className="flex items-center gap-[0.6rem] rounded-full bg-gold px-[1.6rem] py-[0.7rem] text-[1.25rem] font-bold text-ink-gold disabled:opacity-60"
            >
              <ListChecks className="h-[1.3rem] w-[1.3rem]" aria-hidden /> Mark as done
            </button>
          )}
          <button
            type="button"
            data-focusable
            data-primary={(done || kind === "live") && !hasMedia && steps <= 1 && !lesson.quiz ? true : undefined}
            onClick={goNext}
            className={`flex items-center gap-[0.6rem] rounded-full px-[1.6rem] py-[0.7rem] text-[1.25rem] font-bold ${done ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] text-ink focus:bg-gold focus:text-ink-gold"}`}
          >
            {nextLabel} <ArrowRight className="h-[1.3rem] w-[1.3rem]" aria-hidden />
          </button>
          {done && (
            <p className="flex items-center gap-[0.5rem] rounded-full bg-green/15 px-[1.1rem] py-[0.5rem] text-[1.15rem] font-bold text-green">
              <CheckCircle2 className="h-[1.3rem] w-[1.3rem]" aria-hidden /> {lesson.quiz && lesson.bestScorePercent !== null ? `Passed ${lesson.bestScorePercent}%` : "Done"}
            </p>
          )}
        </div>
        {actionError && <Message tone="error">{actionError}</Message>}

        <div className="flex items-start gap-[2rem]">
          <div className="min-w-0 flex-1">
            {kind === "text" && <p className="whitespace-pre-line text-[1.9rem] leading-snug text-ink">{textPages[page]}</p>}
            {kind === "slides" &&
              (slides[page] ? (
                <div className="space-y-[0.8rem]">
                  <h2 className="text-[2.8rem] font-black leading-tight text-ink">{slides[page]!.title}</h2>
                  {slides[page]!.body && <p className="whitespace-pre-line text-[1.8rem] leading-snug text-ink">{slides[page]!.body}</p>}
                </div>
              ) : (
                <Message>{detail ? "This lesson has no slides yet." : "Loading the slides…"}</Message>
              ))}
            {kind === "live" && lesson.live && (
              <div className="space-y-[0.8rem]">
                <p className="flex items-center gap-[0.6rem] text-[1rem] font-bold uppercase tracking-[0.18em] text-gold">
                  <Radio className="h-[1.2rem] w-[1.2rem]" aria-hidden /> Live video lesson
                </p>
                <p className="text-[2.4rem] font-black text-ink">{new Date(lesson.live.startsAt).toLocaleString("en-UG", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-[1.3rem] text-ink-500">Live lessons open in the Peebee app on your phone.</p>
              </div>
            )}
            {assessment && lesson.quiz && (
              <p className="text-[1.5rem] text-ink-500">
                {lesson.quiz.questionCount} questions · pass mark {lesson.quiz.passingScorePercent}%{lesson.quiz.timeLimitMinutes > 0 ? ` · ${lesson.quiz.timeLimitMinutes} minutes` : ""}
              </p>
            )}
            {(kind === "video" || kind === "audio") && lesson.summary && <p className="whitespace-pre-line text-[1.3rem] leading-snug text-ink">{lesson.summary}</p>}
            {!hasMedia && !lesson.summary && !lesson.quiz && !lesson.contentUrl && kind !== "slides" && kind !== "live" && kind !== "text" && <Message>This lesson has no content to show yet.</Message>}
          </div>
          {lesson.contentUrl && (
            <div className="w-[12rem] shrink-0 space-y-[0.4rem] rounded-[1.1rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[0.8rem]">
              <p className="text-[0.95rem] font-bold text-ink">Extra material</p>
              <Qr value={lesson.contentUrl} label="QR code that opens this lesson's extra material on your phone" className="aspect-square w-full" />
              <p className="text-[0.85rem] leading-snug text-ink-500">Scan with your phone to open it.</p>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
