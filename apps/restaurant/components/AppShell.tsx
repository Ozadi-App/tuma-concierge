"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BusinessTheme } from "@peebee/shared/business-theme";
import { useAuth } from "../lib/auth-context";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { ServiceBanner } from "./ServiceBanner";
import { PracticeModeBanner, PracticeModeGuard, PracticeModePrompt } from "./PracticeMode";
import { Breadcrumbs } from "./shell/Breadcrumbs";
import { CommandPalette } from "./shell/CommandPalette";
import { MenuDrawer } from "./shell/MenuDrawer";
import { Sidebar } from "./shell/Sidebar";
import { Toaster } from "./shell/Toaster";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, restaurant } = useAuth();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/activate" || pathname === "/forgot-password" || pathname.startsWith("/verify");
  // A chat thread is a full-screen takeover with its own header and composer.
  const isChatThread = pathname.startsWith("/chat/");
  const chrome = !isAuthPage && !isChatThread;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (isAuthPage || !user) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setMenuOpen(false); setSearchOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthPage, user]);
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);
  const openSearch = () => { setMenuOpen(false); setSearchOpen(true); };

  return (
    <AuthGate>
      {restaurant && <BusinessTheme scene={restaurant.theme_scene} mode={restaurant.theme_mode} />}
      <PracticeModeGuard role="restaurant" pathname={pathname} />
      {!isAuthPage && <PracticeModePrompt role="restaurant" />}
      {chrome && <BrandHeader menuOpen={menuOpen} onMenu={() => setMenuOpen((o) => !o)} onSearch={openSearch} />}
      {chrome && <Sidebar onSearch={openSearch} />}
      {chrome && <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onSearch={openSearch} />}
      {chrome && <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />}
      <div className={chrome ? "lg:pl-[264px]" : ""}>
        {!isAuthPage && <PracticeModeBanner role="restaurant" />}
        {!isAuthPage && <ServiceBanner />}
        <main className={`mx-auto max-w-lg ${chrome ? "min-h-[calc(100dvh-4rem)] pb-[calc(96px+env(safe-area-inset-bottom))] lg:max-w-[1040px] lg:pb-12" : "min-h-dvh"}`}>
          {chrome && <Breadcrumbs />}
          {children}
        </main>
      </div>
      {chrome && <BottomNav onMore={() => setMenuOpen((o) => !o)} moreOpen={menuOpen} />}
      {chrome && <Toaster />}
    </AuthGate>
  );
}
