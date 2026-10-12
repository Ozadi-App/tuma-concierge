"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronLeft, Menu } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useResolvedTheme } from "../lib/theme";

export function BrandHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/settings";
  const activeTheme = useResolvedTheme();
  const isDarkMode = activeTheme === "dark";

  if (isSettingsRoot) {
    return (
      <header className="customer-header sticky top-0 z-40 transition-colors">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link
            href="/"
            aria-label="Back to overview"
            className={`-ml-1 flex h-9 w-9 items-center justify-center rounded-full transition active:opacity-60 ${
              isDarkMode ? "text-black hover:bg-black/10" : "text-white hover:bg-white/10"
            }`}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
          </Link>
          <span className="font-serif text-xl font-bold tracking-tight lowercase select-none">
            peebee
          </span>
          <Link
            href="/activity"
            aria-label="Activity notifications"
            className={`relative -mr-1 flex h-9 w-9 items-center justify-center rounded-full transition active:opacity-60 ${
              isDarkMode ? "text-black hover:bg-black/10" : "text-white hover:bg-white/10"
            }`}
          >
            <Bell className="h-5 w-5" strokeWidth={1.8} />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-current" />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="customer-header sticky top-0 z-40 transition-colors">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open settings"
              className={`-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:opacity-60 ${
                isDarkMode ? "text-black hover:bg-black/10" : "text-white hover:bg-white/10"
              }`}
            >
              <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          )}
          <Link
            href="/"
            aria-label="Peebee Admin Home"
            className="flex shrink-0 items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
          >
            <BrandLogo variant={isDarkMode ? "dark" : "light"} />
            <sup
              aria-hidden="true"
              className={`pt-1 text-[10px] font-black uppercase tracking-widest ${
                isDarkMode ? "text-black" : "text-gold"
              }`}
            >
              Admin
            </sup>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/activity"
            aria-label="Activity notifications"
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition active:opacity-60 ${
              isDarkMode ? "text-black hover:bg-black/10" : "text-white hover:bg-white/10"
            }`}
          >
            <Bell className="h-4.5 w-4.5" strokeWidth={2} />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-current" />
          </Link>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition ${
              isDarkMode
                ? "bg-black/15 text-black font-extrabold"
                : "bg-white/10 text-white/90 border border-white/15"
            }`}
          >
            Admin
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
