"use client";

import type { AiringView, PostView } from "@peebee/shared";
import { Bell, BellRing, CalendarClock, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export const KIND_LABEL: Record<AiringView["kind"], string> = { broadcast: "Broadcast", premiere: "Premiere" };

/** "2d 4h", "3h 12m", "4:09" — as precise as it needs to be for how far away it is. */
export function countdownText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function whenText(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Shown before a broadcast or premiere starts: what it is, when, a countdown, and a Remind me button. When the
 * clock reaches zero it asks for the post again, which by then says it is on air.
 */
export function AiringCountdown({ post, event, fullscreen, onStarted }: { post: PostView; event: AiringView; fullscreen: boolean; onStarted: () => void }) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [remind, setRemind] = useState({ on: event.remindMe, count: event.reminders });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const left = new Date(event.startsAt).getTime() - now;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Once it is time, keep asking until the server says it is on air (a few seconds at most).
  useEffect(() => {
    if (left > 0) return;
    onStarted();
    const t = setInterval(onStarted, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left > 0]);

  async function toggle() {
    if (!user) { window.location.href = "/login"; return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api.airingRemind(post.id, !remind.on);
      setRemind({ on: r.remindMe, count: r.reminders });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // "absolute" and "relative" must not both be on one element: whichever the stylesheet lists last would win.
  const frame = fullscreen ? "absolute inset-0" : "relative aspect-[4/5] w-full overflow-hidden rounded-3xl";
  const label = KIND_LABEL[event.kind];
  return (
    <div className={`${frame} flex flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-center text-white ${fullscreen ? "pr-20" : ""}`}>
      {post.media.coverUrl && <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${post.media.coverUrl})` }} aria-hidden />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" aria-hidden />
      <div className="relative flex w-full max-w-xs flex-col items-center gap-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-gold"><Radio className="h-3.5 w-3.5" aria-hidden />{label}</span>
        <h2 className="text-xl font-extrabold leading-tight">{event.title || post.caption}</h2>
        <div role="timer" aria-label={`Starts in ${countdownText(left)}`} className="text-5xl font-extrabold tabular-nums">{left > 0 ? countdownText(left) : "Starting…"}</div>
        <p className="inline-flex items-center gap-1.5 text-sm text-white/80"><CalendarClock className="h-4 w-4" aria-hidden />{whenText(event.startsAt)}</p>
        {!post.isMine ? (
          <button type="button" disabled={busy} onClick={() => void toggle()} aria-pressed={remind.on} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${remind.on ? "bg-white/90 text-ink" : "bg-gold text-ink-gold"}`}>
            {remind.on ? <><BellRing className="h-4 w-4" aria-hidden />Reminder set</> : <><Bell className="h-4 w-4" aria-hidden />Remind me</>}
          </button>
        ) : (
          <p className="text-sm font-semibold text-white/80">{remind.count} {remind.count === 1 ? "person wants" : "people want"} a reminder</p>
        )}
        {error && <p role="alert" className="rounded-xl bg-red-600/90 px-3 py-2 text-xs font-semibold">{error}</p>}
      </div>
    </div>
  );
}
