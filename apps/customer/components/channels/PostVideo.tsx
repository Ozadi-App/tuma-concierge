"use client";

import type { AdDecision, PostView } from "@peebee/shared";
import { ExternalLink, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { adBeacon, adClickUrl } from "../../lib/channels";

type Props = {
  post: PostView;
  muted: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  /** The viewer is not allowed to watch this (and there is no preview left). */
  onLocked?: () => void;
  /** A preview reached its end. */
  onPreviewEnded?: () => void;
};

type Phase = "loading" | "ad" | "main";

/**
 * Plays a post's video in Peebee's own player. Peebee decides every ad (a pre-roll, and mid-rolls on
 * longer videos), however the video is hosted. A locked video plays only as far as the viewer is
 * allowed: the address the server gives a non-member stops working just after the preview ends.
 */
export function PostVideo({ post, muted, autoPlay = true, loop = false, className = "", onLocked, onPreviewEnded }: Props) {
  const mainRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [sources, setSources] = useState<Awaited<ReturnType<typeof api.postPlayback>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [ad, setAd] = useState<AdDecision | null>(null);
  const [skipIn, setSkipIn] = useState(0);
  const assetId = post.media.videoAssetId;

  const plan = useRef<{ midrollAtSeconds: number[] } | null>(null);
  const midrollsDone = useRef(new Set<number>());
  const adResume = useRef<(() => void) | null>(null);
  const watched = useRef({ seconds: 0, last: 0, sentAt: 0 });
  const previewEnded = useRef(false);

  // Fetch the playback address and, for a normal viewing, the ad plan.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError(null);
    setSources(null);
    previewEnded.current = false;
    midrollsDone.current = new Set();
    watched.current = { seconds: 0, last: 0, sentAt: 0 };
    (async () => {
      try {
        const res = await api.postPlayback(post.id);
        if (cancelled) return;
        setSources(res);
        if (!res.preview && assetId) {
          const p = await api.adsPlan(assetId).catch(() => null);
          plan.current = p ? { midrollAtSeconds: p.midrollAtSeconds } : null;
          if (p?.preroll) {
            const d = await api.adsDecision(assetId, "preroll", post.id).catch(() => ({ ad: null }));
            if (!cancelled && d.ad) {
              adResume.current = () => setPhase("main");
              setAd(d.ad);
              setPhase("ad");
              return;
            }
          }
        }
        if (!cancelled) setPhase("main");
      } catch (err) {
        if (cancelled) return;
        const message = errorMessage(err);
        if (/locked/i.test(message) || (err as { status?: number })?.status === 403) onLocked?.();
        setError(message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, assetId]);

  // Attach the video to the player once it is time for the main content.
  useEffect(() => {
    const video = mainRef.current;
    const src = sources?.playback;
    if (!video || !src) return;
    let cancelled = false;
    (async () => {
      if (src.hlsUrl) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src.hlsUrl;
        } else {
          const { default: Hls } = await import("hls.js");
          if (cancelled) return;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(src.hlsUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;
          } else if (src.mp4Url) {
            video.src = src.mp4Url;
          }
        }
      } else if (src.mp4Url) {
        video.src = src.mp4Url;
      }
    })();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [sources]);

  // Play when the main content is ready (not while an ad is up).
  useEffect(() => {
    const video = mainRef.current;
    if (!video || phase !== "main" || !autoPlay) return;
    video.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
  }, [phase, autoPlay, sources]);

  const reportWatched = useCallback((force = false) => {
    const w = watched.current;
    const due = w.seconds >= 4 && (w.sentAt === 0 || w.seconds - w.sentAt >= 15);
    if ((due || (force && w.seconds >= 1 && w.seconds !== w.sentAt)) && !previewEnded.current) {
      w.sentAt = w.seconds;
      void api.reportPostView(post.id, w.seconds).catch(() => undefined);
    }
  }, [post.id]);

  useEffect(() => () => reportWatched(true), [reportWatched]);

  async function startMidroll() {
    const video = mainRef.current;
    if (!assetId || !video) return;
    video.pause();
    const d = await api.adsDecision(assetId, "midroll", post.id).catch(() => ({ ad: null }));
    if (!d.ad) {
      void video.play().catch(() => undefined);
      return;
    }
    adResume.current = () => {
      setPhase("main");
      void mainRef.current?.play().catch(() => undefined);
    };
    setAd(d.ad);
    setPhase("ad");
  }

  function onTimeUpdate() {
    const video = mainRef.current;
    if (!video) return;
    const now = video.currentTime;
    const w = watched.current;
    if (now > w.last && now - w.last < 2) w.seconds += now - w.last;
    w.last = now;
    reportWatched();

    if (sources?.preview && sources.previewSeconds && now >= sources.previewSeconds && !previewEnded.current) {
      previewEnded.current = true;
      video.pause();
      onPreviewEnded?.();
      return;
    }
    const next = plan.current?.midrollAtSeconds.find((t) => now >= t && !midrollsDone.current.has(t));
    if (next !== undefined && phase === "main") {
      midrollsDone.current.add(next);
      void startMidroll();
    }
  }

  if (error) {
    return <div className={`flex items-center justify-center bg-black p-6 text-center text-sm text-white/70 ${className}`}>{error}</div>;
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video
        ref={mainRef}
        poster={post.media.coverUrl ?? undefined}
        muted={muted}
        loop={loop && !sources?.preview}
        playsInline
        controls={phase === "main" && !autoPlay}
        onTimeUpdate={onTimeUpdate}
        onClick={() => {
          const v = mainRef.current;
          if (!v || phase !== "main") return;
          if (v.paused) void v.play(); else v.pause();
        }}
        className="h-full w-full object-cover"
      />
      {phase === "loading" && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-label="Loading video" /></div>}
      {phase === "main" && needsTap && (
        <button type="button" onClick={() => { void mainRef.current?.play().then(() => setNeedsTap(false)); }} aria-label="Play video" className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md"><Play className="h-7 w-7" aria-hidden /></span>
        </button>
      )}
      {phase === "ad" && ad && (
        <AdOverlay
          key={ad.serveId}
          ad={ad}
          muted={muted}
          skipIn={skipIn}
          setSkipIn={setSkipIn}
          onDone={() => { setAd(null); adResume.current?.(); }}
        />
      )}
    </div>
  );
}

/** One ad, played over the video with a skip button after the admin-set delay. */
function AdOverlay({ ad, muted, skipIn, setSkipIn, onDone }: { ad: AdDecision; muted: boolean; skipIn: number; setSkipIn: (n: number) => void; onDone: () => void }) {
  const sent = useRef(new Set<string>());
  const doneRef = useRef(false);
  const c = ad.creative;
  const fire = useCallback((event: string) => {
    if (sent.current.has(event)) return;
    sent.current.add(event);
    adBeacon(ad.token, event);
  }, [ad.token]);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // The skip button counts down from the admin-set delay.
  useEffect(() => {
    let left = c.skipAfterSeconds;
    setSkipIn(left);
    if (left === 0) return;
    const tick = setInterval(() => {
      left = Math.max(0, left - 1);
      setSkipIn(left);
      if (left === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [c.skipAfterSeconds, setSkipIn]);

  // An image ad runs for its length, then counts as finished.
  useEffect(() => {
    if (c.kind !== "image") return;
    fire("impression");
    const q = [0.25, 0.5, 0.75].map((f, i) => setTimeout(() => fire(["q25", "q50", "q75"][i]!), c.durationSeconds * 1000 * f));
    const end = setTimeout(() => { fire("complete"); finish(); }, c.durationSeconds * 1000);
    return () => { q.forEach(clearTimeout); clearTimeout(end); };
  }, [c.kind, c.durationSeconds, fire, finish]);

  return (
    <div className="absolute inset-0 z-10 bg-black" data-no-drag>
      {c.kind === "video" ? (
        <video
          src={c.mediaUrl}
          poster={c.posterUrl ?? undefined}
          autoPlay
          muted={muted}
          playsInline
          className="h-full w-full object-contain"
          onPlaying={() => fire("impression")}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (!v.duration) return;
            const p = v.currentTime / v.duration;
            if (p >= 0.25) fire("q25");
            if (p >= 0.5) fire("q50");
            if (p >= 0.75) fire("q75");
          }}
          onEnded={() => { fire("complete"); finish(); }}
          onError={finish}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.mediaUrl} alt={c.headline ?? "Advertisement"} className="h-full w-full object-contain" />
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">Ad{c.headline ? ` · ${c.headline}` : ""}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        {c.hasClickThrough ? (
          <button type="button" onClick={() => window.open(adClickUrl(ad.token), "_blank", "noopener,noreferrer")} className="flex h-10 items-center gap-1.5 rounded-full bg-gold px-4 text-xs font-semibold text-ink-gold">
            {c.ctaLabel || "Learn more"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : <span />}
        <button
          type="button"
          disabled={skipIn > 0}
          onClick={() => { fire("skip"); finish(); }}
          className="h-10 rounded-full bg-black/60 px-4 text-xs font-semibold text-white backdrop-blur-md disabled:opacity-70"
        >
          {skipIn > 0 ? `Skip in ${skipIn}` : "Skip ad"}
        </button>
      </div>
    </div>
  );
}
