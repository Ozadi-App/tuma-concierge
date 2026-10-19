"use client";

import type { LearnerLesson, QuizResult } from "@peebee/shared";
import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { tvApi } from "../lib/api";
import { useDevice } from "../lib/device";
import { useBack } from "../lib/dpad";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Result = { ok: true } & QuizResult;

/**
 * A lesson's quiz, one question at a time. Pick an answer with the remote (or press 1 to 6); the last answer sends them
 * all to Peebee to be marked. Marking happens on Peebee's side, so the answers are never on the TV.
 */
export function Quiz({
  lesson,
  onPassed,
  onClose,
  next,
}: {
  lesson: LearnerLesson;
  onPassed: () => void;
  onClose: () => void;
  /** What to offer after passing: the next lesson, if there is one. */
  next: { label: string; go: () => void };
}) {
  const quiz = lesson.quiz!;
  const { secret } = useDevice();
  const total = quiz.questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => quiz.questions.map(() => -1));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBack(onClose, { exclusive: true });

  const submit = useCallback(
    async (final: number[]) => {
      if (!secret) return;
      setBusy(true);
      setError(null);
      try {
        const res = await tvApi.quiz(secret, lesson.id, final);
        setResult(res);
        if (res.passed) onPassed();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send your answers.");
      } finally {
        setBusy(false);
      }
    },
    [secret, lesson.id, onPassed],
  );

  const choose = useCallback(
    (option: number) => {
      if (busy) return;
      const updated = answers.map((a, i) => (i === index ? option : a));
      setAnswers(updated);
      if (index + 1 < total) setIndex(index + 1);
      else void submit(updated);
    },
    [answers, busy, index, submit, total],
  );

  // Number keys answer too: 1 is A, 2 is B, and so on.
  useEffect(() => {
    if (result) return;
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= (quiz.questions[index]?.options.length ?? 0)) choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, index, quiz.questions, result]);

  // Each time the quiz switches between its questions and its results, the old buttons are gone: put the remote on the new first one.
  const showingResult = result !== null;
  useEffect(() => {
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-quiz-first]")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showingResult]);

  function retry() {
    setAnswers(quiz.questions.map(() => -1));
    setIndex(0);
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <section aria-live="polite" className="space-y-[1.4rem]">
        <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">{quiz.title}</p>
        <h2 className={`text-[3.6rem] font-black leading-tight ${result.passed ? "text-green" : "text-ink"}`}>{result.passed ? `Well done! ${result.scorePercent}%` : `You scored ${result.scorePercent}%`}</h2>
        <p className="text-[1.4rem] text-ink-500">{result.passed ? "You passed. This lesson is complete." : `You need ${result.passMark}% to pass. Have another go.`}</p>
        <ol className="grid grid-cols-2 gap-[0.7rem]">
          {quiz.questions.map((q, i) => {
            const r = result.results[i];
            return (
              <li key={i} className="flex items-start gap-[0.8rem] rounded-[1rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[0.9rem]">
                {r?.correct ? <CheckCircle2 className="mt-[0.2rem] h-[1.4rem] w-[1.4rem] shrink-0 text-green" aria-label="Right" /> : <XCircle className="mt-[0.2rem] h-[1.4rem] w-[1.4rem] shrink-0 text-red-400" aria-label="Wrong" />}
                <span className="min-w-0 text-[1.05rem] leading-snug">
                  <span className="font-bold text-ink">{q.question}</span>
                  {result.passed && r?.correctIndex !== undefined && (
                    <span className="mt-[0.2rem] block text-ink-500">
                      Answer: {q.options[r.correctIndex]}
                      {r.explanation ? `. ${r.explanation}` : ""}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-[1rem]">
          {result.passed ? (
            <button type="button" data-focusable data-quiz-first onClick={next.go} className="rounded-full bg-gold px-[1.8rem] py-[0.7rem] text-[1.3rem] font-bold text-ink-gold">
              {next.label}
            </button>
          ) : (
            <button type="button" data-focusable data-quiz-first onClick={retry} className="rounded-full bg-gold px-[1.8rem] py-[0.7rem] text-[1.3rem] font-bold text-ink-gold">
              Try again
            </button>
          )}
          <button type="button" data-focusable onClick={onClose} className="rounded-full border border-[var(--border-faint)] px-[1.6rem] py-[0.7rem] text-[1.2rem] font-bold text-ink focus:bg-gold focus:text-ink-gold">
            Back to the lesson
          </button>
        </div>
      </section>
    );
  }

  const q = quiz.questions[index]!;
  return (
    <section aria-label="Quiz" className="space-y-[1.4rem]">
      <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">
        {quiz.title} · Question {index + 1} of {total}
      </p>
      <h2 className="text-[2.6rem] font-black leading-[1.15] text-ink">{q.question}</h2>
      <ul className="grid grid-cols-2 gap-[0.9rem]">
        {q.options.map((option, i) => (
          <li key={i}>
            <button
              type="button"
              data-focusable
              data-quiz-first={i === 0 ? true : undefined}
              disabled={busy}
              onClick={() => choose(i)}
              className="group flex w-full items-center gap-[1rem] rounded-[1.1rem] border-2 border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1rem] text-left focus:bg-gold focus:text-ink-gold disabled:opacity-60"
            >
              <span className="flex h-[2.6rem] w-[2.6rem] shrink-0 items-center justify-center rounded-full bg-gold text-[1.3rem] font-black text-ink-gold group-focus:bg-ink-gold group-focus:text-gold">{LETTERS[i]}</span>
              <span className="text-[1.5rem] font-bold leading-tight">{option}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[1.05rem] text-ink-500">{busy ? "Marking your answers…" : "Choose an answer with the arrow keys and OK. Press Back to leave the quiz."}</p>
      {error && (
        <div className="space-y-[0.6rem]">
          <p role="alert" className="text-[1.2rem] text-red-400">
            {error}
          </p>
          <button type="button" data-focusable onClick={() => void submit(answers)} className="rounded-full bg-gold px-[1.6rem] py-[0.6rem] text-[1.2rem] font-bold text-ink-gold">
            Send answers again
          </button>
        </div>
      )}
    </section>
  );
}
