"use client";

import type { TalentMessage } from "@peebee/shared";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useLivePolling } from "../../lib/use-live-polling";
import { FailureNote } from "./JobsUI";
import { fieldClass, jobsFailure, type JobsFailure } from "./jobs-utils";

/** A short conversation between an employer and one applicant (before and during the job). */
export function ApplicationChat({ applicationId }: { applicationId: string }) {
  const [messages, setMessages] = useState<TalentMessage[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.talentMessages(applicationId).then((r) => setMessages(r.messages)).catch((err) => setFailure(jobsFailure(err)));
  }, [applicationId]);

  useEffect(load, [load]);
  useLivePolling(load, 10_000, [load]);
  useEffect(() => bottom.current?.scrollIntoView({ block: "nearest" }), [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await api.talentSendMessage(applicationId, body);
      setMessages((m) => [...(m ?? []), r.message]);
      setText("");
      setFailure(null);
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl bg-[rgb(var(--surface-muted))] p-3" aria-live="polite">
        {messages?.length === 0 ? <p className="text-center text-xs text-ink-500">No messages yet. Say hello.</p> : null}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <span className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-card))] text-ink"}`}>{m.body}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <FailureNote failure={failure} />
      <form onSubmit={send} className="field-box flex items-center gap-2 rounded-2xl border border-[var(--border-faint)] px-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" aria-label="Message" maxLength={1000} className="min-h-[48px] min-w-0 flex-1 text-sm" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold disabled:opacity-50">
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export { fieldClass };
