"use client";

import { Clapperboard, HandCoins, HeartHandshake, Home, ListVideo, PlusCircle, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChannelsConfig } from "../../lib/channels";

const TABS = [
  { href: "/studio", label: "Home", icon: Home },
  { href: "/studio/new", label: "Create", icon: PlusCircle },
  { href: "/studio/posts", label: "Posts", icon: ListVideo },
  { href: "/studio/money", label: "Money", icon: HandCoins },
  { href: "/studio/members", label: "Members", icon: Users },
  { href: "/studio/causes", label: "Causes", icon: HeartHandshake },
  { href: "/studio/profile", label: "Profile", icon: UserRound },
];

/** The Creator Studio lives inside the customer app: no separate login, no separate app. */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { config, loading } = useChannelsConfig();
  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!config?.enabled) {
    return (
      <div className="space-y-3 px-6 py-16 text-center">
        <Clapperboard className="mx-auto h-10 w-10 text-gold" aria-hidden />
        <h1 className="text-lg font-bold text-ink">Channels are coming soon</h1>
        <p className="text-sm text-ink-500">Creator channels are not open yet. Check back shortly.</p>
        <Link href="/" className="inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Back home</Link>
      </div>
    );
  }
  return (
    <div className="pb-24">
      <nav aria-label="Creator Studio" className="sticky top-0 z-30 -mx-0 flex gap-1 overflow-x-auto bg-[rgb(var(--color-cream)/0.95)] px-3 py-2 backdrop-blur-md">
        {TABS.map((t) => {
          const active = t.href === "/studio" ? pathname === "/studio" : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold ${active ? "bg-gold text-ink-gold" : "text-ink-500"}`}>
              <t.icon className="h-4 w-4" aria-hidden /> {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-4 px-4 pt-3">{children}</div>
    </div>
  );
}
