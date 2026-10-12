"use client";

import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { useResolvedTheme } from "../lib/theme";

export function BrandHeader() {
  const activeTheme = useResolvedTheme();
  const isDarkMode = activeTheme === "dark";

  return (
    <header className="customer-header sticky top-0 z-40 transition-colors">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4">
        <Link
          href="/"
          aria-label="Peebee Rider Home"
          className="flex shrink-0 items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
        >
          <BrandLogo variant={isDarkMode ? "dark" : "light"} />
          <sup
            aria-hidden="true"
            className={`pt-1 text-[10px] font-black uppercase tracking-widest ${
              isDarkMode ? "text-black" : "text-gold"
            }`}
          >
            Rider
          </sup>
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            isDarkMode
              ? "bg-black/15 text-black font-extrabold"
              : "bg-white/10 text-white/90"
          }`}
        >
          Rider
        </span>
      </div>
    </header>
  );
}
