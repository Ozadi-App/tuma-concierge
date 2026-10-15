"use client";

import { AlertTriangle, ArrowLeft, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, type WorkFailure } from "./work-utils";

export const cardClass = "home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4";
export const primaryBtn =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryBtn =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-4 font-semibold text-ink transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export function WorkPage({ eyebrow, title, backHref, backLabel, children }: { eyebrow: string; title: string; backHref: string; backLabel: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-5 px-4 pb-28 pt-4 text-ink">
      <header className="flex items-center justify-between">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink transition-transform active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold">{eyebrow}</span>
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        <div className="h-11 w-11" aria-hidden />
      </header>
      {children}
    </main>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_LABEL[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as const };
  const tone =
    meta.tone === "gold"
      ? "bg-gold/15 text-gold"
      : meta.tone === "good"
        ? "bg-gold/25 text-ink"
        : meta.tone === "bad"
          ? "bg-[rgb(var(--surface-muted))] text-ink ring-1 ring-gold"
          : "bg-[rgb(var(--surface-muted))] text-ink-500";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{meta.label}</span>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500">
      <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden />
      {label}
    </div>
  );
}

export function Notice({ failure, text, tone = "error", inlineTopUp = false, children }: { failure?: WorkFailure | null; text?: string; tone?: "error" | "info"; inlineTopUp?: boolean; children?: ReactNode }) {
  const message = text ?? failure?.message;
  if (!message) return null;
  const Icon = tone === "error" ? AlertTriangle : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm text-ink">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
      <div className="space-y-2">
        <p>{message}</p>
        {failure?.topUp && !inlineTopUp ? (
          <Link href="/wallet" className="inline-flex min-h-[44px] items-center font-bold text-gold underline">
            Top up your wallet
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function UnavailablePanel({ title, message, backHref = "/services" }: { title: string; message: string; backHref?: string }) {
  return (
    <section className={`${cardClass} space-y-3 p-6 text-center`}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
        <Info className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm leading-relaxed text-ink-500">{message}</p>
      <Link href={backHref} className={secondaryBtn}>
        Back to Services
      </Link>
    </section>
  );
}
