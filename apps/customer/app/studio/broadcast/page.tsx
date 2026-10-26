"use client";

import type { MyAiring, PublisherView } from "@peebee/shared";
import { ArrowDown, ArrowUp, Plus, Radio, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countdownText, KIND_LABEL, whenText } from "../../../components/live/AiringCountdown";
import { Button, Card, Chip, Notice, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { api, errorMessage } from "../../../lib/api";

type Video = { id: string; title: string | null; durationSeconds: number | null; posterUrl: string | null; createdAt: string };

const mmss = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round(total % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
/** A date for a datetime-local field, in the phone's own time. */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const videoName = (v: Video) => v.title?.trim() || `Video from ${new Date(v.createdAt.replace(" ", "T") + "Z").toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

/**
 * A broadcast: pick videos you have already uploaded, put them in order, choose when it goes on air. Everyone who
 * tunes in watches the same moment, with live chat, like a TV channel. Below are your upcoming and past airings.
 */
export default function BroadcastPage() {
  const { config, identities, loading } = useMyChannel();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<"soon" | "pick">("soon");
  const [at, setAt] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [airings, setAirings] = useState<MyAiring[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<{ id: string; at: string } | null>(null);

  const live = config?.live;
  const usable: PublisherView[] = useMemo(
    () => identities.filter((i) => (i.type === "personal" ? config?.publishing?.personalPosting : config?.publishing?.publishers.includes(i.type))),
    [identities, config],
  );
  const identity = usable.find((i) => `${i.type}:${i.id}` === identityKey) ?? usable[0] ?? null;
  const byId = useMemo(() => new Map((videos ?? []).map((v) => [v.id, v])), [videos]);
  const total = picked.reduce((n, id) => n + (byId.get(id)?.durationSeconds ?? 0), 0);

  const loadAirings = useCallback(() => { api.myAirings().then((r) => setAirings(r.airings)).catch(() => setAirings([])); }, []);
  useEffect(() => {
    if (!live?.broadcastsEnabled && !live?.premieresEnabled) return;
    api.myReadyVideos().then((r) => setVideos(r.assets)).catch((e) => { setVideos([]); setError(errorMessage(e)); });
    loadAirings();
  }, [live?.broadcastsEnabled, live?.premieresEnabled, loadAirings]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!live?.broadcastsEnabled && !live?.premieresEnabled) {
    return (
      <div className="space-y-3 px-4 py-12 text-center">
        <Radio className="mx-auto h-10 w-10 text-gold" aria-hidden />
        <h1 className="text-lg font-bold text-ink">Broadcasts are coming soon</h1>
        <p className="text-sm text-ink-500">They are not open yet. Check back shortly.</p>
      </div>
    );
  }

  const move = (i: number, d: -1 | 1) => setPicked((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, live.maxProgramItems ?? 12)));
  const whenOk = when === "soon" || at !== "";
  const canSend = !!identity && title.trim().length > 0 && picked.length > 0 && whenOk && !busy;

  async function schedule() {
    if (!identity) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api.createBroadcast({ publisherType: identity.type, publisherId: identity.id, title: title.trim(), assetIds: picked, startsAt: when === "pick" ? new Date(at).toISOString() : null });
      setDone(`“${r.airing.title}” is set for ${whenText(r.airing.startsAt)}.`);
      setPicked([]);
      setTitle("");
      loadAirings();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setError(null);
    try { await api.cancelAiring(id); loadAirings(); } catch (err) { setError(errorMessage(err)); }
  }
  async function saveTime() {
    if (!editing) return;
    setError(null);
    try { await api.rescheduleAiring(editing.id, new Date(editing.at).toISOString()); setEditing(null); loadAirings(); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Broadcast</h1>
      <p className="text-sm text-ink-500">Air videos you have already uploaded, one after another, like a TV channel. Everyone who tunes in watches the same moment and can chat. Premiering a single video? Choose “Premiere this video” when you create a post.</p>

      {live.broadcastsEnabled && (
        <>
          <Card title="1. Name your broadcast">
            <TextField id="bc-title" label="Name" value={title} onChange={setTitle} maxLength={140} placeholder="e.g. Sunday Cooking Hour" />
            {usable.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Broadcast as">
                {usable.map((i) => { const key = `${i.type}:${i.id}`; return <Chip key={key} active={!!identity && key === `${identity.type}:${identity.id}`} onClick={() => setIdentityKey(key)}>{i.name}</Chip>; })}
              </div>
            )}
          </Card>

          <Card title="2. Choose the videos" hint={`Up to ${live.maxProgramItems ?? 12} of your ready videos, in the order they will play.`}>
            {videos === null && <p className="text-sm text-ink-500" aria-busy>Loading your videos…</p>}
            {videos?.length === 0 && <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-center text-sm text-ink-500">You have no ready videos yet. <Link href="/studio/new" className="font-bold text-gold">Upload one</Link>, then come back.</p>}
            <ul className="space-y-2">
              {videos?.map((v) => {
                const on = picked.includes(v.id);
                return (
                  <li key={v.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(v.id)} className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${on ? "bg-gold/20 ring-2 ring-gold" : "bg-[rgb(var(--surface-muted))]"}`}>
                      {v.posterUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.posterUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold"><Radio className="h-5 w-5" aria-hidden /></span>}
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{videoName(v)}</span><span className="text-xs text-ink-500 tabular-nums">{mmss(v.durationSeconds ?? 0)}</span></span>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${on ? "bg-gold text-ink-gold" : "bg-white/60 text-ink-500"}`}>{on ? picked.indexOf(v.id) + 1 : <Plus className="h-4 w-4" aria-hidden />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked.length > 0 && (
              <div className="space-y-2 border-t border-[var(--border-faint)] pt-3">
                <p className="text-xs font-bold text-ink-500">Playing order · {mmss(total)} in all</p>
                {picked.map((id, i) => (
                  <div key={id} className="flex items-center gap-2 rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-2">
                    <span className="w-5 text-xs font-extrabold text-gold">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{byId.get(id) ? videoName(byId.get(id)!) : id}</span>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-full p-1.5 disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                    <button type="button" aria-label="Move down" disabled={i === picked.length - 1} onClick={() => move(i, 1)} className="rounded-full p-1.5 disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden /></button>
                    <button type="button" aria-label="Remove" onClick={() => toggle(id)} className="rounded-full p-1.5 text-red-600"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="3. When does it go on air?">
            <div className="flex gap-2">
              <Chip active={when === "soon"} onClick={() => setWhen("soon")}>{live.minLeadMinutes ? `In ${live.minLeadMinutes} minutes` : "Right away"}</Chip>
              <Chip active={when === "pick"} onClick={() => setWhen("pick")}>Pick a time</Chip>
            </div>
            {when === "pick" && <TextField id="bc-at" label="On air at" type="datetime-local" value={at} onChange={setAt} min={localInput(new Date())} hint={`Up to ${live.maxLeadDays ?? 30} days ahead.`} />}
          </Card>

          {error && <Notice tone="error">{error}</Notice>}
          {done && <Notice tone="ok">{done}</Notice>}
          <Button disabled={!canSend} onClick={() => void schedule()} className="w-full">{busy ? "Scheduling…" : "Schedule the broadcast"}</Button>
        </>
      )}

      <Card title="Your broadcasts and premieres">
        {airings === null && <p className="text-sm text-ink-500" aria-busy>Loading…</p>}
        {airings?.length === 0 && <p className="text-sm text-ink-500">Nothing scheduled yet.</p>}
        <ul className="space-y-3">
          {airings?.map((a) => {
            const left = new Date(a.startsAt).getTime() - now;
            return (
              <li key={a.id} className="space-y-2 rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.title}</p>
                    <p className="text-xs text-ink-500">{KIND_LABEL[a.kind]} · {whenText(a.startsAt)} · {mmss(a.durationSeconds)}</p>
                    <p className="text-xs text-ink-500">
                      {a.status === "scheduled" ? `Starts in ${countdownText(left)} · ${a.reminders} reminder${a.reminders === 1 ? "" : "s"}` : a.status === "on_air" ? "On air now" : `Ended · most watching ${a.peakViewers}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${a.status === "on_air" ? "bg-red-600 text-white" : "bg-gold/15 text-gold"}`}>{a.status === "scheduled" ? "Scheduled" : a.status === "on_air" ? "On air" : "Ended"}</span>
                </div>
                {editing?.id === a.id && (
                  <div className="space-y-2">
                    <TextField id={`bc-edit-${a.id}`} label="New time" type="datetime-local" value={editing.at} onChange={(v) => setEditing({ id: a.id, at: v })} min={localInput(new Date())} />
                    <div className="flex gap-2"><Button onClick={() => void saveTime()} disabled={!editing.at}>Save</Button><Button variant="plain" onClick={() => setEditing(null)}>Cancel</Button></div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/post/${a.postId}`} className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-ink">Open</Link>
                  {a.status === "on_air" && <Link href="/live/helper" className="rounded-full bg-gold px-4 py-2 text-xs font-bold text-ink-gold">Manage the chat</Link>}
                  {a.status === "scheduled" && editing?.id !== a.id && <button type="button" onClick={() => setEditing({ id: a.id, at: localInput(new Date(a.startsAt)) })} className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-ink">Change time</button>}
                  {a.status === "scheduled" && <button type="button" onClick={() => void cancel(a.id)} className="rounded-full bg-red-50 px-4 py-2 text-xs font-bold text-red-700">{a.kind === "premiere" ? "Skip the premiere" : "Cancel"}</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
