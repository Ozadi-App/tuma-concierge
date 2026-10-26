"use client";

import type { CauseView } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProgressBar } from "../../../components/channels/CauseCard";
import { Button, Card, Chip, Notice, TextArea, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { api, errorMessage } from "../../../lib/api";
import { ugx, uploadPicture } from "../../../lib/channels";

const STATUS: Record<string, string> = { draft: "Draft", submitted: "Waiting for approval", live: "Live", rejected: "Needs changes", ended: "Ended", closed: "Closed", frozen: "On hold" };

function CauseForm({ initial, onSaved, onCancel }: { initial?: CauseView; onSaved: () => void; onCancel: () => void }) {
  const { config } = useMyChannel();
  const rules = config?.causes;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [story, setStory] = useState(initial?.story ?? "");
  const [beneficiary, setBeneficiary] = useState(initial?.beneficiary ?? "");
  const [goal, setGoal] = useState(initial?.goalUgx ?? 500_000);
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<"keep" | "all_or_nothing">((initial?.fundingMode as "keep" | "all_or_nothing") ?? rules?.defaultFundingMode ?? "keep");
  const [cover, setCover] = useState<{ path: string; url: string } | null>(initial?.coverUrl ? { path: "", url: initial.coverUrl } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { title, story, beneficiary: beneficiary || undefined, goalUgx: goal, ...(cover?.path ? { coverPath: cover.path } : {}) };
      if (initial) await api.updateCause(initial.id, { ...body, ...(initial.status === "live" ? {} : { fundingMode: mode }) });
      else await api.createCause({ ...body, days, fundingMode: mode });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <Card title={initial ? "Edit cause" : "Start a cause"} hint={rules?.requireApproval ? "Peebee checks every cause before it goes public." : undefined}>
        {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={cover.url} alt="Cover" className="aspect-[16/10] w-full rounded-2xl object-cover" />}
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] px-5 text-sm font-bold text-ink">{cover ? "Change cover picture" : "Add a cover picture"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setCover(await uploadPicture(f)); } catch (err) { setError(errorMessage(err)); } } }} /></label>
        <TextField id="cz-t" label="Title" value={title} onChange={setTitle} maxLength={100} required />
        <TextArea id="cz-s" label="Your story" hint="What is it for, who benefits, how will the money be used? Honest detail helps people trust you." value={story} onChange={setStory} rows={7} maxLength={5000} required />
        <TextField id="cz-b" label="Who is it for? (optional)" value={beneficiary} onChange={setBeneficiary} maxLength={120} />
        <TextField id="cz-g" label={`Goal (UGX ${(rules?.minGoalUgx ?? 0).toLocaleString()} to ${(rules?.maxGoalUgx ?? 0).toLocaleString()})`} type="number" inputMode="numeric" value={goal} onChange={(v) => setGoal(Number(v))} required />
        {!initial && <TextField id="cz-d" label={`How many days? (${rules?.minDays} to ${rules?.maxDays})`} type="number" inputMode="numeric" value={days} onChange={(v) => setDays(Number(v))} required />}
        {rules?.allowAllOrNothing && initial?.status !== "live" && (
          <div className="space-y-2"><p className="text-xs font-bold text-ink-500">If the goal is not reached</p>
            <div className="flex flex-wrap gap-2"><Chip active={mode === "keep"} onClick={() => setMode("keep")}>Keep what is raised</Chip><Chip active={mode === "all_or_nothing"} onClick={() => setMode("all_or_nothing")}>Refund everyone</Chip></div></div>
        )}
        {initial?.status === "live" && <Notice tone="info">Changing the title, story, goal or who it is for sends this cause back for approval before it shows again.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2"><Button variant="plain" onClick={onCancel} className="flex-1">Cancel</Button><Button type="submit" disabled={busy} className="flex-[1.4]">{busy ? "Saving…" : "Save"}</Button></div>
      </Card>
    </form>
  );
}

export default function CausesPage() {
  const { channel, config, loading } = useMyChannel();
  const [causes, setCauses] = useState<CauseView[] | null>(null);
  const [editing, setEditing] = useState<CauseView | "new" | null>(null);
  const [update, setUpdate] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => { api.myCauses().then((r) => setCauses(r.causes)).catch((e) => setMsg({ ok: false, text: errorMessage(e) })); }, []);
  useEffect(() => { if (channel && config?.causes?.enabled) load(); }, [channel, config, load]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!channel) return <Notice tone="info">Open a channel first to raise money for a cause.</Notice>;
  if (!config?.causes?.enabled) return <Notice tone="info">Causes are not available yet.</Notice>;

  async function run(id: string, fn: () => Promise<string>) {
    setBusy(id);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      load();
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  if (editing) return <CauseForm initial={editing === "new" ? undefined : editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-extrabold text-ink">Causes</h1><Button onClick={() => setEditing("new")} className="!min-h-10 !text-xs">Start a cause</Button></div>
      <p className="text-sm text-ink-500">Raise money for a project. Anyone can give through your link, with or without a Peebee account.</p>
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
      {causes?.length === 0 && <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-6 text-center text-sm text-ink-500">No causes yet.</p>}
      {causes?.map((c) => (
        <Card key={c.id}>
          <div className="flex items-start justify-between gap-3"><h2 className="text-base font-bold text-ink">{c.title}</h2><span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold">{STATUS[c.status] ?? c.status}</span></div>
          <ProgressBar percent={c.percent} />
          <p className="text-sm text-ink"><strong>{ugx(c.raisedUgx)}</strong> <span className="text-ink-500">of {ugx(c.goalUgx)} · {c.donorCount} donors{c.status === "live" ? ` · ${c.daysLeft} days left` : ""}</span></p>
          {c.rejectionReason && <Notice tone="error">Needs changes: {c.rejectionReason}</Notice>}
          {c.status === "frozen" && <Notice tone="info">This cause is on hold while Peebee looks into it.</Notice>}
          {["live", "ended", "closed"].includes(c.status) && (
            <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-sm text-ink">
              <p>Ready to take out: <strong>{ugx(c.releasableUgx ?? 0)}</strong></p>
              <p className="text-xs text-ink-500">Already taken out: {ugx(c.releasedUgx ?? 0)}. New donations are held for a short safety period first.</p>
              <Button disabled={busy === c.id || (c.releasableUgx ?? 0) <= 0} onClick={() => run(c.id, async () => { const r = await api.releaseCause(c.id); return `${ugx(r.releasedUgx)} moved to your earnings. Withdraw it from the Money page.`; })} className="mt-2 !min-h-10 !text-xs">Move to my earnings</Button>
            </div>
          )}
          {["live", "ended", "closed"].includes(c.status) && <p className="text-xs text-ink-500">Your link: <Link href={`/give/${c.slug}`} className="font-bold text-gold">peebee.online/give/{c.slug}</Link></p>}
          {c.status === "live" && (
            <div className="space-y-2">
              <TextField id={`up-${c.id}`} label="Post an update for your donors" value={update[c.id] ?? ""} onChange={(v) => setUpdate((s) => ({ ...s, [c.id]: v }))} maxLength={1000} />
              <Button variant="plain" disabled={busy === c.id || !(update[c.id] ?? "").trim()} onClick={() => run(c.id, async () => { await api.postCauseUpdate(c.id, update[c.id]!); setUpdate((s) => ({ ...s, [c.id]: "" })); return "Update posted."; })} className="!min-h-10 !text-xs">Post update</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {["draft", "rejected", "live", "submitted"].includes(c.status) && <Button variant="plain" onClick={() => setEditing(c)} className="!min-h-10 !text-xs">Edit</Button>}
            {["draft", "rejected"].includes(c.status) && <Button disabled={busy === c.id} onClick={() => run(c.id, async () => { const r = await api.submitCause(c.id); return r.cause.status === "live" ? "Your cause is live." : "Sent for approval. We will let you know."; })} className="!min-h-10 !text-xs">Send for approval</Button>}
            {c.status === "live" && <Button variant="danger" disabled={busy === c.id} onClick={() => { if (window.confirm("Close this cause? No more donations will be taken.")) void run(c.id, async () => { await api.closeCause(c.id); return "Cause closed."; }); }} className="!min-h-10 !text-xs">Close</Button>}
          </div>
        </Card>
      ))}
      <p className="text-xs text-ink-500">Taking money out needs a one-time ID check: <Link href="/studio/withdraw" className="font-bold text-gold">verify and withdraw</Link>.</p>
    </div>
  );
}
