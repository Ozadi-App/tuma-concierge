"use client";

import type { WorkJob, WorkStaffMember } from "@peebee/shared";
import { Phone } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../../../components/StatusBadge";
import { api, errorMessage } from "../../../lib/api";
import { estimatedEarnings, ugx, whenLabel } from "../../../lib/format";

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<WorkJob | null>(null);
  const [role, setRole] = useState<"owner" | "staff">("owner");
  const [staff, setStaff] = useState<WorkStaffMember[]>([]);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.workProviderJob(id);
      setJob(res.job);
      setRole(res.role);
      if (res.role === "owner") api.workStaff().then((s) => setStaff(s.staff.filter((m) => m.status === "active"))).catch(() => {});
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!job) return error ? <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div> : <p className="text-xs text-ink-500">Loading…</p>;

  const owner = role === "owner";
  const btn = "w-full rounded-2xl bg-gold py-3 text-sm font-black text-ink-gold shadow transition active:scale-[0.98] disabled:opacity-50";
  const quoteNum = Number(quote);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-black text-ink">{job.service.name}{job.quantity > 1 ? ` × ${job.quantity}` : ""}</h1>
        <StatusBadge status={job.status} />
      </div>

      {error && <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div>}

      <section className="home-card space-y-2 p-4 text-xs font-medium text-ink-500">
        <p><span className="font-black text-ink">Where: </span>{job.address}{job.area ? ` (${job.area})` : ""}</p>
        <p><span className="font-black text-ink">When: </span>{whenLabel(job.scheduledFor)}</p>
        {job.details && <p><span className="font-black text-ink">Details: </span>{job.details}</p>}
        {job.pricingMode === "quote" && job.priceUgx === 0
          ? <p><span className="font-black text-ink">Call-out fee: </span>{ugx(job.calloutFeeUgx)}</p>
          : <p><span className="font-black text-ink">You earn: </span>{ugx(estimatedEarnings(job))} <span>({ugx(job.priceUgx)} less {job.commissionPercent}%)</span></p>}
        {job.workerName && <p><span className="font-black text-ink">Assigned to: </span>{job.workerName}</p>}
        {job.customer && (
          <p className="flex items-center gap-1.5">
            <span className="font-black text-ink">Customer: </span>{job.customer.name}
            {job.customer.phone && <a href={`tel:${job.customer.phone}`} className="ml-1 inline-flex items-center gap-1 font-black text-gold"><Phone className="h-3.5 w-3.5" aria-hidden />{job.customer.phone}</a>}
          </p>
        )}
        {job.disputeReason && <p className="text-red-600"><span className="font-black">Reported problem: </span>{job.disputeReason}</p>}
      </section>

      {owner && staff.length > 0 && ["assigned", "booked"].includes(job.status) && (
        <section className="home-card space-y-2 p-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink-500">Assign to a team member</span>
            <select defaultValue="" disabled={busy} onChange={(e) => e.target.value && run(() => api.workAssignWorker(job.id, e.target.value))} className="w-full text-sm font-medium text-ink outline-none">
              <option value="" disabled>Choose…</option>
              {staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </select>
          </label>
        </section>
      )}

      {owner && job.status === "assigned" && job.pricingMode === "quote" && (
        <section className="home-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink-500">Your quote for the whole job (UGX)</span>
            <input inputMode="numeric" value={quote} onChange={(e) => setQuote(e.target.value.replace(/\D/g, ""))} className="w-full text-sm font-medium text-ink outline-none" />
          </label>
          <button type="button" disabled={busy || !quoteNum} onClick={() => run(() => api.workQuote(job.id, quoteNum))} className={btn}>Send quote</button>
        </section>
      )}

      {job.status === "booked" && <button type="button" disabled={busy} onClick={() => run(() => api.workStartJob(job.id))} className={btn}>Start job</button>}

      {job.status === "in_progress" && (
        <section className="home-card space-y-3 p-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink-500">Note for the customer (optional)</span>
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="w-full resize-none text-sm font-medium text-ink outline-none" />
          </label>
          <button type="button" disabled={busy} onClick={() => run(() => api.workCompleteJob(job.id, note.trim() || undefined))} className={btn}>Mark as finished</button>
        </section>
      )}

      {job.status === "completed" && <p className="text-xs font-medium text-ink-500">Finished. You are paid when the customer confirms{job.confirmBy ? `, or automatically ${whenLabel(job.confirmBy)}` : ""}.</p>}
      {job.status === "settled" && <p className="text-xs font-black text-green">Paid out to your wallet.</p>}

      {owner && ["assigned", "quoted", "booked"].includes(job.status) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => { if (confirm("Cancel this job? The customer is refunded.")) run(() => api.workProviderCancel(job.id)); }}
          className="w-full rounded-2xl border border-red-500/40 py-3 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:opacity-50"
        >
          Cancel job
        </button>
      )}
    </div>
  );
}
