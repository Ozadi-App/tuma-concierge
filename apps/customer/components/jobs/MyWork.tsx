"use client";

import type { TalentContractSummary, TalentMyApplication } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge, BusyButton, cardClass, EmptyState, FailureNote, JobsPage, primaryBtn, secondaryBtn, Spinner } from "./JobsUI";
import { formatUgx, JOB_TYPE, jobsFailure, type JobsFailure } from "./jobs-utils";
import { RecurrenceList } from "./Recurrences";

type Earnings = Awaited<ReturnType<typeof api.talentEarnings>>;

export function MyWork() {
  const [apps, setApps] = useState<TalentMyApplication[] | null>(null);
  const [contracts, setContracts] = useState<TalentContractSummary[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.talentMyApplications().then((r) => { setApps(r.applications); setFailure(null); }).catch((err) => setFailure(jobsFailure(err)));
    api.talentContracts("worker").then((r) => setContracts(r.contracts)).catch(() => {});
    api.talentEarnings().then(setEarnings).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function payDue() {
    setBusy(true);
    try { await api.talentPayDue(); setFailure(null); load(); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(false); }
  }

  const running = contracts.filter((c) => c.status === "active" || c.status === "disputed");
  const done = contracts.filter((c) => !["active", "disputed"].includes(c.status));
  const waiting = (apps ?? []).filter((a) => ["applied", "shortlisted"].includes(a.status));
  const past = (apps ?? []).filter((a) => !["applied", "shortlisted"].includes(a.status) && !a.contractId);

  return (
    <JobsPage eyebrow="Peebee Hire" title="My work" backHref="/services/hire" backLabel="Back to Hire">
      {earnings ? (
        <section className="grid grid-cols-2 gap-3" aria-label="Earnings">
          <div className={cardClass}><span className="block text-[11px] font-bold uppercase text-ink-500">Earned</span><strong className="text-lg text-gold">{formatUgx(earnings.worker.paidUgx)}</strong></div>
          <div className={cardClass}><span className="block text-[11px] font-bold uppercase text-ink-500">Still to come</span><strong className="text-lg">{formatUgx(earnings.worker.upcomingUgx)}</strong></div>
        </section>
      ) : null}
      {earnings && earnings.owedUgx > 0 ? (
        <section className={`${cardClass} space-y-2`}>
          <p className="text-sm">You owe Peebee <strong>{formatUgx(earnings.owedUgx)}</strong> in fees from jobs paid directly.</p>
          <BusyButton busy={busy} onClick={payDue} className={primaryBtn}>Pay from my wallet</BusyButton>
        </section>
      ) : null}
      <FailureNote failure={failure} />
      {!apps && !failure ? <Spinner label="Loading" /> : null}

      {running.length > 0 ? (
        <section className="space-y-2" aria-label="In progress">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">In progress</h2>
          {running.map((c) => (
            <Link key={c.id} href={`/services/hire/contracts/${c.id}`} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span className="min-w-0"><strong className="block truncate text-sm">{c.title}</strong><span className="block truncate text-xs text-ink-500">{c.otherParty.name} · {formatUgx(c.priceUgx)}</span></span>
              <Badge status={c.status} />
            </Link>
          ))}
        </section>
      ) : null}

      <RecurrenceList onChange={load} />

      {waiting.length > 0 ? (
        <section className="space-y-2" aria-label="Applications">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Waiting for a reply</h2>
          {waiting.map((a) => (
            <Link key={a.id} href={`/services/hire/${a.jobId}`} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span className="min-w-0"><strong className="block truncate text-sm">{a.jobTitle}</strong><span className="block truncate text-xs text-ink-500">{JOB_TYPE[a.jobType].short}{a.area ? ` · ${a.area}` : ""}{a.bidUgx ? ` · ${formatUgx(a.bidUgx)}` : ""}</span></span>
              <Badge status={a.status} />
            </Link>
          ))}
        </section>
      ) : null}

      {apps && running.length === 0 && waiting.length === 0 && done.length === 0 && past.length === 0 ? (
        <EmptyState title="No work yet" text="Set up your worker profile, then apply for gigs and projects near you." action={<div className="grid gap-2"><Link href="/services/hire/profile" className={primaryBtn}>My worker profile</Link><Link href="/services/hire/find" className={secondaryBtn}>Find work</Link></div>} />
      ) : null}

      {done.length > 0 ? (
        <section className="space-y-2" aria-label="Finished">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Finished</h2>
          {done.map((c) => (
            <Link key={c.id} href={`/services/hire/contracts/${c.id}`} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span className="min-w-0"><strong className="block truncate text-sm">{c.title}</strong><span className="block truncate text-xs text-ink-500">{c.otherParty.name} · {formatUgx(c.paidToWorkerUgx)} paid</span></span>
              <Badge status={c.status} />
            </Link>
          ))}
        </section>
      ) : null}
      {past.length > 0 ? (
        <section className="space-y-2" aria-label="Past applications">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Past applications</h2>
          {past.map((a) => (
            <Link key={a.id} href={`/services/hire/${a.jobId}`} className={`${cardClass} flex items-center justify-between gap-3`}>
              <span className="min-w-0 truncate text-sm">{a.jobTitle}</span><Badge status={a.status} />
            </Link>
          ))}
        </section>
      ) : null}
    </JobsPage>
  );
}
