import { hasPermission, type AdminRole } from "@peebee/shared";
import type { LucideIcon } from "lucide-react";
import {
  Activity, Banknote, Briefcase, Bus, Car, ClipboardList, Compass, CreditCard, GraduationCap, Home, KeyRound, Languages,
  LayoutDashboard, MapPin, Mic, Package, Phone, PiggyBank, Power, Route, Ruler, ShieldCheck, Store, User, UserRound, Users, UsersRound, Video, Wallet, Waypoints,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short description shown in the command palette and settings index. */
  hint?: string;
  /** Extra words the command palette should match. */
  keywords?: string;
  visible?: (role: AdminRole | null) => boolean;
  /** Sub-pages: searchable and used for breadcrumbs, not listed in the sidebar. */
  children?: { href: string; label: string }[];
};
export type NavGroup = { id: string; label: string; items: NavItem[] };

const can = (p: Parameters<typeof hasPermission>[1]) => (role: AdminRole | null) => hasPermission(role, p);
const superOnly = (role: AdminRole | null) => role === "super_admin";

/** The admin's information architecture: one place that drives the sidebar, the
 * mobile menu, the command palette and breadcrumbs. Visibility mirrors the
 * permission checks the old settings drawer used. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, hint: "Stats, orders and health" },
      { href: "/activity", label: "Activity log", icon: ClipboardList, hint: "Who changed what", visible: can("activity_log.view") },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/orders", label: "Orders", icon: Package, hint: "Parcels, shopping, rides, food" },
      { href: "/settings/services", label: "Services", icon: Power, hint: "Switch modules on or off", keywords: "pause enable modules" },
      {
        href: "/settings/car", label: "Peebee Car", icon: Car, hint: "Rides, carpool, self-drive", visible: can("car.view"),
        children: [{ href: "/settings/car/fleet", label: "Fleet & car types" }],
      },
      {
        href: "/work", label: "Peebee Work", icon: Briefcase, hint: "Clean, Laundry, Fix jobs", visible: can("work.view"), keywords: "hive jobs providers",
        children: [
          { href: "/work/catalogue", label: "Catalogue" }, { href: "/work/providers", label: "Providers" }, { href: "/work/flags", label: "Flags" },
          { href: "/work/settings", label: "Work settings" }, { href: "/work/demo", label: "Demo" }, { href: "/work/jobs", label: "Job" },
        ],
      },
      {
        href: "/talent", label: "Peebee Hire", icon: Users, hint: "Workers, hiring and fees", visible: can("talent.view"), keywords: "talent jobs workers",
        children: [
          { href: "/talent/jobs", label: "Jobs" }, { href: "/talent/workers", label: "Workers" }, { href: "/talent/disputes", label: "Disputes" },
          { href: "/talent/safety", label: "Safety" }, { href: "/talent/money", label: "Money" }, { href: "/talent/settings", label: "Hire settings" },
        ],
      },
      { href: "/stages", label: "Stages", icon: Waypoints, hint: "Boda stages and approvals", children: [{ href: "/stages/pending", label: "Pending" }] },
      { href: "/settings/matching", label: "Rider matching", icon: Route, hint: "Dispatch and bidding rules" },
      { href: "/settings/relay", label: "Relay delivery", icon: Bus, hint: "Boda → matatu → boda", visible: (r) => hasPermission(r, "settings.manage") || hasPermission(r, "riders.view") || hasPermission(r, "orders.view") },
      { href: "/settings/taxipress", label: "Taxipress", icon: Bus, hint: "Shared-taxi seats on fixed routes", visible: (r) => hasPermission(r, "settings.manage") },
      { href: "/settings/delivery", label: "Delivery pricing", icon: Banknote, hint: "Per-km rates and fees" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { href: "/people", label: "Users", icon: UsersRound, hint: "Customers, riders, merchants", visible: (r) => hasPermission(r, "customers.view") || hasPermission(r, "riders.view"), keywords: "customers riders merchants restaurants" },
      { href: "/staff", label: "Staff accounts", icon: ShieldCheck, hint: "Team access", visible: superOnly },
      { href: "/onboarding", label: "Sales onboarding", icon: Store, hint: "Agents and policy", visible: superOnly },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/settings/payments", label: "Payments", icon: CreditCard, hint: "MTN / Airtel aggregators", visible: can("payments.manage") },
      { href: "/settings/monetization", label: "Monetization", icon: Banknote, hint: "Commissions, fees, Pro", visible: can("payments.manage"), keywords: "commission subscription pro" },
      { href: "/settings/merchant-payments", label: "Merchant payments", icon: Store, hint: "Custody gate", visible: can("merchant_finance.manage") },
      { href: "/settings/customer-wallet", label: "Customer wallet", icon: Wallet, hint: "Balance caps", visible: can("payments.manage") },
      { href: "/settings/rider-wallet", label: "Rider wallet", icon: Wallet, hint: "Minimum reserve", visible: can("payments.manage") },
      { href: "/settings/stage-savings", label: "Stage savings", icon: PiggyBank, hint: "Cycles and loans", visible: can("payments.manage") },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/settings/home-menu", label: "Home menu", icon: Home, hint: "Names and Hive shortcuts", visible: can("settings.manage") },
      { href: "/settings/marketplace", label: "Marketplace", icon: Store, hint: "Pro stores, live and ads" },
      { href: "/settings/learn", label: "Peebee Learn", icon: GraduationCap, hint: "Schools and courses" },
      { href: "/settings/video-ads", label: "Video & ads", icon: Video, hint: "Creator video providers and ads", keywords: "channels creators cloudinary mux bunny cloudflare advertising campaigns", visible: can("settings.manage") },
      { href: "/settings/guest", label: "Guest checkout", icon: UserRound, hint: "Shared links and alerts" },
      { href: "/settings/shopping-units", label: "Shopping units", icon: Ruler, hint: "Measures and matching", visible: can("settings.manage") },
      { href: "/settings/luganda-audio", label: "Luganda reading", icon: Languages, hint: "Audio voices" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/settings/platform", label: "Live / sandbox", icon: Activity, hint: "Platform environment", keywords: "environment production" },
      { href: "/settings/maps", label: "Maps", icon: MapPin, hint: "TomTom / Mapbox / Jawg", visible: can("payments.manage") },
      { href: "/settings/navigation", label: "Navigation & tracking", icon: Compass, hint: "Live routes", visible: (r) => hasPermission(r, "payments.manage") || hasPermission(r, "settings.manage") },
      { href: "/settings/calls", label: "Voice calls", icon: Phone, hint: "Call provider", visible: can("payments.manage") },
      { href: "/settings/voice", label: "Voice notes", icon: Mic, hint: "Max duration" },
      { href: "/settings/ai-keys", label: "Google AI keys", icon: KeyRound, hint: "Auto-rotation", visible: can("settings.manage") },
      { href: "/settings/email-keys", label: "Email keys", icon: KeyRound, hint: "Resend", visible: can("settings.manage") },
      { href: "/account", label: "My account", icon: User, hint: "Password and profile" },
    ],
  },
];

export function visibleGroups(role: AdminRole | null): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.visible || i.visible(role)) })).filter((g) => g.items.length > 0);
}

const matches = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** Where a path sits: its group, top-level item and (if any) sub-page — for breadcrumbs and the active state. */
export function locate(path: string): { group: NavGroup; item: NavItem; child?: { href: string; label: string } } | null {
  let best: { group: NavGroup; item: NavItem; child?: { href: string; label: string }; len: number } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (matches(path, item.href) && (!best || item.href.length > best.len)) best = { group, item, len: item.href.length };
      for (const child of item.children ?? []) {
        if (matches(path, child.href) && (!best || child.href.length > best.len)) best = { group, item, child, len: child.href.length };
      }
    }
  }
  return best;
}

export function isActive(path: string, href: string): boolean {
  const hit = locate(path);
  return !!hit && hit.item.href === href;
}
