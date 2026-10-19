"use client";

import type { WorkAdminProvider, WorkProviderAction, WorkProviderStatus } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, useWorkPermissions, when } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";

const STATUSES: WorkProviderStatus[] = ["pending", "approved", "suspended", "rejected"];

/** Which actions the API allows from each status (mirrors providerDecisions in admin.ts). */
const ACTIONS: Record<WorkProviderStatus, WorkProviderAction[]> = {
  pending: ["approve", "reject", "suspend"],
  approved: ["suspend"],
  suspended: ["approve", "reinstate"],
  rejected: ["approve", "reinstate"],
};
const NOTE_REQUIRED: WorkProviderAction[] = ["reject", "suspend"];

export default function WorkProvidersPage() {
  const { canManage } = useWorkPermissions();
  const [status, setStatus] = useState("");
  const [providers, setProviders] = useState<WorkAdminProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ provider: WorkAdminProvider; action: WorkProviderAction } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .workAdminProviders((status || undefined) as WorkProviderStatus | undefined)
      .then((r) => setProviders(r.providers))
      .catch((err) => setError(errorMessage(err)));
  }, [status]);

  useEffect(() => {
    setProviders(null);
    load();
  }, [load]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setDialogError(null);
    try {
      await api.workAdminProviderAction(pending.provider.id, pending.action, note.trim() || undefined);
      setPending(null);
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{label(s)}</option>
        ))}
      </select>
      <ErrorNote message={error} />
      {providers === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {providers && providers.length === 0 && <p className="text-sm text-ink-500">No providers.</p>}
      <ul className="space-y-2">
        {(providers ?? []).map((p) => (
          <li key={p.id} className="home-card space-y-1.5 !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{p.company_name || p.display_name}</p>
                <p className="truncate text-xs text-ink-500">
                  {label(p.kind)}
                  {p.kind === "company" ? ` · ${p.team_size} on team` : ""} · {p.user_name ?? "—"} · {p.phone || p.user_phone || "no phone"}
                </p>
              </div>
              <Badge>{p.status}</Badge>
            </div>
            <p className="text-xs text-ink-500">Services: {p.services || "none chosen"}</p>
            <p className="text-xs text-ink-500">
              {p.rating_count > 0 ? `${(p.rating_sum / p.rating_count).toFixed(1)} rating (${p.rating_count})` : "No ratings"} · {p.jobs_completed} jobs completed · joined {when(p.created_at)}
            </p>
            {p.status_note && <p className="text-xs text-ink-500">Note: {p.status_note}</p>}
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                {ACTIONS[p.status].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setNote("");
                      setDialogError(null);
                      setPending({ provider: p, action: a });
                    }}
                    className={`min-h-9 rounded-full px-3.5 text-xs font-bold ${
                      a === "approve" || a === "reinstate" ? "bg-gold text-ink-gold" : "border border-[var(--border-faint)] text-ink"
                    }`}
                  >
                    {label(a)}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {pending && (
        <ConfirmDialog
          title={`${label(pending.action)} provider`}
          confirmLabel={label(pending.action)}
          danger={pending.action === "reject" || pending.action === "suspend"}
          busy={busy}
          error={dialogError}
          disabled={NOTE_REQUIRED.includes(pending.action) && note.trim().length === 0}
          onClose={() => setPending(null)}
          onConfirm={confirm}
        >
          <p>
            {pending.provider.company_name || pending.provider.display_name} is currently <strong>{pending.provider.status}</strong>.
          </p>
          <Field label={NOTE_REQUIRED.includes(pending.action) ? "Note (required)" : "Note (optional)"} hint="Up to 300 characters; kept with the provider and the activity log.">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} className={inputCls} />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
