"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { SettingsDrawer } from "./SettingsDrawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/set-password";
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AuthGate>
      {!isAuthPage && <BrandHeader onMenuClick={() => setDrawerOpen(true)} />}
      {!isAuthPage && <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
      <main className="mx-auto min-h-dvh max-w-lg customer-nav-content-clearance pb-[calc(88px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {!isAuthPage && <BottomNav onSettingsClick={() => setDrawerOpen(true)} />}
    </AuthGate>
  );
}
