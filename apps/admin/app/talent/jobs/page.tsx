"use client";

import { Select } from "../../../components/ui/Select";
import type { TalentAdminJob } from "@peebee/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, ugx, useTalentPermissions, when } from "../../../components/talent/ui";
import { api, errorMessage } from "../../../lib/api";

const STATUSES = ["pending_review", "open", "in_progress", "filled", "completed", "cancelled", "expired", "closed", "rejected"];

function Jobs() {
  const { canManage } = useTalentPermissions();
  const [status, setStatus] = useState(useSearchParams().get("status") ?? "");
  const [type, setType] = useState("");
  const [jobs, setJobs] = useState<TalentAdminJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<TalentAdminJob | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.talentAdminJobs({ status: status || undefined, type: type || undefined }).then((r) => setJobs(r.jobs)).catch((err) => setError(errorMessage(err)));
  }, [status, type]);
  useEffect(() => { setJobs(null); load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Status" value={status} onValueChange={(next) => setStatus(next)} className={inputCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        <Select aria-label="Type" value={type} onValueChange={(next) => setType(next)} className={inputCls}>
          <option value="">All types</option>
          {["gig", "project", "hiring"].map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </Select>
      </div>
      <ErrorNote message={error} />
      {jobs === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {jobs && jobs.length === 0 && <p className="text-sm text-ink-500">No jobs.</p>}
      <ul className="space-y-2">
        {(jobs ?? []).map((j) => (
          <li key={j.id} className="home-card space-y-1.5 !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-[15px] font-bold text-ink">{j.title}</p><p className="truncate text-xs text-ink-500">{label(j.type)} · {j.category ?? "—"} · {j.area ?? "Remote"} · {ugx(j.budgetMaxUgx)}</p></div>
              <Badge>{j.status}</Badge>
            </div>
            <p className="line-clamp-3 text-xs text-ink-500">{j.description}</p>
            <p className="text-xs text-ink-500">{j.employer.name} · {j.employer.phone} · {j.applicationCount} applied · {when(j.createdAt)}{j.moderationState !== "clear" ? ` · screening: ${j.moderationState}` : ""}</p>
            {canManage && (j.status === "pending_review" || j.status === "open") && (
              <div className="flex flex-wrap gap-2 pt-1">
                {j.status === "pending_review" && <button type="button" onClick={async () => { try { await api.talentAdminApproveJob(j.id); load(); } catch (err) { setError(errorMessage(err)); } }} className="min-h-9 rounded-full bg-gold px-3.5 text-xs font-bold text-ink-gold">Approve</button>}
                <button type="button" onClick={() => { setReason(""); setDialogError(null); setRejecting(j); }} className="min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink">Take down</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {rejecting && (
        <ConfirmDialog title="Take down job" confirmLabel="Take down" danger busy={busy} error={dialogError} disabled={reason.trim().length < 3} onClose={() => setRejecting(null)} onConfirm={async () => {
          setBusy(true); setDialogError(null);
          try { await api.talentAdminRejectJob(rejecting.id, reason.trim()); setRejecting(null); load(); } catch (err) { setDialogError(errorMessage(err)); } finally { setBusy(false); }
        }}>
          <p>{rejecting.title}</p>
          <Field label="Reason (shown to the employer)"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} /></Field>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function TalentJobsPage() {
  return <Suspense><Jobs /></Suspense>;
}
