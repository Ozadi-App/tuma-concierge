"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locate } from "../../lib/admin-nav";

const DETAIL: Record<string, string> = { customers: "Customer", riders: "Rider", merchants: "Merchant", restaurants: "Restaurant", orders: "Order", stages: "Stage" };

/** "Operations › Peebee Work › Catalogue": where you are, one tap back up. */
export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login" || pathname === "/set-password") return null;
  const hit = locate(pathname);
  const crumbs: { label: string; href?: string }[] = [];
  if (hit) {
    crumbs.push({ label: hit.group.label });
    crumbs.push({ label: hit.item.label, href: hit.child || pathname !== hit.item.href ? hit.item.href : undefined });
    if (hit.child) crumbs.push({ label: hit.child.label, href: pathname !== hit.child.href ? hit.child.href : undefined });
    const rest = pathname.slice((hit.child ?? hit.item).href.length).split("/").filter(Boolean);
    if (rest.length) crumbs.push({ label: "Details" });
  } else if (pathname.startsWith("/settings")) {
    crumbs.push({ label: "Settings" });
  } else {
    const parts = pathname.split("/").filter(Boolean);
    crumbs.push({ label: parts[0] ? parts[0][0]!.toUpperCase() + parts[0].slice(1) : "" });
    const kind = parts[1];
    if (kind && DETAIL[kind]) crumbs.push({ label: DETAIL[kind]! });
  }
  return (
    <nav aria-label="Breadcrumb" className="admin-crumbs hidden px-4 pt-4 lg:block lg:px-8 lg:pt-6">
      <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />}
            {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={i === crumbs.length - 1 ? "text-ink" : ""}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
