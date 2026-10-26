"use client";

import type { CauseView } from "@peebee/shared";
import Link from "next/link";
import { ugx } from "../../lib/channels";

/** The money bar shared by a cause card and a cause page. */
export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress towards the goal"} className="h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.max(2, percent)}%` }} />
    </div>
  );
}

export function CauseCard({ cause }: { cause: CauseView }) {
  return (
    <Link href={`/give/${cause.slug}`} className="block overflow-hidden rounded-3xl bg-[rgb(var(--surface-card))] shadow-sm transition active:scale-[0.99]">
      {cause.coverUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={cause.coverUrl} alt="" className="h-40 w-full object-cover" />}
      <div className="space-y-2 p-4">
        <h2 className="text-base font-bold text-ink">{cause.title}</h2>
        <ProgressBar percent={cause.percent} />
        <p className="text-sm text-ink"><strong>{ugx(cause.raisedUgx)}</strong> <span className="text-ink-500">of {ugx(cause.goalUgx)} · {cause.donorCount} donors{cause.status === "live" ? ` · ${cause.daysLeft} days left` : ""}</span></p>
      </div>
    </Link>
  );
}
