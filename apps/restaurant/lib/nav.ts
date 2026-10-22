import type { LucideIcon } from "lucide-react";
import { ClipboardList, Eye, MessageCircle, Settings, ShieldCheck, Store, UtensilsCrossed, WalletCards } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; hint: string; keywords?: string; anchors?: { id: string; label: string; keywords?: string }[] };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/** The food business app's information architecture: drives the sidebar, the
 * mobile menu, search and breadcrumbs from one place. */
export const NAV_GROUPS: NavGroup[] = [
  { id: "today", label: "Today", items: [
    { href: "/", label: "Orders", icon: ClipboardList, hint: "Active orders and history", keywords: "kitchen queue new" },
    { href: "/chat", label: "Messages", icon: MessageCircle, hint: "Chat with customers", keywords: "chat inbox" },
  ] },
  { id: "storefront", label: "Storefront", items: [
    { href: "/menu", label: "Menu", icon: UtensilsCrossed, hint: "Dishes, sections, featured", keywords: "dish food items price sections featured available" },
    { href: "/preview", label: "Customer preview", icon: Eye, hint: "See your storefront as customers do", keywords: "preview storefront look" },
    { href: "/business", label: "Business profile", icon: Store, hint: "Name, hours, location, photos", keywords: "open close hours address cover logo",
      anchors: [{ id: "status", label: "Open / closed" }, { id: "photos", label: "Cover & logo" }, { id: "theme", label: "Colour theme", keywords: "palette colours brand" }, { id: "details", label: "Details & hours" }] },
  ] },
  { id: "money", label: "Money", items: [
    { href: "/wallet", label: "Business balance", icon: WalletCards, hint: "Balance and payouts", keywords: "wallet settlement withdraw" },
    { href: "/payments", label: "Rider payments", icon: ShieldCheck, hint: "Confirm rider payments", keywords: "momo confirm" },
  ] },
  { id: "account", label: "Account", items: [
    { href: "/account", label: "Settings", icon: Settings, hint: "Language, password, practice", keywords: "account logout password language appearance practice" },
  ] },
];

const matches = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
export function locate(path: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of NAV_GROUPS) for (const item of group.items) if (matches(path, item.href) && (!best || item.href.length > best.item.href.length)) best = { group, item };
  return best;
}
export const isActive = (path: string, href: string) => locate(path)?.item.href === href;
