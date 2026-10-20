"use client";

import type { WorkCustomerAction, WorkJob, WorkPublicSettings } from "@peebee/shared";
import { Check, Star, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useLivePolling } from "../../lib/use-live-polling";
import { cardClass, Notice, primaryBtn, secondaryBtn, Spinner, StatusBadge, UnavailablePanel, WorkPage } from "./WorkUI";
import { CHAT_STATUSES, WorkChat } from "./WorkChat";
import { WorkPhotos } from "./WorkPhotos";
import { isTrackable, WorkTracking } from "./WorkTracking";
import { WorkTopUp } from "./WorkTopUp";
import { formatUgx, formatWorkDate, hoursLabel, isActiveStatus, workFailure, type WorkFailure } from "./work-utils";

type Detail = Awaited<ReturnType<typeof api.workJob>>;
type Panel = "cancel" | "decline" | "problem" | null;
type TopUpState = { needed: number; key: string; fn: () => Promise<unknown>; success: string; nonce: number };

const fieldClass = "w-full rounded-2xl border border-[var(--border-faint)] px-4 py-3 text-sm text-ink placeholder:text-ink-500";

const TIMELINE_LABEL: Record<string, string> = {
  created: "Booked and paid from your wallet",
  assigned: "A provider was assigned",
  offered: "A provider sent an offer",
  worker_assigned: "A team member was assigned",
  quoted: "The provider sent a quote",
  quote_accepted: "You accepted the quote",
  quote_declined: "The quote was declined",
  quote_lapsed: "The quote expired",
  started: "The job started",
  in_progress: "The job started",
  completed: "The provider marked the job done",
  confirmed: "You confirmed the job",
  auto_confirmed: "Confirmed automatically",
  settled: "The provider was paid",
  cancelled: "The job was cancelled",
  expired: "No provider took the job in time",
  disputed: "A problem was reported",
  refunded: "You were refunded",
  resolved: "Peebee ruled on the problem",
  rated: "You rated the job",
  provider_cancelled: "Your provider couldn't make it",
  rematched: "We sent the job out to other providers again",
  photo_added: "A photo was added",
};

function timelineLabel(action: string): string {
  if (action.startsWith("resolved")) return TIMELINE_LABEL.resolved;
  return TIMELINE_LABEL[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function WorkJobDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [settings, setSettings] = useState<WorkPublicSettings | null>(null);
  const [loadFailure, setLoadFailure] = useState<WorkFailure | null>(null);
  const [missing, setMissing] = useState(false);
  const detailRef = useRef<Detail | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api.workJob(id);
      detailRef.current = d;
      setDetail(d);
      setLoadFailure(null);
    } catch (err) {
      const f = workFailure(err);
      if (f.code === "not_found") setMissing(true);
      else if (!detailRef.current) setLoadFailure(f);
    }
  }, [id]);

  useEffect(() => {
    api
      .workCatalog()
      .then((r) => setSettings(r.settings))
      .catch(() => {});
  }, []);

  // First load, then every ~15s while the job can still change.
  useLivePolling(
    () => {
      if (detailRef.current && !isActiveStatus(detailRef.current.job.status)) return;
      void refresh();
    },
    15_000,
    [refresh],
  );

  return (
    <WorkPage eyebrow="Peebee Work" title="Job" backHref="/services/work" backLabel="Back to my jobs">
      {missing ? (
        <UnavailablePanel title="Job not found" message="We couldn't find that job. It may belong to another account." backHref="/services/work" />
      ) : loadFailure ? (
        <div className="space-y-3">
          <Notice failure={loadFailure} />
          <button type="button" onClick={() => void refresh()} className={secondaryBtn}>
            Try again
          </button>
        </div>
      ) : !detail ? (
        <Spinner label="Loading job" />
      ) : (
        <JobBody detail={detail} settings={settings} onChanged={refresh} />
      )}
    </WorkPage>
  );
}

function JobBody({ detail, settings, onChanged }: { detail: Detail; settings: WorkPublicSettings | null; onChanged: () => Promise<void> }) {
  const { job, actions, offers, timeline } = detail;
  const has = (a: WorkCustomerAction) => actions.includes(a);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<WorkFailure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<TopUpState | null>(null);
  const nonce = useRef(0);

  // `neededUgx` is what this action takes from the wallet; if the server says that's more than
  // the balance, we offer a top-up and then repeat the same call (idempotent on the server).
  async function run(key: string, fn: () => Promise<unknown>, success: string, neededUgx?: number) {
    if (busy) return;
    setBusy(key);
    setFailure(null);
    setDone(null);
    try {
      await fn();
      setPanel(null);
      setReason("");
      setTopUp(null);
      setDone(success);
      await onChanged();
    } catch (err) {
      const f = workFailure(err);
      if (f.topUp && neededUgx && neededUgx > 0) {
        nonce.current += 1;
        setTopUp({ needed: neededUgx, key, fn, success, nonce: nonce.current });
      } else {
        setTopUp(null);
      }
      setFailure(f);
      // The job may have moved on (someone else acted, a window closed): show what is true now.
      void onChanged();
    } finally {
      setBusy(null);
    }
  }

  function toggle(p: Panel) {
    setFailure(null);
    setReason("");
    setPanel((cur) => (cur === p ? null : p));
  }

  const isQuote = job.pricingMode === "quote";
  const quotePrice = job.priceUgx;
  const quoteExtra = Math.max(0, quotePrice - job.heldUgx);
  const problemOk = reason.trim().length >= 5;

  return (
    <>
      <section className={`${cardClass} space-y-3`} aria-label="Status">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{job.service.name}</h2>
            <p className="text-xs text-ink-500">Booked {formatWorkDate(job.createdAt)}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-sm leading-relaxed" aria-live="polite">
          {statusMessage(job, settings)}
        </p>
        {isActiveStatus(job.status) ? <p className="text-[11px] text-ink-500">This page updates by itself.</p> : null}
      </section>

      <Notice text={done ?? undefined} tone="info" />
      <Notice failure={failure} inlineTopUp={!!topUp} />
      {topUp ? <WorkTopUp key={topUp.nonce} neededUgx={topUp.needed} onCredited={() => void run(topUp.key, topUp.fn, topUp.success, topUp.needed)} /> : null}

      {job.status === "open" && (job.rematchCount ?? 0) > 0 ? (
        <Notice tone="info" text={`Your first provider couldn't make it, we're finding another (attempt ${(job.rematchCount ?? 0) + 1}).`} />
      ) : null}

      {settings?.photosEnabled && (job.status === "open" || job.status === "assigned") ? (
        <WorkPhotos jobId={job.id} settings={settings} canAdd prompt />
      ) : null}

      {isTrackable(job, settings?.trackingEnabled) ? <WorkTracking job={job} /> : null}

      {has("choose_provider") ? (
        <section className={`${cardClass} space-y-3`} aria-labelledby="offers-heading">
          <h2 id="offers-heading" className="text-xs font-bold uppercase tracking-wider">
            Choose a provider
          </h2>
          {offers.length === 0 ? (
            <p className="text-sm text-ink-500">No offers yet. Providers near you have been notified, so check back soon.</p>
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => {
                const extra = Math.max(0, o.priceUgx - job.heldUgx);
                return (
                  <li key={o.id} className="space-y-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{o.provider.name}</p>
                        <ProviderMeta provider={o.provider} />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gold">{formatUgx(o.priceUgx)}</p>
                        {o.etaMinutes != null ? <p className="text-[11px] text-ink-500">about {o.etaMinutes} min away</p> : null}
                      </div>
                    </div>
                    {o.message ? <p className="text-xs text-ink-500">&ldquo;{o.message}&rdquo;</p> : null}
                    {extra > 0 ? <p className="text-xs text-ink-500">You&apos;ll pay {formatUgx(extra)} more from your wallet now (the call-out fee already held counts towards it).</p> : null}
                    <button type="button" disabled={!!busy} onClick={() => run(`offer:${o.id}`, () => api.workSelectOffer(job.id, o.id), "Provider chosen.", extra)} className={primaryBtn}>
                      {busy === `offer:${o.id}` ? "Choosing..." : `Choose ${o.provider.name}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {has("accept_quote") || has("decline_quote") ? (
        <section className={`${cardClass} space-y-3`} aria-labelledby="quote-heading">
          <h2 id="quote-heading" className="text-xs font-bold uppercase tracking-wider">
            Your quote
          </h2>
          <dl className="space-y-1 text-sm">
            <Line label="Quoted price" value={formatUgx(quotePrice)} bold />
            <Line label="Already held (call-out fee)" value={formatUgx(job.heldUgx)} />
            <Line label={quoteExtra > 0 ? "You pay now from your wallet" : "You pay now"} value={formatUgx(quoteExtra)} bold />
          </dl>
          {job.quoteExpiresAt ? <p className="text-xs text-ink-500">Quote valid until {formatWorkDate(job.quoteExpiresAt)}.</p> : null}
          {has("accept_quote") ? (
            <button type="button" disabled={!!busy} onClick={() => run("accept", () => api.workAcceptQuote(job.id), "Quote accepted. Your job is booked.", quoteExtra)} className={primaryBtn}>
              {busy === "accept" ? "Accepting..." : quoteExtra > 0 ? `Accept and pay ${formatUgx(quoteExtra)}` : "Accept quote"}
            </button>
          ) : null}
          {has("decline_quote") ? (
            panel === "decline" ? (
              <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold/10 p-3">
                <p className="text-sm">Decline this quote? The job ends{job.heldUgx > 0 ? ` and the ${formatUgx(job.heldUgx)} call-out fee goes to the provider for their visit` : ""}.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => toggle("decline")} className={secondaryBtn}>
                    Keep quote
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => run("decline", () => api.workDeclineQuote(job.id), "Quote declined.")} className={primaryBtn}>
                    {busy === "decline" ? "Declining..." : "Yes, decline"}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => toggle("decline")} className={secondaryBtn}>
                Decline quote
              </button>
            )
          ) : null}
        </section>
      ) : null}

      {has("confirm") || has("report_problem") ? (
        <section className={`${cardClass} space-y-3`} aria-labelledby="done-heading">
          <h2 id="done-heading" className="text-xs font-bold uppercase tracking-wider">
            Is the job done?
          </h2>
          <p className="text-sm text-ink-500">
            Confirming pays the provider.{" "}
            {job.confirmBy
              ? `If you do nothing, it is confirmed automatically on ${formatWorkDate(job.confirmBy)}.`
              : settings
                ? `If you do nothing, it is confirmed automatically after ${hoursLabel(settings.autoConfirmHours)}.`
                : ""}
            {settings && has("report_problem") ? ` You can report a problem within ${hoursLabel(settings.disputeWindowHours)} of completion.` : ""}
          </p>
          {has("confirm") ? (
            <button type="button" disabled={!!busy} onClick={() => run("confirm", () => api.workConfirm(job.id), "Thanks. The provider has been paid.")} className={primaryBtn}>
              <Check className="h-5 w-5" aria-hidden />
              {busy === "confirm" ? "Confirming..." : "Confirm job is done"}
            </button>
          ) : null}
          {has("report_problem") ? (
            panel === "problem" ? (
              <div className="space-y-2">
                <label htmlFor="problem-reason" className="block text-sm font-semibold">
                  What went wrong?
                </label>
                <textarea id="problem-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} required aria-required="true" placeholder="Tell us what happened (a few words at least)" className={fieldClass} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => toggle("problem")} className={secondaryBtn}>
                    Back
                  </button>
                  <button type="button" disabled={!!busy || !problemOk} onClick={() => run("problem", () => api.workReportProblem(job.id, reason.trim()), "Problem reported. Peebee will review it.")} className={primaryBtn}>
                    {busy === "problem" ? "Sending..." : "Report problem"}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => toggle("problem")} className={secondaryBtn}>
                Report a problem
              </button>
            )
          ) : null}
        </section>
      ) : null}

      {has("rate") ? (
        <section className={`${cardClass} space-y-3`} aria-labelledby="rate-heading">
          <h2 id="rate-heading" className="text-xs font-bold uppercase tracking-wider">
            Rate {job.provider?.name ?? "the provider"}
          </h2>
          <div className="flex justify-between" role="radiogroup" aria-label="Rating out of 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className="flex h-12 w-12 items-center justify-center rounded-full"
              >
                <Star className={`h-8 w-8 ${n <= rating ? "fill-gold text-gold" : "text-ink-500"}`} aria-hidden />
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="rate-review" className="mb-1 block text-xs text-ink-500">
              Review (optional)
            </label>
            <textarea id="rate-review" value={review} onChange={(e) => setReview(e.target.value)} maxLength={500} rows={3} className={fieldClass} placeholder="How was it?" />
          </div>
          <button type="button" disabled={!!busy || rating < 1} onClick={() => run("rate", () => api.workRate(job.id, rating, review.trim() || undefined), "Thanks for your rating.")} className={primaryBtn}>
            {busy === "rate" ? "Sending..." : "Submit rating"}
          </button>
        </section>
      ) : null}

      <section className={`${cardClass} space-y-2`} aria-label="Job details">
        <h2 className="text-xs font-bold uppercase tracking-wider">Details</h2>
        <dl className="space-y-1 text-sm">
          <Line label="Service" value={job.service.name} />
          {!isQuote && job.quantity > 1 ? <Line label="Quantity" value={String(job.quantity)} /> : null}
          <Line label="When" value={job.scheduledFor ? formatWorkDate(job.scheduledFor) : "As soon as possible"} />
          <Line label="Where" value={job.address} />
        </dl>
        {job.details ? <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-sm text-ink-500">{job.details}</p> : null}
      </section>

      {job.provider ? (
        <section className={`${cardClass} space-y-2`} aria-label="Provider">
          <h2 className="text-xs font-bold uppercase tracking-wider">Your provider</h2>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{job.provider.name}</p>
              <ProviderMeta provider={job.provider} />
              {job.workerName ? <p className="text-xs text-ink-500">On the job: {job.workerName}</p> : null}
            </div>
          </div>
          {job.provider.bio ? <p className="text-xs text-ink-500">{job.provider.bio}</p> : null}
        </section>
      ) : null}

      <section className={`${cardClass} space-y-2`} aria-label="Price and payment">
        <h2 className="text-xs font-bold uppercase tracking-wider">Price</h2>
        <dl className="space-y-1 text-sm">
          {isQuote ? (
            <>
              <Line label="Call-out fee" value={formatUgx(job.calloutFeeUgx)} />
              {quotePrice > 0 ? <Line label="Quoted price" value={formatUgx(quotePrice)} /> : <Line label="Quoted price" value="Waiting for the provider" />}
            </>
          ) : (
            <Line label={`${formatUgx(job.unitPriceUgx)} x ${job.quantity}`} value={formatUgx(job.priceUgx)} />
          )}
          <Line label={heldLabel(job.status)} value={formatUgx(job.heldUgx)} bold />
        </dl>
        {isQuote && job.status === "open" ? (
          <p className="text-xs text-ink-500">The provider inspects, then quotes. If you accept, the call-out fee counts towards the price.</p>
        ) : null}
      </section>

      {settings?.chatEnabled && job.provider && CHAT_STATUSES.includes(job.status) ? <WorkChat jobId={job.id} providerName={job.provider.name} /> : null}

      {settings?.photosEnabled && job.status !== "open" && job.status !== "assigned" ? (
        <WorkPhotos jobId={job.id} settings={settings} canAdd={!["settled", "cancelled", "expired", "refunded"].includes(job.status)} />
      ) : null}

      {has("cancel") ? (
        <section className={`${cardClass} space-y-3`} aria-label="Cancel">
          {panel === "cancel" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-500">{cancelPolicy(job, settings)}</p>
              <label htmlFor="cancel-reason" className="block text-sm font-semibold">
                Reason (optional)
              </label>
              <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} className={fieldClass} placeholder="Why are you cancelling?" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => toggle("cancel")} className={secondaryBtn}>
                  Keep job
                </button>
                <button type="button" disabled={!!busy} onClick={() => run("cancel", () => api.workCancel(job.id, reason.trim() || undefined), "Job cancelled.")} className={primaryBtn}>
                  {busy === "cancel" ? "Cancelling..." : "Cancel job"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => toggle("cancel")} className={secondaryBtn}>
              Cancel job
            </button>
          )}
        </section>
      ) : null}

      {timeline.length > 0 ? (
        <section className={`${cardClass} space-y-3`} aria-label="Timeline">
          <h2 className="text-xs font-bold uppercase tracking-wider">Timeline</h2>
          <ol className="space-y-3">
            {timeline.map((e, i) => (
              <li key={`${e.action}-${e.created_at}-${i}`} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i === timeline.length - 1 ? "bg-gold" : "bg-ink-500/40"}`} aria-hidden />
                <div>
                  <p className="text-sm font-semibold">{timelineLabel(e.action)}</p>
                  <p className="text-xs text-ink-500">{formatWorkDate(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Link href="/services/work" className={secondaryBtn}>
        All my jobs
      </Link>
    </>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`text-right ${bold ? "font-bold text-gold" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}

function ProviderMeta({ provider }: { provider: NonNullable<WorkJob["provider"]> }) {
  const parts = [
    provider.rating != null ? `${provider.rating.toFixed(1)} (${provider.ratingCount})` : "New provider",
    `${provider.jobsCompleted} job${provider.jobsCompleted === 1 ? "" : "s"} done`,
    provider.kind === "company" ? "Company" : "",
  ].filter(Boolean);
  return <p className="text-xs text-ink-500">{parts.join(" · ")}</p>;
}

function heldLabel(status: string): string {
  if (status === "settled") return "Paid out";
  if (["cancelled", "expired", "refunded"].includes(status)) return "Amount that was held";
  return "Held by Peebee";
}

function cancelPolicy(job: WorkJob, settings: WorkPublicSettings | null): string {
  if (!job.provider || !settings) return "Cancelling returns what Peebee is holding for this job, unless a provider is already on it.";
  return `Cancelling within ${settings.freeCancelMinutes} minutes of a provider taking the job is free. After that, ${settings.lateCancelFeePercent}% of the held amount goes to the provider.`;
}

function statusMessage(job: WorkJob, settings: WorkPublicSettings | null): string {
  switch (job.status) {
    case "open":
      if (job.matchingMode === "customer_picks") return `Providers are sending offers. Choose one below.${job.expiresAt ? ` Open until ${formatWorkDate(job.expiresAt)}; if nobody is chosen you are refunded.` : ""}`;
      if (job.matchingMode === "admin_assigns") return "Peebee is finding a provider for you.";
      return `We've notified providers near you. The first to accept gets the job.${job.expiresAt ? ` If nobody takes it by ${formatWorkDate(job.expiresAt)} you are refunded.` : ""}`;
    case "assigned":
      return `${job.provider?.name ?? "A provider"} will inspect the work and send you a quote.`;
    case "quoted":
      return "Your quote is ready. Review it below.";
    case "booked":
      return `${job.provider?.name ?? "Your provider"} has the job${job.scheduledFor ? ` for ${formatWorkDate(job.scheduledFor)}` : ""}.`;
    case "in_progress":
      return "The job is under way.";
    case "completed":
      return `The provider says the job is done. Please confirm it, or report a problem${settings ? ` within ${hoursLabel(settings.disputeWindowHours)}` : ""}.`;
    case "settled":
      return "All done. The provider has been paid.";
    case "cancelled":
      return `This job was cancelled${job.cancelledBy ? ` by ${job.cancelledBy === "customer" ? "you" : job.cancelledBy}` : ""}.${job.cancelReason ? ` Reason: ${job.cancelReason}` : ""}`;
    case "expired":
      return "No provider took this job in time. Your payment was refunded.";
    case "disputed":
      return `You reported a problem${job.disputeReason ? `: "${job.disputeReason}"` : ""}. Peebee is reviewing it and will release or refund the money.`;
    case "refunded":
      return `This job was refunded to your wallet.${job.resolutionNote ? ` ${job.resolutionNote}` : ""}`;
    default:
      return "";
  }
}
