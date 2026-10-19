"use client";

import { ADMIN_ROLE_LABELS, hasPermission } from "@peebee/shared";
import {
  ArrowUpRight,
  Banknote,
  Briefcase,
  Bus,
  Bell,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  CreditCard,
  Globe,
  HelpCircle,
  KeyRound,
  Languages,
  LogOut,
  MapPin,
  Mic,
  GraduationCap,
  Moon,
  Phone,
  PiggyBank,
  Power,
  Route,
  Settings2,
  Sparkles,
  Store,
  Trash2,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useResolvedTheme, useThemeMode } from "../lib/theme";

export interface SettingsItem {
  href?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value?: string | React.ReactNode;
  isExternal?: boolean;
  show?: boolean;
  onClick?: () => void;
}

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const resolvedTheme = useResolvedTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className={`fixed inset-0 z-50 flex flex-col bg-[rgb(var(--color-cream))] text-ink transition-transform duration-300 ease-out overflow-y-auto ${
        open ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      {/* Top Header matching Inspiration Screenshot */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-faint)] bg-[rgb(var(--color-cream))]/95 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink transition active:opacity-60"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </button>

        <span className="font-serif text-xl font-bold tracking-tight text-ink lowercase select-none">
          peebee
        </span>

        <Link
          href="/activity"
          onClick={onClose}
          aria-label="Activity notifications"
          className="relative -mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink transition active:opacity-60"
        >
          <Bell className="h-5 w-5" strokeWidth={1.8} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[rgb(var(--color-cream))]" />
        </Link>
      </header>

      {/* Main Drawer Scroll Area */}
      <div className="mx-auto w-full max-w-lg px-4 pb-20 pt-3">
        <SettingsListContent onItemClick={onClose} />
      </div>
    </div>
  );
}

/**
 * Shared Settings Content Component
 * Used both in SettingsDrawer and in /settings/page.tsx
 */
export function SettingsListContent({ onItemClick }: { onItemClick?: () => void }) {
  const { user, logout } = useAuth();
  const role = user?.adminRole ?? null;
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  const [platformMode, setPlatformMode] = useState<string | null>(null);
  const [activeServicesCount, setActiveServicesCount] = useState<number | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("1.2 MB");

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings }) => {
        setPlatformMode(settings.platformEnvironment ?? "live");
        const activeCount = Object.values(settings.services ?? {}).filter(Boolean).length;
        setActiveServicesCount(activeCount);
      })
      .catch(() => {});
  }, []);

  function handleThemeCycle() {
    const next = themeMode === "auto" ? "dark" : themeMode === "dark" ? "light" : "auto";
    setThemeMode(next);
  }

  async function handleClearCache() {
    setCacheStatus("Clearing…");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setTimeout(() => {
        setCacheStatus("Cleaned");
      }, 350);
    } catch {
      setCacheStatus("Cleaned");
    }
  }

  const themeLabel =
    themeMode === "auto" ? "Follow system" : themeMode === "dark" ? "Dark" : "Light";

  // Group 1: Mobility, Fleet & Delivery Logistics
  const mobilityGroup: SettingsItem[] = [
    {
      href: "/settings/services",
      icon: Power,
      label: "Services",
      value: activeServicesCount !== null ? `${activeServicesCount} active` : "All active",
      show: true,
    },
    {
      href: "/settings/car",
      icon: Car,
      label: "Peebee Car",
      value: "Fleet & drivers",
      show: hasPermission(role, "car.view"),
    },
    {
      href: "/work",
      icon: Briefcase,
      label: "Peebee Work",
      value: "Jobs & providers",
      show: hasPermission(role, "work.view"),
    },
    {
      href: "/talent",
      icon: Users,
      label: "Peebee Hire",
      value: "Workers, hiring & fees",
      show: hasPermission(role, "talent.view"),
    },
    {
      href: "/settings/delivery",
      icon: Banknote,
      label: "Delivery pricing",
      value: "Per-km rates",
      show: true,
    },
    {
      href: "/settings/matching",
      icon: Route,
      label: "Rider matching",
      value: "Dispatch rules",
      show: true,
    },
    {
      href: "/settings/relay",
      icon: Bus,
      label: "Relay delivery",
      value: "Boda → matatu → boda",
      show:
        hasPermission(role, "settings.manage") ||
        hasPermission(role, "riders.view") ||
        hasPermission(role, "orders.view"),
    },
  ];

  // Group 2: Finances, Custody & Wallets
  const financesGroup: SettingsItem[] = [
    {
      href: "/settings/monetization",
      icon: CreditCard,
      label: "Monetization",
      value: "Commissions",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/marketplace",
      icon: Store,
      label: "Marketplace & Pro stores",
      value: "TikTok live & ads",
      show: true,
    },
    {
      href: "/settings/learn",
      icon: GraduationCap,
      label: "Peebee Learn",
      value: "Schools & courses",
      show: true,
    },
    {
      href: "/settings/payments",
      icon: CreditCard,
      label: "Payments",
      value: "MTN / Airtel",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/merchant-payments",
      icon: Store,
      label: "Merchant payments",
      value: "Custody gate",
      show: hasPermission(role, "merchant_finance.manage"),
    },
    {
      href: "/settings/customer-wallet",
      icon: Wallet,
      label: "Customer wallet",
      value: "Balance caps",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/rider-wallet",
      icon: Wallet,
      label: "Rider wallet",
      value: "Min reserve",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/stage-savings",
      icon: PiggyBank,
      label: "Stage savings circles",
      value: "Cycles & loans",
      show: hasPermission(role, "payments.manage"),
    },
  ];

  // Group 3: Intelligence, Maps & Communications
  const intelligenceGroup: SettingsItem[] = [
    {
      href: "/settings/ai-keys",
      icon: KeyRound,
      label: "Google AI keys",
      value: "Auto-rotation",
      show: hasPermission(role, "settings.manage"),
    },
    {
      href: "/settings/email-keys",
      icon: KeyRound,
      label: "Email API keys",
      value: "Resend",
      show: hasPermission(role, "settings.manage"),
    },
    {
      href: "/settings/maps",
      icon: MapPin,
      label: "Maps provider",
      value: "TomTom / Mapbox",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/navigation",
      icon: Compass,
      label: "Navigation and tracking",
      value: "Live routes",
      show: hasPermission(role, "payments.manage") || hasPermission(role, "settings.manage"),
    },
    {
      href: "/settings/calls",
      icon: Phone,
      label: "Voice calls",
      value: "Provider",
      show: hasPermission(role, "payments.manage"),
    },
    {
      href: "/settings/voice",
      icon: Mic,
      label: "Voice recordings",
      value: "Max duration",
      show: true,
    },
    {
      href: "/settings/luganda-audio",
      icon: Languages,
      label: "Luganda list reading",
      value: "Audio voices",
      show: true,
    },
  ];

  // Group 4: Administration & Staff Access
  const adminAccessGroup: SettingsItem[] = [
    ...(role === "super_admin"
      ? [
          {
            href: "/staff",
            icon: Users,
            label: "Staff accounts",
            value: "Team access",
            show: true,
          },
          {
            href: "/onboarding",
            icon: Store,
            label: "Sales onboarding",
            value: "Policy",
            show: true,
          },
        ]
      : []),
    {
      href: "/settings/shopping-units",
      icon: Settings2,
      label: "Shopping units",
      value: "Measures",
      show: hasPermission(role, "settings.manage"),
    },
    {
      href: "/settings/home-menu",
      icon: Settings2,
      label: "Home menu",
      value: "Names & Hive",
      show: hasPermission(role, "settings.manage"),
    },
  ];

  // Group 5: Device & App Preferences
  const preferencesGroup: SettingsItem[] = [
    {
      href: "/account",
      icon: User,
      label: "Account",
      show: true,
    },
    {
      icon: Globe,
      label: "Language",
      value: "English",
      show: true,
    },
    {
      icon: Moon,
      label: "Appearance",
      value: themeLabel,
      onClick: handleThemeCycle,
      show: true,
    },
    {
      icon: Trash2,
      label: "Clear cache",
      value: cacheStatus,
      onClick: handleClearCache,
      show: true,
    },
  ];

  // Group 6: System Audit & External Hubs
  const systemGroup: SettingsItem[] = [
    {
      href: "/activity",
      icon: ClipboardList,
      label: "Activity log",
      show: hasPermission(role, "activity_log.view"),
    },
    {
      href: "https://preview.peebee.online",
      icon: Sparkles,
      label: "Explore Preview Hub",
      isExternal: true,
      show: true,
    },
    {
      href: "https://github.com/Peebee-Application/Peebee",
      icon: HelpCircle,
      label: "Get help & documentation",
      isExternal: true,
      show: true,
    },
    {
      icon: Settings2,
      label: "Version",
      value: "v26.18.0",
      show: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Admin Profile Card (Matches Inspiration Screenshot 2 Top Card) */}
      <Link
        href="/account"
        onClick={onItemClick}
        className="flex items-center gap-3.5 rounded-[24px] bg-[rgb(var(--surface-card))] p-3.5 border border-[var(--border-faint)] shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition active:opacity-75"
      >
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full overflow-hidden bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-400 text-white font-black text-xl shadow-inner">
          <span className="select-none">🌍</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-ink truncate leading-tight">
            {user?.name ?? "Christo"}
          </h2>
          <p className="text-xs text-ink-500 font-medium mt-0.5">
            {role ? (ADMIN_ROLE_LABELS[role] ?? "Admin") : "Personal"}
          </p>
        </div>
        <ChevronRight className="h-4.5 w-4.5 text-ink-500/50 shrink-0" strokeWidth={1.8} />
      </Link>

      {/* 2. Platform Status / Mode Highlight Card (Matches Inspiration Screenshot 2 Second Card) */}
      <div className="rounded-[24px] bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-2xl font-black text-ink tracking-tight">
            {platformMode === "live" ? "Live" : "Sandbox"}
          </h3>
          <Link
            href="/settings/platform"
            onClick={onItemClick}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream transition hover:opacity-90 active:scale-95"
          >
            {platformMode === "live" ? "Production" : "Manage"}
          </Link>
        </div>
        <div className="border-t border-[var(--border-faint)] pt-3">
          <Link
            href="/settings/services"
            onClick={onItemClick}
            className="flex items-center justify-between transition active:opacity-75"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4.5 w-4.5 text-gold" strokeWidth={2} />
              <span className="text-sm font-semibold text-ink">Active Services</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-ink-500">
                {activeServicesCount !== null ? `${activeServicesCount} Online` : "Loading…"}
              </span>
              <ChevronRight className="h-4 w-4 text-ink-500/50" strokeWidth={1.8} />
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Group 1: Mobility & Fleet Logistics */}
      <SettingsCardSection items={mobilityGroup} onItemClick={onItemClick} />

      {/* 4. Group 2: Finances & Custody Wallets */}
      <SettingsCardSection items={financesGroup} onItemClick={onItemClick} />

      {/* 5. Group 3: Intelligence, Maps & Communications */}
      <SettingsCardSection items={intelligenceGroup} onItemClick={onItemClick} />

      {/* 6. Group 4: Administration & Staff Policy */}
      {adminAccessGroup.length > 0 && (
        <SettingsCardSection items={adminAccessGroup} onItemClick={onItemClick} />
      )}

      {/* 7. Group 5: Device Preferences */}
      <SettingsCardSection items={preferencesGroup} onItemClick={onItemClick} />

      {/* 8. Group 6: System Audit & Hubs */}
      <SettingsCardSection items={systemGroup} onItemClick={onItemClick} />

      {/* 9. Standalone Log Out Card (Matches Inspiration Screenshot 1 Bottom Card) */}
      <button
        type="button"
        onClick={() => {
          onItemClick?.();
          logout();
        }}
        className="flex w-full items-center gap-3.5 rounded-[24px] bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] px-4 py-3.5 text-sm font-semibold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition active:opacity-75"
      >
        <LogOut className="h-5 w-5 text-ink/80 shrink-0" strokeWidth={1.8} />
        <span>Log out</span>
      </button>
    </div>
  );
}

function SettingsCardSection({
  items,
  onItemClick,
}: {
  items: SettingsItem[];
  onItemClick?: () => void;
}) {
  const visible = items.filter((i) => i.show !== false);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-[24px] bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] divide-y divide-[var(--border-faint)] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      {visible.map((item, idx) => {
        const Icon = item.icon;
        const content = (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="h-5 w-5 text-ink/80 shrink-0" strokeWidth={1.8} />
              <span className="text-sm font-medium text-ink truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.value && (
                <span className="text-[13px] text-ink-500 font-medium">{item.value}</span>
              )}
              {item.isExternal ? (
                <ArrowUpRight className="h-4 w-4 text-ink-500/60" strokeWidth={1.8} />
              ) : (
                <ChevronRight className="h-4 w-4 text-ink-500/50" strokeWidth={1.8} />
              )}
            </div>
          </>
        );

        if (item.href) {
          if (item.isExternal) {
            return (
              <a
                key={item.label + idx}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                onClick={onItemClick}
                className="flex items-center justify-between px-4 py-3.5 transition active:bg-black/5 dark:active:bg-white/5"
              >
                {content}
              </a>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className="flex items-center justify-between px-4 py-3.5 transition active:bg-black/5 dark:active:bg-white/5"
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.label + idx}
            type="button"
            onClick={() => {
              item.onClick?.();
            }}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
