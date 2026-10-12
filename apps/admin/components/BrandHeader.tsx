"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronLeft, Menu } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

export function BrandHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const isSettingsRoot = pathname === "/settings";

  if (isSettingsRoot) {
    return (
      <header className="sticky top-0 z-40 border-b border-[var(--border-faint)] bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link
            href="/"
            aria-label="Back to overview"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink transition active:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <span className="font-serif text-xl font-bold tracking-tight text-ink lowercase">
            peebee
          </span>
          <Link
            href="/activity"
            aria-label="Activity notifications"
            className="relative -mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink transition active:opacity-60"
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-cream" />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-faint)] bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="-ml-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
        <BrandLogo />
        <span className="ml-auto rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-medium text-ink">
          Admin
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
