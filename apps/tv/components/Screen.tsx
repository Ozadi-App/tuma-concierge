"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDevice } from "../lib/device";
import { useGoBack } from "../lib/nav";

/** The frame every learning screen shares: a Back button that the remote can reach, a title, and a guard that sends an unlinked TV home. */
export function Screen({ title, kicker, backTo = "/", children }: { title: string; kicker?: string; backTo?: string; children: ReactNode }) {
  const { state } = useDevice();
  const router = useRouter();
  const goBack = useGoBack(backTo);

  useEffect(() => {
    if (state.phase === "pairing") router.replace("/");
  }, [state.phase, router]);

  if (state.phase !== "paired") return <main className="tv-safe flex min-h-screen items-center justify-center text-[1.6rem] text-ink-500">Starting…</main>;
  if (!state.learnEnabled) {
    return (
      <main className="tv-safe flex min-h-screen flex-col items-center justify-center gap-[1.4rem] text-center">
        <h1 className="text-[2.8rem] font-black text-ink">Learning on TV is switched off right now</h1>
        <button type="button" data-focusable autoFocus onClick={() => router.push("/")} className="rounded-full border border-[var(--border-faint)] px-[1.6rem] py-[0.6rem] text-[1.3rem] font-bold text-ink focus:bg-gold focus:text-ink-gold">
          Back to home
        </button>
      </main>
    );
  }

  return (
    <main className="tv-safe flex min-h-screen flex-col gap-[1.6rem]">
      <header className="flex items-center gap-[1.4rem]">
        <button
          type="button"
          data-focusable
          onClick={goBack}
          className="flex items-center gap-[0.5rem] rounded-full border border-[var(--border-faint)] px-[1.2rem] py-[0.5rem] text-[1.1rem] font-bold text-ink focus:bg-gold focus:text-ink-gold"
        >
          <ArrowLeft className="h-[1.2rem] w-[1.2rem]" aria-hidden /> Back
        </button>
        <div className="min-w-0">
          {kicker && <p className="truncate text-[0.95rem] font-bold uppercase tracking-[0.2em] text-gold">{kicker}</p>}
          <h1 className="truncate text-[2.2rem] font-black leading-tight text-ink">{title}</h1>
        </div>
      </header>
      {children}
    </main>
  );
}

export function Message({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-[1.4rem] leading-snug ${tone === "error" ? "text-red-400" : "text-ink-500"}`}>
      {children}
    </p>
  );
}
