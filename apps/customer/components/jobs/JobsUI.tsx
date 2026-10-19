"use client";

import { Loader2, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cardClass, Notice, secondaryBtn } from "../work/WorkUI";
import { chipOff, chipOn, STATUS, type JobsFailure } from "./jobs-utils";

export { cardClass, Notice, primaryBtn, secondaryBtn, Spinner, WorkPage as JobsPage } from "../work/WorkUI";

export function Badge({ status, label }: { status: string; label?: string }) {
  const meta = STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as const };
  const tone =
    meta.tone === "gold" ? "bg-gold/15 text-gold" : meta.tone === "good" ? "bg-gold/25 text-ink" : meta.tone === "bad" ? "bg-[rgb(var(--surface-muted))] text-ink ring-1 ring-gold" : "bg-[rgb(var(--surface-muted))] text-ink-500";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label ?? meta.label}</span>;
}

export function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick} className={`min-h-[40px] shrink-0 rounded-full border px-3.5 text-xs font-bold disabled:opacity-50 ${on ? chipOn : chipOff}`}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-ink-500">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null || count === 0) return <span className="text-xs font-semibold text-ink-500">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink">
      <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
      {rating.toFixed(1)} <span className="font-normal text-ink-500">({count})</span>
    </span>
  );
}

export function FailureNote({ failure }: { failure: JobsFailure | null }) {
  if (!failure) return null;
  return (
    <Notice text={failure.message}>
      {failure.topUp ? (
        <Link href="/wallet" className="inline-flex min-h-[44px] items-center font-bold text-gold underline">
          Top up your wallet
        </Link>
      ) : null}
      {failure.pro ? (
        <Link href="/services/jobs/plans" className="inline-flex min-h-[44px] items-center font-bold text-gold underline">
          See plans and free trial
        </Link>
      ) : null}
    </Notice>
  );
}

export function BusyButton({ busy, children, className, ...rest }: { busy?: boolean; children: ReactNode; className: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} disabled={busy || rest.disabled} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className={`${cardClass} space-y-3 p-6 text-center`}>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-ink-500">{text}</p>
      {action}
    </section>
  );
}

export function Unavailable({ failure }: { failure: JobsFailure }) {
  return (
    <section className={`${cardClass} space-y-3 p-6 text-center`}>
      <h2 className="text-lg font-bold">{failure.pending ? "Almost ready" : failure.disabled ? "Jobs is switched off" : "Something went wrong"}</h2>
      <p className="text-sm text-ink-500">{failure.message}</p>
      <Link href="/services/jobs/practice" className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-gold px-4 font-bold text-ink-gold">
        Explore with sample jobs (practice mode)
      </Link>
      <Link href="/services" className={secondaryBtn}>
        Back to Services
      </Link>
    </section>
  );
}
