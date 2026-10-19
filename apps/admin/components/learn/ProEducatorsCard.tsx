"use client";

import type { LearnProEducator } from "@peebee/shared";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "no end date");

/** Who has Learn Pro. Staff can give it to an educator by phone or email, or take it away. */
export function ProEducatorsCard({ canManage }: { canManage: boolean }) {
  const [educators, setEducators] = useState<LearnProEducator[] | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEducators((await api.adminProList()).educators);
    } catch (err) {
      setEducators([]);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const n = days.trim() === "" ? null : Number(days);
      if (n !== null && (!Number.isInteger(n) || n < 1)) throw new Error("Days must be a whole number, or leave it empty for no end date.");
      const res = await api.adminProGrant(identifier.trim(), n);
      setMessage(`${res.name} now has Learn Pro (${res.expiresAt ? `until ${when(res.expiresAt)}` : "no end date"}).`);
      setIdentifier("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(e: LearnProEducator) {
    if (!window.confirm(`Take Learn Pro away from ${e.name}?`)) return;
    setError(null);
    setMessage(null);
    try {
      await api.adminProRevoke(e.userId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="space-y-4 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-ink">Educators with Learn Pro</h2>
          <p className="text-xs text-ink-500">Only matters when &ldquo;TV is a Pro feature&rdquo; is on. Educators can also buy Pro from their wallet.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <div className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
          <label htmlFor="pro-who" className="mb-1 text-xs font-bold text-ink-500">Educator&apos;s phone or email</label>
          <input id="pro-who" value={identifier} disabled={!canManage || busy} onChange={(ev) => setIdentifier(ev.target.value)} className="w-full text-base font-bold text-ink outline-none" />
        </div>
        <div className="field-box flex flex-col rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
          <label htmlFor="pro-days" className="mb-1 text-xs font-bold text-ink-500">Days</label>
          <input id="pro-days" inputMode="numeric" value={days} placeholder="No end" disabled={!canManage || busy} onChange={(ev) => setDays(ev.target.value.replace(/\D/g, ""))} className="w-full text-base font-bold text-ink outline-none" />
        </div>
        <button type="button" disabled={!canManage || busy || identifier.trim().length < 3} onClick={() => void grant()} className="rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink-gold disabled:opacity-50">
          Give Pro
        </button>
      </div>

      {message && <p role="status" className="rounded-2xl bg-green/10 p-3 text-sm font-semibold text-green">{message}</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {educators === null ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : educators.length === 0 ? (
        <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-sm text-ink-500">No educator has Learn Pro yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-faint)]">
          {educators.map((e) => (
            <li key={e.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{e.name}</p>
                <p className="truncate text-xs text-ink-500">
                  {e.contact} · {e.source === "purchase" ? `bought, UGX ${e.pricePaidUgx.toLocaleString("en-UG")}` : "granted by staff"} · {e.active ? `until ${when(e.expiresAt)}` : `ended ${when(e.expiresAt)}`}
                </p>
              </div>
              <button type="button" disabled={!canManage} onClick={() => void revoke(e)} className="rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-bold text-ink disabled:opacity-50">
                Take away
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
