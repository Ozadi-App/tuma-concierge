"use client";

import type { TalentContractSummary, TalentJob } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge, cardClass, EmptyState, FailureNote, JobsPage, primaryBtn, Spinner } from "./JobsUI";
import { formatUgx, jobsFailure, type JobsFailure } from "./jobs-utils";
import { JobCard } from "./FindJobs";
import { RecurrenceList } from "./Recurrences";

export function MyPostedJobs() {
  const [jobs, setJobs] = useState<TalentJob[] | null>(null);
  const [contracts, setContracts] = useState<TalentContractSummary[]>([]);
  const [failure, setFailure] = useState<JobsFailure | null>(null);

  const load = useCallback(() => {
    api.talentMyJobs().then((r) => { setJobs(r.jobs); setFailure(null); }).catch((err) => setFailure(jobsFailure(err)));
    api.talentContracts("employer").then((r) => setContracts(r.contracts)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const running = contracts.filter((c) => c.status === "active" || c.status === "disputed");
  return (
    <JobsPage eyebrow="Peebee Jobs" title="Jobs I posted" backHref="/services/jobs" backLabel="Back to Jobs">
      <FailureNote failure={failure} />
      {!jobs && !failure ? <Spinner label="Loading" /> : null}
      {running.length > 0 ? (
        <section className="space-y-2" aria-label="Work in progress">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">In progress</h2>
          {running.map((c) => (
            <Link key={c.id} href={`/services/jobs/contracts/${c.id}`} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span className="min-w-0"><strong className="block truncate text-sm">{c.title}</strong><span className="block truncate text-xs text-ink-500">{c.otherParty.name} · {formatUgx(c.priceUgx)}</span></span>
              <Badge status={c.status} />
            </Link>
          ))}
        </section>
      ) : null}
      <RecurrenceList onChange={load} />
      {jobs?.length === 0 ? <EmptyState title="You haven't posted anything" text="Post a gig, a project or a hiring ad and workers near you will be told." action={<Link href="/services/jobs/post" className={primaryBtn}>Post a job</Link>} /> : null}
      {jobs && jobs.length > 0 ? (
        <section className="space-y-3" aria-label="Your posts">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Your posts</h2>
          <ul className="space-y-3">
            {jobs.map((j) => (
              <li key={j.id} className="space-y-1">
                <JobCard job={j} showStatus />
                {j.pendingApplications ? <p className="px-2 text-xs font-bold text-gold">{j.pendingApplications} waiting for you</p> : null}
              </li>
            ))}
          </ul>
          <Link href="/services/jobs/post" className={primaryBtn}>Post another job</Link>
        </section>
      ) : null}
    </JobsPage>
  );
}
