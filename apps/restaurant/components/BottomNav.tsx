"use client";

import { ClipboardList, Eye, LayoutGrid, MessageCircle, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTranslate, type TranslationKey } from "../lib/i18n";
import { isActive } from "../lib/nav";

const tabs: { href: string; labelKey?: TranslationKey; label?: string; icon: LucideIcon }[] = [
  { href: "/", labelKey: "nav_orders", icon: ClipboardList },
  { href: "/menu", labelKey: "nav_menu", icon: UtensilsCrossed },
  { href: "/preview", label: "Preview", icon: Eye },
  { href: "/chat", labelKey: "nav_chat", icon: MessageCircle },
];

/** Phone tabs: the four daily screens, then More for everything else. Hidden on desktop (sidebar). */
export function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();
  const t = useTranslate();
  const inMore = !tabs.some((tab) => isActive(pathname, tab.href));
  return (
    <nav aria-label="Bottom Navigation" className="customer-nav fixed inset-x-0 bottom-3 z-40 px-3 pointer-events-none pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-center">
        <ul className="customer-nav-capsule pointer-events-auto flex w-full items-stretch justify-around rounded-[24px] p-1.5 gap-1">
          {tabs.map((tab) => {
            const active = !moreOpen && isActive(pathname, tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Link href={tab.href} aria-current={active ? "page" : undefined}
                  className={`customer-nav-item relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${active ? "is-active" : ""}`}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                  <span className="leading-none truncate max-w-[64px]">{tab.labelKey ? t(tab.labelKey) : tab.label}</span>
                  {active && <span className="customer-nav-indicator absolute bottom-1.5 h-1 w-3.5 rounded-full" aria-hidden />}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button type="button" onClick={onMore} aria-expanded={moreOpen} aria-label="More: all pages"
              className={`customer-nav-item relative flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${moreOpen || inMore ? "is-active" : ""}`}>
              <LayoutGrid className="h-5 w-5" strokeWidth={moreOpen || inMore ? 2.4 : 1.8} aria-hidden />
              <span className="leading-none">More</span>
              {(moreOpen || inMore) && <span className="customer-nav-indicator absolute bottom-1.5 h-1 w-3.5 rounded-full" aria-hidden />}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
