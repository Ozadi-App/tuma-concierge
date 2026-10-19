"use client";

import type { TalentMembership, TalentPlan } from "@peebee/shared";
import { Check, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { BusyButton, cardClass, FailureNote, JobsPage, Notice, primaryBtn, secondaryBtn, Spinner } from "./JobsUI";
import { formatUgx, jobsFailure, type JobsFailure } from "./jobs-utils";

const WAIVED: Record<string, string> = {
  worker_onboarding: "no joining fee", employer_onboarding: "no joining fee", listing: "free job posts", boost: "free boosts", application: "free applications",
  hire_fee: "no hiring fee", contact_unlock: "free contact unlocks", employer_commission: "no employer fee", worker_commission: "no worker fee",
};

export function ProPlans() {
  const [plans, setPlans] = useState<TalentPlan[] | null>(null);
  const [freeAccess, setFreeAccess] = useState(false);
  const [membership, setMembership] = useState<TalentMembership | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => {
    api.talentPlans().then((r) => { setPlans(r.plans); setFreeAccess(r.freeAccess); }).catch((err) => setFailure(jobsFailure(err)));
    api.talentMe().then((m) => setMembership(m.membership)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function subscribe(p: TalentPlan) {
    setBusy(p.id);
    setFailure(null);
    setDone(null);
    try {
      const r = await api.talentSubscribe(p.id);
      setDone(r.trial ? `Your ${p.trialDays}-day free trial of ${p.name} has started.` : `You're on ${p.name}.`);
      load();
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(null);
    }
  }

  const mine = [...(membership?.worker.subscriptions ?? []), ...(membership?.employer.subscriptions ?? [])];
  const pro = membership?.features.filter((f) => f.pro) ?? [];

  return (
    <JobsPage eyebrow="Peebee Jobs" title="Plans & Pro" backHref="/services/jobs" backLabel="Back to Jobs">
      {freeAccess ? <Notice tone="info" text="Everything on Jobs is free right now, so you don't need a plan. Plans will appear here if that changes." /> : null}
      {membership?.worker.trial || membership?.employer.trial ? <Notice tone="info" text="Your free Pro trial is running. Every Pro feature is open to you." /> : null}
      {!plans && !failure ? <Spinner label="Loading plans" /> : null}
      <FailureNote failure={failure} />
      {done ? <Notice tone="info" text={done} /> : null}

      {mine.length > 0 ? (
        <section className="space-y-2" aria-label="Your plans">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Your plans</h2>
          {mine.map((s) => (
            <div key={s.id} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span><strong className="block text-sm">{s.planName ?? "Plan"}</strong><span className="block text-xs text-ink-500">{s.status === "trial" ? "Free trial until" : s.autoRenew ? "Renews" : "Ends"} {new Date(s.expiresAt.replace(" ", "T") + "Z").toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</span></span>
              {s.autoRenew ? <BusyButton busy={busy === s.id} className="min-h-[44px] rounded-2xl border border-[var(--border-faint)] px-4 text-xs font-bold" onClick={async () => { setBusy(s.id); try { await api.talentCancelSubscription(s.id); load(); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(null); } }}>Stop renewing</BusyButton> : null}
            </div>
          ))}
        </section>
      ) : null}

      {plans?.map((p) => (
        <section key={p.id} className={`${cardClass} space-y-3`}>
          <div className="flex items-start justify-between gap-2">
            <div><span className="text-[10px] font-bold uppercase tracking-wider text-gold">{p.audience === "worker" ? "For workers" : "For employers"}</span><h2 className="text-lg font-bold">{p.name}</h2></div>
            <div className="text-right"><strong className="block text-lg text-gold">{p.priceUgx === 0 ? "Free" : formatUgx(p.priceUgx)}</strong>{p.priceUgx > 0 ? <span className="text-[11px] text-ink-500">every {p.periodDays} days</span> : null}</div>
          </div>
          {p.description ? <p className="text-sm text-ink-500">{p.description}</p> : null}
          <ul className="space-y-1.5 text-sm">
            {p.features.map((f) => <li key={f.key} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{f.label}</li>)}
            {p.waivedKinds.map((k) => WAIVED[k] ? <li key={k} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{WAIVED[k].charAt(0).toUpperCase() + WAIVED[k].slice(1)}</li> : null)}
            {p.workerCommissionPercent != null ? <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />Only {p.workerCommissionPercent}% fee on jobs you do</li> : null}
            {p.employerCommissionPercent != null ? <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />Only {p.employerCommissionPercent}% fee on jobs you pay for</li> : null}
          </ul>
          {p.subscribed ? <p className="rounded-xl bg-gold/10 p-2 text-center text-xs font-bold text-gold">You&apos;re on this plan</p> : (
            <BusyButton busy={busy === p.id} className={primaryBtn} onClick={() => subscribe(p)}>{p.trialAvailable && p.priceUgx > 0 ? `Start ${p.trialDays}-day free trial` : p.priceUgx === 0 ? "Get this plan" : `Choose ${p.name}`}</BusyButton>
          )}
        </section>
      ))}

      {pro.length > 0 ? (
        <section className="space-y-2" aria-label="Pro features">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Pro features</h2>
          <ul className="divide-y divide-[var(--border-faint)] overflow-hidden rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]">
            {pro.map((f) => (
              <li key={f.key} className="flex items-center gap-3 px-4 py-3">
                {f.unlocked ? <Check className="h-4 w-4 shrink-0 text-gold" aria-hidden /> : <Lock className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />}
                <span className="min-w-0"><strong className="block text-sm">{f.label}</strong><span className="block text-xs text-ink-500">{f.description}</span></span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <button type="button" onClick={load} className={secondaryBtn}>Refresh</button>
    </JobsPage>
  );
}
