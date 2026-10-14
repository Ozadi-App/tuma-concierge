"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/auth-context";
import { BottomNav } from "./BottomNav";
import { BrandLogo } from "./BrandLogo";

const PUBLIC_PAGES = ["/login", "/signup"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, provider, ready } = useAuth();
  const isPublic = PUBLIC_PAGES.includes(pathname);

  // Signed out → sign in. Signed in but not a provider yet → set up the provider account.
  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    else if (user && isPublic) router.replace(provider ? "/" : "/onboard");
    else if (user && !provider && pathname !== "/onboard" && pathname !== "/account") router.replace("/onboard");
    else if (user && provider && pathname === "/onboard") router.replace("/");
  }, [ready, user, provider, pathname, isPublic, router]);

  if (isPublic) return <main className="mx-auto min-h-dvh max-w-lg px-4 py-6">{children}</main>;
  if (!ready || !user) return null;
  const showNav = !!provider;

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="customer-header sticky top-0 z-30 border-b border-[var(--border-faint)] bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <BrandLogo wordmark={false} className="[&_img]:h-9 [&_img]:w-9" />
          <div className="min-w-0 flex-1 px-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-gold">Peebee Work</p>
            <h1 className="truncate text-sm font-black text-ink">{provider ? (provider.companyName || provider.displayName) : user.name}</h1>
          </div>
          {provider && (
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${provider.online ? "bg-green/15 text-green" : "bg-black/5 text-ink-500"}`}>
              <span className={`h-2 w-2 rounded-full ${provider.online ? "bg-green" : "bg-ink-500/50"}`} />
              {provider.online ? "Online" : "Offline"}
            </span>
          )}
        </div>
      </header>
      <main className={`mx-auto max-w-lg px-4 py-4 ${showNav ? "customer-nav-content-clearance" : ""}`}>{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}
