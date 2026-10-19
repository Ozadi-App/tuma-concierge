"use client";

import type { Announcement, QaQuestion } from "@peebee/shared";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../../../../lib/api";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const ago = (iso: string) => new Date(iso.replace(" ", "T") + "Z").toLocaleDateString("en-UG", { day: "numeric", month: "short" });

function Question({ q, onChanged, onError }: { q: QaQuestion; onChanged: () => void; onError: (m: string) => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  async function answer() {
    if (reply.trim().length < 2) return;
    setBusy(true);
    try {
      await api.learnAnswer(q.id, reply);
      setReply("");
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className={`${card} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{q.body}</p>
          <p className="text-xs text-ink-500">{q.askedBy} · {ago(q.createdAt)}</p>
        </div>
        {q.canDelete && (
          <button type="button" aria-label="Delete question" onClick={() => window.confirm("Delete this question and its answers?") && api.learnDeleteQuestion(q.id).then(onChanged).catch((e) => onError(errorMessage(e)))} className="shrink-0 text-ink-500 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {q.answers.length > 0 && (
        <ul className="space-y-2 border-l-2 border-gold/40 pl-3">
          {q.answers.map((a) => (
            <li key={a.id} className="space-y-0.5">
              <p className="text-sm text-ink">{a.body}</p>
              <p className="flex items-center gap-2 text-xs text-ink-500">
                {a.by}
                {a.byTeacher && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Teacher</span>}
                · {ago(a.createdAt)}
                {a.canDelete && <button type="button" className="underline" onClick={() => api.learnDeleteAnswer(a.id).then(onChanged).catch((e) => onError(errorMessage(e)))}>Delete</button>}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="field-box flex items-center gap-2 rounded-xl px-3 py-1.5">
        <input aria-label="Write an answer" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write an answer" maxLength={1500} className="min-w-0 flex-1 text-sm" />
        <button type="button" onClick={answer} disabled={busy} className="shrink-0 text-xs font-bold text-gold disabled:opacity-50">Reply</button>
      </div>
    </li>
  );
}

function Discuss() {
  const { id } = useParams<{ id: string }>();
  const lessonId = useSearchParams().get("lesson") ?? undefined;
  const [questions, setQuestions] = useState<QaQuestion[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.learnQa(id, lessonId).then((r) => setQuestions(r.questions)).catch((e) => setError(errorMessage(e)));
    api.learnAnnouncements(id).then((r) => setAnnouncements(r.announcements)).catch(() => undefined);
  }, [id, lessonId]);
  useEffect(load, [load]);

  async function ask() {
    if (text.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await api.learnAsk(id, text, lessonId ?? null);
      setText("");
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-28">
      <Link href={`/learn/course/${id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the class
      </Link>
      <h1 className="flex items-center gap-2 text-xl font-bold text-ink"><MessageCircle className="h-5 w-5 text-gold" aria-hidden /> {lessonId ? "Questions about this lesson" : "Questions and announcements"}</h1>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">{error}</p>}

      {!lessonId && announcements.length > 0 && (
        <section aria-label="Announcements" className="space-y-2">
          {announcements.map((a) => (
            <article key={a.id} className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
              <p className="text-sm font-bold text-ink">📣 {a.title}</p>
              {a.body && <p className="whitespace-pre-line text-sm text-ink">{a.body}</p>}
              <p className="mt-1 text-xs text-ink-500">{ago(a.createdAt)}</p>
            </article>
          ))}
        </section>
      )}

      <section className={`${card} space-y-2 p-4`}>
        <label htmlFor="ask" className="block text-xs font-semibold text-ink-500">Ask a question</label>
        <textarea id="ask" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} className="w-full rounded-xl px-3 py-2.5 text-sm" placeholder="What would you like to know?" />
        <button type="button" onClick={ask} disabled={busy} className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink-gold disabled:opacity-50">{busy ? "Posting…" : "Post question"}</button>
      </section>

      {questions === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
      ) : questions.length === 0 ? (
        <p className="text-sm text-ink-500">No questions yet. Be the first to ask.</p>
      ) : (
        <ul className="space-y-3">{questions.map((q) => <Question key={q.id} q={q} onChanged={load} onError={setError} />)}</ul>
      )}
    </div>
  );
}

export default function DiscussPage() {
  return (
    <Suspense fallback={<div className="p-4"><div className="h-24 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" /></div>}>
      <Discuss />
    </Suspense>
  );
}
