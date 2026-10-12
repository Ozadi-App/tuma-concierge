"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";

export function AppShell({ children }: { children: any }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/apply";

  return (
    <div className="min-h-dvh bg-cream text-ink">
      {!isAuthPage && <BrandHeader />}
      <main
        className={`mx-auto max-w-lg px-4 py-4 ${
          !isAuthPage ? "customer-nav-content-clearance" : ""
        }`}
      >
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}
