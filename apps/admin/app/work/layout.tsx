"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkPermissions } from "../../components/work/ui";
import { useAuth } from "../../lib/auth-context";

const TABS = [
  { href: "/work", label: "Jobs" },
  { href: "/work/providers", label: "Providers" },
  { href: "/work/flags", label: "Flags" },
  { href: "/work/catalogue", label: "Catalogue" },
  { href: "/work/laundry", label: "Laundry" },
  { href: "/work/settings", label: "Settings" },
  { href: "/work/demo", label: "Demo" },
];

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useAuth();
  const { canView } = useWorkPermissions();

  if (!ready) return null;
  if (!canView) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-xl font-bold text-ink">Peebee Work</h1>
        <p className="mt-2 text-sm text-ink-500">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <h1 className="text-xl font-bold text-ink">Peebee Work</h1>
      <nav aria-label="Work sections" className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.href === "/work" ? pathname === "/work" || pathname.startsWith("/work/jobs") : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                active ? "border-gold bg-gold/15 text-ink" : "border-[var(--border-faint)] text-ink-500"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
