"use client";

import type { WorkAdminJobDetail, WorkAdminPhoto, WorkAdminProvider, WorkResolveOutcome } from "@peebee/shared";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, ugx, useWorkPermissions, when } from "../../../../components/work/ui";
import { api, errorMessage } from "../../../../lib/api";

const EVENT_LABEL: Record<string, string> = {
  provider_cancelled: "Provider cancelled the job",
  rematched: "Job offered to other providers again",
  photo_added: "Photo added",
};
const eventLabel = (a: string) => EVENT_LABEL[a] ?? label(a);

const DETAIL_KEY: Record<string, string> = {
  serviceId: "Service", quantity: "Quantity", pricingMode: "Pricing", matchingMode: "Matching", providerId: "Provider", priceUgx: "Price",
  reason: "Reason", note: "Note", refundUgx: "Refund", payoutUgx: "Payout", commissionUgx: "Commission", attempt: "Attempt", phase: "Photo", workerId: "Worker",
};
/** Event details are stored as JSON; show them as plain "Label: value" text. */
function readableDetail(raw: string): string {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return raw;
    return Object.entries(data)
      .filter(([k]) => k !== "photoId" && k !== "serviceId" && k !== "providerId" && k !== "workerId")
      .map(([k, v]) => `${DETAIL_KEY[k] ?? label(k)}: ${/Ugx$/.test(k) && typeof v === "number" ? ugx(v) : label(String(v))}`)
      .join(" · ");
  } catch {
    return raw;
  }
}

/** Photos are private, so they load with the sign-in header and show from an object URL. */
function PhotoThumb({ photo }: { photo: WorkAdminPhoto }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let made: string | null = null;
    let cancelled = false;
    api
      .workPhotoBlob(photo.id)
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [photo.id]);
  return (
    <figure className="space-y-1">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[rgb(var(--surface-muted))]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label(photo.phase)} photo by ${photo.uploader_kind}`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-ink-500">{failed ? "Couldn't load" : "Loading…"}</span>
        )}
      </div>
      <figcaption className="text-[11px] text-ink-500">
        {label(photo.phase)} · {label(photo.uploader_kind)} · {when(photo.created_at)}
        {photo.note ? ` · ${photo.note}` : ""}
      </figcaption>
    </figure>
  );
}

type Dialog = "assign" | "broadcast" | "cancel" | "resolve" | null;

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-500">{k}</span>
      <span className="text-right font-semibold text-ink">{v}</span>
    </div>
  );
}

export default function WorkJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = decodeURIComponent(String(params.id));
  const { canManage } = useWorkPermissions();
  const [data, setData] = useState<WorkAdminJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // dialog inputs
  const [providers, setProviders] = useState<WorkAdminProvider[] | null>(null);
  const [providerId, setProviderId] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<WorkResolveOutcome>("release");
  const [refundPercent, setRefundPercent] = useState("50");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    api
      .workAdminJob(jobId)
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [jobId]);

  useEffect(load, [load]);

  function openDialog(d: Exclude<Dialog, null>) {
    setDialogError(null);
    setNotice(null);
    setDialog(d);
    if (d === "assign" && !providers) {
      api
        .workAdminProviders("approved")
        .then((r) => setProviders(r.providers))
        .catch((err) => setDialogError(errorMessage(err)));
    }
  }

  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setDialogError(null);
    try {
      const msg = await fn();
      setDialog(null);
      if (msg) setNotice(msg);
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="text-sm text-ink-500">Loading…</p>;

  const { job, events, money, offers } = data;
  const held = job.heldUgx;
  const pct = Number(refundPercent);
  const splitValid = Number.isInteger(pct) && pct >= 1 && pct <= 99;
  const refundAmount = outcome === "refund" ? held : outcome === "release" ? 0 : splitValid ? Math.round((held * pct) / 100) : 0;
  const canAssign = job.status === "open";
  const canCancel = ["open", "assigned", "quoted", "booked"].includes(job.status);
  const canResolve = job.status === "disputed";
  const providerNames = new Map<string, string>();
  if (job.provider) providerNames.set(job.provider.id, job.provider.display_name);
  (providers ?? []).forEach((p) => providerNames.set(p.id, p.display_name));

  return (
    <div className="space-y-4">
      <Link href="/work" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500">
        <ChevronLeft className="h-4 w-4" aria-hidden /> All jobs
      </Link>

      <section className="home-card space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">{job.service.name}</h2>
          <Badge>{job.status}</Badge>
        </div>
        <Row k="Type" v={`${label(job.service.type)} · ${label(job.pricingMode)}`} />
        <Row k="Matching" v={label(job.matchingMode)} />
        <Row k="Quantity" v={job.quantity} />
        {(job.rematchCount ?? 0) > 0 && <Row k="Re-matched" v={`${job.rematchCount} time${job.rematchCount === 1 ? "" : "s"}`} />}
        {job.providerLocation && (
          <Row
            k="Provider last seen"
            v={
              <a
                href={`https://www.google.com/maps?q=${job.providerLocation.lat},${job.providerLocation.lng}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {job.providerLocation.lat.toFixed(5)}, {job.providerLocation.lng.toFixed(5)} · {when(job.providerLocation.updatedAt)}
              </a>
            }
          />
        )}
        <Row k="Address" v={[job.address, job.area].filter(Boolean).join(", ") || "—"} />
        <Row k="Scheduled" v={when(job.scheduledFor)} />
        <Row k="Provider" v={job.provider ? `${job.provider.display_name} (${label(job.provider.kind)})` : "None yet"} />
        {job.workerName && <Row k="Worker" v={job.workerName} />}
        <Row k="Price" v={ugx(job.priceUgx)} />
        <Row k="Call-out fee" v={ugx(job.calloutFeeUgx)} />
        <Row k="Held" v={ugx(job.heldUgx)} />
        <Row k="Commission" v={`${job.commissionPercent}% · ${ugx(job.commissionUgx)}`} />
        {job.expiresAt && <Row k="Expires" v={when(job.expiresAt)} />}
        {job.confirmBy && <Row k="Auto-confirms" v={when(job.confirmBy)} />}
        {job.details && <p className="pt-1 text-sm text-ink">{job.details}</p>}
        {job.cancelReason && <Row k={`Cancelled by ${job.cancelledBy ?? "?"}`} v={job.cancelReason} />}
        {job.disputeReason && <Row k="Reported problem" v={job.disputeReason} />}
        {job.resolutionNote && <Row k="Ruling" v={job.resolutionNote} />}
        {job.rating != null && <Row k="Rating" v={`${job.rating}/5${job.review ? ` — ${job.review}` : ""}`} />}
      </section>

      {notice && <p className="rounded-xl bg-green/15 px-3 py-2 text-sm font-medium text-green">{notice}</p>}

      {canManage ? (
        <section className="flex flex-wrap gap-2">
          {canAssign && <button type="button" onClick={() => openDialog("assign")} className="min-h-11 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold">Assign provider</button>}
          {canAssign && <button type="button" onClick={() => openDialog("broadcast")} className="min-h-11 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">Re-broadcast</button>}
          {canResolve && <button type="button" onClick={() => openDialog("resolve")} className="min-h-11 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold">Resolve problem</button>}
          {canCancel && <button type="button" onClick={() => openDialog("cancel")} className="min-h-11 rounded-full border border-red-300 px-4 text-sm font-bold text-red-700 dark:text-red-300">Cancel job</button>}
        </section>
      ) : (
        <p className="text-xs text-ink-500">You can view this job but not change it.</p>
      )}

      <section className="home-card space-y-2">
        <h3 className="text-sm font-bold text-ink">Money</h3>
        {money.length === 0 && <p className="text-sm text-ink-500">No money movements.</p>}
        {money.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{label(m.kind)} · {ugx(m.amount_ugx)}</p>
              <p className="truncate text-xs text-ink-500">{m.note || "—"} · {when(m.done_at ?? m.created_at)}</p>
            </div>
            <Badge>{m.status}</Badge>
          </div>
        ))}
      </section>

      <section className="home-card space-y-2">
        <h3 className="text-sm font-bold text-ink">Offers</h3>
        {offers.length === 0 && <p className="text-sm text-ink-500">No offers.</p>}
        {offers.map((o) => (
          <div key={o.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{providerNames.get(o.provider_id) ?? o.provider_id} · {ugx(o.price_ugx)}</p>
              <p className="text-xs text-ink-500">
                {o.eta_minutes != null ? `${o.eta_minutes} min away · ` : ""}{o.message || "No message"} · {when(o.created_at)}
              </p>
            </div>
            <Badge>{o.status}</Badge>
          </div>
        ))}
      </section>

      <section className="home-card space-y-2">
        <h3 className="text-sm font-bold text-ink">Photos</h3>
        {(data.photos ?? []).length === 0 && <p className="text-sm text-ink-500">No photos.</p>}
        <div className="grid grid-cols-2 gap-3">
          {(data.photos ?? []).map((p) => (
            <PhotoThumb key={p.id} photo={p} />
          ))}
        </div>
      </section>

      <section className="home-card space-y-2">
        <h3 className="text-sm font-bold text-ink">Messages (read only)</h3>
        {(data.messages ?? []).length === 0 && <p className="text-sm text-ink-500">No messages.</p>}
        <ul className="space-y-2">
          {(data.messages ?? []).map((m) => (
            <li key={m.id} className={`flex flex-col ${m.sender_kind === "customer" ? "items-start" : "items-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm text-ink ${m.sender_kind === "customer" ? "bg-[rgb(var(--surface-muted))]" : "bg-gold/15"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-500">
                {label(m.sender_kind)}{m.sender_name ? ` · ${m.sender_name}` : ""} · {when(m.created_at)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-card space-y-2">
        <h3 className="text-sm font-bold text-ink">Timeline</h3>
        {events.length === 0 && <p className="text-sm text-ink-500">No events.</p>}
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-semibold text-ink">{eventLabel(e.action)} <span className="font-normal text-ink-500">· {label(e.actor_kind)}</span></p>
              {e.detail && readableDetail(e.detail) && <p className="break-words text-xs text-ink-500">{readableDetail(e.detail)}</p>}
              <p className="text-[11px] text-ink-500">{when(e.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>

      {dialog === "assign" && (
        <ConfirmDialog
          title="Assign provider"
          confirmLabel="Assign"
          busy={busy}
          error={dialogError}
          disabled={!providerId}
          onClose={() => setDialog(null)}
          onConfirm={() => run(async () => { await api.workAdminAssign(job.id, providerId); return "Provider assigned."; })}
        >
          <p className="text-ink-500">Only approved providers who offer &quot;{job.service.name}&quot; can take this job.</p>
          <Field label="Provider">
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
              <option value="">{providers ? "Choose a provider" : "Loading…"}</option>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} — {p.services || "no services"}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-ink-500">Price {ugx(job.priceUgx)} · held {ugx(held)}.</p>
        </ConfirmDialog>
      )}

      {dialog === "broadcast" && (
        <ConfirmDialog
          title="Re-broadcast job"
          confirmLabel="Send again"
          busy={busy}
          error={dialogError}
          onClose={() => setDialog(null)}
          onConfirm={() => run(async () => { const r = await api.workAdminBroadcast(job.id); return `Sent to ${r.notified} provider${r.notified === 1 ? "" : "s"}.`; })}
        >
          <p>Notify nearby providers about this open job again.</p>
        </ConfirmDialog>
      )}

      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel job"
          confirmLabel="Cancel and refund"
          danger
          busy={busy}
          error={dialogError}
          onClose={() => setDialog(null)}
          onConfirm={() => run(async () => { await api.workAdminCancel(job.id, reason.trim() || undefined); return "Job cancelled."; })}
        >
          <p>
            This cancels the job and refunds the customer. Currently held on this job: <strong>{ugx(held)}</strong>.
          </p>
          <Field label="Reason (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
          </Field>
        </ConfirmDialog>
      )}

      {dialog === "resolve" && (
        <ConfirmDialog
          title="Resolve reported problem"
          confirmLabel="Apply ruling"
          busy={busy}
          error={dialogError}
          disabled={note.trim().length < 3 || (outcome === "split" && !splitValid)}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            run(async () => {
              await api.workAdminResolve(job.id, { outcome, note: note.trim(), ...(outcome === "split" ? { refundPercent: pct } : {}) });
              return "Ruling applied.";
            })
          }
        >
          {job.disputeReason && <p className="text-ink-500">Customer says: {job.disputeReason}</p>}
          <div className="flex gap-1.5">
            {(["release", "refund", "split"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                className={`flex-1 rounded-full border px-2 py-2 text-xs font-bold ${outcome === o ? "border-gold bg-gold/15 text-ink" : "border-[var(--border-faint)] text-ink-500"}`}
              >
                {o === "release" ? "Pay provider" : o === "refund" ? "Refund customer" : "Split"}
              </button>
            ))}
          </div>
          {outcome === "split" && (
            <Field label="Percent refunded to the customer (1-99)">
              <input inputMode="numeric" value={refundPercent} onChange={(e) => setRefundPercent(e.target.value.replace(/[^\d]/g, ""))} className={inputCls} />
            </Field>
          )}
          <div className="space-y-1 rounded-xl border border-[var(--border-faint)] p-3">
            <Row k="Held" v={ugx(held)} />
            <Row k="Refunded to customer" v={ugx(refundAmount)} />
            <Row k="Left for provider" v={ugx(held - refundAmount)} />
            <p className="pt-1 text-xs text-ink-500">
              The provider&apos;s share is paid after this job&apos;s {job.commissionPercent}% commission.
            </p>
          </div>
          <Field label="Note explaining the ruling (required)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={inputCls} />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
