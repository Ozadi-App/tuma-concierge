"use client";

import { useEffect, useSyncExternalStore } from "react";
import { noteInAppNavigation } from "../lib/nav-primary-action";
import { usePathname } from "next/navigation";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { ChatDrawerShell } from "../lib/chat-drawer";
import { FoodBusinessTheme } from "./FoodBusinessTheme";
import { OfflineBanner } from "./OfflineBanner";
import { PracticeModeBanner, PracticeModeGuard, PracticeModePrompt } from "./PracticeMode";
import { isNavigationOverlayOpen, subscribeToNavigationOverlay } from "../lib/location-flow-state";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Lets the nav's Back use router.back() only when there is an in-app screen to return to.
  useEffect(() => { noteInAppNavigation(); }, [pathname]);
  const navigationOverlayOpen = useSyncExternalStore(subscribeToNavigationOverlay, isNavigationOverlayOpen, () => false);
  const foodBusinessId=/^\/restaurants\/([^/]+)(?:\/items\/[^/]+)?$/.exec(pathname)?.[1];
  const isFoodDetail=/^\/restaurants\/[^/]+\/items\/[^/]+$/.test(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/activate" || pathname === "/forgot-password" || pathname.startsWith("/verify") || pathname.startsWith("/trip/") || pathname.startsWith("/guest/");
  // "/chat" itself is a normal list screen (conversations) with the usual
  // header + nav; a specific thread ("/chat/<counterpartId>" for order
  // chat, or "/restaurants/<id>/chat" for restaurant chat) takes over the
  // whole screen — its own header/footer replace BrandHeader/BottomNav so
  // the conversation gets the full viewport with nothing floating over it.
  const isChatThread = pathname.startsWith("/chat/") || /^\/restaurants\/[^/]+\/chat$/.test(pathname);
  // Single store (/store/<id>) and single product (/product/<id> or /store/<id>/product/<productId>)
  // screens take on full viewport view without top BrandHeader or bottom navigation bar.
  const isSingleStore = /^\/store\/[^/]+$/.test(pathname);
  const isSingleProduct = pathname.startsWith("/product/") || /^\/store\/[^/]+\/product\/[^/]+$/.test(pathname);
  // Spotlight is an edge-to-edge immersive feed: no header, no bottom nav;
  // the page overlays its own back affordance.
  const isSpotlight = pathname === "/spotlight" || pathname.startsWith("/spotlight/");
  const isImmersiveFullscreen = isSingleStore || isSingleProduct || isSpotlight;

  const showHeader = !isAuthPage && !isChatThread && !isFoodDetail && !isImmersiveFullscreen;
  const showNav = !isAuthPage && !isChatThread && !isFoodDetail && !navigationOverlayOpen && !isImmersiveFullscreen;

  return (
    <AuthGate>
      <ChatDrawerShell>

      <PracticeModeGuard role="customer" pathname={pathname} />
      {!isAuthPage && <PracticeModePrompt role="customer" />}
      {!isAuthPage && <PracticeModeBanner role="customer" />}
      {!isAuthPage && <OfflineBanner />}
      {showHeader && <BrandHeader />}
      <main
        className={`mx-auto max-w-lg ${showHeader ? "min-h-[calc(100dvh-4rem)]" : "min-h-dvh"} ${showNav ? "customer-nav-content-clearance" : ""}`}
      >
        {foodBusinessId ? <FoodBusinessTheme key={foodBusinessId} id={foodBusinessId}>{children}</FoodBusinessTheme> : children}
      </main>
      {showNav && <BottomNav />}
      </ChatDrawerShell>
    </AuthGate>
  );
}
