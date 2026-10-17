"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLearnAuth } from "../lib/auth-context";
import { BottomNav } from "./BottomNav";
import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { Radio, FlaskConical } from "lucide-react";
import { exitPracticeMode, isPracticeMode } from "@peebee/shared";
import { PracticeModeFrame, usePracticeModeActive } from "@peebee/shared/practice-ui";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, activeStream } = useLearnAuth();
  const isPracticeActive = usePracticeModeActive();

  // If in an active live meeting classroom (e.g. /live/live_fintech_101), provide full-width immersion
  const isMeetingRoom = pathname.startsWith("/live/") && pathname !== "/live";

  const handleExitPractice = () => {
    exitPracticeMode("learner");
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <PracticeModeFrame onExit={handleExitPractice} label="Learner Sandbox" />

      {isPracticeActive && !isMeetingRoom && (
        <aside
          aria-label="Learner Practice and Sandbox Banner"
          className="border-b border-sky-300/60 bg-sky-100/90 px-4 py-2 text-xs text-sky-950 backdrop-blur dark:border-sky-800 dark:bg-sky-950/80 dark:text-sky-200"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-600"></span>
              </span>
              <p className="truncate font-semibold">
                <strong className="font-black">Sandbox Mode Active:</strong> Safe simulated classrooms & tutor chats
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/practice"
                className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-black text-white transition hover:bg-sky-700"
              >
                Guide
              </Link>
              <button
                type="button"
                onClick={handleExitPractice}
                className="text-[11px] font-bold text-sky-800 hover:underline dark:text-sky-300"
              >
                Exit
              </button>
            </div>
          </div>
        </aside>
      )}

      {!isMeetingRoom && (
        <header className="customer-header sticky top-0 z-30 border-b border-[var(--border-faint)] bg-cream/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo wordmark={false} className="[&_img]:h-9 [&_img]:w-9" />
              <div className="min-w-0 flex-1 px-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-gold">Peebee Learn</p>
                <h1 className="truncate text-sm font-black text-ink">{user?.name ?? "Student Portal"}</h1>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/practice"
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black transition ${
                  isPracticeActive
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                }`}
                title="Open Sandbox & Practice Training Workstation"
              >
                <FlaskConical className="h-3 w-3" />
                <span className="hidden sm:inline">Sandbox</span>
              </Link>

              <Link
                href="/live"
                className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-600 transition hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <Radio className="h-3 w-3" />
                <span className="hidden sm:inline">Live Now</span>
              </Link>

              <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-black capitalize text-gold">
                {activeStream}
              </span>
            </div>
          </div>
        </header>
      )}

      <main className={`mx-auto ${isMeetingRoom ? "max-w-4xl" : "max-w-lg px-4 py-4"} ${!isMeetingRoom ? "customer-nav-content-clearance" : ""}`}>
        {children}
      </main>

      {!isMeetingRoom && <BottomNav />}
    </div>
  );
}
