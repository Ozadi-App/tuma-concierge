"use client";

import type { LearnerCourse, LearnerLesson, QuizResult } from "@peebee/shared";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, HelpCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../../../lib/api";
import { ApiError } from "@peebee/shared";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const ugx = (n: number) => (n > 0 ? `UGX ${n.toLocaleString("en-UG")}` : "Free");

type Preview = { title: string; summary: string; priceUgx: number; schoolName: string; outcomes: string[]; lessonCount: number };

function Player({ lesson, onChanged }: { lesson: LearnerLesson; onChanged: () => void }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMediaUrl(null);
    setMediaError(null);
    setResult(null);
    setError(null);
    setAnswers(lesson.quiz ? lesson.quiz.questions.map(() => -1) : []);
    if (!lesson.hasMedia) return;
    let cancelled = false;
    api
      .learnLessonMediaUrl(lesson.id)
      .then((r) => !cancelled && setMediaUrl(r.url))
      .catch((err) => !cancelled && setMediaError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [lesson.id, lesson.hasMedia, lesson.quiz]);

  async function submitQuiz() {
    if (answers.some((a) => a < 0)) return setError("Answer every question first.");
    setBusy(true);
    setError(null);
    try {
      const res = await api.learnSubmitQuiz(lesson.id, answers);
      setResult(res);
      if (res.passed) onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await api.learnCompleteLesson(lesson.id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isAudio = mediaUrl !== null && lesson.contentType === "audio_story";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{lesson.title}</h2>
        <p className="text-xs text-ink-500">{lesson.durationMinutes} min</p>
      </div>
      {lesson.hasMedia &&
        (mediaError ? (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
            {mediaError}
          </p>
        ) : mediaUrl ? (
          isAudio ? (
            <audio controls preload="metadata" src={mediaUrl} className="w-full" />
          ) : (
            <video controls playsInline preload="metadata" src={mediaUrl} className="aspect-video w-full rounded-2xl bg-black" />
          )
        ) : (
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
        ))}
      {lesson.contentUrl && (
        <a href={lesson.contentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold underline">
          Open the lesson material <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
      {lesson.summary && <p className="whitespace-pre-line text-sm text-ink">{lesson.summary}</p>}

      {lesson.quiz ? (
        <section aria-labelledby="quiz-h" className={`${card} space-y-4 p-4`}>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-gold" aria-hidden />
            <h3 id="quiz-h" className="text-sm font-semibold text-ink">
              {lesson.quiz.title} · pass mark {lesson.quiz.passingScorePercent}%
            </h3>
          </div>
          {lesson.quiz.questions.map((q, qi) => (
            <fieldset key={qi} className="space-y-2">
              <legend className="text-sm font-semibold text-ink">
                {qi + 1}. {q.question}
              </legend>
              {q.options.map((option, oi) => {
                const r = result?.results[qi];
                const reveal = r && result?.passed && r.correctIndex === oi;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                      answers[qi] === oi ? "border-gold bg-gold/10" : "border-[var(--border-faint)] hover:border-gold/40"
                    } ${reveal ? "ring-1 ring-green" : ""}`}
                  >
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))} className="h-4 w-4 accent-[rgb(var(--color-gold))]" />
                    <span className="text-ink">{option}</span>
                  </label>
                );
              })}
              {result && (
                <p className={`text-xs font-semibold ${result.results[qi]?.correct ? "text-green" : "text-red-600 dark:text-red-400"}`}>
                  {result.results[qi]?.correct ? "Correct" : "Not quite"}
                  {result.passed && result.results[qi]?.explanation ? <span className="font-normal text-ink-500"> · {result.results[qi]?.explanation}</span> : null}
                </p>
              )}
            </fieldset>
          ))}
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {result && (
            <p role="status" className={`rounded-xl px-3.5 py-3 text-sm font-semibold ${result.passed ? "bg-green/10 text-green" : "bg-gold/10 text-ink"}`}>
              {result.passed ? `Passed with ${result.scorePercent}%. This lesson is complete.` : `You scored ${result.scorePercent}%. You need ${result.passMark}%. Try again.`}
            </p>
          )}
          <button type="button" onClick={submitQuiz} disabled={busy} className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink-gold disabled:opacity-50">
            {busy ? "Marking…" : result && !result.passed ? "Try again" : "Submit answers"}
          </button>
        </section>
      ) : (
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {lesson.completed ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Lesson complete
            </p>
          ) : (
            <button type="button" onClick={complete} disabled={busy} className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink-gold disabled:opacity-50">
              Mark as complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LearnCoursePage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolError, setEnrolError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.learnCourse(id);
      setCourse(res.course);
      setPreview(null);
      setLessonId((current) => current ?? res.course.modules.flatMap((m) => m.lessons).find((l) => !l.completed)?.id ?? res.course.modules[0]?.lessons[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setCourse(null);
      if (err instanceof ApiError && err.status === 403) {
        try {
          const info = await api.getCatalogCourse(id);
          const c = info.course;
          setPreview({ title: c.title, summary: c.summary, priceUgx: c.priceUgx, schoolName: c.schoolName, outcomes: c.outcomes, lessonCount: c.modules.reduce((n, m) => n + m.lessons.length, 0) });
          setError(null);
        } catch (inner) {
          setError(errorMessage(inner));
        }
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enrol() {
    setBusy(true);
    setEnrolError(null);
    setNeedsFunds(false);
    try {
      await api.learnEnroll(id);
      setLoaded(false);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setEnrolError(message);
      setNeedsFunds(err instanceof ApiError && err.status === 402);
    } finally {
      setBusy(false);
    }
  }

  const lessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);
  const current = lessons.find((l) => l.id === lessonId) ?? null;

  if (!loaded) return <div className="mx-auto max-w-3xl p-4"><div className="h-64 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-10">
      <Link href="/learn/my" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> My learning
      </Link>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {preview && (
        <section className={`${card} space-y-4 p-5`}>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gold">{preview.schoolName}</p>
            <h1 className="text-xl font-bold text-ink">{preview.title}</h1>
            {preview.summary && <p className="text-sm text-ink-500">{preview.summary}</p>}
          </div>
          {preview.outcomes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">
              {preview.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" aria-hidden /> {preview.lessonCount} lessons unlock when you enrol
          </p>
          {enrolError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {enrolError}{" "}
              {needsFunds && (
                <Link href="/wallet" className="font-semibold underline">
                  Open your wallet
                </Link>
              )}
            </p>
          )}
          <button type="button" onClick={enrol} disabled={busy} className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink-gold disabled:opacity-50">
            {busy ? "Enrolling…" : preview.priceUgx > 0 ? `Enrol for ${ugx(preview.priceUgx)} from your wallet` : "Enrol for free"}
          </button>
        </section>
      )}

      {course && (
        <>
          <header className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gold">{course.schoolName}</p>
            <h1 className="text-xl font-bold text-ink">{course.title}</h1>
            <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuenow={course.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${course.progressPercent}%` }} />
            </div>
            <p className="text-xs text-ink-500">{course.progressPercent}% complete</p>
          </header>
          <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
            <nav aria-label="Lessons" className="space-y-4">
              {course.modules.map((m, mi) => (
                <div key={m.id} className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                    {mi + 1}. {m.title}
                  </p>
                  <ul className="space-y-1">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          aria-current={l.id === lessonId ? "true" : undefined}
                          onClick={() => setLessonId(l.id)}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                            l.id === lessonId ? "border-gold bg-gold/10" : "border-[var(--border-faint)] hover:border-gold/40"
                          }`}
                        >
                          {l.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green" aria-label="Complete" /> : <Circle className="h-4 w-4 shrink-0 text-ink-500" aria-label="Not done" />}
                          <span className="min-w-0 flex-1 truncate text-ink">{l.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <section className={`${card} p-4 sm:p-5`}>{current ? <Player lesson={current} onChanged={() => void load()} /> : <p className="text-sm text-ink-500">This course has no lessons yet.</p>}</section>
          </div>
        </>
      )}
    </div>
  );
}
