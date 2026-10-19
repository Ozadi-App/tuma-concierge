"use client";

import type { TalentWorker } from "@peebee/shared";
import { BadgeCheck, Flag, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { cardClass, EmptyState, FailureNote, JobsPage, primaryBtn, Rating, secondaryBtn, Spinner, BusyButton } from "./JobsUI";
import { formatUgx, jobsFailure, RATE_TYPE, type JobsFailure } from "./jobs-utils";

type Detail = { worker: TalentWorker; phoneLocked: boolean; reviews: { rating: number; comment: string; createdAt: string; from: string }[] };

export function WorkerDetail({ id }: { id: string }) {
  const forJob = useSearchParams().get("forJob");
  const [invited, setInvited] = useState(false);
  const [data, setData] = useState<Detail | null>(null);
  const [failure, setFailure] = useState<JobsFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    api.talentWorker(id).then(setData).catch((err) => setFailure(jobsFailure(err)));
  }, [id]);

  async function unlock() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await api.talentUnlockContact(id);
      setData((d) => (d ? { ...d, phoneLocked: false, worker: { ...d.worker, phone: r.phone } } : d));
    } catch (err) {
      setFailure(jobsFailure(err));
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const reason = window.prompt("What is wrong with this profile?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await api.talentReport({ targetType: "profile", targetId: id, reason: reason.trim() });
      setReported(true);
    } catch (err) {
      setFailure(jobsFailure(err));
    }
  }

  const w = data?.worker;
  return (
    <JobsPage eyebrow="Peebee Hire" title="Worker" backHref="/services/hire/workers" backLabel="Back to search">
      {!data && !failure ? <Spinner label="Loading profile" /> : null}
      {!data && failure ? <EmptyState title="Not available" text={failure.message} action={<Link href="/services/hire/workers" className={secondaryBtn}>Back to search</Link>} /> : null}
      {w ? (
        <>
          <section className={`${cardClass} space-y-3`}>
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/15 text-2xl font-bold text-gold" aria-hidden>{w.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-lg font-bold">{w.name}{w.verified ? <BadgeCheck className="h-5 w-5 text-gold" aria-label="ID verified" /> : null}</h2>
                <p className="text-sm text-ink">{w.headline}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
                  <Rating rating={w.rating} count={w.ratingCount} />
                  <span>{w.jobsCompleted} jobs done</span>
                  {w.area ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{w.area}</span> : null}
                </div>
              </div>
            </div>
            <p className="text-sm font-bold text-gold">{w.rateUgx > 0 ? `${formatUgx(w.rateUgx)} ${RATE_TYPE[w.rateType]}` : "Rate: negotiable"}</p>
            {w.categories.length ? <p className="text-xs text-ink-500">{w.categories.join(" · ")}</p> : null}
          </section>

          {w.bio ? (
            <section className={`${cardClass} space-y-2`}>
              <h3 className="text-sm font-bold">About</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{w.bio}</p>
              {w.skills.length ? <div className="flex flex-wrap gap-1.5 pt-1">{w.skills.map((s) => <span key={s} className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-[11px] font-semibold">{s}</span>)}</div> : null}
              <p className="text-xs text-ink-500">{w.experienceYears > 0 ? `${w.experienceYears} years of experience. ` : ""}{w.languages.length ? `Speaks ${w.languages.join(", ")}.` : ""}{w.remote ? " Works remotely." : ""}</p>
            </section>
          ) : null}

          <section className={`${cardClass} space-y-3`}>
            <h3 className="text-sm font-bold">Hire {w.name.split(" ")[0]}</h3>
            {forJob ? (
              <BusyButton busy={busy} disabled={invited} className={primaryBtn} onClick={async () => { setBusy(true); setFailure(null); try { await api.talentInvite(forJob, id); setInvited(true); } catch (err) { setFailure(jobsFailure(err)); } finally { setBusy(false); } }}>{invited ? "Invited" : "Invite to my job"}</BusyButton>
            ) : (
              <Link href={`/services/hire/post?invite=${encodeURIComponent(w.id)}`} className={primaryBtn}>Post a job and invite them</Link>
            )}
            {data.phoneLocked ? (
              <BusyButton busy={busy} onClick={unlock} className={secondaryBtn}><Phone className="h-4 w-4" aria-hidden />Show phone number</BusyButton>
            ) : w.phone ? (
              <a href={`tel:${w.phone}`} className={secondaryBtn}><Phone className="h-4 w-4" aria-hidden />Call {w.phone}</a>
            ) : null}
            <FailureNote failure={failure} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold">Reviews</h3>
            {data.reviews.length === 0 ? <p className="text-sm text-ink-500">No reviews yet.</p> : (
              <ul className="space-y-2">
                {data.reviews.map((r, i) => (
                  <li key={i} className={`${cardClass} space-y-1`}>
                    <Rating rating={r.rating} count={1} />
                    {r.comment ? <p className="text-sm">{r.comment}</p> : null}
                    <p className="text-[11px] text-ink-500">{r.from}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button type="button" onClick={report} disabled={reported} className="mx-auto flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-ink-500 underline disabled:no-underline">
            <Flag className="h-3.5 w-3.5" aria-hidden />{reported ? "Reported. Thank you." : "Report this profile"}
          </button>
        </>
      ) : null}
    </JobsPage>
  );
}
