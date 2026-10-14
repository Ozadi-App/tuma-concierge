"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { BrandHeader } from "./BrandHeader";
import { FoodBusinessTheme } from "./FoodBusinessTheme";
import { OfflineBanner } from "./OfflineBanner";
import { PracticeModeGuard, PracticeModePrompt } from "./PracticeMode";
import Link from "next/link";
import { ModulesProvider, useModules } from "../lib/modules-context";
import { isNavigationOverlayOpen, subscribeToNavigationOverlay } from "../lib/location-flow-state";

/** A page whose module an admin has switched off: nothing of it renders, only a way back home. */
function ModuleGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { isHidden } = useModules();
  if (!isHidden(pathname)) return <>{children}</>;
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-base font-bold text-ink">This isn&apos;t available right now</p>
      <Link href="/" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink-gold">Back to home</Link>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ModulesProvider>
      <AppShellInner>{children}</AppShellInner>
    </ModulesProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navigationOverlayOpen = useSyncExternalStore(subscribeToNavigationOverlay, isNavigationOverlayOpen, () => false);
  const foodBusinessId=/^\/restaurants\/([^/]+)(?:\/items\/[^/]+)?$/.exec(pathname)?.[1];
  const isFoodDetail=/^\/restaurants\/[^/]+\/items\/[^/]+$/.test(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/activate" || pathname === "/forgot-password" || pathname.startsWith("/verify") || pathname.startsWith("/trip/");
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
  const isImmersiveFullscreen = isSingleStore || isSingleProduct;

  const showHeader = !isAuthPage && !isChatThread && !isFoodDetail && !isImmersiveFullscreen;
  const showNav = !isAuthPage && !isChatThread && !isFoodDetail && !navigationOverlayOpen && !isImmersiveFullscreen;

  return (
    <AuthGate>

      <PracticeModeGuard role="customer" pathname={pathname} />
      {!isAuthPage && <PracticeModePrompt role="customer" />}
      {!isAuthPage && <OfflineBanner />}
      {showHeader && <BrandHeader />}
      <main
        className={`mx-auto max-w-lg ${showHeader ? "min-h-[calc(100dvh-4rem)]" : "min-h-dvh"} ${showNav ? "customer-nav-content-clearance" : ""}`}
      >
        <ModuleGate pathname={pathname}>{foodBusinessId ? <FoodBusinessTheme key={foodBusinessId} id={foodBusinessId}>{children}</FoodBusinessTheme> : children}</ModuleGate>
      </main>
      {showNav && <BottomNav />}
    </AuthGate>
  );
}
