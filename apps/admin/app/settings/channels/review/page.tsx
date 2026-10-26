"use client";

import { hasPermission } from "@peebee/shared";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CARD, Field, Pill, ugx, when } from "../../../../components/channels/ui";
import { SettingsPageShell } from "../../../../components/SettingsPageShell";
import { api, errorMessage, getStoredToken } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";

type Tab = "posts" | "reports" | "kyc" | "causes" | "channels" | "payouts" | "rates";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "posts", label: "Posts" }, { id: "reports", label: "Reports" }, { id: "kyc", label: "Verification" }, { id: "causes", label: "Causes" },
  { id: "channels", label: "Channels" }, { id: "payouts", label: "Payouts" }, { id: "rates", label: "Reward rate" },
];

/** A decision button that asks for a reason when one is required, then reloads the list. */
function Act({ label, tone, needsReason, onRun, done }: { label: string; tone?: "gold" | "red" | "plain"; needsReason?: string; onRun: (reason?: string) => Promise<unknown>; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function click() {
    let reason: string | undefined;
    if (needsReason) {
      const r = window.prompt(needsReason);
      if (!r || !r.trim()) return;
      reason = r.trim();
    }
    setBusy(true);
    setErr(null);
    try {
      await onRun(reason);
      done();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const cls = tone === "gold" ? "admin-btn-gold px-4" : tone === "red" ? "px-4 text-red-600" : "px-4 text-ink";
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={busy} onClick={click} className={`min-h-10 rounded-full text-xs font-bold ${cls}`}>{busy ? "…" : label}</button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-sm text-ink-500">{text}</p>;
}

function PostsTab({ canModerate }: { canModerate: boolean }) {
  const [status, setStatus] = useState("review");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminChannelPosts>>["posts"] | null>(null);
  const load = useCallback(() => { api.adminChannelPosts(status).then((r) => setRows(r.posts)).catch(() => setRows([])); }, [status]);
  useEffect(load, [load]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["review", "published", "removed", "scheduled"].map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${status === s ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{s === "review" ? "Waiting for review" : s}</button>
        ))}
      </div>
      {rows?.length === 0 && <Empty text="Nothing here." />}
      {rows?.map((p) => (
        <div key={p.id} className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{p.publisher} <span className="text-xs font-semibold text-ink-500">· {p.publisherType} · {p.type}{p.access !== "free" ? ` · ${p.access.replace("_", " ")}` : ""}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{p.caption || <em className="text-ink-500">No caption</em>}</p>
              <p className="mt-1 text-xs text-ink-500">{when(p.createdAt)}{p.reportCount ? ` · ${p.reportCount} reports` : ""}{p.removedReason ? ` · ${p.removedReason}` : ""}</p>
            </div>
            <Pill>{p.status}</Pill>
          </div>
          {canModerate && (
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status !== "published" && <Act label="Approve" tone="gold" onRun={() => api.adminModeratePost(p.id, "approve")} done={load} />}
              {p.status !== "removed" && <Act label="Remove" tone="red" needsReason="Why is this being removed? The creator is shown this." onRun={(r) => api.adminModeratePost(p.id, "remove", r)} done={load} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ canModerate }: { canModerate: boolean }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminReports>>["reports"] | null>(null);
  const load = useCallback(() => { api.adminReports().then((r) => setRows(r.reports)).catch(() => setRows([])); }, []);
  useEffect(load, [load]);
  if (rows?.length === 0) return <Empty text="No open reports." />;
  return (
    <div className="space-y-3">
      {rows?.map((r) => (
        <div key={r.id} className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <p className="text-sm font-bold text-ink">{r.reason} <span className="text-xs font-semibold text-ink-500">· {r.post.type} by {r.post.publisherType} · {r.post.reportCount} reports · {r.post.status}</span></p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{r.post.caption || <em className="text-ink-500">No caption</em>}</p>
          {r.details && <p className="mt-1 text-xs text-ink-500">“{r.details}”</p>}
          {canModerate && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Act label="Dismiss" onRun={() => api.adminResolveReport(r.id, "dismiss")} done={load} />
              <Act label="Remove post" tone="red" needsReason="Why is the post being removed?" onRun={(x) => api.adminResolveReport(r.id, "remove_post", x)} done={load} />
              {r.post.publisherType === "channel" && <Act label="Suspend channel" tone="red" needsReason="Why is the channel being suspended?" onRun={(x) => api.adminResolveReport(r.id, "suspend_channel", x)} done={load} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** An ID photo, fetched with the staff sign-in (it is never available on a public address). */
function IdPhoto({ userId, which }: { userId: string; which: "front" | "back" | "selfie" }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"}/v1/admin/channels/kyc/${encodeURIComponent(userId)}/document/${which}`, { headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("no photo"))))
      .then((b) => { if (!cancelled) { url = URL.createObjectURL(b); setSrc(url); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [userId, which]);
  if (failed) return <p className="text-xs text-ink-500">{which}: not provided</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={`${which} of the ID`} className="max-h-64 rounded-xl border border-[var(--border-faint)] object-contain" /> : <div className="admin-skeleton h-32 w-48 rounded-xl" />;
}

function KycTab({ canReview }: { canReview: boolean }) {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminKycQueue>>["checks"] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.adminKycDetail>> | null>(null);
  const load = useCallback(() => { api.adminKycQueue(status).then((r) => setRows(r.checks)).catch(() => setRows([])); }, [status]);
  useEffect(load, [load]);
  useEffect(() => {
    setDetail(null);
    if (open) api.adminKycDetail(open).then(setDetail).catch(() => setDetail(null));
  }, [open]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => { setOpen(null); setStatus(s); }} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${status === s ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{s}</button>
        ))}
      </div>
      {rows?.length === 0 && <Empty text="No checks here." />}
      {rows?.map((k) => (
        <div key={k.userId} className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === k.userId ? null : k.userId)} aria-expanded={open === k.userId}>
            <span>
              <span className="block text-sm font-bold text-ink">{k.fullName}</span>
              <span className="text-xs text-ink-500">{k.idType.replace("_", " ")} · age {k.age ?? "?"} · account “{k.accountName}” · {k.phone} · sent {when(k.submittedAt)}</span>
            </span>
            <Pill>{k.status}</Pill>
          </button>
          {open === k.userId && detail && (
            <div className="mt-3 space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-ink-500">ID number</dt><dd className="font-mono text-ink">{detail.idNumber}</dd>
                <dt className="text-ink-500">Date of birth</dt><dd className="text-ink">{detail.dateOfBirth} (age {detail.age})</dd>
                <dt className="text-ink-500">Payout accounts</dt>
                <dd className="text-ink">{detail.payoutAccounts.length ? detail.payoutAccounts.map((a) => `${a.name} · ${a.number}`).join("; ") : "none yet"}</dd>
              </dl>
              <p className="text-xs text-ink-500">Check the name on the ID matches the full name, the photo matches the selfie, and the payout account is in the same name.</p>
              <div className="flex flex-wrap gap-3">
                <IdPhoto userId={k.userId} which="front" />
                {detail.hasBack && <IdPhoto userId={k.userId} which="back" />}
                {detail.hasSelfie && <IdPhoto userId={k.userId} which="selfie" />}
              </div>
              {canReview && k.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Act label="Approve" tone="gold" onRun={() => api.adminReviewKyc(k.userId, "approve")} done={() => { setOpen(null); load(); }} />
                  <Act label="Reject" tone="red" needsReason="What should the person fix? They are shown this." onRun={(n) => api.adminReviewKyc(k.userId, "reject", n)} done={() => { setOpen(null); load(); }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CausesTab({ canReview }: { canReview: boolean }) {
  const [status, setStatus] = useState("submitted");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminChannelCauses>>["causes"] | null>(null);
  const load = useCallback(() => { api.adminChannelCauses(status).then((r) => setRows(r.causes)).catch(() => setRows([])); }, [status]);
  useEffect(load, [load]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["submitted", "live", "frozen", "ended", "rejected"].map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${status === s ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{s === "submitted" ? "Waiting for approval" : s}</button>
        ))}
      </div>
      {rows?.length === 0 && <Empty text="No causes here." />}
      {rows?.map((c) => (
        <div key={c.id} className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{c.title}</p>
              <p className="text-xs text-ink-500">{c.ownerName} · @{c.channelHandle} · goal {ugx(c.goalUgx)} · {c.daysLeft ? `${c.daysLeft} days left` : "ends " + when(c.endsAt)}{c.beneficiary ? ` · for ${c.beneficiary}` : ""}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{c.story}</p>
              <p className="mt-1 text-xs text-ink-500">Raised {ugx(c.raisedUgx)} from {c.donorCount} donors{c.releasedUgx ? ` · released ${ugx(c.releasedUgx)}` : ""}</p>
            </div>
            <Pill>{c.status}</Pill>
          </div>
          {canReview && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.status === "submitted" && <Act label="Approve" tone="gold" onRun={() => api.adminReviewCause(c.id, "approve")} done={load} />}
              {c.status === "submitted" && <Act label="Reject" tone="red" needsReason="What should the creator fix? They are shown this." onRun={(r) => api.adminReviewCause(c.id, "reject", r)} done={load} />}
              {["live", "ended", "closed"].includes(c.status) && <Act label="Freeze" tone="red" needsReason="Why is this cause being frozen? Giving and releases stop." onRun={(r) => api.adminFreezeCause(c.id, true, r)} done={load} />}
              {c.status === "frozen" && <Act label="Unfreeze" tone="gold" onRun={() => api.adminFreezeCause(c.id, false)} done={load} />}
              {["live", "frozen", "ended"].includes(c.status) && <Act label="Refund everyone" tone="red" needsReason="Why are all donors being refunded?" onRun={(r) => api.adminRefundCause(c.id, r ?? "")} done={load} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChannelsTab({ canModerate }: { canModerate: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminChannelList>>["channels"] | null>(null);
  const load = useCallback(() => { api.adminChannelList(q).then((r) => setRows(r.channels)).catch(() => setRows([])); }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  return (
    <div className="space-y-3">
      <Field id="chq" label="Search by handle or name"><input id="chq" value={q} onChange={(e) => setQ(e.target.value)} className="w-full text-sm text-ink outline-none" /></Field>
      {rows?.length === 0 && <Empty text="No channels found." />}
      {rows?.map((c) => (
        <div key={c.id} className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">{c.displayName} <span className="text-xs font-semibold text-ink-500">@{c.handle}{c.verified ? " · verified badge" : ""}</span></p>
              <p className="text-xs text-ink-500">{c.ownerName} · {c.ownerPhone} · {c.followers} followers · opened {when(c.createdAt)}{c.suspendedReason ? ` · ${c.suspendedReason}` : ""}</p>
            </div>
            <Pill tone={c.status === "active" ? "green" : "red"}>{c.status}</Pill>
          </div>
          {canModerate && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.status === "active" ? <Act label="Suspend" tone="red" needsReason="Why is this channel being suspended?" onRun={(r) => api.adminSetChannelStatus(c.id, "suspended", r)} done={load} /> : <Act label="Restore" tone="gold" onRun={() => api.adminSetChannelStatus(c.id, "active")} done={load} />}
              <Act label={c.verified ? "Remove badge" : "Give badge"} onRun={() => api.adminSetChannelBadge(c.id, !c.verified)} done={load} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PayoutsTab() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.adminChannelWithdrawals>>["withdrawals"] | null>(null);
  useEffect(() => { api.adminChannelWithdrawals().then((r) => setRows(r.withdrawals)).catch(() => setRows([])); }, []);
  if (rows?.length === 0) return <Empty text="No withdrawals yet." />;
  return (
    <div className="space-y-2">
      {rows?.map((w) => (
        <div key={w.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
          <div>
            <p className="text-sm font-bold text-ink">{ugx(w.amountUgx)} <span className="text-xs font-semibold text-ink-500">· {w.userName} · {w.phone}</span></p>
            <p className="text-xs text-ink-500">{w.network ?? "mobile money"} · {when(w.createdAt)}{w.environment === "sandbox" ? " · sandbox" : ""}</p>
          </div>
          <Pill tone={w.status === "successful" ? "green" : w.status === "failed" ? "red" : "gold"}>{w.status}</Pill>
        </div>
      ))}
    </div>
  );
}

function RatesTab({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.adminRewardRates>> | null>(null);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState(0);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { api.adminRewardRates().then(setData).catch(() => setData({ rates: [], currentUgxPer1000: 0 })); }, []);
  useEffect(load, [load]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.adminAddRewardRate({ effectiveFrom: new Date(`${from}T00:00:00Z`).toISOString(), ugxPer1000Points: rate, note: note.trim() || undefined });
      setNote("");
      load();
    } catch (x) {
      setErr(errorMessage(x));
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4">
        <p className="text-sm text-ink-500">Right now</p>
        <p className="text-xl font-extrabold text-ink">{ugx(data?.currentUgxPer1000 ?? 0)} per 1,000 points</p>
        {data?.currentUgxPer1000 === 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">No rate is set, so points are worth nothing yet. Add one before turning Rewards on.</p>}
      </div>
      {canManage && (
        <form onSubmit={add} className="space-y-3">
          <p className="text-sm font-bold text-ink">Add a rate</p>
          <Field id="rt-from" label="Starts on" hint="A rate applies from this date until a newer one starts. Old rates are kept for the record."><input id="rt-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className="w-full text-sm text-ink outline-none" /></Field>
          <Field id="rt-rate" label="UGX per 1,000 points"><input id="rt-rate" type="number" min={0} step={100} required value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full text-sm text-ink outline-none" /></Field>
          <Field id="rt-note" label="Note (optional)"><input id="rt-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="w-full text-sm text-ink outline-none" /></Field>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="submit" className="admin-btn-gold min-h-11 px-6 text-sm font-bold">Add rate</button>
        </form>
      )}
      <div className="space-y-2">
        {data?.rates.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 text-sm">
            <span className="text-ink">{ugx(r.ugxPer1000Points)} per 1,000 · from {new Date(r.effectiveFrom.replace(" ", "T") + "Z").toLocaleDateString()}</span>
            <span className="text-xs text-ink-500">{r.note ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Review() {
  const { user } = useAuth();
  const role = user?.adminRole ?? null;
  const params = useSearchParams();
  const initial = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "posts") as Tab;
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <SettingsPageShell title="Channels review" description="Posts, reports, identity checks, causes, payouts and the reward rate." loading={false}>
      <div role="tablist" aria-label="Review queues" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{t.label}</button>
        ))}
      </div>
      {!hasPermission(role, "channels.view") && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5" /><p>Your role cannot view Channels.</p></div>
      )}
      <section className={CARD}>
        {tab === "posts" && <PostsTab canModerate={hasPermission(role, "channels.moderate")} />}
        {tab === "reports" && <ReportsTab canModerate={hasPermission(role, "channels.moderate")} />}
        {tab === "kyc" && (hasPermission(role, "channels.kyc") ? <KycTab canReview /> : <Empty text="Your role cannot review identity checks." />)}
        {tab === "causes" && <CausesTab canReview={hasPermission(role, "channels.causes")} />}
        {tab === "channels" && <ChannelsTab canModerate={hasPermission(role, "channels.moderate")} />}
        {tab === "payouts" && <PayoutsTab />}
        {tab === "rates" && <RatesTab canManage={hasPermission(role, "settings.manage")} />}
      </section>
    </SettingsPageShell>
  );
}

export default function ChannelsReviewPage() {
  return (
    <Suspense fallback={null}>
      <Review />
    </Suspense>
  );
}
