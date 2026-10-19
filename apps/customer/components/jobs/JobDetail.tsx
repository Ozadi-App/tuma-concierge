"use client";

import type { TalentApplicant, TalentConfig, TalentJob } from "@peebee/shared";
import { BadgeCheck, Flag, MapPin, MessageCircle, Rocket, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ApplicationChat } from "./ApplicationChat";
import { Badge, BusyButton, cardClass, EmptyState, FailureNote, Field, JobsPage, Notice, primaryBtn, Rating, secondaryBtn, Spinner } from "./JobsUI";
import { budgetLabel, EMPLOYMENT, fieldClass, formatUgx, formatWorkDate, JOB_TYPE, jobsFailure, type JobsFailure } from "./jobs-utils";

type Detail = { job: TalentJob };

export function JobDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const [job, setJob] = useState<TalentJob | null>(null);
  const [config, setConfig] = useState<TalentConfig | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  const load = useCallback(() => {
    api.talentJob(id).then((r: Detail) => { setJob(r.job); setFailure(null); }).catch((err) => setFailure(jobsFailure(err)));
  }, [id]);
  useEffect(() => { load(); api.talentConfig().then(setConfig).catch(() => {}); }, [load]);

  const back = job?.isMine ? "/services/jobs/mine" : "/services/jobs/find";
  return (
    <JobsPage eyebrow="Peebee Jobs" title={job ? JOB_TYPE[job.type].label : "Job"} backHref={back} backLabel="Back">
      {!job && !failure ? <Spinner label="Loading job" /> : null}
      {!job && failure ? <EmptyState title="Not available" text={failure.message} action={<Link href="/services/jobs/find" className={secondaryBtn}>Find other work</Link>} /> : null}
      {job && config ? (
        <>
          {params.get("review") ? <Notice tone="info" text="Thanks. Your post is being checked by our team and will go live once approved." /> : null}
          <section className={`${cardClass} space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold leading-snug">{job.title}</h2>
              <Badge status={job.status} />
            </div>
            <p className="text-2xl font-bold text-gold">{budgetLabel(job)}</p>
            <ul className="space-y-1 text-sm text-ink-500">
              {job.category ? <li>{job.category.name}</li> : null}
              <li className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{job.remote ? "Remote" : [job.area, job.address].filter(Boolean).join(", ") || "—"}</li>
              {job.employmentType ? <li>{EMPLOYMENT[job.employmentType]}</li> : null}
              {job.paymentMode !== "none" ? <li>{job.paymentMode === "escrow" ? "Protected payment through Peebee" : "Paid directly to the worker"}</li> : null}
              {job.workersNeeded > 1 ? <li>{job.workersNeeded} people needed</li> : null}
              {job.deadline ? <li>Needed by {formatWorkDate(job.deadline)}</li> : null}
            </ul>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{job.description}</p>
            {job.skills.length ? <div className="flex flex-wrap gap-1.5">{job.skills.map((s) => <span key={s} className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-[11px] font-semibold">{s}</span>)}</div> : null}
            <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-xs text-ink-500">
              <span className="flex items-center gap-1.5">{job.employer.name}{job.employer.verified ? <BadgeCheck className="h-4 w-4 text-gold" aria-label="Verified" /> : null}<Rating rating={job.employer.rating} count={job.employer.ratingCount} /></span>
              <span>{job.applicationCount} applied</span>
            </div>
          </section>
          {job.isMine ? <EmployerPanel job={job} config={config} reload={load} /> : <WorkerPanel job={job} reload={load} />}
          {!job.isMine ? <ReportJob id={job.id} /> : null}
        </>
      ) : null}
    </JobsPage>
  );
}

function ReportJob({ id }: { id: string }) {
  const [sent, setSent] = useState(false);
  return (
    <button type="button" disabled={sent} onClick={async () => {
      const reason = window.prompt("What is wrong with this job?");
      if (!reason || reason.trim().length < 3) return;
      try { await api.talentReport({ targetType: "job", targetId: id, reason: reason.trim() }); setSent(true); } catch { /* ignore */ }
    }} className="mx-auto flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-ink-500 underline disabled:no-underline">
      <Flag className="h-3.5 w-3.5" aria-hidden />{sent ? "Reported. Thank you." : "Report this job"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The worker's side: apply, follow up
// ---------------------------------------------------------------------------

function WorkerPanel({ job, reload }: { job: TalentJob; reload: () => void }) {
  const mine = job.myApplication && typeof job.myApplication === "object" ? job.myApplication : null;
  const [message, setMessage] = useState("");
  const [bid, setBid] = useState(job.type === "gig" ? String(job.budgetMaxUgx) : "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  async function apply() {
    setBusy(true);
    setFailure(null);
    try {
      await api.talentApply(job.id, { message, bidUgx: Number(bid) || 0 });
      reload();
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(false);
    }
  }

  if (mine && mine.status !== "withdrawn") {
    return (
      <section className={`${cardClass} space-y-3`}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Your application</h3><Badge status={mine.status} /></div>
        {mine.bidUgx > 0 ? <p className="text-sm">Your price: <strong>{formatUgx(mine.bidUgx)}</strong></p> : null}
        {mine.message ? <p className="text-sm text-ink-500">{mine.message}</p> : null}
        {mine.contractId ? <Link href={`/services/jobs/contracts/${mine.contractId}`} className={primaryBtn}>Open the job</Link> : null}
        {["applied", "shortlisted"].includes(mine.status) ? (
          <BusyButton busy={busy} className={secondaryBtn} onClick={async () => { setBusy(true); try { await api.talentWithdrawApplication(mine.id); reload(); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(false); } }}>Withdraw application</BusyButton>
        ) : null}
        <FailureNote failure={failure} />
        <details className="rounded-2xl border border-[var(--border-faint)] p-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-gold" aria-hidden />Messages</summary><div className="pt-3"><ApplicationChat applicationId={mine.id} /></div></details>
      </section>
    );
  }
  if (job.status !== "open") return <Notice tone="info" text="This job isn't taking applications." />;

  return (
    <section className={`${cardClass} space-y-3`}>
      <h3 className="text-sm font-bold">{job.type === "hiring" ? "Apply for this role" : job.type === "project" ? "Send your offer" : "Take this gig"}</h3>
      {job.invited ? <p className="rounded-xl bg-gold/10 p-2 text-xs font-semibold text-gold">The employer invited you to apply.</p> : null}
      {job.type !== "hiring" ? (
        <Field label={job.type === "project" ? "Your price (UGX)" : "Your price (UGX)"} hint={job.type === "gig" ? "The job pays this much. You can ask for less." : "What you'll charge for the whole project."}>
          <input inputMode="numeric" value={bid} onChange={(e) => setBid(e.target.value.replace(/\D/g, ""))} className={fieldClass} />
        </Field>
      ) : null}
      <Field label="Message (optional)"><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} placeholder="Tell them why you're a good fit." className={fieldClass} /></Field>
      <FailureNote failure={failure} />
      {failure?.code === "profile_required" || failure?.code === "profile_not_live" ? <Link href="/services/jobs/profile" className={secondaryBtn}>Go to my worker profile</Link> : null}
      <BusyButton busy={busy} onClick={apply} className={primaryBtn}>{job.type === "gig" ? "Apply for this gig" : job.type === "project" ? "Send offer" : "Apply"}</BusyButton>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The employer's side: applicants, accepting and hiring
// ---------------------------------------------------------------------------

function EmployerPanel({ job, config, reload }: { job: TalentJob; config: TalentConfig; reload: () => void }) {
  const [applicants, setApplicants] = useState<TalentApplicant[] | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const loadApplicants = useCallback(() => {
    api.talentApplicants(job.id).then((r) => setApplicants(r.applicants)).catch((err) => setFailure(jobsFailure(err)));
  }, [job.id]);
  useEffect(loadApplicants, [loadApplicants]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setFailure(null);
    try {
      await fn();
      loadApplicants();
      reload();
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(null);
    }
  }

  const canClose = ["open", "pending_review"].includes(job.status);
  return (
    <>
      {canClose ? (
      <section className={`${cardClass} space-y-3`}>
        <h3 className="text-sm font-bold">Manage this job</h3>
        <div className="grid grid-cols-2 gap-2">
          {job.status === "open" ? (
            <BusyButton busy={busy === "boost"} className={secondaryBtn} onClick={() => act("boost", () => api.talentBoostJob(job.id))}><Rocket className="h-4 w-4" aria-hidden />Boost</BusyButton>
          ) : null}
          {job.status === "open" ? <Link href={`/services/jobs/workers?forJob=${job.id}`} className={secondaryBtn}><UserPlus className="h-4 w-4" aria-hidden />Invite</Link> : null}
          {canClose ? <BusyButton busy={busy === "close"} className={secondaryBtn} onClick={() => act("close", () => api.talentCloseJob(job.id))}>Close job</BusyButton> : null}
        </div>
        {job.status === "open" && !config.freeAccess ? <p className="text-[11px] text-ink-500">Boosting shows your job first for {config.limits.boostDays} days.</p> : null}
        <FailureNote failure={failure} />
      </section>
      ) : <FailureNote failure={failure} />}

      <section className="space-y-3" aria-label="Applicants">
        <h3 className="text-sm font-bold">{applicants ? `${applicants.length} ${applicants.length === 1 ? "applicant" : "applicants"}` : "Applicants"}</h3>
        {!applicants ? <Spinner label="Loading applicants" /> : null}
        {applicants?.length === 0 ? <EmptyState title="No applicants yet" text="Workers near you have been told about this job. You can also invite people directly." /> : null}
        {applicants?.map((a) => (
          <article key={a.id} className={`${cardClass} space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/services/jobs/workers/${encodeURIComponent(a.worker.id)}`} className="min-w-0">
                <strong className="flex items-center gap-1.5 text-sm">{a.worker.name}{a.worker.verified ? <BadgeCheck className="h-4 w-4 text-gold" aria-label="ID verified" /> : null}</strong>
                <span className="block truncate text-xs text-ink">{a.worker.headline}</span>
                <span className="flex items-center gap-2 text-[11px] text-ink-500"><Rating rating={a.worker.rating} count={a.worker.ratingCount} />{a.worker.jobsCompleted} jobs</span>
              </Link>
              <Badge status={a.status} />
            </div>
            {a.bidUgx > 0 ? <p className="text-sm">Offer: <strong className="text-gold">{formatUgx(a.bidUgx)}</strong></p> : null}
            {a.message ? <p className="text-sm text-ink-500">{a.message}</p> : null}
            {!a.phoneLocked && a.worker.phone ? <a href={`tel:${a.worker.phone}`} className="text-sm font-bold text-gold underline">Call {a.worker.phone}</a> : null}

            {["applied", "shortlisted"].includes(a.status) && job.status === "open" ? (
              <div className="grid grid-cols-2 gap-2">
                {job.type === "hiring" ? (
                  <BusyButton busy={busy === `h${a.id}`} className={primaryBtn} onClick={() => act(`h${a.id}`, () => api.talentHire(a.id))}>Hire</BusyButton>
                ) : (
                  <button type="button" className={primaryBtn} onClick={() => setOpen(open === a.id ? null : a.id)}>Accept…</button>
                )}
                {a.status === "applied" ? <BusyButton busy={busy === `s${a.id}`} className={secondaryBtn} onClick={() => act(`s${a.id}`, () => api.talentShortlist(a.id))}>Shortlist</BusyButton> : <BusyButton busy={busy === `r${a.id}`} className={secondaryBtn} onClick={() => act(`r${a.id}`, () => api.talentReject(a.id))}>Decline</BusyButton>}
                {a.status === "applied" ? <BusyButton busy={busy === `r${a.id}`} className={`${secondaryBtn} col-span-2`} onClick={() => act(`r${a.id}`, () => api.talentReject(a.id))}>Decline</BusyButton> : null}
              </div>
            ) : null}
            {a.contractId ? <Link href={`/services/jobs/contracts/${a.contractId}`} className={primaryBtn}>Open the job</Link> : null}
            {open === a.id ? <AcceptPanel applicant={a} job={job} config={config} onDone={(contractId) => { setOpen(null); loadApplicants(); reload(); if (contractId) window.location.assign(`/services/jobs/contracts/${contractId}`); }} onError={setFailure} /> : null}
            {a.status !== "rejected" ? (
              <details className="rounded-2xl border border-[var(--border-faint)] p-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-gold" aria-hidden />Messages</summary><div className="pt-3"><ApplicationChat applicationId={a.id} /></div></details>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}

function AcceptPanel({ applicant, job, config, onDone, onError }: { applicant: TalentApplicant; job: TalentJob; config: TalentConfig; onDone: (contractId?: string) => void; onError: (f: JobsFailure | null) => void }) {
  const price = applicant.bidUgx > 0 ? applicant.bidUgx : job.budgetMaxUgx;
  const [steps, setSteps] = useState<{ title: string; amount: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const sum = steps.reduce((t, s) => t + (Number(s.amount) || 0), 0);
  const stepsOk = steps.length === 0 || sum === price;
  const escrow = job.paymentMode === "escrow";

  async function accept() {
    setBusy(true);
    onError(null);
    try {
      const r = await api.talentAccept(applicant.id, steps.length ? { milestones: steps.map((s) => ({ title: s.title || "Step", amountUgx: Number(s.amount) || 0 })) } : {});
      onDone(r.contractId);
    } catch (err) {
      onError(jobsFailure(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gold/40 bg-gold/5 p-3">
      <p className="text-sm">Agree <strong>{formatUgx(price)}</strong> with {applicant.worker.name.split(" ")[0]}.{escrow ? " The money is held safely by Peebee and paid out when you approve the work." : " You pay them directly."}</p>
      {job.type === "project" && config.limits.maxMilestones > 1 ? (
        <div className="space-y-2">
          {steps.length === 0 ? <button type="button" className="text-xs font-bold text-gold underline" onClick={() => setSteps([{ title: "First part", amount: String(Math.round(price / 2)) }, { title: "Final part", amount: String(price - Math.round(price / 2)) }])}>Pay in steps instead</button> : null}
          {steps.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem] gap-2">
              <input value={s.title} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={`Step ${i + 1} name`} className={fieldClass} />
              <input inputMode="numeric" value={s.amount} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/\D/g, "") } : x)))} aria-label={`Step ${i + 1} amount`} className={fieldClass} />
            </div>
          ))}
          {steps.length > 0 ? (
            <div className="flex items-center justify-between text-xs">
              <span className={stepsOk ? "text-ink-500" : "font-bold text-gold"}>{formatUgx(sum)} of {formatUgx(price)}</span>
              <span className="flex gap-3">
                {steps.length < config.limits.maxMilestones ? <button type="button" className="font-bold text-gold underline" onClick={() => setSteps([...steps, { title: "", amount: "" }])}>Add step</button> : null}
                <button type="button" className="font-bold text-ink-500 underline" onClick={() => setSteps([])}>One payment</button>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <BusyButton busy={busy} disabled={!stepsOk} onClick={accept} className={primaryBtn}>{escrow ? `Accept and hold ${formatUgx(price)}` : "Accept"}</BusyButton>
    </div>
  );
}
