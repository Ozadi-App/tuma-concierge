"use client";

import type { LiveHostView, PublisherView } from "@peebee/shared";
import { Eye, Loader2, Mic, MicOff, Radio, SwitchCamera, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMyChannel } from "../studio/useMyChannel";
import { api, errorMessage } from "../../lib/api";
import { LiveCommentInput, LiveCommentList } from "./LiveChat";
import { HelperSheet } from "./HelperSheet";
import { useCamera } from "./useCamera";
import { useLiveFeed } from "./useLiveFeed";
import { publishWhip, whenConnected } from "./whip";

const KIND_LABEL: Record<string, string> = { channel: "My channel", personal: "Me", store: "Store", restaurant: "Restaurant", learn: "School", driver: "Driver" };
type Phase = "setup" | "connecting" | "live" | "ended";

const clock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Going live, as simple as it gets: the camera opens, the person types what is happening and taps Go live.
 * While live they see how many are watching, read and answer comments, flip the camera, mute, and can open the
 * stream on a second phone to help. No stream addresses, no encoder.
 */
export function LiveHost() {
  const router = useRouter();
  const { config, identities, loading } = useMyChannel();
  const cam = useCamera();
  const [phase, setPhase] = useState<Phase>("setup");
  const [title, setTitle] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [live, setLive] = useState<LiveHostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{ seconds: number; peakViewers: number; comments: number } | null>(null);
  const [leftover, setLeftover] = useState<LiveHostView | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  const pub = config?.publishing;
  const usable: PublisherView[] = useMemo(
    () => identities.filter((i) => (i.type === "personal" ? pub?.personalPosting : pub?.publishers.includes(i.type))),
    [identities, pub],
  );
  const identity = usable.find((i) => `${i.type}:${i.id}` === identityKey) ?? usable[0] ?? null;

  const feed = useLiveFeed(phase === "live" && live ? live.id : null);

  // Open the camera as soon as the screen opens, and pick up a stream left open from earlier.
  useEffect(() => {
    if (!config?.live?.enabled) return;
    void cam.start();
    api.liveMine().then((r) => { if (r.live) setLeftover(r.live); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.live?.enabled]);

  // The preview element can appear after the camera is ready (the screen waits for the rules to load), so it is attached by ref.
  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && cam.stream) { el.srcObject = cam.stream; void el.play().catch(() => undefined); }
  }, [cam.stream]);

  // The timer, and keep the screen on while live.
  useEffect(() => {
    if (phase !== "live") return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request("screen").then((l) => { wakeRef.current = l; }).catch(() => undefined);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { clearInterval(timer); window.removeEventListener("beforeunload", warn); void wakeRef.current?.release().catch(() => undefined); };
  }, [phase]);

  // If the server closed the stream (time limit, lost connection), show the end screen.
  useEffect(() => {
    if (phase === "live" && feed.state?.status === "ended") void finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.state?.status, phase]);

  const closeConnection = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  async function connect(l: LiveHostView, media: MediaStream) {
    if (l.mock || !l.publishUrl) return; // the demo provider has no camera connection
    const pc = await publishWhip(l.publishUrl, media);
    pcRef.current = pc;
    await whenConnected(pc);
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setNotice("Your connection dropped. Trying again…");
        void retry(l, media);
      } else if (pc.connectionState === "connected") setNotice(null);
    });
  }

  async function retry(l: LiveHostView, media: MediaStream, attempt = 1) {
    closeConnection();
    try {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      await connect(l, media);
      setNotice(null);
    } catch {
      if (attempt < 4) await retry(l, media, attempt + 1);
      else setNotice("Could not reconnect. End the stream and start again when your network is better.");
    }
  }

  async function goLive() {
    if (!identity || busy) return;
    setBusy(true);
    setError(null);
    const media = cam.stream ?? (await cam.start());
    if (!media) { setBusy(false); return; }
    setPhase("connecting");
    let started: LiveHostView | null = null;
    try {
      started = (await api.liveStart({ publisherType: identity.type, publisherId: identity.id, title: title.trim() || undefined })).live;
      await connect(started, media);
      const went = (await api.liveGo(started.id)).live;
      setLive(went);
      setPhase("live");
    } catch (err) {
      closeConnection();
      if (started) await api.liveEnd(started.id).catch(() => undefined);
      setPhase("setup");
      setError(err instanceof Error && !("status" in err) && /^(timeout|failed|The stream address)/.test(err.message)
        ? "Could not connect your camera to the stream. Check your network and try again."
        : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reconnectLeftover() {
    if (!leftover || busy) return;
    setBusy(true);
    setError(null);
    const media = cam.stream ?? (await cam.start());
    if (!media) { setBusy(false); return; }
    try {
      setPhase("connecting");
      await connect(leftover, media);
      const went = (await api.liveGo(leftover.id)).live;
      setLive(went);
      setLeftover(null);
      setPhase("live");
    } catch (err) {
      setPhase("setup");
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function discardLeftover() {
    if (!leftover) return;
    await api.liveEnd(leftover.id).catch(() => undefined);
    setLeftover(null);
  }

  async function finish(callApi = true) {
    if (!live) return;
    setBusy(true);
    try {
      const res = callApi ? await api.liveEnd(live.id) : { seconds: elapsed, peakViewers: feed.state?.peakViewers ?? 0, comments: feed.comments.length };
      setSummary({ seconds: res.seconds, peakViewers: res.peakViewers, comments: res.comments });
    } catch (err) {
      setError(errorMessage(err));
      setSummary({ seconds: elapsed, peakViewers: feed.state?.peakViewers ?? 0, comments: feed.comments.length });
    } finally {
      closeConnection();
      cam.stop();
      setPhase("ended");
      setConfirmEnd(false);
      setBusy(false);
    }
  }

  async function flipCamera() {
    await cam.flip(async (track) => {
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(track);
    });
  }

  useEffect(() => () => { pcRef.current?.close(); }, []);

  if (loading) return <Shell><p className="m-auto text-sm text-white/70">Loading…</p></Shell>;
  if (!config?.enabled || !config.live?.enabled) {
    return (
      <Shell>
        <div className="m-auto max-w-xs space-y-3 px-6 text-center">
          <Radio className="mx-auto h-10 w-10 text-gold" aria-hidden />
          <h1 className="text-lg font-bold">Going live is coming soon</h1>
          <p className="text-sm text-white/70">It is not open yet. Check back shortly.</p>
          <Link href="/spotlight" className="inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Back to Spotlight</Link>
        </div>
      </Shell>
    );
  }
  if (!usable.length) {
    return (
      <Shell>
        <div className="m-auto max-w-xs space-y-3 px-6 text-center">
          <h1 className="text-lg font-bold">You cannot go live yet</h1>
          <p className="text-sm text-white/70">Open a channel first, then come back here.</p>
          <Link href="/studio" className="inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Open a channel</Link>
        </div>
      </Shell>
    );
  }

  // ------------------------------------------------------------------ the end screen
  if (phase === "ended") {
    return (
      <Shell>
        <div className="m-auto w-full max-w-sm space-y-5 px-6 text-center">
          <h1 className="text-2xl font-extrabold">Your live has ended</h1>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Time" value={clock(summary?.seconds ?? 0)} />
            <Tile label="Most watching" value={String(summary?.peakViewers ?? 0)} />
            <Tile label="Comments" value={String(summary?.comments ?? 0)} />
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="button" onClick={() => router.push("/spotlight")} className="min-h-12 w-full rounded-full bg-gold px-6 text-sm font-bold text-ink-gold">Done</button>
        </div>
      </Shell>
    );
  }

  const live_ = phase === "live" && live;
  return (
    <Shell>
      <video ref={attachPreview} muted playsInline autoPlay aria-label="Your camera" className="absolute inset-0 h-full w-full object-cover" style={{ transform: cam.facing === "user" ? "scaleX(-1)" : undefined }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        {live_ ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-extrabold tracking-wide"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />LIVE {clock(elapsed)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold backdrop-blur-md"><Eye className="h-3.5 w-3.5" aria-hidden />{(feed.state?.viewers ?? 0).toLocaleString()}</span>
          </div>
        ) : (
          <button type="button" onClick={() => router.back()} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><X className="h-5 w-5" aria-hidden /></button>
        )}
        {live_ ? (
          <button type="button" onClick={() => setConfirmEnd(true)} className="rounded-full bg-white/90 px-4 py-2 text-xs font-extrabold text-red-700">End</button>
        ) : (
          <span className="text-xs font-semibold text-white/80">Go live</span>
        )}
      </div>

      {/* side buttons */}
      <div className="absolute right-3 z-20 flex flex-col items-center gap-3" style={{ top: "calc(max(0.75rem, env(safe-area-inset-top)) + 3.5rem)" }}>
        <RoundButton label="Flip camera" onClick={() => void flipCamera()}><SwitchCamera className="h-5 w-5" aria-hidden /></RoundButton>
        <RoundButton label={cam.micOn ? "Mute microphone" : "Unmute microphone"} onClick={cam.toggleMic}>{cam.micOn ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5 text-red-400" aria-hidden />}</RoundButton>
        {live_ && config.live.helperEnabled && <RoundButton label="Add a helper device" onClick={() => setHelperOpen(true)}><UsersRound className="h-5 w-5" aria-hidden /></RoundButton>}
      </div>

      {/* bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 px-4 pr-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {notice && <p role="status" className="rounded-2xl bg-gold px-4 py-2 text-xs font-bold text-ink-gold">{notice}</p>}
        {live_ ? (
          <>
            {feed.state?.commentsEnabled !== false && (
              <>
                <LiveCommentList
                  comments={feed.comments} pinned={feed.state?.pinned ?? null} canModerate streamId={live.id} max={6} className="pr-14"
                  onChanged={(id, change) => feed.patch((prev) => prev.map((c) => (c.id === id ? { ...c, hidden: change === "hide" ? true : c.hidden, pinned: change === "pin" } : c)))}
                />
                <LiveCommentInput streamId={live.id} maxChars={feed.state?.maxCommentChars ?? 200} placeholder="Reply to your viewers…" onSent={feed.refresh} />
              </>
            )}
          </>
        ) : (
          <>
            {leftover && (
              <div className="space-y-2 rounded-3xl bg-black/60 p-4 backdrop-blur-md">
                <p className="text-sm font-bold">You have a stream still open{leftover.title ? `: “${leftover.title}”` : ""}.</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void reconnectLeftover()} className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">Carry on</button>
                  <button type="button" disabled={busy} onClick={() => void discardLeftover()} className="min-h-11 flex-1 rounded-full bg-white/90 px-4 text-sm font-bold text-ink disabled:opacity-50">End it</button>
                </div>
              </div>
            )}
            {(cam.error || error) && <p role="alert" className="rounded-2xl bg-red-600/90 px-4 py-3 text-sm font-semibold">{cam.error ?? error}</p>}
            {usable.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Go live as">
                {usable.map((i) => {
                  const key = `${i.type}:${i.id}`;
                  const on = identity && key === `${identity.type}:${identity.id}`;
                  return <button key={key} type="button" aria-pressed={!!on} onClick={() => setIdentityKey(key)} className={`rounded-full px-4 py-2 text-xs font-bold ${on ? "bg-gold text-ink-gold" : "bg-black/50 text-white"}`}>{KIND_LABEL[i.type] ?? i.type}: {i.name}</button>;
                })}
              </div>
            )}
            <span className="field-box flex items-center rounded-2xl border border-[var(--border-faint)] px-4">
              <input id="live-title" aria-label="What are you going live about?" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening? e.g. Fresh tomatoes at the market" className="h-12 w-full text-base text-ink outline-none" />
            </span>
            {cam.error
              ? <button type="button" onClick={() => void cam.start()} className="min-h-14 w-full rounded-full bg-gold px-6 text-base font-extrabold text-ink-gold">Try the camera again</button>
              : <button type="button" disabled={busy || phase === "connecting" || !cam.stream} onClick={() => void goLive()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-base font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60">
                {phase === "connecting" ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Connecting…</> : <><Radio className="h-5 w-5" aria-hidden />Go live</>}
              </button>}
            <p className="text-center text-[11px] text-white/70">Your followers see you in the Spotlight. You can end any time.</p>
          </>
        )}
      </div>

      {/* confirm end */}
      {confirmEnd && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60 p-4" role="dialog" aria-modal aria-label="End the live stream">
          <div className="w-full space-y-3 rounded-[28px] bg-[rgb(var(--surface-card))] p-5 text-ink">
            <h2 className="text-lg font-extrabold">End your live?</h2>
            <p className="text-sm text-ink-500">Everyone watching will see that it ended.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmEnd(false)} className="min-h-12 flex-1 rounded-full bg-[rgb(var(--surface-muted))] px-4 text-sm font-bold">Keep going</button>
              <button type="button" disabled={busy} onClick={() => void finish()} className="min-h-12 flex-1 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">End live</button>
            </div>
          </div>
        </div>
      )}

      {live && <HelperSheet open={helperOpen} onClose={() => setHelperOpen(false)} streamId={live.id} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-black text-white">{children}</div>;
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95">{children}</button>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-extrabold tabular-nums">{value}</p><p className="text-[11px] text-white/70">{label}</p></div>;
}
