"use client";

import type { WorkJob } from "@peebee/shared";
import { Clock, MapPin, Power } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { estimatedEarnings, ugx, whenLabel } from "../lib/format";

export default function HomePage() {
  const { provider, canWork, isOwner, refreshProvider } = useAuth();
  const [open, setOpen] = useState<WorkJob[]>([]);
  const [active, setActive] = useState<WorkJob[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, feed] = await Promise.all([
        api.workProviderJobs(),
        canWork && isOwner ? api.workOpenJobs() : Promise.resolve({ jobs: [] as WorkJob[] }),
      ]);
      setActive(mine.jobs.filter((j) => ["assigned", "quoted", "booked", "in_progress", "completed", "disputed"].includes(j.status)));
      setOpen(feed.jobs);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [canWork, isOwner]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (!provider) return null;

  async function toggleOnline() {
    setError(null);
    try {
      const next = !provider!.online;
      let coords: { lat?: number; lng?: number } = {};
      if (next && typeof navigator !== "undefined" && navigator.geolocation) {
        coords = await new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({}),
            { timeout: 6000, maximumAge: 60000 },
          ),
        );
      }
      await api.workProviderUpdate({ online: next, ...coords });
      await refreshProvider();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function accept(job: WorkJob) {
    setBusyId(job.id);
    setError(null);
    setNotice(null);
    try {
      if (job.matchingMode === "broadcast") {
        await api.workAcceptJob(job.id);
        setNotice("Job accepted. It is now yours.");
      } else {
        await api.workOfferOnJob(job.id, {});
        setNotice("Offer sent. The customer will choose.");
      }
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {provider.status !== "approved" && (
        <div className="home-card space-y-1 p-4">
          <p className="text-sm font-black text-ink">{provider.status === "pending" ? "Waiting for approval" : provider.status === "suspended" ? "Account suspended" : "Application not approved"}</p>
          <p className="text-xs font-medium text-ink-500">{provider.statusNote || (provider.status === "pending" ? "Peebee is reviewing your account. You can take jobs once it is approved." : "Contact Peebee support for help.")}</p>
        </div>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={toggleOnline}
          disabled={!canWork}
          className={`flex w-full items-center justify-between rounded-3xl p-4 text-left transition active:scale-[0.99] disabled:opacity-50 ${provider.online ? "bg-gold text-ink-gold" : "home-card"}`}
        >
          <span>
            <span className="block text-base font-black">{provider.online ? "You are online" : "You are offline"}</span>
            <span className={`block text-xs font-medium ${provider.online ? "" : "text-ink-500"}`}>{provider.online ? "New jobs near you appear below." : "Go online to see and take jobs."}</span>
          </span>
          <Power className="h-6 w-6" aria-hidden />
        </button>
      )}

      {error && <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div>}
      {notice && <div className="rounded-2xl bg-green/10 p-3 text-xs font-bold text-green" role="status">{notice}</div>}

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-ink-500">Your jobs</h2>
          {active.map((j) => <JobCard key={j.id} job={j} />)}
        </section>
      )}

      {isOwner && canWork && (
        <section className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-ink-500">Open jobs near you</h2>
          {!provider.online && <p className="text-xs font-medium text-ink-500">Go online to be matched with new jobs.</p>}
          {provider.online && open.length === 0 && <p className="text-xs font-medium text-ink-500">No open jobs right now. We will keep looking.</p>}
          {open.map((j) => (
            <div key={j.id} className="home-card space-y-2 p-4">
              <JobSummary job={j} />
              {j.myOffer ? (
                <p className="text-xs font-bold text-gold">Offer sent{j.myOffer.price_ugx ? ` · ${ugx(j.myOffer.price_ugx)}` : ""}. Waiting for the customer.</p>
              ) : (
                <button type="button" onClick={() => accept(j)} disabled={busyId === j.id} className="w-full rounded-2xl bg-gold py-2.5 text-sm font-black text-ink-gold transition active:scale-[0.98] disabled:opacity-50">
                  {busyId === j.id ? "Please wait…" : j.matchingMode === "broadcast" ? "Accept job" : "Send offer"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function JobSummary({ job }: { job: WorkJob }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black text-ink">{job.service.name}{job.quantity > 1 ? ` × ${job.quantity}` : ""}</p>
        <StatusBadge status={job.status} />
      </div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{job.area || job.address}</p>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />{whenLabel(job.scheduledFor)}</p>
      <p className="text-xs font-black text-ink">
        {job.pricingMode === "quote" && job.priceUgx === 0 ? `Quote needed · call-out ${ugx(job.calloutFeeUgx)}` : `You earn about ${ugx(estimatedEarnings(job))}`}
      </p>
    </div>
  );
}

function JobCard({ job }: { job: WorkJob }) {
  return (
    <Link href={`/jobs/${job.id}`} className="home-card block p-4 transition active:scale-[0.99]">
      <JobSummary job={job} />
    </Link>
  );
}
