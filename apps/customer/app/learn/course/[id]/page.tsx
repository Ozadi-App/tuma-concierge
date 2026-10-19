"use client";

import type { LearnerCourse, LearnerLesson } from "@peebee/shared";
import { ApiError } from "@peebee/shared";
import { LearnThumb } from "@peebee/shared/learn-thumb";
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, Play } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KIND_ICON, KIND_LABEL, metaLine } from "../../../../components/learn/kinds";
import { api, errorMessage } from "../../../../lib/api";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const ugx = (n: number) => (n > 0 ? `UGX ${n.toLocaleString("en-UG")}` : "Free");

type Preview = { title: string; summary: string; priceUgx: number; schoolName: string; outcomes: string[]; lessonCount: number };

function Ring({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Class progress">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-[rgb(var(--surface-muted))]" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className="stroke-gold" style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">{percent}%</span>
    </div>
  );
}

function Row({ courseId, lesson }: { courseId: string; lesson: LearnerLesson }) {
  const Icon = KIND_ICON[lesson.contentType];
  const assessment = lesson.contentType === "quiz" || lesson.contentType === "exam";
  if (lesson.locked) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 opacity-60" aria-disabled="true">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink-500">
          <Lock className="h-5 w-5" aria-label="Locked" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{lesson.title}</span>
          <span className="block truncate text-xs text-ink-500">{lesson.locked.message}</span>
        </span>
      </div>
    );
  }
  return (
    <Link href={`/learn/course/${courseId}/lesson/${lesson.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-[rgb(var(--surface-muted))]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${lesson.completed ? "bg-green/15 text-green" : assessment ? "bg-gold/20 text-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>
        {lesson.completed ? <CheckCircle2 className="h-5 w-5" aria-label="Done" /> : <Icon className="h-5 w-5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{lesson.title}</span>
        <span className="block truncate text-xs text-ink-500">
          {KIND_LABEL[lesson.contentType]} · {metaLine(lesson)}
          {lesson.bestScorePercent !== null && assessment ? ` · best ${lesson.bestScorePercent}%` : ""}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
    </Link>
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
  const [loaded, setLoaded] = useState(false);
  const [prerequisite, setPrerequisite] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.learnCourse(id);
      setCourse(res.course);
      setPreview(null);
      setError(null);
    } catch (err) {
      setCourse(null);
      if (err instanceof ApiError && err.status === 403) {
        try {
          const info = await api.getCatalogCourse(id);
          const c = info.course;
          setPrerequisite(c.prerequisite ?? null);
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
      setEnrolError(errorMessage(err));
      setNeedsFunds(err instanceof ApiError && err.status === 402);
    } finally {
      setBusy(false);
    }
  }

  const items = useMemo(() => course?.modules.flatMap((m) => m.lessons) ?? [], [course]);
  const resume = items.find((l) => !l.completed && !l.locked) ?? items.find((l) => !l.locked) ?? null;
  const started = items.some((l) => l.completed);
  const allDone = items.length > 0 && items.every((l) => l.completed);

  if (!loaded) return <div className="mx-auto max-w-3xl p-4"><div className="h-64 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-28">
      <Link href="/learn/my" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> My learning
      </Link>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      {preview && (
        <section className={`${card} space-y-4 overflow-hidden`}>
          <LearnThumb src={api.learnArtUrl("course", id)} className="max-w-xl" />
          <div className="space-y-4 px-5 pb-5">
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
              <Lock className="h-3.5 w-3.5" aria-hidden /> {preview.lessonCount} items unlock when you enrol
            </p>
            {prerequisite && (
              <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-ink">
                Before you join, finish{" "}
                <Link href={`/learn/course/${prerequisite.id}`} className="font-semibold underline">
                  {prerequisite.title}
                </Link>
                .
              </p>
            )}
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
          </div>
        </section>
      )}

      {course && (
        <>
          <header className={`${card} overflow-hidden`}>
            <LearnThumb src={api.learnArtUrl("course", id)} className="max-w-none" />
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gold">{course.schoolName}</p>
                  <h1 className="text-xl font-bold leading-tight text-ink">{course.title}</h1>
                </div>
                <Ring percent={course.progressPercent} />
              </div>
              {course.summary && <p className="text-sm text-ink-500">{course.summary}</p>}
              <p className="text-xs text-ink-500">
                {course.modules.length} section{course.modules.length === 1 ? "" : "s"} · {items.length} item{items.length === 1 ? "" : "s"}
              </p>
            </div>
          </header>

          {course.certificateId && (
            <Link href={`/learn/certificates/${course.certificateId}`} className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
              <span className="text-2xl" aria-hidden>🎓</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">You finished this class!</span>
                <span className="block text-xs text-ink-500">View your certificate</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
            </Link>
          )}

          {items.length === 0 && <p className="text-sm text-ink-500">This class has no lessons yet.</p>}

          {course.modules.map((m, mi) => {
            const done = m.lessons.filter((l) => l.completed).length;
            return (
              <section key={m.id} aria-label={m.title} className={`${card} overflow-hidden`}>
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-faint)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Section {mi + 1}</p>
                    <h2 className="truncate text-base font-bold text-ink">{m.title}</h2>
                    {m.opensAt && <p className="text-xs text-ink-500">Opens {new Date(m.opensAt).toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short" })}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-ink-500">
                    {done}/{m.lessons.length}
                  </span>
                </div>
                <div className="divide-y divide-[var(--border-faint)]">
                  {m.lessons.map((l) => (
                    <Row key={l.id} courseId={id} lesson={l} />
                  ))}
                </div>
              </section>
            );
          })}

          {resume && (
            <div className="fixed inset-x-0 bottom-20 z-30 px-4">
              <Link href={`/learn/course/${id}/lesson/${resume.id}`} className="mx-auto flex max-w-2xl items-center justify-center gap-2 rounded-full bg-gold px-5 py-4 text-base font-bold text-ink-gold shadow-lg">
                <Play className="h-4 w-4" aria-hidden /> {allDone ? "Review from the start" : started ? "Continue" : "Start learning"}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
