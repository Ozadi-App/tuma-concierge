"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTalentPermissions } from "../../components/talent/ui";
import { useAuth } from "../../lib/auth-context";

const TABS = [
  { href: "/talent", label: "Overview" },
  { href: "/talent/jobs", label: "Jobs" },
  { href: "/talent/workers", label: "Workers" },
  { href: "/talent/disputes", label: "Disputes" },
  { href: "/talent/safety", label: "Safety" },
  { href: "/talent/money", label: "Money" },
  { href: "/talent/settings", label: "Settings" },
];

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useAuth();
  const { canView } = useTalentPermissions();

  if (!ready) return null;
  if (!canView) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-xl font-bold text-ink">Peebee Jobs</h1>
        <p className="mt-2 text-sm text-ink-500">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <h1 className="text-xl font-bold text-ink">Peebee Jobs</h1>
      <nav aria-label="Jobs sections" className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.href === "/talent" ? pathname === "/talent" : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold ${active ? "border-gold bg-gold/15 text-ink" : "border-[var(--border-faint)] text-ink-500"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
