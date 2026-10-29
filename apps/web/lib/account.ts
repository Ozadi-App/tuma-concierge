import { Wallet, ShoppingBag, Package, MapPin, MessagesSquare, Bell, Settings, Smartphone, type LucideIcon } from "lucide-react";
import type { PhotoKey } from "./subs";

/** The account pages of the app. Illustrative only: no balances, names or orders are shown, and nothing is faked. */
export type AccountPage = {
  slug: string;
  title: string;
  icon: LucideIcon;
  photo: PhotoKey;
  lead: string;
  points: string[];
  /** where the same screen lives in the app */
  appPath: string;
  related: { title: string; href: string }[];
};

export const ACCOUNT_PAGES: AccountPage[] = [
  {
    slug: "wallet", title: "Wallet", icon: Wallet, photo: "sub-acct-wallet", appPath: "/wallet",
    lead: "One wallet sits under everything you do here. Top up from MTN MoMo or Airtel Money, pay from the balance, send some to a friend, or take a refund. What a job costs waits in escrow until the work is done, and every movement is written twice.",
    points: ["Top up from MTN MoMo or Airtel Money.", "Pay from the balance, send to a friend, take a refund.", "Escrow holds what a job costs until the work is done.", "Every movement is written twice, in a double-entry ledger."],
    related: [{ title: "Orders", href: "/orders" }, { title: "Ride", href: "/ride" }, { title: "Buy", href: "/buy" }],
  },
  {
    slug: "cart", title: "Unified cart", icon: ShoppingBag, photo: "sub-acct-cart", appPath: "/cart",
    lead: "One cart for everything you want. Mix items from different shops and dishes from different restaurants in the same cart, then check out once and pay a single time from your wallet.",
    points: ["Items from several shops in one cart.", "Dishes from different restaurants alongside them.", "Check out once. Nothing is bought until you fund it."],
    related: [{ title: "Eat: order from several kitchens", href: "/eat/carts" }, { title: "Stores", href: "/buy/stores" }, { title: "Groceries", href: "/buy/groceries" }],
  },
  {
    slug: "orders", title: "Orders", icon: Package, photo: "sub-acct-orders", appPath: "/orders",
    lead: "Everything you have ordered, in one list. When you want the same again, buy it again from here instead of starting over.",
    points: ["Everything you have ordered.", "Buy again from an earlier order.", "Each order follows the same path, from create to settle."],
    related: [{ title: "Track", href: "/track" }, { title: "The list", href: "/buy/list" }, { title: "Wallet", href: "/wallet" }],
  },
  {
    slug: "track", title: "Track", icon: MapPin, photo: "sub-acct-track", appPath: "/track",
    lead: "Follow a delivery step by step, or type a tracking code if someone sent you one. You will see it move from matched to funded, on the way and handed over.",
    points: ["Follow a delivery step by step.", "Or type a tracking code.", "Share a live trip link with someone who is waiting."],
    related: [{ title: "Parcels", href: "/ride/parcels" }, { title: "Orders", href: "/orders" }, { title: "Notifications", href: "/notifications" }],
  },
  {
    slug: "chat", title: "Chat and calls", icon: MessagesSquare, photo: "sub-chat", appPath: "/chat",
    lead: "Talk to the rider or the kitchen, with voice notes when typing is a nuisance. Every conversation sits on its order, so you can always find it again.",
    points: ["Talk to the rider or the kitchen.", "Voice notes work.", "Each conversation sits on its order."],
    related: [{ title: "Eat: chat on the order", href: "/eat/chat" }, { title: "Orders", href: "/orders" }, { title: "Track", href: "/track" }],
  },
  {
    slug: "notifications", title: "Notifications", icon: Bell, photo: "sub-acct-notifications", appPath: "/notifications",
    lead: "A short line each time something moves: matched, funded, on the way, handed over. You never have to wonder what is happening to an order.",
    points: ["Matched.", "Funded.", "On the way.", "Handed over."],
    related: [{ title: "Track", href: "/track" }, { title: "Orders", href: "/orders" }, { title: "Settings", href: "/settings" }],
  },
  {
    slug: "settings", title: "Settings", icon: Settings, photo: "sub-acct-settings", appPath: "/settings",
    lead: "Save the places you use most, such as Home and Office, so you never type them twice. Pick English or Luganda, and the app speaks it.",
    points: ["Saved places such as Home and Office.", "English and Luganda.", "Your account, in one place."],
    related: [{ title: "Wallet", href: "/wallet" }, { title: "Notifications", href: "/notifications" }, { title: "Install", href: "/install" }],
  },
  {
    slug: "install", title: "On your home screen", icon: Smartphone, photo: "sub-acct-install", appPath: "",
    lead: "Install Peebee like an app, so it opens from your home screen with one tap. It also tells you when you are offline, so a missing signal never looks like a broken order.",
    points: ["Install it like an app.", "Opens from your home screen.", "Tells you when you are offline."],
    related: [{ title: "Settings", href: "/settings" }, { title: "Notifications", href: "/notifications" }, { title: "Wallet", href: "/wallet" }],
  },
];
export const ACCOUNT_BY_SLUG = Object.fromEntries(ACCOUNT_PAGES.map((a) => [a.slug, a]));
