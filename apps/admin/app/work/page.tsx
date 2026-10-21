"use client";

import { Select } from "../../components/ui/Select";
import type { WorkAdminJob, WorkJobStatus, WorkServiceType } from "@peebee/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, ErrorNote, inputCls, label, ugx, when } from "../../components/work/ui";
import { api, errorMessage } from "../../lib/api";

const STATUSES: WorkJobStatus[] = ["open", "assigned", "quoted", "booked", "in_progress", "completed", "settled", "disputed", "cancelled", "expired", "refunded"];
const TYPES: WorkServiceType[] = ["clean", "fix", "laundry"];

export default function WorkJobsPage() {
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [jobs, setJobs] = useState<WorkAdminJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJobs(null);
    setError(null);
    api
      .workAdminJobs(status || undefined)
      .then((r) => setJobs(r.jobs))
      .catch((err) => setError(errorMessage(err)));
  }, [status]);

  const shown = useMemo(() => (jobs ?? []).filter((j) => !type || j.service.type === type), [jobs, type]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Status" value={status} onValueChange={(next) => setStatus(next)} className={inputCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </Select>
        <Select aria-label="Service type" value={type} onValueChange={(next) => setType(next)} className={inputCls}>
          <option value="">All service types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </Select>
      </div>
      <ErrorNote message={error} />
      {jobs === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {jobs && shown.length === 0 && <p className="text-sm text-ink-500">No jobs match.</p>}
      <ul className="space-y-2">
        {shown.map((j) => (
          <li key={j.id}>
            <Link href={`/work/jobs/${encodeURIComponent(j.id)}`} className="home-card block space-y-1 !p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[15px] font-bold text-ink">{j.service.name}</p>
                <Badge>{j.status}</Badge>
              </div>
              <p className="truncate text-xs text-ink-500">
                {label(j.service.type)} · {label(j.pricingMode)} · {label(j.matchingMode)} · {j.area || j.address}
              </p>
              <div className="flex justify-between text-xs text-ink-500">
                <span>{j.provider ? j.provider.display_name : "No provider yet"}</span>
                <span className="font-semibold text-ink">{ugx(j.heldUgx)} held</span>
              </div>
              <p className="text-[11px] text-ink-500">{when(j.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
      {jobs && jobs.length >= 200 && <p className="text-xs text-ink-500">Showing the latest 200 jobs.</p>}
    </div>
  );
}
