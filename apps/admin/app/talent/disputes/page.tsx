"use client";

import type { TalentAdminDispute } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, ErrorNote, Field, inputCls, ugx, useTalentPermissions, when } from "../../../components/talent/ui";
import { api, errorMessage } from "../../../lib/api";

type Outcome = "release" | "refund" | "split";

export default function TalentDisputesPage() {
  const { canManage } = useTalentPermissions();
  const [rows, setRows] = useState<TalentAdminDispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ d: TalentAdminDispute; outcome: Outcome } | null>(null);
  const [detail, setDetail] = useState<{ events: Record<string, unknown>[]; messages: Record<string, unknown>[] } | null>(null);
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => { api.talentAdminDisputes().then((r) => setRows(r.disputes)).catch((err) => setError(errorMessage(err))); }, []);
  useEffect(load, [load]);

  async function start(d: TalentAdminDispute, outcome: Outcome) {
    setRefund(""); setNote(""); setDialogError(null); setDetail(null);
    setOpen({ d, outcome });
    api.talentAdminContract(d.contractId).then((r) => setDetail({ events: r.events, messages: r.messages })).catch(() => {});
  }
  async function confirm() {
    if (!open) return;
    setBusy(true); setDialogError(null);
    try {
      await api.talentAdminResolveDispute(open.d.contractId, open.outcome === "split" ? { outcome: "split", refundUgx: Number(refund), note } : { outcome: open.outcome, note });
      setOpen(null); load();
    } catch (err) { setDialogError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Payment is paused on these jobs until you decide. Release pays the worker, refund returns the money to the employer, split divides what is held.</p>
      <ErrorNote message={error} />
      {rows === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-ink-500">No disputes.</p>}
      <ul className="space-y-2">
        {rows?.map((d) => (
          <li key={d.contractId} className="home-card space-y-1.5 !p-3.5">
            <p className="text-[15px] font-bold text-ink">{d.title}</p>
            <p className="text-xs text-ink-500">{d.employer} (employer) · {d.worker} (worker) · {ugx(d.priceUgx)} · {d.paymentMode === "escrow" ? `${ugx(d.heldUgx)} held` : "paid directly"}</p>
            <p className="text-sm text-ink"><strong>{d.raisedBy === "worker" ? "Worker" : "Employer"}</strong> says: {d.reason}</p>
            <p className="text-xs text-ink-500">Raised {when(d.raisedAt)}</p>
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => start(d, "release")} className="min-h-9 rounded-full bg-gold px-3.5 text-xs font-bold text-ink-gold">Pay the worker</button>
                <button type="button" onClick={() => start(d, "refund")} className="min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink">Refund employer</button>
                {d.paymentMode === "escrow" && <button type="button" onClick={() => start(d, "split")} className="min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink">Split</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {open && (
        <ConfirmDialog title={open.outcome === "release" ? "Pay the worker" : open.outcome === "refund" ? "Refund the employer" : "Split the money"} confirmLabel="Decide" busy={busy} error={dialogError} disabled={open.outcome === "split" && !(Number(refund) > 0)} onClose={() => setOpen(null)} onConfirm={confirm}>
          <p>{open.d.title} · {ugx(open.d.heldUgx)} held</p>
          {open.outcome === "split" && <Field label="Refund to the employer (UGX)" hint="The rest goes to the worker, less Peebee's fee on that part."><input inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, ""))} className={inputCls} /></Field>}
          <Field label="Note (both people will see it)"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
          {detail && detail.messages.length > 0 && (
            <details className="text-xs"><summary className="cursor-pointer font-semibold">Their messages ({detail.messages.length})</summary><ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{detail.messages.map((m, i) => <li key={i}>{String(m.body)}</li>)}</ul></details>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
