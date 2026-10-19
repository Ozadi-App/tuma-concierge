"use client";

import type { WorkJob } from "@peebee/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import { api, errorMessage } from "../../lib/api";
import { timeAgo, ugx } from "../../lib/format";

export default function JobsPage() {
  const [jobs, setJobs] = useState<WorkJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.workProviderJobs().then((r) => setJobs(r.jobs)).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-ink">Jobs</h1>
      {error && <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div>}
      {jobs === null && !error && <p className="text-xs text-ink-500">Loading…</p>}
      {jobs?.length === 0 && <p className="text-xs font-medium text-ink-500">No jobs yet. Go online on the Home tab to get started.</p>}
      {jobs?.map((j) => (
        <Link key={j.id} href={`/jobs/${j.id}`} className="home-card flex items-start justify-between gap-3 p-4 transition active:scale-[0.99]">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-black text-ink">{j.service.name}</p>
            <p className="truncate text-xs font-medium text-ink-500">{j.area || j.address}</p>
            <p className="text-[11px] font-medium text-ink-500">{timeAgo(j.createdAt)}{j.priceUgx ? ` · ${ugx(j.priceUgx)}` : ""}</p>
          </div>
          <StatusBadge status={j.status} />
        </Link>
      ))}
    </div>
  );
}
