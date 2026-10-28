"use client";

import { ModuleRouteGate } from "@peebee/shared/module-gate";
import { MODULE_ROUTES } from "../lib/module-routes";
import { useModules } from "../lib/modules";

import { exitPracticeMode, isUserVerified } from "@peebee/shared";
import { PracticeModeFrame, usePracticeModeActive } from "@peebee/shared/practice-ui";
import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useLearnAuth } from "../lib/auth-context";
import { BottomNav } from "./BottomNav";
import { BrandLogo } from "./BrandLogo";

const PUBLIC_PAGES = ["/login", "/signup", "/forgot-password"];
// Reachable whatever the auth state — the emailed "Verify Email Address"
// link can be opened signed out, on a different device.
const UNGATED_PAGES = ["/verify/confirmed"];
// Full-screen account screens drawn by the shared AuthScene (same as every
// other Peebee app), so they skip the app header and page padding.
const AUTH_SCENE_PAGES = [...PUBLIC_PAGES, "/verify", ...UNGATED_PAGES];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const moduleOn = useModules();
  const router = useRouter();
  const { user, ready } = useLearnAuth();
  const isPracticeActive = usePracticeModeActive();
  const isPublic = PUBLIC_PAGES.includes(pathname);
  const isUngated = UNGATED_PAGES.includes(pathname);
  const verified = isUserVerified(user);
  const isMeetingRoom = pathname.startsWith("/live/") && pathname !== "/live";

  // Signed out → sign in. Signed in but phone/email not confirmed yet → verify
  // it (same identity check as the other Peebee apps).
  useEffect(() => {
    if (!ready || isUngated) return;
    if (!user && !isPublic) router.replace("/login");
    else if (!user) return;
    else if (!verified) {
      if (pathname !== "/verify") router.replace("/verify");
    } else if (pathname === "/verify" || isPublic) router.replace("/");
  }, [ready, user, verified, pathname, isPublic, isUngated, router]);

  if (isUngated) return <>{children}</>;
  if (!ready) return null;
  if (isPublic) return user ? null : <>{children}</>;
  if (!user) return null;
  if (!verified) return pathname === "/verify" ? <>{children}</> : null;
  if (AUTH_SCENE_PAGES.includes(pathname)) return null;

  const handleExitPractice = () => {
    exitPracticeMode("learner");
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <PracticeModeFrame onExit={handleExitPractice} label="Educator Sandbox" />

      {!isMeetingRoom && (
        <header className="customer-header sticky top-0 z-30 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Peebee Learn home">
              <BrandLogo wordmark={false} className="shrink-0 [&_img]:h-9 [&_img]:w-9" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Peebee Learn</p>
                <h1 className="truncate text-sm font-bold">Educator Studio</h1>
              </div>
            </Link>
            <Link
              href="/practice"
              className={`customer-header-toggle flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isPracticeActive ? "ring-2 ring-current" : ""}`}
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              <span>{isPracticeActive ? "Sandbox on" : "Sandbox"}</span>
            </Link>
          </div>
        </header>
      )}

      <main className={isMeetingRoom ? "mx-auto max-w-5xl" : "customer-nav-content-clearance mx-auto max-w-5xl px-4 py-5"}><ModuleRouteGate rules={MODULE_ROUTES} pathname={pathname} modules={moduleOn}>{children}</ModuleRouteGate></main>

      {!isMeetingRoom && <BottomNav />}
    </div>
  );
}
