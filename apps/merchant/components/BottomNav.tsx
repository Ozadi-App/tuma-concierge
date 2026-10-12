"use client";

import { Building2, CreditCard, LayoutGrid, Store, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";

const tabs = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/store", label: "Pro Store", icon: Store },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/wallet", label: "Wallet", icon: WalletCards },
  { href: "/outlets", label: "Outlets", icon: Building2 },
  { href: "/account", label: "Account", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  const { merchant } = useAuth();

  if (pathname === "/login" || pathname === "/apply" || pathname === "/activate") return null;

  const visibleTabs =
    merchant?.member_role === "cashier" ? tabs.filter((tab) => tab.href !== "/wallet") : tabs;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="customer-nav fixed inset-x-0 bottom-3 z-40 px-3 pointer-events-none pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg items-center justify-center">
        <ul className="customer-nav-capsule pointer-events-auto flex w-full items-stretch justify-around rounded-[24px] p-1.5 gap-1">
          {visibleTabs.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`customer-nav-item relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                    active ? "is-active" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                  <span className="leading-none truncate max-w-[58px]">{tab.label}</span>
                  {active && (
                    <span
                      className="customer-nav-indicator absolute bottom-1.5 h-1 w-3.5 rounded-full"
                      aria-hidden
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
