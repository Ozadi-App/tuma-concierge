"use client";

import type { LearnerLessonDetail, QuizAnswer, QuizAttemptStart, QuizResult, ServedQuestion } from "@peebee/shared";
import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tvApi } from "../lib/api";
import { useDevice } from "../lib/device";
import { useBack } from "../lib/dpad";
import { Qr } from "./JoinCard";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const TYPED = new Set(["fill_blank", "short_answer"]);
const choice = "group flex w-full items-center gap-[1rem] rounded-[1.1rem] border-2 border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1rem] text-left focus:bg-gold focus:text-ink-gold disabled:opacity-60";
const pill = "rounded-full bg-gold px-[1.8rem] py-[0.7rem] text-[1.3rem] font-bold text-ink-gold";

type Result = { ok: true } & QuizResult;

function Letter({ i, on }: { i: number; on?: boolean }) {
  return <span className={`flex h-[2.6rem] w-[2.6rem] shrink-0 items-center justify-center rounded-full text-[1.3rem] font-black ${on ? "bg-green text-ink-gold" : "bg-gold text-ink-gold group-focus:bg-ink-gold group-focus:text-gold"}`}>{LETTERS[i]}</span>;
}

/**
 * A quiz or exam, one question at a time. Questions that need typing are done on the phone; everything else works with the
 * remote. Marking happens on Peebee's side, so the answers are never on the TV.
 */
export function Quiz({
  lesson,
  phoneUrl,
  onPassed,
  onClose,
  next,
}: {
  lesson: LearnerLessonDetail;
  /** Where the same quiz can be opened on a phone. */
  phoneUrl: string;
  onPassed: () => void;
  onClose: () => void;
  next: { label: string; go: () => void };
}) {
  const info = lesson.quiz!;
  const { secret } = useDevice();
  const [attempt, setAttempt] = useState<QuizAttemptStart | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useBack(onClose, { exclusive: true });

  const start = useCallback(async () => {
    if (!secret) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tvApi.startQuiz(secret, lesson.id);
      setAttempt(res);
      setAnswers({});
      setIndex(0);
      setResult(null);
      setLeft(res.timeLimitMinutes > 0 ? res.timeLimitMinutes * 60 : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start.");
    } finally {
      setBusy(false);
    }
  }, [secret, lesson.id]);

  const submit = useCallback(
    async (final: Record<string, QuizAnswer>) => {
      if (!secret || !attempt) return;
      setBusy(true);
      setError(null);
      try {
        const res = await tvApi.submitQuiz(secret, lesson.id, attempt.attemptToken, final);
        setResult(res);
        if (res.passed) onPassed();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send your answers.");
      } finally {
        setBusy(false);
      }
    },
    [secret, attempt, lesson.id, onPassed],
  );

  // A timed paper sends what it has when the time is up.
  useEffect(() => {
    if (left === null || result || !attempt) return;
    if (left <= 0) {
      void submit(answers);
      return;
    }
    const t = setTimeout(() => setLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, result, attempt, answers, submit]);

  // Whenever the screen changes between intro, questions and results, the old buttons are gone: put the remote on the new first one.
  const stage = result ? "result" : attempt ? `q${index}` : "intro";
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-quiz-first]")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  const q: ServedQuestion | undefined = attempt?.questions[index];
  const set = (id: string, v: QuizAnswer) => setAnswers((a) => ({ ...a, [id]: v }));
  const advance = (final: Record<string, QuizAnswer> = answers) => {
    if (!attempt) return;
    if (index + 1 < attempt.questions.length) setIndex(index + 1);
    else void submit(final);
  };
  const hasTyped = useMemo(() => attempt?.questions.some((x) => TYPED.has(x.type)) ?? false, [attempt]);

  // Number keys answer single-choice questions: 1 is A, 2 is B, and so on.
  useEffect(() => {
    if (!q || q.type !== "single" || busy) return;
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= (q.options?.length ?? 0)) {
        const final = { ...answers, [q.id]: n - 1 };
        setAnswers(final);
        advance(final);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!attempt && !result) {
    const attemptsLeft = info.attemptsAllowed > 0 ? Math.max(0, info.attemptsAllowed - info.attemptsUsed) : null;
    return (
      <section className="space-y-[1.4rem]">
        <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">{lesson.contentType === "exam" ? "Exam" : "Quiz"}</p>
        <h2 className="text-[3rem] font-black leading-tight text-ink">{info.title || lesson.title}</h2>
        <p className="text-[1.4rem] text-ink-500">
          {info.questionCount} questions · pass mark {info.passingScorePercent}%
          {info.timeLimitMinutes > 0 ? ` · ${info.timeLimitMinutes} minutes` : ""}
          {attemptsLeft !== null ? ` · ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left` : ""}
        </p>
        {error && <p role="alert" className="text-[1.2rem] text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-[1rem]">
          <button type="button" data-focusable data-quiz-first disabled={busy || attemptsLeft === 0} onClick={() => void start()} className={`${pill} disabled:opacity-50`}>
            {busy ? "Starting…" : attemptsLeft === 0 ? "No attempts left" : "Start"}
          </button>
          <button type="button" data-focusable onClick={onClose} className="rounded-full border border-[var(--border-faint)] px-[1.6rem] py-[0.7rem] text-[1.2rem] font-bold text-ink focus:bg-gold focus:text-ink-gold">
            Back
          </button>
        </div>
      </section>
    );
  }

  if (result && attempt) {
    return (
      <section aria-live="polite" className="space-y-[1.4rem]">
        <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">{attempt.title}</p>
        <h2 className={`text-[3.6rem] font-black leading-tight ${result.passed ? "text-green" : "text-ink"}`}>{result.passed ? `Well done! ${result.scorePercent}%` : `You scored ${result.scorePercent}%`}</h2>
        <p className="text-[1.4rem] text-ink-500">{result.passed ? "You passed." : `You need ${result.passMark}% to pass.`}</p>
        <ol className="grid grid-cols-2 gap-[0.7rem]">
          {result.results.map((r, i) => (
            <li key={r.id} className="flex items-start gap-[0.8rem] rounded-[1rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[0.9rem]">
              {r.correct ? <CheckCircle2 className="mt-[0.2rem] h-[1.4rem] w-[1.4rem] shrink-0 text-green" aria-label="Right" /> : <XCircle className="mt-[0.2rem] h-[1.4rem] w-[1.4rem] shrink-0 text-red-400" aria-label="Wrong" />}
              <span className="min-w-0 text-[1.05rem] leading-snug">
                <span className="font-bold text-ink">{attempt.questions[i]?.question}</span>
                {!r.correct && r.reveal && <span className="mt-[0.2rem] block text-ink-500">Answer: {r.reveal.answer}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-[1rem]">
          {result.passed ? (
            <button type="button" data-focusable data-quiz-first onClick={next.go} className={pill}>{next.label}</button>
          ) : result.attemptsAllowed === 0 || result.attemptsUsed < result.attemptsAllowed ? (
            <button type="button" data-focusable data-quiz-first onClick={() => void start()} className={pill}>Try again</button>
          ) : null}
          <button type="button" data-focusable data-quiz-first={!result.passed && result.attemptsAllowed > 0 && result.attemptsUsed >= result.attemptsAllowed ? true : undefined} onClick={onClose} className="rounded-full border border-[var(--border-faint)] px-[1.6rem] py-[0.7rem] text-[1.2rem] font-bold text-ink focus:bg-gold focus:text-ink-gold">
            Back to the lesson
          </button>
        </div>
      </section>
    );
  }

  // Typed answers can't be given with a remote.
  if (hasTyped) {
    return (
      <section className="flex items-center gap-[2rem]">
        <div className="min-w-0 flex-1 space-y-[1rem]">
          <h2 className="text-[2.4rem] font-black text-ink">This one has typed answers</h2>
          <p className="text-[1.3rem] text-ink-500">Scan the code to take it on your phone, where you can type. Your result shows here too.</p>
          <button type="button" data-focusable data-quiz-first onClick={onClose} className={pill}>Back</button>
        </div>
        <div className="w-[13rem] shrink-0"><Qr value={phoneUrl} label="QR code that opens this quiz on your phone" className="aspect-square w-full" /></div>
      </section>
    );
  }

  const cur = q!;
  const clock = left === null ? "" : ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const last = index + 1 === attempt!.questions.length;
  const value = answers[cur.id];

  return (
    <section aria-label="Quiz" className="space-y-[1.4rem]">
      <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">
        {attempt!.title} · Question {index + 1} of {attempt!.questions.length}
        {clock}
      </p>
      <h2 className="text-[2.6rem] font-black leading-[1.15] text-ink">{cur.question}</h2>

      {cur.type === "single" && (
        <ul className="grid grid-cols-2 gap-[0.9rem]">
          {cur.options!.map((o, i) => (
            <li key={i}>
              <button type="button" data-focusable data-quiz-first={i === 0 ? true : undefined} disabled={busy} onClick={() => { const final = { ...answers, [cur.id]: i }; setAnswers(final); advance(final); }} className={choice}>
                <Letter i={i} />
                <span className="text-[1.5rem] font-bold leading-tight">{o}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cur.type === "true_false" && (
        <ul className="grid grid-cols-2 gap-[0.9rem]">
          {[true, false].map((b, i) => (
            <li key={String(b)}>
              <button type="button" data-focusable data-quiz-first={i === 0 ? true : undefined} disabled={busy} onClick={() => { const final = { ...answers, [cur.id]: b }; setAnswers(final); advance(final); }} className={`${choice} justify-center text-[1.8rem] font-black`}>
                {b ? "True" : "False"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {cur.type === "multiple" && (
        <>
          <p className="text-[1.1rem] text-ink-500">Choose every right answer, then press Next.</p>
          <ul className="grid grid-cols-2 gap-[0.9rem]">
            {cur.options!.map((o, i) => {
              const picked = Array.isArray(value) ? value : [];
              const on = picked.includes(i);
              return (
                <li key={i}>
                  <button type="button" data-focusable data-quiz-first={i === 0 ? true : undefined} aria-pressed={on} onClick={() => set(cur.id, on ? picked.filter((p) => p !== i) : [...picked, i])} className={choice}>
                    <Letter i={i} on={on} />
                    <span className="text-[1.5rem] font-bold leading-tight">{o}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {cur.type === "ordering" && (() => {
        const order = Array.isArray(value) ? (value as number[]) : cur.options!.map((_, i) => i);
        const move = (from: number, by: number) => {
          const to = from + by;
          if (to < 0 || to >= order.length) return;
          const nextOrder = [...order];
          [nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];
          set(cur.id, nextOrder);
        };
        return (
          <>
            <p className="text-[1.1rem] text-ink-500">Put these in the right order, then press Next.</p>
            <ul className="space-y-[0.6rem]">
              {order.map((pos, i) => (
                <li key={pos} className="flex items-center gap-[0.8rem]">
                  <span className="flex h-[2.4rem] w-[2.4rem] items-center justify-center rounded-full bg-gold text-[1.2rem] font-black text-ink-gold">{i + 1}</span>
                  <span className="min-w-0 flex-1 rounded-[0.9rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-[1rem] py-[0.6rem] text-[1.3rem] font-bold">{cur.options![pos]}</span>
                  <button type="button" data-focusable data-quiz-first={i === 0 ? true : undefined} aria-label="Move up" onClick={() => move(i, -1)} className="rounded-full border border-[var(--border-faint)] p-[0.6rem] focus:bg-gold focus:text-ink-gold"><ArrowUp className="h-[1.2rem] w-[1.2rem]" aria-hidden /></button>
                  <button type="button" data-focusable aria-label="Move down" onClick={() => move(i, 1)} className="rounded-full border border-[var(--border-faint)] p-[0.6rem] focus:bg-gold focus:text-ink-gold"><ArrowDown className="h-[1.2rem] w-[1.2rem]" aria-hidden /></button>
                </li>
              ))}
            </ul>
          </>
        );
      })()}

      {cur.type === "matching" && (() => {
        const picks = Array.isArray(value) ? (value as number[]) : cur.left!.map(() => -1);
        return (
          <>
            <p className="text-[1.1rem] text-ink-500">Press OK on an item to cycle through its partners, then press Next.</p>
            <ul className="grid grid-cols-2 gap-[0.7rem]">
              {cur.left!.map((l, i) => (
                <li key={i}>
                  <button
                    type="button"
                    data-focusable
                    data-quiz-first={i === 0 ? true : undefined}
                    onClick={() => {
                      const nextPicks = [...picks];
                      nextPicks[i] = (picks[i] + 1) % cur.right!.length;
                      set(cur.id, nextPicks);
                    }}
                    className={choice}
                  >
                    <span className="text-[1.3rem] font-bold">{l}</span>
                    <span className="ml-auto rounded-full bg-gold/20 px-[0.9rem] py-[0.2rem] text-[1.2rem] font-bold">{picks[i] >= 0 ? cur.right![picks[i]] : "Choose…"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        );
      })()}

      {(cur.type === "multiple" || cur.type === "ordering" || cur.type === "matching") && (
        <button type="button" data-focusable disabled={busy} onClick={() => advance()} className={`${pill} disabled:opacity-60`}>
          {last ? (busy ? "Marking…" : "Submit") : "Next"}
        </button>
      )}

      <p className="text-[1.05rem] text-ink-500">{busy ? "Marking your answers…" : "Use the arrow keys and OK. Press Back to leave."}</p>
      {error && (
        <div className="space-y-[0.6rem]">
          <p role="alert" className="text-[1.2rem] text-red-400">{error}</p>
          <button type="button" data-focusable onClick={() => void submit(answers)} className={pill}>Send answers again</button>
        </div>
      )}
    </section>
  );
}
