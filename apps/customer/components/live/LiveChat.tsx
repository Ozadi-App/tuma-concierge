"use client";

import type { LiveComment } from "@peebee/shared";
import { EyeOff, Pin, PinOff, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";

/** The newest comments, over the video. People who run the stream (the host, helpers) can tap one to hide or pin it. */
export function LiveCommentList({ comments, pinned, canModerate, streamId, onChanged, max = 6, className = "" }: {
  comments: LiveComment[]; pinned: LiveComment | null; canModerate: boolean; streamId: string; onChanged?: (id: number, change: "hide" | "pin" | "unpin") => void; max?: number; className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const shown = comments.filter((c) => canModerate || !c.hidden).slice(-max);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [shown.length]);

  async function act(id: number, action: "hide" | "pin" | "unpin") {
    setBusy(true);
    try {
      await api.liveModerate(streamId, id, action);
      onChanged?.(id, action);
      setOpen(null);
    } catch {
      /* the next refresh shows the truth */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {pinned && (
        <div className="flex items-start gap-2 rounded-2xl bg-gold/90 px-3 py-2 text-xs font-semibold text-ink-gold">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words"><b>{pinned.author}</b> {pinned.body}</span>
        </div>
      )}
      <div className="no-scrollbar max-h-48 space-y-1.5 overflow-y-auto">
        {shown.map((c) => {
          const tap = canModerate ? () => setOpen(open === c.id ? null : c.id) : undefined;
          return (
            <div key={c.id} className="space-y-1">
              <button type="button" onClick={tap} disabled={!canModerate} className={`block max-w-full rounded-2xl bg-black/45 px-3 py-1.5 text-left text-[13px] leading-snug text-white backdrop-blur-sm ${c.hidden ? "opacity-50" : ""}`}>
                <b className={c.byHost ? "text-gold" : "text-white/80"}>{c.author}</b>{" "}
                <span className="break-words">{c.body}</span>
                {c.hidden && <span className="ml-1 text-[10px] text-white/60">(hidden)</span>}
              </button>
              {canModerate && open === c.id && (
                <div className="flex gap-2">
                  {!c.hidden && <button type="button" disabled={busy} onClick={() => void act(c.id, "hide")} className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-ink"><EyeOff className="h-3.5 w-3.5" aria-hidden />Hide</button>}
                  {!c.hidden && (c.pinned
                    ? <button type="button" disabled={busy} onClick={() => void act(c.id, "unpin")} className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-ink"><PinOff className="h-3.5 w-3.5" aria-hidden />Unpin</button>
                    : <button type="button" disabled={busy} onClick={() => void act(c.id, "pin")} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-ink-gold"><Pin className="h-3.5 w-3.5" aria-hidden />Pin</button>)}
                </div>
              )}
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </div>
  );
}

/** One line to write a comment. The send button sits beside the field, not inside it. */
export function LiveCommentInput({ streamId, maxChars, placeholder = "Say something…", onSent }: { streamId: string; maxChars: number; placeholder?: string; onSent?: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.liveComment(streamId, body);
      setText("");
      onSent?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="field-box flex min-w-0 flex-1 items-center rounded-full border border-[var(--border-faint)] px-4">
          <input
            id={`live-comment-${streamId}`}
            aria-label="Write a comment"
            value={text}
            maxLength={maxChars}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            enterKeyHint="send"
            autoComplete="off"
            className="h-11 w-full min-w-0 text-sm text-ink outline-none"
          />
        </span>
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send comment" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold transition active:scale-95 disabled:opacity-50">
          <Send className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      {error && <p role="alert" className="px-2 text-xs font-semibold text-red-300">{error}</p>}
    </form>
  );
}
