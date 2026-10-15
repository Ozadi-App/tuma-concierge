"use client";

import type { WorkMessage } from "@peebee/shared";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useLivePolling } from "../../lib/use-live-polling";
import { cardClass, Notice, primaryBtn } from "./WorkUI";
import { formatWorkDate, workFailure, type WorkFailure } from "./work-utils";

export const CHAT_STATUSES = ["assigned", "quoted", "booked", "in_progress", "completed", "disputed"];

/** Messages between the customer and whoever is doing the job. New ones are fetched with `after` = the last id we hold. */
export function WorkChat({ jobId, providerName }: { jobId: string; providerName: string }) {
  const [messages, setMessages] = useState<WorkMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WorkFailure | null>(null);
  const [closed, setClosed] = useState(false);
  const lastId = useRef<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

  const append = useCallback((incoming: WorkMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return cur;
      const next = [...cur, ...fresh];
      lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  const poll = useCallback(() => {
    api
      .workJobMessages(jobId, lastId.current)
      .then((r) => {
        setClosed(false);
        append(r.messages);
      })
      .catch((err) => {
        const f = workFailure(err);
        if (f.code === "chat_disabled" || f.code === "chat_closed") setClosed(true);
      });
  }, [jobId, append]);

  useLivePolling(poll, 8000, [poll]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await api.workSendJobMessage(jobId, body);
      append([res.message]);
      setText("");
    } catch (err) {
      setFailure(workFailure(err));
    } finally {
      setBusy(false);
    }
  }

  if (closed) return null;

  return (
    <section className={`${cardClass} space-y-3`} aria-labelledby="chat-heading">
      <h2 id="chat-heading" className="text-xs font-bold uppercase tracking-wider">
        Chat with {providerName}
      </h2>
      <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">No messages yet. Say hello.</p> : null}
        {messages.map((m) => {
          const mine = m.from === "customer";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-md bg-gold text-ink-gold" : "rounded-bl-md bg-[rgb(var(--surface-muted))] text-ink"}`}>
                {!mine && m.senderName ? <p className="text-[10px] font-bold opacity-70">{m.senderName}</p> : null}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">{formatWorkDate(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <Notice failure={failure} />
      <form onSubmit={send} className="space-y-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Write a message"
          className="w-full rounded-2xl border border-[var(--border-faint)] px-4 py-3 text-sm text-ink placeholder:text-ink-500"
        />
        <button type="submit" disabled={busy || !text.trim()} className={primaryBtn}>
          <Send className="h-4 w-4" aria-hidden />
          {busy ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
