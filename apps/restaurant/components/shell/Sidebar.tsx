"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NAV_GROUPS, isActive } from "../../lib/nav";
import { useAuth } from "../../lib/auth-context";

/** Desktop navigation: every area of the food business in clear groups. */
export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const { restaurant } = useAuth();
  return (
    <aside aria-label="Food business navigation" className="rs-sidebar fixed bottom-0 left-0 top-16 z-30 hidden w-[264px] flex-col lg:flex">
      {restaurant && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border-faint)] px-3 py-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${restaurant.is_open ? "bg-green" : "bg-ink-500/50"}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{restaurant.name}</span>
            <span className="block text-xs text-ink-500">{restaurant.status !== "active" ? "Not live yet" : restaurant.is_open ? "Open for orders" : "Closed"}</span>
          </span>
        </div>
      )}
      <div className="px-4 pb-2 pt-3">
        <button type="button" onClick={onSearch} className="rs-search-btn flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-ink-500">
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rs-kbd">⌘K</kbd>
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.id}>
            <p className="rs-nav-group px-3 pb-1.5">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const on = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={on ? "page" : undefined} className={`rs-nav-link ${on ? "is-active" : ""}`}>
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
