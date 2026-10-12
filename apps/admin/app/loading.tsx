"use client";

import { BrandLogo } from "../components/BrandLogo";
import { useResolvedTheme } from "../lib/theme";

export default function Loading() {
  const activeTheme = useResolvedTheme();
  const isDarkMode = activeTheme === "dark";

  return (
    <div
      aria-label="Loading Peebee Admin"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgb(var(--color-cream))] text-ink"
    >
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <BrandLogo variant={isDarkMode ? "dark" : "light"} wordmark={false} className="h-20 w-20" />
        <span className="font-serif text-2xl font-black lowercase tracking-tight text-ink select-none">
          peebee
        </span>
      </div>
    </div>
  );
}
