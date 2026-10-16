"use client";

import { Fuel } from "lucide-react";
import { PracticePromptDialog } from "@peebee/shared/practice-ui";
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
    <PracticePromptDialog
      id="practice-proposal"
      title="Try Practice Mode"
      body="Test fuel dispensing, scan sample codes and build muscle memory with simulated boda riders. No real money or station records are touched."
      icon={<Fuel className="h-6 w-6" aria-hidden />}
      primaryLabel="Open Practice Mode"
      onPrimary={handleStartPractice}
      secondaryLabel="Keep working"
      onSecondary={handleDismiss}
      tertiaryLabel="Don't remind me again"
      onTertiary={handleOptOut}
    />
  );
}
