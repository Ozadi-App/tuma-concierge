"use client";

import { Briefcase, ChevronRight, FilePlus2, Search, Sparkles, UserRound, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { cardClass, FailureNote, JobsPage, Spinner, Unavailable } from "./JobsUI";
import { formatUgx } from "./jobs-utils";
import { useJobsConfig } from "./useJobsConfig";

export function JobsHub() {
  const { config, me, failure } = useJobsConfig();

  if (failure && !config) {
    return (
      <JobsPage eyebrow="Peebee Jobs" title="Jobs" backHref="/service" backLabel="Back">
        <Unavailable failure={failure} />
      </JobsPage>
    );
  }
  if (failure) {
    return (
      <JobsPage eyebrow="Peebee Jobs" title="Jobs" backHref="/service" backLabel="Back">
        <Unavailable failure={failure} />
      </JobsPage>
    );
  }
  if (!config || !me) {
    return (
      <JobsPage eyebrow="Peebee Jobs" title="Jobs" backHref="/service" backLabel="Back">
        <Spinner label="Loading Jobs" />
      </JobsPage>
    );
  }

  const counts = me.counts;
  const profile = me.profile;
  const trial = me.membership.worker.trial ?? me.membership.employer.trial;

  const big = [
    { href: "/services/jobs/workers", icon: Users, title: "Find a worker", text: "Search people near you for any kind of work.", show: config.workerSearchEnabled },
    { href: "/services/jobs/find", icon: Search, title: "Find work", text: "Browse gigs, projects and jobs and apply.", show: true },
    { href: "/services/jobs/post", icon: FilePlus2, title: "Post a job", text: config.jobTypes.map((t) => (t === "gig" ? "a quick gig" : t === "project" ? "a project" : "a hiring ad")).join(", "), show: config.jobTypes.length > 0 },
  ].filter((b) => b.show);

  return (
    <JobsPage eyebrow="Peebee Jobs" title="Jobs" backHref="/service" backLabel="Back">
      <p className="text-sm leading-relaxed text-ink-500">Hire skilled people nearby, or find work that suits you. Quick gigs, projects and longer-term jobs, all in one place.</p>

      {config.freeAccess ? (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <strong>Free for now.</strong> Everything on Jobs is free to use at the moment.
        </div>
      ) : trial ? (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <strong>Pro trial running.</strong> Every Pro feature is free until {new Date(trial.expiresAt.replace(" ", "T") + "Z").toLocaleDateString("en-UG", { day: "numeric", month: "short" })}.
        </div>
      ) : null}

      <div className="grid gap-3">
        {big.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className={`${cardClass} flex min-h-[80px] items-center gap-4 transition-transform active:scale-[0.99]`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block">{title}</strong>
              <span className="block text-xs text-ink-500">{text}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
          </Link>
        ))}
      </div>

      <section aria-label="Your Jobs" className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Yours</h2>
        <ul className="divide-y divide-[var(--border-faint)] overflow-hidden rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]">
          {[
            { href: "/services/jobs/mine", icon: Briefcase, title: "Jobs I posted", note: counts.openJobs ? `${counts.openJobs} open` : "", extra: counts.hiringInProgress ? `${counts.hiringInProgress} running` : "" },
            { href: "/services/jobs/work", icon: Sparkles, title: "My work", note: counts.pendingApplications ? `${counts.pendingApplications} applied` : "", extra: counts.workInProgress ? `${counts.workInProgress} running` : counts.invites ? `${counts.invites} invites` : "" },
            { href: "/services/jobs/profile", icon: UserRound, title: profile ? "My worker profile" : "Offer your work", note: profile ? (profile.status === "approved" ? "Live" : profile.status === "pending" ? "Waiting for approval" : profile.status) : "Create a profile to apply for work", extra: "" },
            { href: "/services/jobs/plans", icon: Wallet, title: "Plans & Pro", note: config.freeAccess ? "Free for now" : "Upgrade for more", extra: "" },
          ].map(({ href, icon: Icon, title, note, extra }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-[60px] items-center gap-3 px-4 py-3 active:bg-[rgb(var(--surface-muted))]">
                <Icon className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{title}</strong>
                  {note || extra ? <span className="block truncate text-xs text-ink-500">{[note, extra].filter(Boolean).join(" · ")}</span> : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {me.membership.owedUgx > 0 ? <FailureNote failure={{ message: `You owe Peebee ${formatUgx(me.membership.owedUgx)} in fees. Pay it from "My work" to keep taking jobs.`, topUp: false, pro: false, disabled: false, pending: false }} /> : null}

      <p className="text-center text-[11px] text-ink-500">Peebee does not allow illegal or unconstitutional work. Report anything that looks wrong.</p>
    </JobsPage>
  );
}
