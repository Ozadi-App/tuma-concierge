"use client";

import { Fuel, Sparkles, X, ChevronRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { isPracticeMode, startPracticeMode } from "@peebee/shared";

const THREE_MINUTES_MS = 3 * 60 * 1000; // 180,000 ms (3 minutes)
export const PRACTICE_PROPOSED_KEY = "peebee_gas_practice_proposed";
export const PRACTICE_OPT_OUT_KEY = "peebee_gas_practice_opt_out";
export const SESSION_START_KEY = "peebee_gas_session_start";

export function PracticeProposalPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { attendant, manager } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only run for authenticated attendants or managers
    if (!attendant && !manager) return;

    // Do not propose if user is already in practice mode
    if (isPracticeMode() || pathname === "/practice" || pathname.startsWith("/practice")) {
      return;
    }

    // Do not propose if already proposed in this session or permanently opted out
    if (sessionStorage.getItem(PRACTICE_PROPOSED_KEY) === "1") return;
    if (localStorage.getItem(PRACTICE_OPT_OUT_KEY) === "1") return;

    // Initialize session start timestamp if not set
    let sessionStart = Number(sessionStorage.getItem(SESSION_START_KEY) || 0);
    if (!sessionStart) {
      sessionStart = Date.now();
      sessionStorage.setItem(SESSION_START_KEY, String(sessionStart));
    }

    // Check for test mode query param: ?testPracticePrompt=true
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get("testPracticePrompt") === "true";

    const elapsed = Date.now() - sessionStart;
    const targetDelay = isTestMode ? 1000 : THREE_MINUTES_MS;
    const remainingDelay = Math.max(0, targetDelay - elapsed);

    const timer = setTimeout(() => {
      // Re-verify criteria before displaying
      if (isPracticeMode() || pathname === "/practice" || pathname.startsWith("/practice")) {
        return;
      }
      if (sessionStorage.getItem(PRACTICE_PROPOSED_KEY) === "1") return;
      if (localStorage.getItem(PRACTICE_OPT_OUT_KEY) === "1") return;

      setOpen(true);
    }, remainingDelay);

    return () => clearTimeout(timer);
  }, [attendant, manager, pathname]);

  function handleStartPractice() {
    sessionStorage.setItem(PRACTICE_PROPOSED_KEY, "1");
    setOpen(false);
    startPracticeMode("gas");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
    router.push("/practice");
  }

  function handleDismiss() {
    sessionStorage.setItem(PRACTICE_PROPOSED_KEY, "1");
    setOpen(false);
  }

  function handleOptOut() {
    localStorage.setItem(PRACTICE_OPT_OUT_KEY, "1");
    sessionStorage.setItem(PRACTICE_PROPOSED_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-proposal-title"
      className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface))] p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 id="practice-proposal-title" className="text-base font-black text-ink">
                Try Practice Mode
              </h2>
              <p className="text-xs font-medium text-ink-500">
                Sharpen your refuel & dispensing speed
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="rounded-full p-1 text-ink-500 hover:text-ink transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--surface-muted)] p-3.5 space-y-1.5 border border-[var(--border-faint)]">
          <p className="text-xs font-bold text-ink flex items-center gap-1.5">
            <Fuel className="h-4 w-4 text-gold shrink-0" />
            <span>Safe Training Environment</span>
          </p>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Test fuel dispensing, scan sample vouchers, and build muscle memory with simulated boda riders. No real money or station records are touched.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleStartPractice}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-xs font-bold text-ink-gold shadow-md transition hover:brightness-105 active:scale-[0.99]"
          >
            <Sparkles className="h-4 w-4" />
            <span>Open Practice Mode</span>
            <ChevronRight className="h-4 w-4 ml-auto" />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-10 w-full items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-xs font-bold text-ink transition hover:bg-[rgb(var(--surface-muted))]"
          >
            <span>Keep Working</span>
          </button>

          <button
            type="button"
            onClick={handleOptOut}
            className="w-full py-1 text-center text-[11px] font-medium text-ink-500/80 hover:text-ink transition"
          >
            Don&apos;t remind me again
          </button>
        </div>
      </div>
    </div>
  );
}
