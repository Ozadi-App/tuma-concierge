"use client";

import { ChevronRight, LogOut, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NAV_GROUPS, isActive } from "../../lib/nav";
import { useAuth } from "../../lib/auth-context";

/** Phone menu: pushes down from under the header with every area, grouped. */
export function MenuDrawer({ open, onClose, onSearch }: { open: boolean; onClose: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <>
      <div aria-hidden onClick={onClose} className={`fixed inset-0 top-16 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <div role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open} inert={!open}
        className={`rs-drawer fixed inset-x-0 top-16 z-[35] max-h-[calc(100dvh-4rem)] overflow-y-auto transition-transform duration-300 ease-out lg:hidden ${open ? "translate-y-0" : "pointer-events-none -translate-y-[110%]"}`}>
        <div className="mx-auto max-w-lg space-y-4 px-4 pb-6 pt-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSearch} className="rs-search-btn flex h-11 flex-1 items-center gap-2 rounded-2xl px-3 text-sm text-ink-500">
              <Search className="h-4 w-4" aria-hidden /> Search pages and settings…
            </button>
            <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-faint)]"><X size={18} /></button>
          </div>
          {NAV_GROUPS.map((g) => (
            <section key={g.id}>
              <p className="rs-nav-group px-1 pb-2">{g.label}</p>
              <ul className="rs-list">
                {g.items.map((item) => {
                  const Icon = item.icon; const on = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} onClick={onClose} aria-current={on ? "page" : undefined} className={`rs-list-row ${on ? "is-active" : ""}`}>
                        <span className="rs-list-icon"><Icon size={18} aria-hidden /></span>
                        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{item.label}</span><span className="block truncate text-xs text-ink-500">{item.hint}</span></span>
                        <ChevronRight size={16} className="text-ink-500" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <button type="button" onClick={logout} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-faint)] text-sm font-bold"><LogOut size={16} /> Log out</button>
        </div>
      </div>
    </>
  );
}
