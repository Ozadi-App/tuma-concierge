"use client";

import type { TalentConfig, TalentMe, TalentProfileInput } from "@peebee/shared";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { BusyButton, Chip, cardClass, FailureNote, Field, JobsPage, Notice, primaryBtn, secondaryBtn, Spinner, Unavailable } from "./JobsUI";
import { fieldClass, formatUgx, jobsFailure, RATE_TYPE, type JobsFailure } from "./jobs-utils";
import { useJobsConfig } from "./useJobsConfig";

const csv = (s: string, max: number) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, max);

export function WorkerProfileEditor() {
  const { config, me, failure: loadFailure, reload } = useJobsConfig();
  if (loadFailure) return <JobsPage eyebrow="Peebee Jobs" title="My worker profile" backHref="/services/jobs" backLabel="Back to Jobs"><Unavailable failure={loadFailure} /></JobsPage>;
  if (!config || !me) return <JobsPage eyebrow="Peebee Jobs" title="My worker profile" backHref="/services/jobs" backLabel="Back to Jobs"><Spinner label="Loading" /></JobsPage>;
  return <Editor config={config} me={me} reload={reload} />;
}

function Editor({ config, me, reload }: { config: TalentConfig; me: TalentMe; reload: () => Promise<void> }) {
  const p = me.profile;
  const [headline, setHeadline] = useState(p?.headline ?? "");
  const [bio, setBio] = useState(p?.bio ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(() => (p ? config.categories.filter((c) => p.categories.includes(c.name)).map((c) => c.id) : []));
  const [skills, setSkills] = useState((p?.skills ?? []).join(", "));
  const [languages, setLanguages] = useState((p?.languages ?? []).join(", "));
  const [area, setArea] = useState(p?.area ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng } : null);
  const [radiusKm, setRadiusKm] = useState(String(p?.radiusKm ?? 10));
  const [remote, setRemote] = useState(p?.remote ?? false);
  const [rateType, setRateType] = useState<TalentProfileInput["rateType"]>(p?.rateType ?? "negotiable");
  const [rate, setRate] = useState(p?.rateUgx ? String(p.rateUgx) : "");
  const [years, setYears] = useState(String(p?.experienceYears ?? 0));
  const [availability, setAvailability] = useState<"available" | "busy" | "offline">(p?.availability ?? "available");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [employerName, setEmployerName] = useState(me.employer?.businessName ?? "");
  const [about, setAbout] = useState(me.employer?.about ?? "");

  useEffect(() => { if (!coords && "geolocation" in navigator) return; }, [coords]);

  const feeRule = config.fees.find((f) => f.kind === "worker_onboarding");
  const boostRule = config.fees.find((f) => f.kind === "boost");

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    setFailure(null);
    setSaved(null);
    try {
      const msg = await fn();
      await reload();
      if (msg) setSaved(msg);
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {}, { timeout: 8000 });
  }

  const save = () =>
    run("save", async () => {
      const r = await api.talentSaveProfile({
        headline: headline.trim(), bio: bio.trim(), categoryIds, skills: csv(skills, config.limits.maxSkills), languages: csv(languages, 10), area: area.trim() || undefined,
        lat: coords?.lat, lng: coords?.lng, radiusKm: Number(radiusKm) || 10, remote, rateType, rateUgx: Number(rate.replace(/\D/g, "")) || 0, experienceYears: Number(years) || 0, availability,
      });
      return r.activation.required ? `Saved. Activate your profile for ${formatUgx(r.activation.amountUgx)} to go live.` : "Saved.";
    });

  const status = p?.status;
  return (
    <JobsPage eyebrow="Peebee Jobs" title="My worker profile" backHref="/services/jobs" backLabel="Back to Jobs">
      {!me.canWork ? <Notice text="Riders can't offer other work right now." /> : null}
      {p ? (
        <section className={`${cardClass} space-y-2`}>
          <div className="flex items-center justify-between"><strong className="text-sm">Profile status</strong><span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">{!p.activated ? "Not activated" : status === "approved" ? "Live" : status === "pending" ? "Waiting for approval" : status}</span></div>
          {status === "pending" && p.activated ? <p className="text-xs text-ink-500">Our team checks every new profile. You'll be told when you're live.</p> : null}
          {status === "rejected" || status === "suspended" ? <p className="text-xs text-ink-500">{p.statusNote ?? "Contact support for help."}</p> : null}
          {!p.activated ? (
            <>
              <p className="text-sm">Activate your profile to appear in search and apply for work{feeRule && !config.freeAccess && !config.freeOnboarding ? `: ${feeRule.model === "flat" ? formatUgx(feeRule.flatUgx) : `${feeRule.percent}%`} one-off fee` : ""}.</p>
              <BusyButton busy={busy === "activate"} className={primaryBtn} onClick={() => run("activate", async () => { await api.talentActivateProfile(); return "Your profile is activated."; })}>Activate my profile</BusyButton>
            </>
          ) : null}
          {status === "approved" && p.activated ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <BusyButton busy={busy === "boost"} className={secondaryBtn} onClick={() => run("boost", async () => { const r = await api.talentBoostProfile(); return `Featured until ${r.featuredUntil.slice(0, 10)}.`; })}><Rocket className="h-4 w-4" aria-hidden />Boost{!config.freeAccess && boostRule?.model === "flat" ? ` ${formatUgx(boostRule.flatUgx)}` : ""}</BusyButton>
              <Link href={`/services/jobs/workers/${p.id}`} className={secondaryBtn}>View public page</Link>
            </div>
          ) : null}
          {p.activated ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {(["available", "busy", "offline"] as const).map((a) => <Chip key={a} on={p.availability === a} onClick={() => run("avail", async () => { await api.talentSetAvailability({ availability: a }); })}>{a === "available" ? "Available" : a === "busy" ? "Busy" : "Hidden"}</Chip>)}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-ink-500">Tell people what you do. Employers search by skill, area and rating, and you can apply for any job.</p>
      )}

      <section className="space-y-4" aria-label="Profile details">
        <Field label="What do you do?" hint="A short headline, e.g. Electrician with 8 years' experience"><input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} className={fieldClass} /></Field>
        <Field label="About you"><textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} placeholder="Your experience, the work you've done, and what makes you reliable." className={fieldClass} /></Field>
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-ink-500">Kinds of work you do</span>
          <div className="flex flex-wrap gap-2">
            {config.categories.map((c) => <Chip key={c.id} on={categoryIds.includes(c.id)} onClick={() => setCategoryIds(categoryIds.includes(c.id) ? categoryIds.filter((x) => x !== c.id) : [...categoryIds, c.id].slice(0, 10))}>{c.name}</Chip>)}
          </div>
        </div>
        <Field label="Skills" hint="Separate with commas"><input value={skills} onChange={(e) => setSkills(e.target.value)} className={fieldClass} /></Field>
        <Field label="Languages" hint="Separate with commas"><input value={languages} onChange={(e) => setLanguages(e.target.value)} className={fieldClass} /></Field>
        <Field label="Where are you based?"><input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area, e.g. Ntinda" className={fieldClass} /></Field>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={Boolean(coords)} onClick={locate}>{coords ? "Location saved" : "Use my current location"}</Chip>
          <Chip on={remote} onClick={() => setRemote(!remote)}>I can work remotely</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Travel up to (km)"><input inputMode="numeric" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
          <Field label="Years of experience"><input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your rate"><select value={rateType} onChange={(e) => setRateType(e.target.value as TalentProfileInput["rateType"])} className={fieldClass}>{Object.entries(RATE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Amount (UGX)"><input inputMode="numeric" disabled={rateType === "negotiable"} value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))} className={fieldClass} /></Field>
        </div>
        <FailureNote failure={failure} />
        {saved ? <Notice tone="info" text={saved} /> : null}
        <BusyButton busy={busy === "save"} disabled={!me.canWork || headline.trim().length < 3 || categoryIds.length === 0} className={primaryBtn} onClick={save}>{p ? "Save changes" : "Create my profile"}</BusyButton>
        <p className="text-center text-[11px] text-ink-500">Peebee does not allow illegal or unconstitutional work. Profiles that offer it are removed.</p>
      </section>

      <section className="space-y-3 border-t border-[var(--border-faint)] pt-5" aria-label="Employer details">
        <h2 className="text-sm font-bold">If you hire people (optional)</h2>
        <Field label="Business name"><input value={employerName} onChange={(e) => setEmployerName(e.target.value)} maxLength={120} className={fieldClass} /></Field>
        <Field label="About your business"><textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} className={fieldClass} /></Field>
        <BusyButton busy={busy === "emp"} className={secondaryBtn} onClick={() => run("emp", async () => { await api.talentSaveEmployer({ businessName: employerName.trim() || undefined, about: about.trim() }); return "Business details saved."; })}>Save business details</BusyButton>
      </section>
    </JobsPage>
  );
}
