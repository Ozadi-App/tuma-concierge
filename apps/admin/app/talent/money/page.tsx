"use client";

import type { TalentAdminCharge, TalentAdminFeature, TalentAdminFeeRule, TalentAdminFeeRuleInput, TalentAdminPlan, TalentAdminPlanInput, TalentFeeKind, TalentJobType } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Badge, Chip, ErrorNote, Field, inputCls, label, Toggle, ugx, useTalentPermissions, when } from "../../../components/talent/ui";
import { api, errorMessage } from "../../../lib/api";

const KIND_HELP: Record<TalentFeeKind, { title: string; who: string; help: string; jobTypes: boolean }> = {
  worker_onboarding: { title: "Worker joining fee", who: "Worker", help: "One-off fee to activate a worker profile.", jobTypes: false },
  employer_onboarding: { title: "Employer joining fee", who: "Employer", help: "One-off fee the first time someone posts a job.", jobTypes: false },
  listing: { title: "Posting a job", who: "Employer", help: "Charged when a job is posted. A percentage is taken from the job's pay.", jobTypes: true },
  boost: { title: "Boosting", who: "Either", help: "Charged each time a job or profile is boosted to the top.", jobTypes: true },
  application: { title: "Applying", who: "Worker", help: "Charged for each application. 'First N free' gives a monthly allowance.", jobTypes: true },
  hire_fee: { title: "Hiring placement", who: "Employer", help: "Charged when a hiring post is filled. A percentage is taken from the pay offered.", jobTypes: false },
  contact_unlock: { title: "Unlocking a phone number", who: "Employer", help: "Charged to see a worker's number before hiring through Peebee.", jobTypes: false },
  employer_commission: { title: "Employer commission", who: "Employer", help: "Added on top of what the employer pays for gigs and projects.", jobTypes: true },
  worker_commission: { title: "Worker commission", who: "Worker", help: "Taken from the worker's pay on gigs and projects.", jobTypes: true },
};
const KINDS = Object.keys(KIND_HELP) as TalentFeeKind[];
const JOB_TYPES: TalentJobType[] = ["gig", "project", "hiring"];

const ruleSummary = (r: TalentAdminFeeRule) =>
  r.model === "free" ? "Free" : r.model === "flat" ? ugx(r.flat_ugx) : `${r.percent}%${r.min_ugx ? ` (min ${ugx(r.min_ugx)})` : ""}${r.max_ugx ? ` (max ${ugx(r.max_ugx)})` : ""}`;

export default function TalentMoneyPage() {
  const { canManage } = useTalentPermissions();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [rules, setRules] = useState<TalentAdminFeeRule[] | null>(null);
  const [plans, setPlans] = useState<TalentAdminPlan[] | null>(null);
  const [features, setFeatures] = useState<TalentAdminFeature[]>([]);
  const [charges, setCharges] = useState<TalentAdminCharge[] | null>(null);
  const [master, setMaster] = useState<{ freeAccess: boolean; freeOnboarding: boolean; trialDays: string } | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<TalentAdminFeeRuleInput> | null>(null);
  const [editingPlan, setEditingPlan] = useState<(Partial<TalentAdminPlanInput> & { id?: string }) | null>(null);

  const load = useCallback(() => {
    api.talentAdminGetSettings().then((r) => setMaster({ freeAccess: r.settings.freeAccess, freeOnboarding: r.settings.freeOnboarding, trialDays: String(r.settings.trialDays) })).catch((e) => setError(errorMessage(e)));
    api.talentAdminFeeRules().then((r) => setRules(r.rules)).catch((e) => setError(errorMessage(e)));
    api.talentAdminPlans().then((r) => setPlans(r.plans)).catch((e) => setError(errorMessage(e)));
    api.talentAdminFeatures().then((r) => setFeatures(r.features)).catch((e) => setError(errorMessage(e)));
    api.talentAdminCharges().then((r) => setCharges(r.charges)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  async function guard(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    setSaved(null);
    try { await fn(); setSaved(ok); load(); } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <div className="space-y-6">
      <ErrorNote message={error} />
      {saved && <p className="rounded-xl bg-gold/10 px-3 py-2 text-sm text-ink">{saved}</p>}

      {master && (
        <section className="home-card space-y-3 !p-3.5">
          <h2 className="text-sm font-bold text-ink">Master switches</h2>
          <Toggle label="All free access" hint="Everything is free: no fees, commission, plan prices or Pro locks. Your fee rules and plans below are kept and apply again the moment this is off." checked={master.freeAccess} disabled={!canManage} onChange={(v) => setMaster({ ...master, freeAccess: v })} />
          <Toggle label="Free onboarding" hint="People joining as a worker or employer pay no joining fee, even when charging is on." checked={master.freeOnboarding} disabled={!canManage} onChange={(v) => setMaster({ ...master, freeOnboarding: v })} />
          <Field label="Free trial of Pro features (days)" hint="Given once to each new worker and employer. 0 turns the trial off."><input inputMode="numeric" disabled={!canManage} value={master.trialDays} onChange={(e) => setMaster({ ...master, trialDays: e.target.value.replace(/\D/g, "") })} className={inputCls} /></Field>
          {canManage && <button type="button" onClick={() => guard(() => api.talentAdminUpdateSettings({ freeAccess: master.freeAccess, freeOnboarding: master.freeOnboarding, trialDays: Number(master.trialDays) || 0 }), "Saved.")} className="min-h-11 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink-gold">Save switches</button>}
          {master.freeAccess && <p className="text-xs text-ink-500">Charging is currently off. Rules marked &ldquo;Active&rdquo; below will start applying when you turn All free access off.</p>}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">Fees and commissions</h2>{canManage && <button type="button" onClick={() => setEditingRule({ kind: "listing", jobType: "", model: "flat", active: true })} className="text-xs font-bold text-gold underline">Add a rule</button>}</div>
        {editingRule && <RuleForm initial={editingRule} onCancel={() => setEditingRule(null)} onSave={(r) => guard(async () => { await api.talentAdminSaveFeeRule(r); setEditingRule(null); }, "Fee rule saved.")} />}
        {rules === null && <p className="text-sm text-ink-500">Loading…</p>}
        <ul className="space-y-2">
          {rules?.map((r) => (
            <li key={r.id} className="home-card flex items-start justify-between gap-2 !p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{KIND_HELP[r.kind]?.title ?? label(r.kind)}{r.job_type ? ` · ${label(r.job_type)}` : ""}</p>
                <p className="text-xs text-ink-500">{KIND_HELP[r.kind]?.who} pays · <strong className="text-ink">{ruleSummary(r)}</strong>{r.free_first_n ? ` · first ${r.free_first_n} free each month` : ""}</p>
                {r.note && <p className="text-[11px] text-ink-500">{r.note}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge tone={r.active ? "good" : "neutral"}>{r.active ? "active" : "off"}</Badge>
                {canManage && (
                  <span className="flex gap-2 text-xs font-bold text-gold">
                    <button type="button" className="underline" onClick={() => setEditingRule({ kind: r.kind, jobType: r.job_type, model: r.model, flatUgx: r.flat_ugx, percent: r.percent, minUgx: r.min_ugx, maxUgx: r.max_ugx, freeFirstN: r.free_first_n, active: Boolean(r.active), note: r.note })}>Edit</button>
                    <button type="button" className="underline" onClick={() => guard(() => api.talentAdminSaveFeeRule({ kind: r.kind, jobType: r.job_type, model: r.model, flatUgx: r.flat_ugx, percent: r.percent, minUgx: r.min_ugx, maxUgx: r.max_ugx, freeFirstN: r.free_first_n, active: !r.active, note: r.note }), r.active ? "Rule turned off." : "Rule turned on.")}>{r.active ? "Turn off" : "Turn on"}</button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">Plans (subscriptions)</h2>{canManage && <button type="button" onClick={() => setEditingPlan({ audience: "worker", priceUgx: 10000, periodDays: 30, trialDays: 7, features: [], waivedKinds: [], active: true })} className="text-xs font-bold text-gold underline">Add a plan</button>}</div>
        {editingPlan && <PlanForm initial={editingPlan} features={features} onCancel={() => setEditingPlan(null)} onSave={(p, id) => guard(async () => { if (id) await api.talentAdminUpdatePlan(id, p); else await api.talentAdminCreatePlan(p as TalentAdminPlanInput); setEditingPlan(null); }, "Plan saved.")} />}
        <ul className="space-y-2">
          {plans?.map((p) => (
            <li key={p.id} className="home-card space-y-1 !p-3.5">
              <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-ink">{p.name} <span className="text-[11px] font-normal text-ink-500">· {label(p.audience)}</span></p><p className="text-xs text-ink-500">{ugx(p.price_ugx)} / {p.period_days} days · {p.trial_days ? `${p.trial_days}-day trial` : "no trial"} · {p.subscribers} subscribers</p></div><Badge tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "off"}</Badge></div>
              <p className="text-xs text-ink-500">Unlocks: {p.features.length ? p.features.map(label).join(", ") : "nothing"}. Waives: {p.waived_kinds.length ? p.waived_kinds.map(label).join(", ") : "nothing"}.{p.worker_commission_percent != null ? ` Worker commission ${p.worker_commission_percent}%.` : ""}{p.employer_commission_percent != null ? ` Employer commission ${p.employer_commission_percent}%.` : ""}</p>
              {canManage && <button type="button" className="text-xs font-bold text-gold underline" onClick={() => setEditingPlan({ id: p.id, code: p.code, audience: p.audience, name: p.name, description: p.description, priceUgx: p.price_ugx, periodDays: p.period_days, trialDays: p.trial_days, features: p.features, waivedKinds: p.waived_kinds, workerCommissionPercent: p.worker_commission_percent, employerCommissionPercent: p.employer_commission_percent, active: Boolean(p.active) })}>Edit</button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-ink">Pro features</h2>
        <p className="text-xs text-ink-500">Mark an area as Pro to lock it behind a plan or the free trial. Anything not marked Pro stays open to everyone.</p>
        <ul className="divide-y divide-[var(--border-faint)] rounded-xl border border-[var(--border-faint)]">
          {features.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{f.label}</span><span className="block text-xs text-ink-500">{f.description} · {label(f.audience)}</span></span>
              <Toggle label={f.pro ? "Pro" : "Free"} checked={Boolean(f.pro)} disabled={!canManage} onChange={(v) => guard(() => api.talentAdminUpdateFeature(f.key, { pro: v }), `${f.label} is now ${v ? "Pro" : "free for everyone"}.`)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-ink">Recent charges</h2>
        {charges?.length === 0 && <p className="text-sm text-ink-500">Nothing yet.</p>}
        <ul className="divide-y divide-[var(--border-faint)] rounded-xl border border-[var(--border-faint)] text-sm">
          {charges?.slice(0, 50).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{label(c.kind)} · {c.user_name}</span><span className="block text-[11px] text-ink-500">{when(c.created_at)} · {label(c.reason)}</span></span>
              <span className="flex items-center gap-2"><strong>{ugx(c.amount_ugx)}</strong><Badge>{c.status}</Badge></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RuleForm({ initial, onSave, onCancel }: { initial: Partial<TalentAdminFeeRuleInput>; onSave: (r: TalentAdminFeeRuleInput) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<TalentFeeKind>(initial.kind ?? "listing");
  const [jobType, setJobType] = useState<"" | TalentJobType>(initial.jobType ?? "");
  const [model, setModel] = useState<"free" | "flat" | "percent">(initial.model ?? "flat");
  const [flat, setFlat] = useState(String(initial.flatUgx ?? 0));
  const [percent, setPercent] = useState(String(initial.percent ?? 0));
  const [min, setMin] = useState(String(initial.minUgx ?? 0));
  const [max, setMax] = useState(String(initial.maxUgx ?? 0));
  const [firstN, setFirstN] = useState(String(initial.freeFirstN ?? 0));
  const [active, setActive] = useState(initial.active ?? true);
  const [note, setNote] = useState(initial.note ?? "");
  const help = KIND_HELP[kind];
  const commission = kind.endsWith("_commission");
  return (
    <form className="home-card space-y-3 !p-3.5" onSubmit={(e) => { e.preventDefault(); onSave({ kind, jobType: help.jobTypes ? jobType : "", model, flatUgx: Number(flat) || 0, percent: Number(percent) || 0, minUgx: Number(min) || 0, maxUgx: Number(max) || 0, freeFirstN: commission ? 0 : Number(firstN) || 0, active, note }); }}>
      <Field label="What is charged" hint={help.help}><select value={kind} onChange={(e) => { setKind(e.target.value as TalentFeeKind); setJobType(""); }} className={inputCls}>{KINDS.map((k) => <option key={k} value={k}>{KIND_HELP[k].title}</option>)}</select></Field>
      {help.jobTypes && <Field label="For which kind of job" hint={commission ? "Commission applies to gigs and projects, which are paid through Peebee." : undefined}><select value={jobType} onChange={(e) => setJobType(e.target.value as "" | TalentJobType)} className={inputCls}><option value="">Every kind</option>{JOB_TYPES.filter((t) => !(commission && t === "hiring")).map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>}
      <div className="flex gap-2">{(["free", "flat", "percent"] as const).map((m) => <Chip key={m} on={model === m} onClick={() => setModel(m)}>{m === "free" ? "Free" : m === "flat" ? "Flat amount" : "Percentage"}</Chip>)}</div>
      {model === "flat" && <Field label="Amount (UGX)"><input inputMode="numeric" value={flat} onChange={(e) => setFlat(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>}
      {model === "percent" && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Percent"><input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} /></Field>
          <Field label="At least (UGX)"><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
          <Field label="At most (UGX)" hint="0 = no limit"><input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
        </div>
      )}
      {!commission && model !== "free" && <Field label="First N free each month" hint="0 = always charged"><input inputMode="numeric" value={firstN} onChange={(e) => setFirstN(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>}
      <Field label="Note (for staff)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputCls} /></Field>
      <Toggle label="Active" hint="Off keeps the rule saved but charges nothing." checked={active} onChange={setActive} />
      <div className="flex gap-2"><button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">Cancel</button><button type="submit" className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold">Save rule</button></div>
    </form>
  );
}

function PlanForm({ initial, features, onSave, onCancel }: { initial: Partial<TalentAdminPlanInput> & { id?: string }; features: TalentAdminFeature[]; onSave: (p: Partial<TalentAdminPlanInput>, id?: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState(initial.code ?? "");
  const [audience, setAudience] = useState<"worker" | "employer">(initial.audience ?? "worker");
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(String(initial.priceUgx ?? 0));
  const [period, setPeriod] = useState(String(initial.periodDays ?? 30));
  const [trial, setTrial] = useState(String(initial.trialDays ?? 0));
  const [feat, setFeat] = useState<string[]>(initial.features ?? []);
  const [waived, setWaived] = useState<TalentFeeKind[]>(initial.waivedKinds ?? []);
  const [wc, setWc] = useState(initial.workerCommissionPercent == null ? "" : String(initial.workerCommissionPercent));
  const [ec, setEc] = useState(initial.employerCommissionPercent == null ? "" : String(initial.employerCommissionPercent));
  const [active, setActive] = useState(initial.active ?? true);
  const editing = Boolean(initial.id);
  const toggle = <T extends string>(list: T[], v: T, set: (x: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form className="home-card space-y-3 !p-3.5" onSubmit={(e) => { e.preventDefault(); const body = { name, description, priceUgx: Number(price) || 0, periodDays: Number(period) || 30, trialDays: Number(trial) || 0, features: feat, waivedKinds: waived, workerCommissionPercent: wc === "" ? null : Number(wc), employerCommissionPercent: ec === "" ? null : Number(ec), active }; onSave(editing ? body : { ...body, code, audience }, initial.id); }}>
      {!editing && <div className="grid grid-cols-2 gap-2"><Field label="Code" hint="Lowercase, e.g. worker_plus"><input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} className={inputCls} /></Field><Field label="For"><select value={audience} onChange={(e) => setAudience(e.target.value as "worker" | "employer")} className={inputCls}><option value="worker">Workers</option><option value="employer">Employers</option></select></Field></div>}
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputCls} /></Field>
      <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className={inputCls} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Price (UGX)"><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
        <Field label="Every (days)"><input inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
        <Field label="Free trial (days)"><input inputMode="numeric" value={trial} onChange={(e) => setTrial(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>
      </div>
      <div className="space-y-1.5"><span className="block text-xs font-semibold text-ink-500">Pro features it unlocks</span><div className="flex flex-wrap gap-1.5">{features.filter((f) => f.audience === "both" || f.audience === audience).map((f) => <Chip key={f.key} on={feat.includes(f.key)} onClick={() => toggle(feat, f.key, setFeat)}>{f.label}</Chip>)}</div></div>
      <div className="space-y-1.5"><span className="block text-xs font-semibold text-ink-500">Fees it waives</span><div className="flex flex-wrap gap-1.5">{KINDS.map((k) => <Chip key={k} on={waived.includes(k)} onClick={() => toggle(waived, k, setWaived)}>{KIND_HELP[k].title}</Chip>)}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Worker commission (%)" hint="Blank = no change"><input inputMode="decimal" value={wc} onChange={(e) => setWc(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} /></Field>
        <Field label="Employer commission (%)" hint="Blank = no change"><input inputMode="decimal" value={ec} onChange={(e) => setEc(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} /></Field>
      </div>
      <Toggle label="Available to buy" checked={active} onChange={setActive} />
      <div className="flex gap-2"><button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">Cancel</button><button type="submit" disabled={name.trim().length < 2 || (!editing && code.length < 3)} className="min-h-11 flex-1 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">Save plan</button></div>
    </form>
  );
}
