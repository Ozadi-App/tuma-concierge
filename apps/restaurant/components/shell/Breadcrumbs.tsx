"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { locate } from "../../lib/nav";

/** "Storefront › Menu": where you are, one tap back up. Desktop only; phones use the Back chevron. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const hit = locate(pathname);
  if (!hit || pathname === "/") return null;
  const deeper = pathname !== hit.item.href;
  const crumbs: { label: string; href?: string }[] = [{ label: hit.group.label }, { label: hit.item.label, href: deeper ? hit.item.href : undefined }];
  if (deeper) crumbs.push({ label: "Conversation" });
  return (
    <nav aria-label="Breadcrumb" className="hidden px-4 pt-6 lg:block lg:px-8">
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
