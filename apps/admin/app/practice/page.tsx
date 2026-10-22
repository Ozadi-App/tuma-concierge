"use client";

import { MODULES, MODULE_CLUSTERS, resolveModuleAvailability, type ModuleFlags, type PracticeCoverage, type PracticeWorldStatus } from "@peebee/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SettingsPageShell } from "../../components/SettingsPageShell";
import { Switch } from "../../components/ui/Switch";
import { api, errorMessage } from "../../lib/api";

const COVERAGE_LABEL: Record<PracticeCoverage, string> = { full: "Complete", partial: "Partly simulated", none: "Not simulated yet" };
const COVERAGE_CLASS: Record<PracticeCoverage, string> = {
  full: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  none: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

export default function PracticePage() {
  const [flags, setFlags] = useState<ModuleFlags | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [autoSandbox, setAutoSandbox] = useState(true);
  const [world, setWorld] = useState<PracticeWorldStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminGetModules()
      .then((r) => { setFlags(r.modules.flags); setPracticeMode(r.practiceModeEnabled); setAutoSandbox(r.practiceAutoInSandbox); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    api.adminPracticeWorld().then(setWorld).catch(() => undefined);
  }, []);

  async function worldAction(label: string, run: () => Promise<unknown>) {
    setBusy(label); setError(null);
    try { await run(); setWorld(await api.adminPracticeWorld()); } catch (err) { setError(errorMessage(err)); } finally { setBusy(null); }
  }

  async function save(label: string, update: Parameters<typeof api.adminUpdateModules>[0]) {
    setBusy(label); setError(null);
    try {
      const r = await api.adminUpdateModules(update);
      setFlags(r.modules.flags); setPracticeMode(r.practiceModeEnabled); setAutoSandbox(r.practiceAutoInSandbox);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  }

  const available = useMemo(() => (flags ? resolveModuleAvailability(flags) : null), [flags]);
  const totals = useMemo(() => {
    const t = { full: 0, partial: 0, none: 0 };
    for (const m of MODULES) t[m.practice.coverage]++;
    return t;
  }, []);

  return (
    <SettingsPageShell title="Practice" description="One simulated world for every app: people, content, rides, stores and channels that behave like the real thing without touching real money, orders or people." loading={loading}>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {flags && available && (
        <div className="space-y-5">
          <section className="home-card space-y-4">
            <label className="flex items-start gap-3">
              <Switch aria-label="Practice mode" checked={practiceMode} disabled={busy === "mode"} onChange={(e) => save("mode", { practiceModeEnabled: e.target.checked })} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">Practice mode {practiceMode ? "is available" : "is off"}</span>
                <span className="block text-xs text-ink-500">Lets customers, riders, restaurants, merchants, fuel attendants and learners open the simulated world from their account. Nothing in it creates a real order, moves a balance, notifies a person or reaches a payment provider.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Switch aria-label="Open practice by itself in sandbox" checked={autoSandbox} disabled={busy === "auto" || !practiceMode} onChange={(e) => save("auto", { practiceAutoInSandbox: e.target.checked })} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">Open practice by itself in sandbox</span>
                <span className="block text-xs text-ink-500">While the platform is in sandbox, the customer app opens in this world automatically. People can leave from the Practice tab. Does nothing in Live.</span>
              </span>
            </label>
            <p className="text-xs text-ink-500">Which modules exist in the practice world is set on <Link href="/settings/services" className="font-bold text-ink underline">Services</Link> (Practice tab). A module can be on there while it is still off in Live.</p>
          </section>

          <section className="home-card space-y-3">
            <div>
              <h2 className="text-base font-bold text-ink">The shared practice world</h2>
              <p className="text-xs text-ink-500">
                One set of demo people, shops, menus and orders, the same data the platform-wide Sandbox shows. Practising users act as a demo persona inside it, so a demo customer&rsquo;s order reaches practising riders, merchants and restaurants.
                {world?.platformEnvironment === "sandbox" ? " The whole platform is in sandbox right now, so everyone sees it." : " The platform is live, so only people who start practice see it."} Switch the whole platform on <Link href="/settings/platform" className="font-bold text-ink underline">Platform state</Link>.
              </p>
            </div>
            {world && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([["Customers", world.counts.customers], ["Riders", world.counts.riders], ["Merchants", world.counts.merchants], ["Restaurants", world.counts.restaurants], ["Stores", world.counts.stores], ["Products", world.counts.products], ["Dishes", world.counts.menuItems], ["Orders", world.counts.orders]] as const).map(([label, n]) => (
                  <div key={label} className="rounded-xl bg-[rgb(var(--surface-muted))] px-3 py-2"><dt className="text-[11px] font-semibold text-ink-500">{label}</dt><dd className="text-lg font-bold text-ink">{n}</dd></div>
                ))}
              </dl>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => worldAction("seed", () => api.adminSeedPractice())} className="admin-btn-gold min-h-10 px-4 text-sm font-bold">{busy === "seed" ? "Working…" : world?.seeded ? "Add anything missing" : "Lay down the practice world"}</button>
              <button type="button" disabled={!!busy || !world?.seeded} onClick={() => worldAction("orders", () => api.adminPracticeOrders())} className="min-h-10 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink disabled:opacity-50">{busy === "orders" ? "Working…" : "Demo customers place orders now"}</button>
              <button type="button" disabled={!!busy || !world?.seeded} onClick={() => { if (window.confirm("Clear every practice order and put demo balances back? Real data is not touched.")) void worldAction("reset", () => api.adminResetPractice()); }} className="min-h-10 rounded-full border border-red-300 px-4 text-sm font-bold text-red-700 disabled:opacity-50">{busy === "reset" ? "Working…" : "Reset practice orders and money"}</button>
            </div>
          </section>

          <section className="home-card space-y-2">
            <h2 className="text-base font-bold text-ink">What the practice world holds</h2>
            <p className="text-xs text-ink-500">{totals.full} modules are fully simulated, {totals.partial} partly, {totals.none} not yet. Anything partial or missing is listed under its module so the gaps are on record rather than found by hand.</p>
          </section>

          {MODULE_CLUSTERS.map((cluster) => (
            <section key={cluster.id} className="home-card space-y-3">
              <h2 className="text-base font-bold text-ink">{cluster.label}</h2>
              <ul className="divide-y divide-[var(--border-faint)]">
                {MODULES.filter((m) => m.cluster === cluster.id).map((m) => {
                  const on = available[m.key]!.practice;
                  return (
                    <li key={m.key} className="space-y-1 py-3 first:pt-0 last:pb-0" style={{ paddingLeft: (m.key.split(".").length - 1) * 16 }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink">{m.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COVERAGE_CLASS[m.practice.coverage]}`}>{COVERAGE_LABEL[m.practice.coverage]}</span>
                        <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-[11px] font-bold text-ink-500">{on ? "On in Practice" : "Off in Practice"}</span>
                      </div>
                      {m.practice.has.length > 0 && <p className="text-xs text-ink-500"><span className="font-semibold text-ink">Has:</span> {m.practice.has.join(", ")}</p>}
                      {m.practice.missing && m.practice.missing.length > 0 && <p className="text-xs text-ink-500"><span className="font-semibold text-ink">Missing:</span> {m.practice.missing.join(", ")}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SettingsPageShell>
  );
}
