"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { useResolvedTheme } from "../lib/theme";

export function BrandHeader({ menuOpen = false, onMenu, onSearch }: { menuOpen?: boolean; onMenu?: () => void; onSearch?: () => void }) {
  const isDarkMode = useResolvedTheme() === "dark";
  const iconBtn = `flex h-10 w-10 items-center justify-center rounded-full transition ${isDarkMode ? "bg-black/10 text-black" : "bg-white/10 text-white"}`;
  return (
    <header className="customer-header sticky top-0 z-40 transition-colors">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4 lg:max-w-none lg:px-6">
        <Link href="/" aria-label="Peebee Food Home" className="flex shrink-0 items-center gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          <BrandLogo variant={isDarkMode ? "dark" : "light"} />
          <sup aria-hidden="true" className={`pt-1 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? "text-black" : "text-gold"}`}>Business</sup>
        </Link>
        <div className="flex items-center gap-2">
          {onSearch && <button type="button" onClick={onSearch} aria-label="Search pages and settings" className={iconBtn}><Search size={18} /></button>}
          {onMenu && <button type="button" onClick={onMenu} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className={`${iconBtn} lg:hidden`}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>}
        </div>
      </div>
    </header>
  );
}
