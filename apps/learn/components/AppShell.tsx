"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLearnAuth } from "../lib/auth-context";
import { BottomNav } from "./BottomNav";
import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { Radio, FlaskConical } from "lucide-react";
import { exitPracticeMode } from "@peebee/shared";
import { PracticeModeFrame, usePracticeModeActive } from "@peebee/shared/practice-ui";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeStream } = useLearnAuth();
  const isPracticeActive = usePracticeModeActive();

  const isMeetingRoom = pathname.startsWith("/live/") && pathname !== "/live";

  const handleExitPractice = () => {
    exitPracticeMode("learner");
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <PracticeModeFrame onExit={handleExitPractice} label="Educator Sandbox" />

      {isPracticeActive && !isMeetingRoom && (
        <aside
          aria-label="Educator Practice and Sandbox Banner"
          className="border-b border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-4 py-2 text-xs text-cream"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />
              <p className="truncate font-medium">
                <strong className="font-semibold text-gold">Sandbox Mode Active:</strong> Test course publishing, live rooms & payouts safely
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/practice"
                className="rounded-lg bg-gold px-2.5 py-0.5 text-[11px] font-semibold text-ink-gold"
              >
                Guide
              </Link>
              <button
                type="button"
                onClick={handleExitPractice}
                className="text-[11px] font-semibold text-ink-500 hover:text-cream"
              >
                Exit
              </button>
            </div>
          </div>
        </aside>
      )}

      {!isMeetingRoom && (
        <header className="customer-header sticky top-0 z-30 border-b border-[var(--border-faint)] bg-cream/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <BrandLogo wordmark={false} className="[&_img]:h-9 [&_img]:w-9 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">Peebee Learn</p>
                <h1 className="truncate text-sm font-semibold text-cream">Educator & School Studio</h1>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                href="/practice"
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  isPracticeActive
                    ? "bg-gold text-ink-gold"
                    : "border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-cream hover:border-gold/40"
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5 text-gold" />
                <span className="hidden sm:inline">Sandbox</span>
              </Link>

              <Link
                href="/live"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-2.5 py-1 text-xs font-semibold text-cream hover:border-gold/40"
              >
                <span className="h-2 w-2 rounded-full bg-gold" />
                <Radio className="h-3.5 w-3.5 text-gold" />
                <span className="hidden sm:inline">Host Live</span>
              </Link>

              <span className="rounded-lg bg-gold/15 px-2.5 py-1 text-[11px] font-semibold capitalize text-gold">
                {activeStream}
              </span>
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto ${
          isMeetingRoom ? "max-w-5xl" : "max-w-5xl px-4 py-5"
        } ${!isMeetingRoom ? "customer-nav-content-clearance" : ""}`}
      >
        {children}
      </main>

      {!isMeetingRoom && <BottomNav />}
    </div>
  );
}
