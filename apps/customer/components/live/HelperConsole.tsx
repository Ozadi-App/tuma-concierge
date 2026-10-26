"use client";

import { Eye, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { LiveCommentInput, LiveCommentList } from "./LiveChat";
import { useLiveFeed } from "./useLiveFeed";

type Stream = { id: string; title: string | null; mine: boolean };

/** The second device: watch the numbers, read the comments, hide or pin them, reply as the host. No camera needed. */
export function HelperConsole() {
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (list: Stream[]) => {
    setStreams(list);
    if (list.length === 1) setActiveId((cur) => cur ?? list[0]!.id);
  };
  const load = () => api.liveMine().then((r) => apply(r.streams)).catch((err) => { setError(errorMessage(err)); setStreams([]); });
  useEffect(() => {
    let off = false;
    api.liveMine().then((r) => { if (!off) apply(r.streams); }).catch((err) => { if (!off) { setError(errorMessage(err)); setStreams([]); } });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.liveJoinHelper(code);
      setActiveId(r.id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (activeId) return <Console streamId={activeId} onLeave={() => { setActiveId(null); void load(); }} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 py-10">
      <div className="space-y-1 text-center">
        <Radio className="mx-auto h-9 w-9 text-gold" aria-hidden />
        <h1 className="text-xl font-extrabold text-ink">Helper device</h1>
        <p className="text-sm text-ink-500">Run a live stream from this phone while the camera is on another.</p>
      </div>
      {streams === null && <p className="text-center text-sm text-ink-500" aria-busy>Looking for your live stream…</p>}
      {streams && streams.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-ink-500">Choose a stream</p>
          {streams.map((s) => <button key={s.id} type="button" onClick={() => setActiveId(s.id)} className="w-full rounded-2xl bg-[rgb(var(--surface-card))] px-4 py-3 text-left text-sm font-bold text-ink shadow-sm">{s.title || "Live stream"}{s.mine ? "" : " (helping)"}</button>)}
        </div>
      )}
      {streams && streams.length === 0 && <p className="rounded-2xl bg-gold/10 px-4 py-3 text-center text-sm text-ink">None of your streams is live right now. If you are helping someone else, enter their code.</p>}
      <form onSubmit={join} className="space-y-3">
        <label htmlFor="helper-code" className="block text-xs font-bold text-ink-500">
          Code from the host
          <span className="field-box mt-1 flex items-center rounded-2xl border border-[var(--border-faint)] px-4">
            <input id="helper-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" className="h-12 w-full text-center text-xl font-bold tracking-[0.3em] text-ink outline-none" />
          </span>
        </label>
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={busy || code.length !== 6} className="min-h-12 w-full rounded-full bg-gold px-6 text-sm font-bold text-ink-gold disabled:opacity-50">Join as helper</button>
      </form>
      <Link href="/spotlight" className="text-center text-xs font-semibold text-ink-500">Back to Spotlight</Link>
    </div>
  );
}

function Console({ streamId, onLeave }: { streamId: string; onLeave: () => void }) {
  const feed = useLiveFeed(streamId);
  const s = feed.state;
  return (
    <div className="relative flex h-dvh w-full flex-col bg-neutral-950 text-white">
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{s?.title || "Live stream"}</p>
          <p className="text-[11px] text-white/60">{s ? (s.status === "live" ? (s.role === "host" ? "You are the host" : "Helping") : "Ended") : "Connecting…"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><Eye className="h-3.5 w-3.5" aria-hidden />{(s?.viewers ?? 0).toLocaleString()}</span>
          <span className="text-[11px] text-white/60">most {(s?.peakViewers ?? 0).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-3">
        {s?.status === "ended" ? (
          <div className="space-y-3 pt-10 text-center"><p className="text-lg font-bold">This stream has ended.</p><button type="button" onClick={onLeave} className="rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Done</button></div>
        ) : (
          <LiveCommentList comments={feed.comments} pinned={s?.pinned ?? null} canModerate streamId={streamId} max={40} className="[&>div:last-child]:max-h-none"
            onChanged={(id, change) => feed.patch((prev) => prev.map((c) => (c.id === id ? { ...c, hidden: change === "hide" ? true : c.hidden, pinned: change === "pin" } : c)))} />
        )}
        {s && s.status === "live" && feed.comments.length === 0 && <p className="pt-8 text-center text-sm text-white/60">No comments yet. They will appear here.</p>}
      </div>
      {s?.status === "live" && (
        <div className="space-y-2 px-4 pt-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <p className="text-[11px] text-white/60">Tap a comment to hide or pin it.</p>
          <LiveCommentInput streamId={streamId} maxChars={s.maxCommentChars} placeholder="Reply as the host…" onSent={feed.refresh} />
        </div>
      )}
    </div>
  );
}
