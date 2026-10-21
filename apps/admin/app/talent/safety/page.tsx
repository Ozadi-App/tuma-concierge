"use client";

import { Select } from "../../../components/ui/Select";
import type { TalentAdminReport, TalentAdminTerm } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Badge, ErrorNote, inputCls, label, useTalentPermissions, when } from "../../../components/talent/ui";
import { api, errorMessage } from "../../../lib/api";

export default function TalentSafetyPage() {
  const { canManage } = useTalentPermissions();
  const [reports, setReports] = useState<TalentAdminReport[] | null>(null);
  const [terms, setTerms] = useState<TalentAdminTerm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("illegal");
  const [action, setAction] = useState<"block" | "review">("block");
  const [show, setShow] = useState(false);

  const load = useCallback(() => {
    api.talentAdminReports().then((r) => setReports(r.reports)).catch((err) => setError(errorMessage(err)));
    api.talentAdminProhibited().then((r) => setTerms(r.terms)).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  async function resolve(id: string, act: "dismiss" | "take_down") {
    try { await api.talentAdminResolveReport(id, act, act === "take_down" ? "Removed after review" : ""); load(); } catch (err) { setError(errorMessage(err)); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api.talentAdminAddProhibited({ term: term.trim(), category: category.trim() || "illegal", action }); setTerm(""); load(); } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">Illegal and unconstitutional work isn&apos;t allowed on Peebee. Posts and profiles are screened against the list below; anything flagged or reported lands here.</p>
      <ErrorNote message={error} />
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-ink">Open reports and screening hits</h2>
        {reports === null && <p className="text-sm text-ink-500">Loading…</p>}
        {reports?.length === 0 && <p className="text-sm text-ink-500">Nothing waiting.</p>}
        <ul className="space-y-2">
          {reports?.map((r) => (
            <li key={r.id} className="home-card space-y-1.5 !p-3.5">
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-ink">{label(r.targetType)} <span className="font-mono text-[11px] font-normal text-ink-500">{r.targetId}</span></p><Badge tone={r.source === "screening" ? "warn" : "neutral"}>{r.source === "screening" ? "Screening" : "Reported"}</Badge></div>
              <p className="text-sm text-ink">{r.reason}</p>
              <p className="text-xs text-ink-500">{r.reporter ? `By ${r.reporter} · ` : ""}{when(r.createdAt)}</p>
              {canManage && <div className="flex gap-2 pt-1"><button type="button" onClick={() => resolve(r.id, "take_down")} className="min-h-9 rounded-full bg-red-600 px-3.5 text-xs font-bold text-white">Take down</button><button type="button" onClick={() => resolve(r.id, "dismiss")} className="min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink">Dismiss</button></div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-ink">Prohibited words and phrases</h2><button type="button" onClick={() => setShow(!show)} className="text-xs font-bold text-gold underline">{show ? "Hide list" : `Show list${terms ? ` (${terms.length})` : ""}`}</button></div>
        <p className="text-xs text-ink-500">&ldquo;Block&rdquo; stops a post outright. &ldquo;Review&rdquo; lets it through to staff first. A term matches the start of a word, so &ldquo;prostitut&rdquo; catches prostitute and prostitution.</p>
        {canManage && (
          <form onSubmit={add} className="grid grid-cols-[1fr_auto] gap-2">
            <input aria-label="New term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Word or phrase" className={inputCls} />
            <button type="submit" disabled={term.trim().length < 3} className="min-h-11 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold disabled:opacity-50">Add</button>
            <input aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={inputCls} />
            <Select aria-label="Action" value={action} onValueChange={(next) => setAction(next as "block" | "review")} className={inputCls}><option value="block">Block</option><option value="review">Review</option></Select>
          </form>
        )}
        {show && (
          <ul className="divide-y divide-[var(--border-faint)] rounded-xl border border-[var(--border-faint)]">
            {terms?.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className={t.active ? "text-ink" : "text-ink-500 line-through"}>{t.term} <span className="text-[11px] text-ink-500">· {label(t.category)}</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone={t.action === "block" ? "bad" : "warn"}>{t.action}</Badge>
                  {canManage && <button type="button" className="text-xs font-bold text-gold underline" onClick={async () => { try { await api.talentAdminUpdateProhibited(t.id, { active: !t.active }); load(); } catch (err) { setError(errorMessage(err)); } }}>{t.active ? "Turn off" : "Turn on"}</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
