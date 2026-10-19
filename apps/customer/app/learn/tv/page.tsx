"use client";

import type { TvDevice } from "@peebee/shared";
import { ArrowLeft, CheckCircle2, MonitorPlay, Tv, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "../../../lib/api";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const TV_URL = (process.env.NEXT_PUBLIC_TV_URL ?? "https://tv.peebee.online").replace(/^https?:\/\//, "").replace(/\/$/, "");

const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

function LinkTv() {
  const asked = useSearchParams().get("code");
  const [code, setCode] = useState(() => clean(asked ?? ""));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const [devices, setDevices] = useState<TvDevice[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices((await api.tvDevices()).devices);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void load();
    // Who is linked is worth keeping fresh: the TV shows up here the moment it connects.
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function link(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    setLinked(null);
    try {
      const res = await api.tvPair(code, name.trim(), "learn");
      setLinked(res.device.name);
      setCode("");
      setName("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.tvRemove(id);
      setRemoving(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-28">
      <header className="space-y-1">
        <Link href="/learn" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Learn
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">Watch on your TV</h1>
        <p className="text-sm text-ink-500">Study your courses on the big screen: watch lessons, take quizzes and pick up where you left off. Your progress stays in sync with your phone.</p>
      </header>

      <section aria-labelledby="link-h" className={`${card} space-y-4 p-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Tv className="h-5 w-5" aria-hidden />
          </span>
          <h2 id="link-h" className="text-base font-semibold text-ink">
            Link a TV
          </h2>
        </div>
        <ol className="space-y-1.5 text-sm text-ink-500">
          <li>
            <strong className="text-ink">1.</strong> On your TV, open the browser and go to <strong className="text-ink">{TV_URL}</strong>
          </li>
          <li>
            <strong className="text-ink">2.</strong> The TV shows a 6-character code. Type it here, then tap <strong className="text-ink">Link TV</strong>.
          </li>
          <li>
            <strong className="text-ink">3.</strong> That&apos;s it. Your courses appear on the TV within a few seconds.
          </li>
        </ol>
        <form onSubmit={link} className="space-y-3">
          <input
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            aria-label="Code shown on the TV"
            placeholder="ABC123"
            className="w-full rounded-xl border border-[var(--border-faint)] text-center font-mono text-2xl font-bold tracking-[0.35em] text-ink outline-none focus:border-gold"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            aria-label="Name for this TV (optional)"
            placeholder="Name this TV (optional), e.g. Living room"
            className="w-full rounded-xl border border-[var(--border-faint)] text-sm text-ink outline-none focus:border-gold"
          />
          <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink-gold disabled:opacity-50">
            {busy ? "Linking…" : "Link TV"}
          </button>
          <p className="text-[11px] text-ink-500">Only link a TV that is showing this same code. The TV will be able to open your courses and lessons. It can never spend your money.</p>
        </form>
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        {linked && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-green/10 px-3.5 py-3 text-sm font-semibold text-green">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {linked} is linked. Look at your TV: your courses are on the screen.
          </p>
        )}
      </section>

      <section aria-labelledby="tvs-h" className="space-y-3">
        <h2 id="tvs-h" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MonitorPlay className="h-4 w-4 text-gold" aria-hidden /> Your TVs
        </h2>
        {devices === null ? (
          <div className="h-16 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
        ) : devices.length === 0 ? (
          <p className={`${card} p-4 text-sm text-ink-500`}>No TV is linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className={`${card} flex items-center justify-between gap-3 p-3`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{d.name}</p>
                  <p className="text-xs text-ink-500">
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${d.online ? "bg-green" : "bg-[rgb(var(--surface-muted))]"}`} aria-hidden />
                    {d.online ? "On now" : "Off or not connected"}
                  </p>
                </div>
                {removing === d.id ? (
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <button type="button" onClick={() => void remove(d.id)} className="rounded-lg bg-gold px-3 py-1.5 font-semibold text-ink-gold">
                      Unlink
                    </button>
                    <button type="button" onClick={() => setRemoving(null)} className="rounded-lg border border-[var(--border-faint)] px-3 py-1.5 font-semibold text-ink">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setRemoving(d.id)} aria-label={`Unlink ${d.name}`} className="shrink-0 rounded-lg p-2 text-ink-500 hover:text-ink">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function WatchOnTvPage() {
  return (
    <Suspense fallback={null}>
      <LinkTv />
    </Suspense>
  );
}
