"use client";

import type { AiringPlay, PostView } from "@peebee/shared";
import { Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@peebee/shared";
import { api, errorMessage } from "../../lib/api";
import { KIND_LABEL } from "./AiringCountdown";

/** How far the picture may drift from the clock before it is snapped back into step. */
const DRIFT_SECONDS = 2.5;

/**
 * Plays a broadcast or premiere in step with everyone else. The server says which video is on and how far in it
 * is; this player starts there, keeps itself on the clock, and asks again when a video ends to move to the next
 * one. There is no scrubbing: nobody can skip ahead of the others.
 */
export function AiringPlayer({ post, muted, fullscreen, onEnded }: { post: PostView; muted: boolean; fullscreen: boolean; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState<AiringPlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  // The server's clock minus this phone's, so a wrong phone clock does not put anyone out of step.
  const skew = useRef(0);
  const itemStartMs = useRef(0);
  const frame = fullscreen ? "absolute inset-0" : "relative aspect-[4/5] w-full overflow-hidden rounded-3xl";

  /** Asks the server which video is on and how far in it is, then plays it from there. */
  const load = useCallback(() => {
    const asked = Date.now();
    return api.airingPlay(post.id).then(
      (p) => {
        skew.current = new Date(p.serverNow).getTime() - (asked + Date.now()) / 2;
        // When this video began on the clock: now, minus how far in it is.
        itemStartMs.current = new Date(p.serverNow).getTime() - p.item.offsetSeconds * 1000;
        setPlay(p);
        setError(null);
      },
      (err) => {
        if (err instanceof ApiError && (err.status === 410 || err.code === "ended" || err.code === "not_started")) { onEnded(); return; }
        setError(errorMessage(err));
      },
    );
  }, [post.id, onEnded]);

  useEffect(() => { void load(); }, [load]);
  const src = play ? (play.playback.hlsUrl ?? play.playback.mp4Url) : undefined;

  // Attach the video and start it at the right second.
  useEffect(() => {
    const v = ref.current;
    if (!v || !play) return;
    if (!src) return;
    let destroy: (() => void) | null = null;
    let cancelled = false;
    const expected = () => (Date.now() + skew.current - itemStartMs.current) / 1000;
    const start = () => {
      if (cancelled) return;
      try { v.currentTime = Math.max(0, Math.min(expected(), play.item.durationSeconds - 0.5)); } catch { /* the first frames are not ready yet */ }
      void v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    };
    v.addEventListener("loadedmetadata", start, { once: true });
    if (play.playback.hlsUrl && !v.canPlayType("application/vnd.apple.mpegurl")) {
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls({ startPosition: Math.max(0, expected()) });
        hls.loadSource(src);
        hls.attachMedia(v);
        destroy = () => hls.destroy();
      });
    } else {
      v.src = src;
    }
    const watch = setInterval(() => {
      if (v.readyState < 2) return;
      const want = expected();
      if (want >= play.item.durationSeconds - 0.3) { void load(); return; }
      if (Math.abs(v.currentTime - want) > DRIFT_SECONDS) { try { v.currentTime = want; } catch { /* try next time */ } }
      if (v.paused && !needsTap) void v.play().catch(() => undefined);
    }, 4000);
    const ended = () => void load();
    v.addEventListener("ended", ended);
    return () => { cancelled = true; clearInterval(watch); v.removeEventListener("loadedmetadata", start); v.removeEventListener("ended", ended); destroy?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return (
    <div className={`${frame} bg-black`}>
      <video ref={ref} poster={play?.playback.posterUrl ?? post.media.coverUrl ?? undefined} muted={muted} playsInline autoPlay className="h-full w-full object-cover" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
        <Radio className="h-3 w-3 text-red-500" aria-hidden /> {play ? (play.kind === "premiere" ? "PREMIERE" : "ON AIR") : KIND_LABEL[post.event?.kind ?? "broadcast"].toUpperCase()}
      </span>
      {play && play.item.count > 1 && (
        <span className="absolute left-3 top-[4.6rem] max-w-[70%] truncate rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">Now: {play.item.title}</span>
      )}
      {play?.upNext && (
        <span className="absolute left-3 top-[6.6rem] max-w-[70%] truncate rounded-full bg-black/40 px-3 py-1 text-[10px] font-medium text-white/85">Up next: {play.upNext}</span>
      )}
      {needsTap && (
        <button type="button" onClick={() => { void ref.current?.play().then(() => setNeedsTap(false)).catch(() => undefined); }} className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-bold text-white">Tap to watch</button>
      )}
      {play && !src && <p role="alert" className="absolute inset-x-6 bottom-24 rounded-2xl bg-red-600/90 px-4 py-3 text-center text-sm font-semibold text-white">This video cannot be played right now.</p>}
      {error && <p role="alert" className="absolute inset-x-6 bottom-24 rounded-2xl bg-red-600/90 px-4 py-3 text-center text-sm font-semibold text-white">{error}</p>}
    </div>
  );
}
