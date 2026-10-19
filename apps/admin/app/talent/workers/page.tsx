"use client";

import type { TalentAdminWorker, TalentWorkerAction } from "@peebee/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, useTalentPermissions, when } from "../../../components/talent/ui";
import { api, errorMessage } from "../../../lib/api";

const ACTIONS: Record<string, TalentWorkerAction[]> = { pending: ["approve", "reject"], approved: ["suspend"], suspended: ["reinstate"], rejected: ["approve"] };

function Workers() {
  const { canManage } = useTalentPermissions();
  const initial = useSearchParams().get("status") ?? "";
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState("");
  const [workers, setWorkers] = useState<TalentAdminWorker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ w: TalentAdminWorker; action: TalentWorkerAction } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.talentAdminWorkers({ status: status || undefined, q: q || undefined }).then((r) => setWorkers(r.workers)).catch((err) => setError(errorMessage(err)));
  }, [status, q]);
  useEffect(() => { setWorkers(null); load(); }, [load]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setDialogError(null);
    try { await api.talentAdminWorkerAction(pending.w.userId, pending.action, note.trim() || undefined); setPending(null); load(); } catch (err) { setDialogError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          {["pending", "approved", "suspended", "rejected"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <input aria-label="Search" placeholder="Name, phone or headline" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />
      </div>
      <ErrorNote message={error} />
      {workers === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {workers && workers.length === 0 && <p className="text-sm text-ink-500">No workers.</p>}
      <ul className="space-y-2">
        {(workers ?? []).map((w) => (
          <li key={w.userId} className="home-card space-y-1.5 !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{w.name}{w.isRider ? " · rider" : ""}</p>
                <p className="truncate text-xs text-ink-500">{w.headline} · {w.phone}{w.area ? ` · ${w.area}` : ""}</p>
              </div>
              <Badge>{w.status}</Badge>
            </div>
            <p className="text-xs text-ink-500">{w.rating ? `${w.rating} rating (${w.ratingCount})` : "No ratings"} · {w.jobsCompleted} jobs · {w.activated ? "activated" : "not activated"} · {w.idVerified ? "ID verified" : "ID not verified"} · joined {when(w.createdAt)}</p>
            {w.statusNote && <p className="text-xs text-ink-500">Note: {w.statusNote}</p>}
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(ACTIONS[w.status] ?? []).map((a) => (
                  <button key={a} type="button" onClick={() => { setNote(""); setDialogError(null); setPending({ w, action: a }); }} className={`min-h-9 rounded-full px-3.5 text-xs font-bold ${a === "approve" || a === "reinstate" ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] text-ink"}`}>{label(a)}</button>
                ))}
                <button type="button" onClick={async () => { try { await api.talentAdminVerifyId(w.userId, !w.idVerified); load(); } catch (err) { setError(errorMessage(err)); } }} className="min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink">{w.idVerified ? "Remove ID badge" : "Mark ID verified"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {pending && (
        <ConfirmDialog title={`${label(pending.action)} worker`} confirmLabel={label(pending.action)} danger={pending.action === "reject" || pending.action === "suspend"} busy={busy} error={dialogError} disabled={(pending.action === "reject" || pending.action === "suspend") && note.trim().length === 0} onClose={() => setPending(null)} onConfirm={confirm}>
          <p>{pending.w.name} · {pending.w.headline}</p>
          <Field label={pending.action === "approve" || pending.action === "reinstate" ? "Note (optional)" : "Reason (shown to the worker)"}>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function TalentWorkersPage() {
  return <Suspense><Workers /></Suspense>;
}
