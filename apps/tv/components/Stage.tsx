"use client";

import type { ScreenCue, ScreenState } from "@peebee/shared";
import { useEffect, useRef, useState } from "react";
import { clock, useCountdown } from "../lib/time";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function Heading({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <header className="space-y-[0.5rem]">
      <p className="text-[1rem] font-bold uppercase tracking-[0.2em] text-gold">{kicker}</p>
      <h1 className="text-[3.2rem] font-black leading-[1.08] text-ink">{children}</h1>
    </header>
  );
}

function Leaders({ leaders, unit }: { leaders: NonNullable<ScreenCue["leaders"]>; unit: string }) {
  if (leaders.length === 0) return null;
  return (
    <section aria-label="Top scores" className="rounded-[1.3rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1.1rem]">
      <p className="mb-[0.6rem] text-[0.9rem] font-bold uppercase tracking-[0.18em] text-gold">Top scores</p>
      <ol className="space-y-[0.4rem]">
        {leaders.map((l, i) => (
          <li key={`${l.name}-${i}`} className="flex items-center justify-between gap-4 text-[1.3rem]">
            <span className="flex items-center gap-3 font-bold text-ink">
              <span className="flex h-[2rem] w-[2rem] items-center justify-center rounded-full bg-gold text-[1rem] font-black text-ink-gold">{i + 1}</span>
              {l.name}
            </span>
            <span className="font-black text-ink">
              {l.points}
              {l.outOf ? ` / ${l.outOf}` : ""} <span className="text-[0.9rem] font-medium text-ink-500">{unit}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Options({ cue }: { cue: ScreenCue }) {
  const counts = cue.counts;
  const total = counts ? counts.reduce((n, v) => n + v, 0) : 0;
  const reveal = cue.revealed && !cue.poll;
  return (
    <ul className="grid grid-cols-2 gap-[1rem]">
      {(cue.options ?? []).map((option, i) => {
        const right = reveal && cue.correctIndex === i;
        const wrong = reveal && cue.correctIndex !== i;
        const share = counts && total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <li
            key={i}
            className={`relative overflow-hidden rounded-[1.2rem] border-2 p-[1.1rem] ${right ? "border-green bg-green/15" : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))]"} ${wrong ? "opacity-45" : ""}`}
          >
            {counts && <span aria-hidden className="absolute inset-y-0 left-0 bg-gold/20" style={{ width: `${share}%` }} />}
            <div className="relative flex items-center gap-[1rem]">
              <span className={`flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full text-[1.5rem] font-black ${right ? "bg-green text-ink-gold" : "bg-gold text-ink-gold"}`}>{LETTERS[i]}</span>
              <span className="text-[1.9rem] font-bold leading-tight text-ink">{option}</span>
              {counts && <span className="ml-auto text-[1.6rem] font-black text-ink">{counts[i]}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="space-y-[0.4rem]" role="progressbar" aria-valuenow={value} aria-valuemax={total} aria-label={label}>
      <div className="h-[1.1rem] overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
        <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[1.3rem] text-ink-500">
        <strong className="font-black text-ink">{value}</strong> of {total} {label}
      </p>
    </div>
  );
}

function Lesson({ cue, playback, soundOn }: { cue: ScreenCue; playback: ScreenState["playback"]; soundOn: boolean }) {
  const media = useRef<HTMLMediaElement>(null);
  const [muted, setMuted] = useState(!soundOn);
  const isAudio = cue.media?.contentType.startsWith("audio");

  // Follow the tutor's play, pause and seek.
  useEffect(() => {
    const el = media.current;
    if (!el) return;
    if (typeof playback?.at === "number" && Math.abs(el.currentTime - playback.at) > 1.5) el.currentTime = playback.at;
    if (playback?.playing === false) el.pause();
    else {
      el.play().catch(() => {
        // Some TVs refuse sound before a key press. Play silently rather than not at all.
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => undefined);
      });
    }
  }, [playback?.playing, playback?.at, playback?.updatedAt, cue.id]);

  return (
    <div className="flex h-full flex-col gap-[1.2rem]">
      <Heading kicker="Lesson">{cue.title}</Heading>
      {cue.media ? (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.4rem] bg-black">
          {isAudio ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-[2rem] text-ink-500">
              Listen to the lesson
              <audio ref={media as React.RefObject<HTMLAudioElement>} src={cue.media.url} autoPlay />
            </div>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={media as React.RefObject<HTMLVideoElement>} src={cue.media.url} playsInline muted={muted} autoPlay className="h-full w-full object-contain" />
          )}
          {playback?.playing === false && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[3rem] font-black text-ink">Paused</div>
          )}
        </div>
      ) : (
        cue.body && <p className="max-w-[60rem] whitespace-pre-line text-[2.2rem] leading-snug text-ink">{cue.body}</p>
      )}
    </div>
  );
}

export function StageCue({ cue, state, now, soundOn }: { cue: ScreenCue; state: ScreenState; now: () => number; soundOn: boolean }) {
  const left = useCountdown(cue.endsAt, now);
  switch (cue.kind) {
    case "slide":
      return (
        <div className="flex h-full flex-col gap-[1.4rem]">
          <Heading kicker="Slide">{cue.title}</Heading>
          {cue.body && <p className="max-w-[60rem] whitespace-pre-line text-[2.2rem] leading-snug text-ink">{cue.body}</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cue.imageUrl && <img src={cue.imageUrl} alt="" className="min-h-0 flex-1 rounded-[1.2rem] object-contain" />}
        </div>
      );
    case "lesson":
      return <Lesson cue={cue} playback={state.playback} soundOn={soundOn} />;
    case "announcement":
      return (
        <div className="flex h-full flex-col justify-center gap-[1.4rem]">
          <p className="text-[1.1rem] font-bold uppercase tracking-[0.2em] text-gold">Announcement</p>
          <p className="text-[4.4rem] font-black leading-[1.1] text-ink">{cue.text}</p>
        </div>
      );
    case "timer":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-[1.6rem] text-center">
          {cue.label && <p className="text-[2.6rem] font-bold text-ink">{cue.label}</p>}
          <p className={`font-mono text-[11rem] font-black leading-none ${left === 0 ? "text-gold" : "text-ink"}`} aria-live="off">
            {left === null ? clock(cue.seconds ?? 0) : clock(left)}
          </p>
          {left === 0 && <p className="text-[2.2rem] font-bold text-gold">Time&apos;s up</p>}
        </div>
      );
    case "question":
      return (
        <div className="flex h-full flex-col gap-[1.5rem]">
          <div className="flex items-start justify-between gap-6">
            <Heading kicker={cue.poll ? "Poll" : cue.revealed ? "Answer" : "Question"}>{cue.question}</Heading>
            {left !== null && cue.open && (
              <p className="shrink-0 rounded-full bg-gold px-[1.4rem] py-[0.5rem] font-mono text-[2.4rem] font-black text-ink-gold" aria-label="Time left">
                {clock(left)}
              </p>
            )}
          </div>
          <Options cue={cue} />
          {!cue.revealed && !cue.poll && <Progress value={cue.answered ?? 0} total={cue.total ?? 0} label="have answered" />}
          {cue.poll && <p className="text-[1.3rem] text-ink-500">{cue.answered ?? 0} votes</p>}
          {cue.revealed && cue.explanation && <p className="max-w-[60rem] text-[1.7rem] leading-snug text-ink-500">{cue.explanation}</p>}
          {cue.revealed && cue.leaders && <Leaders leaders={cue.leaders} unit="pts" />}
        </div>
      );
    case "exam":
      return (
        <div className="flex h-full flex-col justify-center gap-[2rem]">
          <Heading kicker={cue.revealed ? "Exam results" : "Exam in progress"}>{cue.title}</Heading>
          {!cue.revealed ? (
            <>
              {left !== null && <p className="font-mono text-[8rem] font-black leading-none text-ink">{clock(left)}</p>}
              <p className="text-[1.6rem] text-ink-500">{cue.questionCount} questions. Answer on your phone.</p>
              <Progress value={cue.submitted ?? 0} total={cue.total ?? 0} label="have handed in" />
            </>
          ) : (
            <>
              <p className="text-[1.8rem] text-ink-500">
                Class average <strong className="text-[3.4rem] font-black text-ink">{cue.average ?? 0}%</strong>
              </p>
              {cue.leaders && <Leaders leaders={cue.leaders} unit="marks" />}
            </>
          )}
        </div>
      );
    case "attendance":
      return (
        <div className="flex h-full flex-col justify-center gap-[2rem]">
          <Heading kicker="Attendance">Tap “I&apos;m here” on your phone</Heading>
          <p className="font-black leading-none text-ink">
            <span className="text-[9rem] text-gold">{cue.present ?? 0}</span>
            <span className="text-[3.5rem] text-ink-500"> of {cue.total ?? 0} are here</span>
          </p>
          <Progress value={cue.present ?? 0} total={cue.total ?? 0} label="checked in" />
        </div>
      );
  }
  return null;
}
