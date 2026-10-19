"use client";

import type { TalentJobInput, TalentJobType, TalentPaymentMode } from "@peebee/shared";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { BusyButton, Chip, cardClass, FailureNote, Field, JobsPage, primaryBtn, secondaryBtn, Spinner, Unavailable } from "./JobsUI";
import { EMPLOYMENT, fieldClass, formatUgx, JOB_TYPE, jobsFailure, newKey, type JobsFailure } from "./jobs-utils";
import { useJobsConfig } from "./useJobsConfig";

const PAYMENT: Record<TalentPaymentMode, { label: string; blurb: string }> = {
  escrow: { label: "Pay through Peebee (protected)", blurb: "We hold your money and release it when you confirm the work is done. Safest for both sides." },
  direct: { label: "Pay the worker directly", blurb: "You pay the worker yourself, in cash or mobile money. Peebee collects only its small fee." },
};

export function PostJob() {
  const { config, failure: configFailure } = useJobsConfig({ needMe: false });
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite");
  const key = useRef(newKey());

  const [step, setStep] = useState(0);
  const [type, setType] = useState<TalentJobType>("gig");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [area, setArea] = useState("");
  const [remote, setRemote] = useState(false);
  const [budget, setBudget] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [employment, setEmployment] = useState<NonNullable<TalentJobInput["employmentType"]>>("full_time");
  const [workers, setWorkers] = useState("1");
  const [payment, setPayment] = useState<TalentPaymentMode | "">("");
  const [skills, setSkills] = useState("");
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const types = config?.jobTypes ?? [];
  const effectiveType = types.includes(type) ? type : types[0];
  const payModes = config?.paymentModes ?? ["escrow"];
  const pay = (payment || config?.defaultPaymentMode || "escrow") as TalentPaymentMode;
  const budgetNum = Number(budget.replace(/\D/g, "")) || 0;
  const fee = useMemo(() => config?.fees.find((f) => f.kind === "listing" && (f.jobType === effectiveType || f.jobType === "")), [config, effectiveType]);
  const cats = config?.categories ?? [];

  if (configFailure) {
    return <JobsPage eyebrow="Peebee Jobs" title="Post a job" backHref="/services/jobs" backLabel="Back to Jobs"><Unavailable failure={configFailure} /></JobsPage>;
  }
  if (!config || !effectiveType) return <JobsPage eyebrow="Peebee Jobs" title="Post a job" backHref="/services/jobs" backLabel="Back to Jobs"><Spinner label="Loading" /></JobsPage>;

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); }, () => setLocating(false), { timeout: 8000 });
  }

  const canNext0 = Boolean(effectiveType);
  const canNext1 = title.trim().length >= 3 && description.trim().length >= 10 && Boolean(categoryId) && (remote || area.trim().length >= 2);
  const money = effectiveType === "hiring" || budgetNum > 0;

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const input: TalentJobInput = {
        type: effectiveType!, title: title.trim(), description: description.trim(), categoryId, remote, area: area.trim() || undefined, lat: coords?.lat, lng: coords?.lng,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20), idempotencyKey: key.current, acceptRules: true,
        ...(effectiveType === "hiring"
          ? { employmentType: employment, budgetMaxUgx: budgetNum, workersNeeded: Number(workers) || 1 }
          : effectiveType === "project"
            ? { budgetMinUgx: Number(budgetMin.replace(/\D/g, "")) || 0, budgetMaxUgx: budgetNum, paymentMode: pay, workersNeeded: Number(workers) || 1 }
            : { budgetMaxUgx: budgetNum, paymentMode: pay, workersNeeded: Number(workers) || 1 }),
      };
      const r = await api.talentPostJob(input);
      if (invite) await api.talentInvite(r.job.id, invite).catch(() => {});
      router.replace(`/services/jobs/${encodeURIComponent(r.job.id)}${r.needsReview ? "?review=1" : ""}`);
    } catch (err) {
      setFailure(jobsFailure(err));
      setBusy(false);
    }
  }

  return (
    <JobsPage eyebrow="Peebee Jobs" title="Post a job" backHref="/services/jobs" backLabel="Back to Jobs">
      <ol className="flex gap-1.5" aria-label="Steps">
        {["Kind", "Details", "Pay & post"].map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gold" : "bg-[rgb(var(--surface-muted))]"}`} title={s} />)}
      </ol>

      {step === 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-bold">What kind of job is it?</h2>
          {types.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={effectiveType === t} className={`${cardClass} block w-full space-y-1 text-left ${effectiveType === t ? "!border-gold ring-1 ring-gold" : ""}`}>
              <strong className="block">{JOB_TYPE[t].label}</strong>
              <span className="block text-xs text-ink-500">{JOB_TYPE[t].blurb}</span>
            </button>
          ))}
          <button type="button" disabled={!canNext0} onClick={() => setStep(1)} className={primaryBtn}>Continue<ArrowRight className="h-4 w-4" aria-hidden /></button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={effectiveType === "hiring" ? "e.g. Shop assistant" : "e.g. Clean my two bedroom flat"} className={fieldClass} /></Field>
          <Field label="What needs doing?" hint="Say what, where, and anything the worker should bring. Only lawful work can be posted."><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} className={fieldClass} /></Field>
          <Field label="Kind of work">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
              <option value="">Choose…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap items-center gap-2"><Chip on={remote} onClick={() => setRemote(!remote)}>Can be done remotely</Chip></div>
          {!remote ? (
            <Field label="Where?" hint={coords ? "Your location is attached so nearby workers are found." : undefined}>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area, e.g. Kololo" className={fieldClass} />
              <button type="button" onClick={locate} disabled={locating} className="mt-1 min-h-[40px] text-xs font-bold text-gold underline">{locating ? "Locating…" : coords ? "Location attached" : "Use my current location"}</button>
            </Field>
          ) : null}
          <Field label="Skills wanted (optional)" hint="Separate with commas"><input value={skills} onChange={(e) => setSkills(e.target.value)} className={fieldClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep(0)} className={secondaryBtn}>Back</button>
            <button type="button" disabled={!canNext1} onClick={() => setStep(2)} className={primaryBtn}>Continue</button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          {effectiveType === "hiring" ? (
            <>
              <Field label="Type of role"><select value={employment} onChange={(e) => setEmployment(e.target.value as NonNullable<TalentJobInput["employmentType"]>)} className={fieldClass}>{Object.entries(EMPLOYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Pay offered (UGX, optional)" hint="Per month, or leave blank to agree later"><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
            </>
          ) : (
            <>
              {effectiveType === "project" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Budget from (UGX)"><input inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
                  <Field label="Budget up to (UGX)"><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
                </div>
              ) : (
                <Field label="What will you pay? (UGX)" hint={`Between ${formatUgx(config.limits.minJobUgx)} and ${formatUgx(config.limits.maxJobUgx)}`}><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
              )}
              {payModes.length > 1 ? (
                <fieldset className="space-y-2"><legend className="text-xs font-bold text-ink-500">How will you pay?</legend>
                  {payModes.map((m) => (
                    <button key={m} type="button" aria-pressed={pay === m} onClick={() => setPayment(m)} className={`${cardClass} block w-full space-y-1 text-left ${pay === m ? "!border-gold ring-1 ring-gold" : ""}`}>
                      <strong className="block text-sm">{PAYMENT[m].label}</strong><span className="block text-xs text-ink-500">{PAYMENT[m].blurb}</span>
                    </button>
                  ))}
                </fieldset>
              ) : <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs text-ink-500"><strong className="text-ink">{PAYMENT[payModes[0]].label}.</strong> {PAYMENT[payModes[0]].blurb}</p>}
            </>
          )}
          <Field label="How many people do you need?"><input inputMode="numeric" value={workers} onChange={(e) => setWorkers(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>

          {!config.freeAccess && fee ? <p className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs">Posting this costs {fee.model === "flat" ? formatUgx(fee.flatUgx) : `${fee.percent}% of the pay`}{fee.freeFirstN ? ` (your first ${fee.freeFirstN} each month are free)` : ""}.</p> : null}
          {config.freeAccess ? <p className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs">Posting is free right now.</p> : null}

          <label className="flex items-start gap-3 rounded-2xl border border-[var(--border-faint)] p-3 text-sm">
            <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span><ShieldCheck className="mr-1 inline h-4 w-4 text-gold" aria-hidden />I confirm this work is lawful. Peebee does not allow illegal or unconstitutional work, and posts that break this are removed.</span>
          </label>
          <FailureNote failure={failure} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setStep(1)} className={secondaryBtn}>Back</button>
            <BusyButton busy={busy} disabled={!rules || !money || (effectiveType !== "hiring" && budgetNum <= 0)} onClick={submit} className={primaryBtn}>Post job</BusyButton>
          </div>
          <Link href="/services/jobs" className="block text-center text-xs font-semibold text-ink-500 underline">Cancel</Link>
        </section>
      ) : null}
    </JobsPage>
  );
}
