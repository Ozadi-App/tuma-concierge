"use client";

import type { WorkCustomerAction, WorkJob } from "@peebee/shared";
import { ChevronRight, Droplets, Hammer, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useLivePolling } from "../../lib/use-live-polling";
import { cardClass, Notice, primaryBtn, secondaryBtn, Spinner, StatusBadge, WorkPage } from "./WorkUI";
import { formatUgx, formatWorkDate, isActiveStatus, WORK_TYPES, workFailure, type WorkFailure } from "./work-utils";

type Row = WorkJob & { actions: WorkCustomerAction[] };

const TYPE_ICON = { clean: Sparkles, fix: Hammer, laundry: Droplets } as const;

const ACTION_HINT: Partial<Record<WorkCustomerAction, string>> = {
  choose_provider: "Offers to review",
  accept_quote: "Quote to review",
  confirm: "Please confirm",
  rate: "Rate this job",
};

export function MyWorkJobs() {
  const [jobs, setJobs] = useState<Row[] | null>(null);
  const [failure, setFailure] = useState<WorkFailure | null>(null);
  const jobsRef = useRef<Row[] | null>(null);

  const load = useCallback(() => {
    api
      .workMyJobs()
      .then((r) => {
        // Newest first, whatever order the server used.
        const sorted = [...r.jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        jobsRef.current = sorted;
        setJobs(sorted);
        setFailure(null);
      })
      .catch((err) => setFailure(workFailure(err)));
  }, []);

  // Keep the list fresh only while something on it is still moving.
  useLivePolling(
    () => {
      if (jobsRef.current && !jobsRef.current.some((j) => isActiveStatus(j.status))) return;
      load();
    },
    15_000,
    [load],
  );

  return (
    <WorkPage eyebrow="Peebee Work" title="My jobs" backHref="/services" backLabel="Back to Services">
      {failure ? (
        <div className="space-y-3">
          <Notice failure={failure} />
          <button type="button" onClick={load} className={secondaryBtn}>
            Try again
          </button>
        </div>
      ) : null}

      {!jobs && !failure ? <Spinner label="Loading your jobs" /> : null}

      {jobs && jobs.length === 0 ? (
        <section className={`${cardClass} space-y-3 p-6 text-center`}>
          <h2 className="text-lg font-bold">No jobs yet</h2>
          <p className="text-sm text-ink-500">Book a clean, a repair or laundry and it will show up here.</p>
          <div className="grid gap-2">
            {Object.values(WORK_TYPES).map((t) => (
              <Link key={t.href} href={t.href} className={secondaryBtn}>
                {t.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {jobs && jobs.length > 0 ? (
        <ul className="space-y-3" aria-label="Your jobs">
          {jobs.map((job) => {
            const Icon = TYPE_ICON[job.service.type] ?? Sparkles;
            const hint = job.actions.map((a) => ACTION_HINT[a]).find(Boolean);
            return (
              <li key={job.id}>
                <Link href={`/services/work/${encodeURIComponent(job.id)}`} className={`${cardClass} flex min-h-[72px] items-center gap-3 transition-transform active:scale-[0.99]`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/12 text-gold">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">{job.service.name}</strong>
                      <StatusBadge status={job.status} />
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {job.scheduledFor ? `For ${formatWorkDate(job.scheduledFor)}` : `Booked ${formatWorkDate(job.createdAt)}`} · {job.address}
                    </span>
                    <span className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gold">{job.pricingMode === "quote" && job.priceUgx <= 0 ? `Call-out ${formatUgx(job.calloutFeeUgx)}` : formatUgx(job.priceUgx)}</span>
                      {hint ? <span className="font-semibold text-gold">{hint}</span> : null}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Link href="/services" className={primaryBtn}>
        Book another service
      </Link>
    </WorkPage>
  );
}
