"use client";

import type { PostView } from "@peebee/shared";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { PollView, LockPanel } from "./PostParts";
import { PostVideo } from "./PostVideo";

/** A live stream (an HLS playlist the creator provides). No ads are inserted into live streams. */
function LiveVideo({ url, poster, muted, className }: { url: string; poster: string | null; muted: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let destroy: (() => void) | null = null;
    let cancelled = false;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = url;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls({ lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(v);
        destroy = () => hls.destroy();
      });
    }
    void v.play().catch(() => undefined);
    return () => { cancelled = true; destroy?.(); };
  }, [url]);
  return (
    <div className={`relative bg-black ${className ?? ""}`}>
      <video ref={ref} poster={poster ?? undefined} muted={muted} playsInline autoPlay className="h-full w-full object-cover" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md"><Radio className="h-3 w-3 text-red-500" aria-hidden /> LIVE</span>
    </div>
  );
}

/**
 * Draws a post's content in whichever form it takes. Locked content is never drawn: the server withholds
 * it, and a locked video shows a preview (if the creator allows one) and then the unlock panel.
 */
export function PostMedia({ post, muted, fullscreen = false, onChanged }: { post: PostView; muted: boolean; fullscreen?: boolean; onChanged: (p?: PostView) => void }) {
  const [slide, setSlide] = useState(0);
  const [lockShown, setLockShown] = useState(false);
  const frame = fullscreen ? "absolute inset-0" : "aspect-[4/5] w-full overflow-hidden rounded-3xl";
  const refresh = async () => {
    try {
      const r = await api.getPost(post.id);
      setLockShown(false);
      onChanged(r.post);
    } catch {
      onChanged();
    }
  };

  useEffect(() => { setLockShown(false); setSlide(0); }, [post.id]);

  // Text and polls
  if (post.type === "text") {
    return (
      <div className={`${fullscreen ? "absolute inset-0" : "w-full rounded-3xl"} flex flex-col justify-center gap-4 overflow-auto p-6 ${fullscreen ? "pr-20" : ""} ${fullscreen ? "bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-white" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>
        {post.locked ? <LockPanel post={post} onUnlocked={refresh} dark={fullscreen} /> : (
          <>
            {post.caption && !post.poll && <p className={`whitespace-pre-wrap break-words font-semibold leading-snug ${fullscreen ? "text-2xl" : "text-lg"}`}>{post.caption}</p>}
            <PollView post={post} onVoted={refresh} dark={fullscreen} />
          </>
        )}
      </div>
    );
  }

  if (post.locked && post.type !== "video") {
    return (
      <div className={`${frame} flex items-center justify-center p-5 ${fullscreen ? "bg-neutral-950" : "bg-[rgb(var(--surface-muted))]"}`}>
        {post.media.coverUrl && <div className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl" style={{ backgroundImage: `url(${post.media.coverUrl})` }} aria-hidden />}
        <div className="relative w-full max-w-sm"><LockPanel post={post} onUnlocked={refresh} dark={fullscreen} /></div>
      </div>
    );
  }

  if (post.type === "video") {
    const showLock = !!post.locked && (lockShown || post.previewSeconds === 0);
    return (
      <div className={`${frame} relative`}>
        {!showLock && (
          <PostVideo
            key={`${post.id}-${post.locked ? "p" : "f"}`}
            post={post}
            muted={muted}
            loop={!post.locked}
            className="h-full w-full"
            onLocked={() => setLockShown(true)}
            onPreviewEnded={() => setLockShown(true)}
          />
        )}
        {showLock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
            {post.media.coverUrl && <div className="absolute inset-0 -z-10 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${post.media.coverUrl})` }} aria-hidden />}
            <div className="w-full max-w-sm"><LockPanel post={post} onUnlocked={refresh} dark /></div>
          </div>
        )}
      </div>
    );
  }

  if (post.type === "live" && post.media.liveUrl) {
    return <LiveVideo url={post.media.liveUrl} poster={post.media.coverUrl} muted={muted} className={frame} />;
  }

  if (post.type === "audio") {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-5 p-6 ${fullscreen ? "bg-neutral-950 text-white" : "bg-[rgb(var(--surface-muted))]"}`}>
        {post.media.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.media.coverUrl} alt="" className="h-48 w-48 rounded-3xl object-cover shadow-lg" />
        ) : <div className="flex h-48 w-48 items-center justify-center rounded-3xl bg-gold/20 text-5xl" aria-hidden>🎧</div>}
        {post.media.audioUrl && <audio controls preload="none" src={post.media.audioUrl} className="w-full max-w-sm" />}
      </div>
    );
  }

  // Single image or carousel
  const images = (post.media.images.filter(Boolean) as string[]);
  if (images.length === 0) return null;
  const i = Math.min(slide, images.length - 1);
  return (
    <div className={`${frame} relative bg-black`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[i]} alt={post.caption.slice(0, 80) || "Post picture"} className={`h-full w-full ${fullscreen ? "object-contain" : "object-cover"}`} draggable={false} />
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => setSlide((i - 1 + images.length) % images.length)} aria-label="Previous picture" className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
          <button type="button" onClick={() => setSlide((i + 1) % images.length)} aria-label="Next picture" className={`absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md ${fullscreen ? "right-[72px]" : "right-3"}`}><ChevronRight className="h-5 w-5" aria-hidden /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {images.map((_, d) => <span key={d} className={`h-1 rounded-full transition-all ${d === i ? "w-4 bg-gold" : "w-1.5 bg-white/50"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
