"use client";

import type { TalentJob, TalentJobType } from "@peebee/shared";
import { ChevronRight, LocateFixed, MapPin, Rocket } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge, Chip, cardClass, EmptyState, FailureNote, JobsPage, Spinner, Unavailable } from "./JobsUI";
import { budgetLabel, EMPLOYMENT, fieldClass, formatWorkDate, JOB_TYPE, jobsFailure, type JobsFailure } from "./jobs-utils";
import { useJobsConfig } from "./useJobsConfig";

export function JobCard({ job, showStatus }: { job: TalentJob; showStatus?: boolean }) {
  const mine = typeof job.myApplication === "string" ? job.myApplication : job.myApplication?.status;
  return (
    <Link href={`/services/hire/${encodeURIComponent(job.id)}`} className={`${cardClass} block space-y-2 transition-transform active:scale-[0.99]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gold">{JOB_TYPE[job.type].short}{job.employmentType ? ` · ${EMPLOYMENT[job.employmentType]}` : ""}</span>
          <h3 className="truncate text-sm font-bold">{job.title}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {job.boosted ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold"><Rocket className="h-3 w-3" aria-hidden />Featured</span> : null}
          {showStatus ? <Badge status={job.status} /> : mine ? <Badge status={mine} /> : job.invited ? <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">Invited</span> : null}
        </div>
      </div>
      <p className="line-clamp-2 text-xs text-ink-500">{job.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <strong className="text-gold">{budgetLabel(job)}</strong>
        <span className="inline-flex items-center gap-1 text-ink-500"><MapPin className="h-3 w-3" aria-hidden />{job.remote ? "Remote" : job.area ?? "—"}{job.distanceKm != null ? ` · ${job.distanceKm} km` : ""}</span>
        <span className="text-ink-500">{formatWorkDate(job.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-500">
        <span>{job.employer.name}{job.employer.verified ? " ✓" : ""}{job.employer.rating ? ` · ★ ${job.employer.rating}` : ""}</span>
        <span className="inline-flex items-center gap-1">{job.applicationCount} applied<ChevronRight className="h-4 w-4" aria-hidden /></span>
      </div>
    </Link>
  );
}

export function FindJobs() {
  const { config, failure: configFailure } = useJobsConfig({ needMe: false });
  const [type, setType] = useState<"" | TalentJobType>("");
  const [segment, setSegment] = useState<"" | "informal" | "professional">("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<"newest" | "budget" | "nearest">("newest");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<TalentJob[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  const load = useCallback(async () => {
    setJobs(null);
    try {
      const r = await api.talentFeed({ type: type || undefined, segment: segment || undefined, category: category || undefined, q: q || undefined, remote: remote || undefined, sort, lat: coords?.lat, lng: coords?.lng });
      setJobs(r.jobs);
      setTotal(r.total);
      setFailure(null);
    } catch (err) {
      setFailure(jobsFailure(err));
      setJobs([]);
    }
  }, [type, segment, category, q, remote, sort, coords]);

  useEffect(() => {
    if (config) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, type, segment, category, remote, sort, coords]);

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("nearest");
      },
      () => {},
      { timeout: 8000 },
    );
  }

  if (configFailure) {
    return (
      <JobsPage eyebrow="Peebee Hire" title="Find work" backHref="/services/hire" backLabel="Back to Hire">
        <Unavailable failure={configFailure} />
      </JobsPage>
    );
  }
  const cats = (config?.categories ?? []).filter((c) => !segment || c.segment === segment || c.segment === "both");

  return (
    <JobsPage eyebrow="Peebee Hire" title="Find work" backHref="/services/hire" backLabel="Back to Hire">
      <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="space-y-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs, e.g. cleaner, driver, accountant" aria-label="Search jobs" className={fieldClass} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={type === ""} onClick={() => setType("")}>All</Chip>
          {(config?.jobTypes ?? []).map((t) => <Chip key={t} on={type === t} onClick={() => setType(type === t ? "" : t)}>{JOB_TYPE[t].label}</Chip>)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={segment === ""} onClick={() => setSegment("")}>All work</Chip>
          <Chip on={segment === "informal"} onClick={() => setSegment("informal")}>Trades & everyday</Chip>
          <Chip on={segment === "professional"} onClick={() => setSegment("professional")}>Professional</Chip>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={category === ""} onClick={() => setCategory("")}>Any kind</Chip>
          {cats.map((c) => <Chip key={c.id} on={category === c.id} onClick={() => setCategory(category === c.id ? "" : c.id)}>{c.name}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={Boolean(coords)} onClick={coords ? () => setCoords(null) : locate}><span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" aria-hidden />{coords ? "Near me" : "Use my location"}</span></Chip>
          <Chip on={remote} onClick={() => setRemote(!remote)}>Remote only</Chip>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="ml-auto rounded-xl border border-[var(--border-faint)] px-3 py-2 text-xs font-semibold">
            <option value="newest">Newest</option>
            <option value="budget">Highest pay</option>
            <option value="nearest" disabled={!coords}>Nearest</option>
          </select>
        </div>
      </form>
      <FailureNote failure={failure} />
      {!jobs ? <Spinner label="Looking for work" /> : null}
      {jobs && jobs.length === 0 && !failure ? <EmptyState title="No jobs match" text="Try different filters, or check back soon. New jobs are posted all the time." action={<Link href="/services/hire/profile" className="flex min-h-[48px] items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold">Set up my worker profile</Link>} /> : null}
      {jobs && jobs.length > 0 ? <p className="text-xs text-ink-500">{total} {total === 1 ? "job" : "jobs"}</p> : null}
      <ul className="space-y-3">{jobs?.map((j) => <li key={j.id}><JobCard job={j} /></li>)}</ul>
    </JobsPage>
  );
}
