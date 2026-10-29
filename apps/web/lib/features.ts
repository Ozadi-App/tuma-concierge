import type { LucideIcon } from "lucide-react";
import { ACCOUNT_PAGES } from "./account";
import { SUBS } from "./subs";

/** Supporting features: perks used across the modules. Shown as a pop-up, never as a module page. */
export type Feature = { id: string; icon: LucideIcon; title: string; text: string; action?: { label: string; href: string } };

const APP = "https://app.peebee.online";

const fromSubs: Feature[] = SUBS.filter((s) => s.feature).map((s) => ({
  id: `${s.door}/${s.key}`, icon: s.icon, title: s.chip && s.title.length > 22 ? s.chip : s.title, text: s.text,
  action: { label: "Open Peebee", href: APP },
}));

const fromAccount: Feature[] = ACCOUNT_PAGES.map((a) => ({
  id: `acct/${a.slug}`, icon: a.icon, title: a.title, text: a.lead,
  action: { label: a.slug === "install" ? "Open Peebee to install" : `Open ${a.title} in Peebee`, href: `${APP}${a.appPath}` },
}));

export const FEATURES: Feature[] = [...fromAccount, ...fromSubs];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<string, Feature>;
/** The account-level features, in the order the app's account menu shows them. */
export const APP_FEATURES = ["acct/wallet", "acct/cart", "acct/orders", "acct/track", "acct/chat", "acct/notifications", "acct/settings", "acct/install", "ride/parcels"].map((id) => FEATURE_BY_ID[id]);
