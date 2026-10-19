"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useRef, useState } from "react";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A player made for a phone: big play button, 15-second skips, speed, and a scrubber. */
export function AudioPlayer({ src, art, onEnded }: { src: string; art?: React.ReactNode; onEnded?: () => void }) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [speed, setSpeed] = useState(1);

  const toggle = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  const skip = (by: number) => {
    if (el.current) el.current.currentTime = Math.max(0, Math.min(length || Infinity, el.current.currentTime + by));
  };
  const cycle = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (el.current) el.current.playbackRate = next;
  };

  return (
    <div className="space-y-6 rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 text-center shadow-sm">
      {art && <div className="mx-auto w-48 overflow-hidden rounded-2xl">{art}</div>}
      <audio
        ref={el}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
      />
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={length || 0}
          step={0.5}
          value={time}
          aria-label="Position"
          onChange={(e) => {
            if (el.current) el.current.currentTime = Number(e.target.value);
          }}
          className="w-full accent-[rgb(var(--color-gold))]"
        />
        <div className="flex justify-between text-xs tabular-nums text-ink-500">
          <span>{clock(time)}</span>
          <span>{length ? clock(length) : "--:--"}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink">
          <RotateCcw className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-ink-gold shadow">
          {playing ? <Pause className="h-7 w-7" aria-hidden /> : <Play className="h-7 w-7 translate-x-0.5" aria-hidden />}
        </button>
        <button type="button" onClick={() => skip(15)} aria-label="Forward 15 seconds" className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink">
          <RotateCw className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={cycle} className="rounded-full border border-[var(--border-faint)] px-3 py-1 text-xs font-bold text-ink">
        {speed}× speed
      </button>
    </div>
  );
}
