"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/apply";

  return (
    <div className="min-h-dvh bg-[rgb(var(--cream))] text-[rgb(var(--ink))]">
      {!isAuthPage && <BrandHeader />}
      <main
        className={`mx-auto max-w-xl px-4 py-4 ${
          !isAuthPage ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""
        }`}
      >
        {children}
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
}
