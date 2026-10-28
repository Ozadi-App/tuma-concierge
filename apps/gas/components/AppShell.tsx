"use client";

import { ModuleRouteGate } from "@peebee/shared/module-gate";
import { MODULE_ROUTES } from "../lib/module-routes";
import { useModules } from "../lib/modules";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import { PracticeProposalPrompt } from "./PracticeProposalPrompt";
import { exitPracticeMode } from "@peebee/shared";
import { PracticeModeFrame } from "@peebee/shared/practice-ui";

export function AppShell({ children }: { children: any }) {
  const pathname = usePathname();
  const moduleOn = useModules();
  const isAuthPage = pathname === "/login" || pathname === "/apply";

  return (
    <div className="min-h-dvh bg-cream text-ink">
      {!isAuthPage && <BrandHeader />}
      <main
        className={`mx-auto max-w-lg px-4 py-4 ${
          !isAuthPage ? "customer-nav-content-clearance" : ""
        }`}
      >
        <ModuleRouteGate rules={MODULE_ROUTES} pathname={pathname} modules={moduleOn}>{children}</ModuleRouteGate>
      </main>
      {!isAuthPage && <BottomNav />}
      <PwaInstallPrompt />
      <PracticeProposalPrompt />
      {/* Same exit as the practice screen's "Back to Pump": leave practice and return to the pump. */}
      <PracticeModeFrame onExit={() => { exitPracticeMode("gas"); window.dispatchEvent(new Event("storage")); window.location.replace("/"); }} />
    </div>
  );
}
