"use client";

import { Fuel, History, Store, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Pump", icon: Fuel },
  { href: "/shift", label: "Shift", icon: History },
  { href: "/prices", label: "Prices", icon: Store },
  { href: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-faint)] bg-[rgb(var(--surface-card))] pb-[env(safe-area-inset-bottom)] shadow-lg">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" || pathname === "/dispense" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-bold transition after:absolute after:inset-x-3 after:bottom-0 after:h-1 after:rounded-full ${
                  active ? "text-gold after:bg-gold" : "text-ink-500 hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.75} aria-hidden />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
