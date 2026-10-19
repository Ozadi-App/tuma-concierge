"use client";

import type { TalentWorker } from "@peebee/shared";
import { BadgeCheck, ChevronRight, LocateFixed, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Chip, cardClass, EmptyState, FailureNote, Field, JobsPage, Rating, Spinner, Unavailable } from "./JobsUI";
import { fieldClass, formatUgx, jobsFailure, RATE_TYPE, type JobsFailure } from "./jobs-utils";
import { useJobsConfig } from "./useJobsConfig";

export function WorkerCard({ w, forJob }: { w: TalentWorker; forJob?: string | null }) {
  return (
    <Link href={`/services/hire/workers/${encodeURIComponent(w.id)}${forJob ? `?forJob=${encodeURIComponent(forJob)}` : ""}`} className={`${cardClass} flex items-center gap-3 transition-transform active:scale-[0.99]`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-base font-bold text-gold" aria-hidden>
        {w.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center gap-1.5">
          <strong className="truncate text-sm">{w.name}</strong>
          {w.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-gold" aria-label="ID verified" /> : null}
          {w.featured ? <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">Featured</span> : null}
        </span>
        <span className="block truncate text-xs text-ink">{w.headline}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-500">
          <Rating rating={w.rating} count={w.ratingCount} />
          {w.jobsCompleted > 0 ? <span>{w.jobsCompleted} jobs</span> : null}
          {w.area ? <span>{w.area}</span> : null}
          {w.distanceKm != null ? <span>{w.distanceKm} km</span> : null}
          {w.remote ? <span>Remote</span> : null}
        </span>
        <span className="block text-xs font-bold text-gold">{w.rateUgx > 0 ? `${formatUgx(w.rateUgx)} ${RATE_TYPE[w.rateType]}` : "Rate: negotiable"}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
    </Link>
  );
}

export function FindWorkers() {
  const { config, failure: configFailure } = useJobsConfig({ needMe: false });
  const forJob = useSearchParams().get("forJob");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [segment, setSegment] = useState<"" | "informal" | "professional">("");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<"best" | "rating" | "nearest" | "rate_low">("best");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [workers, setWorkers] = useState<TalentWorker[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [locating, setLocating] = useState(false);

  const search = useCallback(async () => {
    setWorkers(null);
    try {
      const r = await api.talentSearchWorkers({
        q: q || undefined, category: category || undefined, segment: segment || undefined, remote: remote || undefined, sort,
        lat: coords?.lat, lng: coords?.lng,
        minRating: minRating ? Number(minRating) : undefined, maxRate: maxRate ? Number(maxRate) : undefined,
        verifiedOnly: verifiedOnly || undefined, availableNow: availableNow || undefined,
      });
      setWorkers(r.workers);
      setTotal(r.total);
      setFailure(null);
    } catch (err) {
      setFailure(jobsFailure(err));
      setWorkers([]);
    }
  }, [q, category, segment, remote, sort, coords, minRating, maxRate, verifiedOnly, availableNow]);

  // Search again whenever a filter that isn't typed text changes.
  useEffect(() => {
    if (config) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, category, segment, remote, sort, coords, verifiedOnly, availableNow]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("nearest");
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  if (configFailure) {
    return (
      <JobsPage eyebrow="Peebee Hire" title="Find a worker" backHref="/services/hire" backLabel="Back to Hire">
        <Unavailable failure={configFailure} />
      </JobsPage>
    );
  }

  const cats = (config?.categories ?? []).filter((c) => !segment || c.segment === segment || c.segment === "both");

  return (
    <JobsPage eyebrow="Peebee Hire" title="Find a worker" backHref="/services/hire" backLabel="Back to Hire">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="space-y-3"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you need? e.g. plumber, tutor, designer" aria-label="Search workers" className={fieldClass} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={segment === ""} onClick={() => setSegment("")}>All work</Chip>
          <Chip on={segment === "informal"} onClick={() => setSegment("informal")}>Trades & everyday</Chip>
          <Chip on={segment === "professional"} onClick={() => setSegment("professional")}>Professionals</Chip>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={category === ""} onClick={() => setCategory("")}>Any</Chip>
          {cats.map((c) => (
            <Chip key={c.id} on={category === c.id} onClick={() => setCategory(category === c.id ? "" : c.id)}>{c.name}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={Boolean(coords)} onClick={coords ? () => setCoords(null) : locate} disabled={locating}>
            <span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" aria-hidden />{locating ? "Locating…" : coords ? "Near me" : "Use my location"}</span>
          </Chip>
          <Chip on={remote} onClick={() => setRemote(!remote)}>Remote</Chip>
          <Chip on={showMore} onClick={() => setShowMore(!showMore)}>
            <span className="inline-flex items-center gap-1"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />More filters</span>
          </Chip>
        </div>
        {showMore ? (
          <div className={`${cardClass} space-y-3`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Best rated from">
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={fieldClass}>
                  <option value="">Any</option>
                  <option value="3">3 stars</option>
                  <option value="4">4 stars</option>
                  <option value="4.5">4.5 stars</option>
                </select>
              </Field>
              <Field label="Rate up to (UGX)">
                <input inputMode="numeric" value={maxRate} onChange={(e) => setMaxRate(e.target.value.replace(/\D/g, ""))} placeholder="Any" className={fieldClass} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip on={verifiedOnly} onClick={() => setVerifiedOnly(!verifiedOnly)}>ID verified</Chip>
              <Chip on={availableNow} onClick={() => setAvailableNow(!availableNow)}>Available now</Chip>
            </div>
            <button type="submit" className="min-h-[44px] w-full rounded-2xl bg-gold font-bold text-ink-gold">Apply filters</button>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-500">{workers ? `${total} ${total === 1 ? "person" : "people"}` : ""}</p>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="rounded-xl border border-[var(--border-faint)] px-3 py-2 text-xs font-semibold">
            <option value="best">Best match</option>
            <option value="rating">Top rated</option>
            <option value="nearest" disabled={!coords}>Nearest</option>
            <option value="rate_low">Lowest rate</option>
          </select>
        </div>
      </form>

      <FailureNote failure={failure} />
      {!workers ? <Spinner label="Searching" /> : null}
      {workers && workers.length === 0 && !failure ? (
        <EmptyState title="No one found" text="Try fewer filters, a wider area, or post the job and let workers come to you." action={<Link href="/services/hire/post" className="flex min-h-[48px] items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold">Post a job</Link>} />
      ) : null}
      <ul className="space-y-3">
        {workers?.map((w) => (
          <li key={w.id}>
            <WorkerCard w={w} forJob={forJob} />
          </li>
        ))}
      </ul>
    </JobsPage>
  );
}
