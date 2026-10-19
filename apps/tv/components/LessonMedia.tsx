"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const SEEK_SECONDS = 10;

/**
 * A lesson's video or audio. It plays on its own when the lesson opens. With the remote: OK plays or pauses,
 * left and right skip back and forward ten seconds, down moves to the buttons under the player, and up to the Back button. A mouse uses the
 * normal controls.
 */
export function LessonMedia({ url, audio, onEnded, onLeaveDown }: { url: string; audio: boolean; onEnded: () => void; onLeaveDown: () => void }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  // The remote controls whatever has focus, so the player takes it as soon as it appears: OK pauses, arrows skip.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const media = ref.current;
    if (!media) return;
    const key = event.key;
    if (key === "Enter" || key === " " || key === "MediaPlayPause") {
      event.preventDefault();
      event.stopPropagation();
      if (media.paused) void media.play().catch(() => setBlocked(true));
      else media.pause();
      setBlocked(false);
    } else if (key === "ArrowDown") {
      // Always lands on the first button under the player, however wide the player is.
      event.preventDefault();
      event.stopPropagation();
      onLeaveDown();
    } else if (key === "ArrowLeft" || key === "MediaRewind") {
      event.preventDefault();
      event.stopPropagation();
      media.currentTime = Math.max(0, media.currentTime - SEEK_SECONDS);
    } else if (key === "ArrowRight" || key === "MediaFastForward") {
      event.preventDefault();
      event.stopPropagation();
      media.currentTime = Math.min(media.duration || media.currentTime + SEEK_SECONDS, media.currentTime + SEEK_SECONDS);
    }
  }

  const shared = {
    ref,
    src: url,
    controls: true,
    autoPlay: true,
    preload: "auto" as const,
    tabIndex: 0,
    "data-focusable": true,
    onKeyDown,
    onEnded,
    onPlay: () => setBlocked(false),
    onError: () => setFailed(true),
    // Some TVs refuse to start by themselves until a button is pressed.
    onLoadedData: () => {
      void ref.current?.play().catch(() => setBlocked(true));
    },
  };

  return (
    <div className="space-y-[0.6rem]">
      {audio ? (
        <div className="flex items-center gap-[1.4rem] rounded-[1.2rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1.4rem]">
          <span className="text-[3.4rem]" aria-hidden>
            🎧
          </span>
          <audio {...shared} className="w-full" />
        </div>
      ) : (
        <video {...shared} playsInline className="aspect-video max-h-[46vh] w-full rounded-[1.2rem] bg-black object-contain" />
      )}
      {blocked && <p className="text-[1.1rem] font-bold text-gold">Press OK to play.</p>}
      {failed && <p role="alert" className="text-[1.1rem] text-red-400">This lesson couldn&apos;t be played. Go back and open it again.</p>}
    </div>
  );
}
