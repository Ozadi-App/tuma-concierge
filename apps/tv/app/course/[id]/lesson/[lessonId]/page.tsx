"use client";

import type { LearnerLesson } from "@peebee/shared";
import { ArrowRight, CheckCircle2, HelpCircle, ListChecks } from "lucide-react";
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

/** One lesson: watch or listen to it, read it, take its quiz, tick it off, move on. */
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
  const [marked, setMarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actions = useRef<HTMLDivElement>(null);

  // A new lesson starts clean.
  useEffect(() => {
    setMediaUrl(null);
    setMediaError(null);
    setQuizOpen(false);
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

  const done = marked || !!lesson?.completed;
  const goNext = useCallback(() => {
    // Replace, so the history stays "course, then this lesson" and Back from any lesson returns to the course however many were watched.
    if (upNext) router.replace(`/course/${id}/lesson/${upNext.id}`);
    else stepBack(router, `/course/${id}`);
  }, [router, id, upNext]);

  const complete = useCallback(async () => {
    if (!secret || !lesson || done || lesson.quiz) return;
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

  if (quizOpen && lesson.quiz) {
    return (
      <Screen title={lesson.title} kicker={kicker} backTo={`/course/${id}`}>
        <Quiz lesson={lesson} onPassed={reload} onClose={() => setQuizOpen(false)} next={{ label: nextLabel, go: goNext }} />
      </Screen>
    );
  }

  const audio = lesson.contentType === "audio_story";
  return (
    <Screen title={lesson.title} kicker={kicker} backTo={`/course/${id}`}>
      <div className="space-y-[1.2rem]">
        {hasMedia && !mediaUrl && !mediaError && <Message>Loading the {audio ? "audio" : "video"}…</Message>}
        {mediaError && <Message tone="error">{mediaError}</Message>}
        {mediaUrl && <LessonMedia key={mediaUrl} url={mediaUrl} audio={audio} onEnded={() => void complete()} onLeaveDown={() => actions.current?.querySelector<HTMLElement>("button")?.focus()} />}

        {/* Under the player, so Down on the remote reaches them: Left and Right belong to the video while it has focus. */}
        <div ref={actions} className="flex flex-wrap items-center gap-[1rem]" role="group" aria-label="Lesson actions">
          {lesson.quiz && (
            <button
              type="button"
              data-focusable
              data-primary={!hasMedia ? true : undefined}
              onClick={() => setQuizOpen(true)}
              className="flex items-center gap-[0.6rem] rounded-full bg-gold px-[1.6rem] py-[0.7rem] text-[1.25rem] font-bold text-ink-gold"
            >
              <HelpCircle className="h-[1.3rem] w-[1.3rem]" aria-hidden /> {done ? "Take the quiz again" : "Take the quiz"}
            </button>
          )}
          {!lesson.quiz && !done && (
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
            data-primary={done && !hasMedia ? true : undefined}
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
            {lesson.summary && <p className={`whitespace-pre-line leading-snug text-ink ${hasMedia ? "text-[1.3rem]" : "text-[1.9rem]"}`}>{lesson.summary}</p>}
            {!hasMedia && !lesson.summary && !lesson.quiz && !lesson.contentUrl && <Message>This lesson has no content to show yet.</Message>}
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
