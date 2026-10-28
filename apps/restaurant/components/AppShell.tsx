"use client";

import { ModuleRouteGate } from "@peebee/shared/module-gate";
import { MODULE_ROUTES } from "../lib/module-routes";
import { useModules } from "../lib/modules";

import { usePathname } from "next/navigation";
import { BusinessTheme } from "@peebee/shared/business-theme";
import { useAuth } from "../lib/auth-context";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { ServiceBanner } from "./ServiceBanner";
import { PracticeModeBanner, PracticeModeGuard, PracticeModePrompt } from "./PracticeMode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {restaurant}=useAuth();
  const pathname = usePathname();
  const moduleOn = useModules();
  const isAuthPage = pathname === "/login" || pathname === "/activate" || pathname === "/forgot-password" || pathname.startsWith("/verify");
  // A specific chat thread ("/chat/<customerId>") is a full-screen
  // takeover — its own header/footer replace BrandHeader/BottomNav so the
  // conversation gets the full viewport with nothing floating over it.
  const isChatThread = pathname.startsWith("/chat/");
  const showHeader = !isAuthPage && !isChatThread;
  const showNav = !isAuthPage && !isChatThread;

  return (
    <AuthGate>
      {restaurant&&<BusinessTheme scene={restaurant.theme_scene} mode={restaurant.theme_mode}/>}
      <PracticeModeGuard role="restaurant" pathname={pathname} />
      {!isAuthPage && <PracticeModePrompt role="restaurant" />}
      {showHeader && <BrandHeader />}
      {!isAuthPage && <PracticeModeBanner role="restaurant" />}
      {!isAuthPage && <ServiceBanner />}
      <main
        className={`mx-auto max-w-lg ${showHeader ? "min-h-[calc(100dvh-4rem)]" : "min-h-dvh"} ${
          showNav ? "pb-[calc(88px+env(safe-area-inset-bottom))]" : ""
        }`}
      >
        <ModuleRouteGate rules={MODULE_ROUTES} pathname={pathname} modules={moduleOn}>{children}</ModuleRouteGate>
      </main>
      {showNav && <BottomNav />}
    </AuthGate>
  );
}
