"use client";

import type { WorkAdminFlag, WorkFlagDetail, WorkFlagOutcome, WorkFlagStatus } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, useWorkPermissions, when } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";

const STATUSES: WorkFlagStatus[] = ["open", "warned", "suspended", "dismissed"];
const KIND_TEXT = { cancel_after_onsite: "Cancelled after being on site", cancel_no_location: "Cancelled with no location shared" } as const;
const OUTCOME_TEXT: Record<WorkFlagOutcome, { title: string; button: string; hint: string }> = {
  dismiss: { title: "Dismiss this flag", button: "Dismiss", hint: "There was a good reason. Nothing happens to the provider." },
  warn: { title: "Warn the provider", button: "Send warning", hint: "The provider gets a notification with your note." },
  suspend: { title: "Suspend the provider", button: "Suspend", hint: "The provider goes offline and can't take jobs until you reinstate them on the Providers page." },
};

const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

export default function WorkFlagsPage() {
  const { canManage } = useWorkPermissions();
  const [status, setStatus] = useState<WorkFlagStatus | "">("open");
  const [flags, setFlags] = useState<WorkAdminFlag[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkFlagDetail | null>(null);
  const [review, setReview] = useState<{ flag: WorkAdminFlag; outcome: WorkFlagOutcome } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .workAdminFlags(status || undefined)
      .then((r) => { setReady(r.ready); setFlags(r.flags); })
      .catch((err) => setError(errorMessage(err)));
  }, [status]);

  useEffect(() => {
    setFlags(null);
    load();
  }, [load]);

  useEffect(() => {
    setDetail(null);
    if (!openId) return;
    api.workAdminFlag(openId).then(setDetail).catch((err) => setError(errorMessage(err)));
  }, [openId]);

  async function confirm() {
    if (!review) return;
    setBusy(true);
    setDialogError(null);
    try {
      await api.workAdminReviewFlag(review.flag.id, review.outcome, note.trim() || undefined);
      setReview(null);
      setNote("");
      setOpenId(null);
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        Cancellations that came after the provider had been at the customer&apos;s address for a while, or after they held a job without ever sharing a location. A flag is a reason to look into it, not proof.
        Turn the checks on under Settings.
      </p>
      <div className="flex gap-1.5 overflow-x-auto">
        {(["", ...STATUSES] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${status === s ? "border-gold bg-gold/15 text-ink" : "border-[var(--border-faint)] text-ink-500"}`}
          >
            {s ? label(s) : "All"}
          </button>
        ))}
      </div>
      <ErrorNote message={error} />
      {!ready && <p className="home-card text-sm text-ink-500">On-site checks need a database update (migration 0100) before they can be used.</p>}
      {ready && flags && flags.length === 0 && <p className="text-sm text-ink-500">No flags here.</p>}
      {!flags && !error && <p className="text-sm text-ink-500">Loading…</p>}

      {flags?.map((f) => {
        const expanded = openId === f.id;
        return (
          <div key={f.id} className="home-card space-y-2 !p-3.5">
            <button type="button" onClick={() => setOpenId(expanded ? null : f.id)} aria-expanded={expanded} className="block w-full space-y-1 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink">{f.provider_name}</span>
                <Badge>{f.status}</Badge>
              </div>
              <p className="text-xs text-ink-500">
                {KIND_TEXT[f.kind]}
                {f.kind === "cancel_after_onsite" ? ` — about ${f.onsite_minutes} min within ${f.radius_m} m` : ""} · cancelled by {f.cancelled_by}
              </p>
              <p className="text-xs text-ink-500">{f.service_name} · {f.address} · {when(f.created_at)}</p>
              {f.provider_flag_count > 1 && <p className="text-xs font-bold text-ink">{f.provider_flag_count} open or upheld flags for this provider</p>}
            </button>

            {expanded && (
              <div className="space-y-2 border-t border-[var(--border-faint)] pt-2 text-xs text-ink-500">
                {!detail && <p>Loading…</p>}
                {detail && (
                  <>
                    <p>Customer: <span className="font-semibold text-ink">{detail.flag.customer_name}</span> · Provider status: <Badge>{detail.flag.provider_status}</Badge></p>
                    <p>
                      Accepted {when(detail.job.assignedAt)} · cancelled {when(detail.job.cancelledAt)} by {detail.job.cancelledBy ?? "—"}
                      {detail.job.cancelReason ? ` (“${detail.job.cancelReason}”)` : ""}
                    </p>
                    {detail.flag.first_onsite_at && <p>On site from {when(detail.flag.first_onsite_at)} to {when(detail.flag.last_onsite_at)}; closest point {detail.flag.closest_m ?? "—"} m; {detail.flag.points} location updates.</p>}
                    {detail.flag.kind === "cancel_no_location" && <p>No location updates were received while the provider held this job.</p>}
                    {detail.job.lat != null && detail.job.lng != null && (
                      <p><a className="font-bold text-ink underline" href={mapLink(detail.job.lat, detail.job.lng)} target="_blank" rel="noreferrer">Job address on the map</a></p>
                    )}
                    {detail.trail.length > 0 && (
                      <details>
                        <summary className="cursor-pointer font-bold text-ink">Location trail ({detail.trailTotal} updates)</summary>
                        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                          {detail.trail.map((p, i) => (
                            <li key={i}>
                              {when(p.at)} · <a className="underline" href={mapLink(p.lat, p.lng)} target="_blank" rel="noreferrer">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</a>
                              {p.accuracyM != null ? ` · ±${Math.round(p.accuracyM)} m` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {detail.otherFlags.length > 0 && (
                      <p>Earlier flags: {detail.otherFlags.map((o) => `${label(o.status)} (${when(o.created_at)})`).join(", ")}</p>
                    )}
                    {detail.flag.review_note && <p>Review note: <span className="text-ink">{detail.flag.review_note}</span></p>}
                    {f.status === "open" && canManage && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(["dismiss", "warn", "suspend"] as const).map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => { setNote(""); setDialogError(null); setReview({ flag: f, outcome: o }); }}
                            className={`min-h-9 rounded-full px-4 text-xs font-bold ${o === "suspend" ? "bg-red-600 text-white" : "border border-[var(--border-faint)] text-ink"}`}
                          >
                            {OUTCOME_TEXT[o].button}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {review && (
        <ConfirmDialog
          title={OUTCOME_TEXT[review.outcome].title}
          confirmLabel={OUTCOME_TEXT[review.outcome].button}
          danger={review.outcome === "suspend"}
          busy={busy}
          error={dialogError}
          onConfirm={confirm}
          onClose={() => setReview(null)}
        >
          <p>{review.flag.provider_name}: {OUTCOME_TEXT[review.outcome].hint}</p>
          <Field label="Note (optional)">
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={3} className={inputCls} />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
