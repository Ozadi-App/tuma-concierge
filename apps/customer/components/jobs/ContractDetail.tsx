"use client";

import type { TalentContractDetail } from "@peebee/shared";
import { CheckCircle2, Circle, Clock, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ApplicationChat } from "./ApplicationChat";
import { Badge, BusyButton, cardClass, EmptyState, FailureNote, Field, JobsPage, Notice, primaryBtn, secondaryBtn, Spinner } from "./JobsUI";
import { fieldClass, formatUgx, formatWorkDate, jobsFailure, type JobsFailure } from "./jobs-utils";
import { FREQ_LABEL, RepeatForm } from "./Recurrences";

export function ContractDetail({ id }: { id: string }) {
  const [data, setData] = useState<TalentContractDetail | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dialog, setDialog] = useState<"cancel" | "dispute" | null>(null);
  const [feeOk, setFeeOk] = useState(false);
  const [maxRuns, setMaxRuns] = useState(52);
  const [showRepeat, setShowRepeat] = useState(false);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(() => {
    api.talentContract(id).then((r) => { setData(r); setFailure(null); }).catch((err) => setFailure(jobsFailure(err)));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { api.talentConfig().then((c) => setMaxRuns(c.recurring.maxRuns)).catch(() => {}); }, []);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setFailure(null);
    try { await fn(); setDialog(null); setReason(""); setNote(""); setFeeOk(false); load(); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(null); }
  }

  if (!data) {
    return (
      <JobsPage eyebrow="Peebee Jobs" title="Job" backHref="/services/jobs" backLabel="Back to Jobs">
        {failure ? <EmptyState title="Not available" text={failure.message} action={<Link href="/services/jobs" className={secondaryBtn}>Back to Jobs</Link>} /> : <Spinner label="Loading" />}
      </JobsPage>
    );
  }
  const { contract: c, milestones, actions } = data;
  const worker = c.role === "worker";
  const single = milestones.length === 1;
  const back = worker ? "/services/jobs/work" : "/services/jobs/mine";

  return (
    <JobsPage eyebrow="Peebee Jobs" title={worker ? "My job" : "Hired job"} backHref={back} backLabel="Back">
      <section className={`${cardClass} space-y-3`}>
        <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-bold leading-snug">{c.title}</h2><Badge status={c.status} /></div>
        <p className="text-2xl font-bold text-gold">{formatUgx(worker ? milestones.reduce((t, m) => t + m.payoutUgx, 0) : c.priceUgx)}</p>
        <p className="text-xs text-ink-500">{worker ? "Your pay after Peebee's fee." : `Job price. ${c.feeUgx > 0 ? `Plus a ${formatUgx(c.feeUgx)} Peebee fee.` : ""}`}</p>
        <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-sm">
          <span><span className="block text-[11px] text-ink-500">{worker ? "Employer" : "Worker"}</span><strong>{c.otherParty.name}</strong></span>
          {c.otherParty.phone ? <a href={`tel:${c.otherParty.phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-gold"><Phone className="h-4 w-4" aria-hidden />Call</a> : null}
        </div>
        <p className="text-xs text-ink-500">{c.paymentMode === "escrow" ? (c.status === "active" || c.status === "disputed" ? `${formatUgx(c.heldUgx)} is held safely by Peebee.` : "Paid through Peebee.") : "Paid directly between you. Peebee collects only its fee."}</p>
      </section>

      {c.status === "disputed" ? <Notice tone="info" text={`A problem was raised${data.disputeReason ? `: "${data.disputeReason}"` : ""}. Peebee is reviewing it and payment is paused.`} /> : null}
      {data.resolutionNote ? <Notice tone="info" text={`Peebee's decision: ${data.resolutionNote}`} /> : null}

      <section className="space-y-2" aria-label="Steps">
        <h3 className="text-sm font-bold">{single ? "Progress" : "Payment steps"}</h3>
        <ol className="space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className={`${cardClass} space-y-2`}>
              <div className="flex items-start gap-3">
                {m.status === "released" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden /> : m.status === "submitted" ? <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><strong className="min-w-0 break-words text-sm">{m.title}</strong><Badge status={m.status} /></div>
                  <p className="text-xs text-ink-500">{formatUgx(worker ? m.payoutUgx : m.amountUgx)}{m.status === "submitted" && m.confirmBy ? ` · paid automatically ${formatWorkDate(m.confirmBy)} unless there's a problem` : ""}</p>
                  {m.note ? <p className="pt-1 text-sm">&ldquo;{m.note}&rdquo;</p> : null}
                </div>
              </div>
              {actions.submit && m.status === "pending" ? (
                <div className="space-y-2">
                  <Field label="Note for the employer (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={fieldClass} /></Field>
                  <BusyButton busy={busy === `s${m.id}`} className={primaryBtn} onClick={() => act(`s${m.id}`, () => api.talentSubmitWork(c.id, { milestoneId: m.id, note }))}>{single ? "I've finished the work" : "Submit this step"}</BusyButton>
                </div>
              ) : null}
              {actions.release && m.status !== "released" ? (
                <BusyButton busy={busy === `r${m.id}`} className={m.status === "submitted" ? primaryBtn : secondaryBtn} onClick={() => act(`r${m.id}`, () => api.talentReleasePayment(c.id, m.id))}>
                  {m.status === "submitted" ? `Approve and pay ${formatUgx(m.amountUgx)}` : `Pay ${formatUgx(m.amountUgx)} now`}
                </BusyButton>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <FailureNote failure={failure} />

      {actions.review ? (
        <section className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold">Rate {c.otherParty.name.split(" ")[0]}</h3>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className={`h-11 w-11 rounded-full border text-lg font-bold ${n <= rating ? "border-gold bg-gold/15 text-gold" : "border-[var(--border-faint)] text-ink-500"}`}>★</button>)}
          </div>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="How did it go? (optional)" className={fieldClass} />
          <BusyButton busy={busy === "review"} className={primaryBtn} onClick={() => act("review", () => api.talentReview(c.id, rating, comment))}>Send rating</BusyButton>
        </section>
      ) : null}
      {data.reviewReceived ? <Notice tone="info" text={`${c.otherParty.name.split(" ")[0]} rated you ${data.reviewReceived.rating}/5${data.reviewReceived.comment ? `: "${data.reviewReceived.comment}"` : ""}`} /> : null}

      {data.recurring.existing ? (
        <Notice tone="info" text={`This job repeats ${FREQ_LABEL[data.recurring.existing.frequency].toLowerCase()}${data.recurring.existing.status === "paused" ? " (paused)" : ""}. Manage it from "Jobs I posted".`} />
      ) : data.recurring.canRepeat ? (
        <section className={`${cardClass} space-y-3`}>
          {showRepeat ? <RepeatForm frequencies={data.recurring.frequencies} maxRuns={maxRuns} kind="rehire" targetId={c.id} onDone={() => { setShowRepeat(false); load(); }} /> : (
            <><h3 className="text-sm font-bold">Need this again?</h3><p className="text-xs text-ink-500">Book {c.otherParty.name.split(" ")[0]} for this job again on a schedule.</p><button type="button" className={secondaryBtn} onClick={() => setShowRepeat(true)}>Repeat this job</button></>
          )}
        </section>
      ) : null}

      <details className="rounded-2xl border border-[var(--border-faint)] p-3"><summary className="cursor-pointer text-sm font-semibold">Messages</summary><div className="pt-3"><ApplicationChat applicationId={c.applicationId} /></div></details>

      {actions.cancel || actions.dispute ? (
        <section className="space-y-2">
          {dialog ? (
            <div className={`${cardClass} space-y-3`}>
              {dialog === "cancel" && !data.cancelQuote.free ? (
                <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
                  <p><strong>Cancelling now costs {formatUgx(data.cancelQuote.feeUgx)}.</strong> The free cancellation period has ended. {formatUgx(data.cancelQuote.compensationUgx)} of it goes to {c.otherParty.name.split(" ")[0]} for the lost work.</p>
                  <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={feeOk} onChange={(e) => setFeeOk(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />I understand and want to cancel anyway.</label>
                </div>
              ) : dialog === "cancel" && (data.cancelQuote.mode === "flat" ? data.cancelQuote.flatUgx > 0 : data.cancelQuote.percent > 0) && data.cancelQuote.freeUntil ? (
                <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs text-ink-500">Cancelling is free until {formatWorkDate(data.cancelQuote.freeUntil)}. After that it costs {data.cancelQuote.mode === "flat" ? formatUgx(data.cancelQuote.flatUgx) : `${data.cancelQuote.percent}% of the work not yet paid`}.</p>
              ) : null}
              <Field label={dialog === "cancel" ? "Why are you cancelling?" : "What went wrong?"}><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={fieldClass} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={secondaryBtn} onClick={() => setDialog(null)}>Back</button>
                <BusyButton busy={busy === dialog} disabled={reason.trim().length < (dialog === "cancel" ? 3 : 5) || (dialog === "cancel" && !data.cancelQuote.free && !feeOk)} className={primaryBtn} onClick={() => act(dialog, () => (dialog === "cancel" ? api.talentCancelContract(c.id, reason.trim(), feeOk) : api.talentDispute(c.id, reason.trim())))}>{dialog === "cancel" ? "Cancel job" : "Report problem"}</BusyButton>
              </div>
            </div>
          ) : (
            <div className={`grid gap-2 ${actions.cancel && actions.dispute ? "grid-cols-2" : "grid-cols-1"}`}>
              {actions.cancel ? <button type="button" className={secondaryBtn} onClick={() => setDialog("cancel")}>Cancel job</button> : null}
              {actions.dispute ? <button type="button" className={secondaryBtn} onClick={() => setDialog("dispute")}>Report a problem</button> : null}
            </div>
          )}
        </section>
      ) : null}
    </JobsPage>
  );
}
