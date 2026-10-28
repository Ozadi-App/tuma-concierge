"use client";

import { ModuleRouteGate } from "@peebee/shared/module-gate";
import { MODULE_ROUTES } from "../lib/module-routes";
import { useModules } from "../lib/modules";

import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useResolvedTheme } from "../lib/theme";
import { AuthGate } from "./AuthGate";
import { BottomNav } from "./BottomNav";
import { ServiceBanner } from "./ServiceBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const moduleOn = useModules();
  const { mode, setMode } = useAuth();
  const activeTheme = useResolvedTheme();
  const isDarkMode = activeTheme === "dark";
  const bare = pathname === "/login";

  return (
    <AuthGate>
      {!bare && (
        <header className="customer-header sticky top-0 z-30 transition-colors">
          <div className="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4">
            <Link
              href="/"
              aria-label="Go to Peebee Car home"
              className="flex shrink-0 items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
            >
              <BrandLogo variant={isDarkMode ? "dark" : "light"} />
              <sup
                aria-hidden="true"
                className={`pt-1 text-[10px] font-black uppercase tracking-widest ${
                  isDarkMode ? "text-black" : "text-gold"
                }`}
              >
                Car
              </sup>
            </Link>
            <div
              role="tablist"
              aria-label="Switch between owner and driver"
              className={`flex items-center gap-1 rounded-full p-1 border transition ${
                isDarkMode
                  ? "bg-black/10 border-black/15"
                  : "bg-white/10 border-white/15"
              }`}
            >
              {(["driver", "owner"] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setMode(m)}
                    className={`min-h-8 rounded-full px-3.5 text-xs font-bold capitalize transition ${
                      isSelected
                        ? isDarkMode
                          ? "bg-black text-white shadow-sm"
                          : "bg-gold text-ink-gold shadow-sm"
                        : isDarkMode
                          ? "text-black/70 hover:text-black"
                          : "text-white/70 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </header>
      )}
      {!bare && <ServiceBanner />}
      <main className={`mx-auto min-h-dvh max-w-xl ${bare ? "" : "pb-[calc(88px+env(safe-area-inset-bottom))]"}`}>
        <ModuleRouteGate rules={MODULE_ROUTES} pathname={pathname} modules={moduleOn}>{children}</ModuleRouteGate>
      </main>
      {!bare && <BottomNav />}
    </AuthGate>
  );
}
