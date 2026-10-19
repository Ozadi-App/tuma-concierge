"use client";

import type { TalentAdminOverview } from "@peebee/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNote, label, ugx } from "../../components/talent/ui";
import { api, errorMessage } from "../../lib/api";

export default function TalentOverviewPage() {
  const [data, setData] = useState<TalentAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.talentAdminOverview().then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className="text-sm text-ink-500">Loading…</p>;
  const c = data.counts;
  const queues = [
    { href: "/talent/jobs?status=pending_review", label: "Jobs to review", n: c.jobsReview },
    { href: "/talent/workers?status=pending", label: "Profiles to approve", n: c.workersPending },
    { href: "/talent/safety", label: "Open reports", n: c.openReports },
    { href: "/talent/disputes", label: "Disputes", n: c.disputes },
  ];
  return (
    <div className="space-y-4">
      {!data.settings.enabled ? (
        <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-ink">Jobs is <strong>switched off</strong> for customers. Turn it on in <Link className="underline" href="/talent/settings">Settings</Link>.</p>
      ) : null}
      {data.settings.freeAccess ? (
        <p className="rounded-xl border border-[var(--border-faint)] px-3 py-2 text-sm text-ink-500">All free access is <strong className="text-ink">on</strong>: no fee, commission or plan is charged. Change it in <Link className="underline" href="/talent/money">Money</Link>.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {queues.map((q) => (
          <Link key={q.href} href={q.href} className="home-card !p-3.5">
            <span className="block text-2xl font-bold text-ink">{q.n}</span>
            <span className="text-xs font-semibold text-ink-500">{q.label}</span>
          </Link>
        ))}
      </div>

      <section className="home-card space-y-2 !p-3.5">
        <h2 className="text-sm font-bold text-ink">Activity</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-ink-500">Open jobs</dt><dd className="text-right font-semibold">{c.jobsOpen}</dd>
          <dt className="text-ink-500">Live workers</dt><dd className="text-right font-semibold">{c.workers}</dd>
          <dt className="text-ink-500">Running contracts</dt><dd className="text-right font-semibold">{c.contracts}</dd>
          <dt className="text-ink-500">Held in escrow</dt><dd className="text-right font-semibold">{ugx(data.money.heldInEscrowUgx)}</dd>
          <dt className="text-ink-500">Owed to Peebee</dt><dd className="text-right font-semibold">{ugx(data.money.owedToPeebeeUgx)}</dd>
        </dl>
      </section>

      <section className="home-card space-y-2 !p-3.5">
        <div className="flex items-baseline justify-between"><h2 className="text-sm font-bold text-ink">Revenue, last 30 days</h2><strong className="text-gold">{ugx(data.revenue30dTotalUgx)}</strong></div>
        {data.revenue30d.length === 0 ? <p className="text-sm text-ink-500">Nothing collected.</p> : (
          <ul className="space-y-1 text-sm">{data.revenue30d.map((r) => <li key={r.kind} className="flex justify-between"><span className="text-ink-500">{label(r.kind)} <span className="text-[11px]">×{r.count}</span></span><span className="font-semibold">{ugx(r.totalUgx)}</span></li>)}</ul>
        )}
        {data.waived30d.length > 0 ? <p className="border-t border-[var(--border-faint)] pt-2 text-xs text-ink-500">Waived: {data.waived30d.map((w) => `${label(w.reason)} ${w.count}`).join(" · ")}</p> : null}
      </section>
    </div>
  );
}
