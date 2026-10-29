"use client";
import type { ReactNode, MouseEvent } from "react";
import { useRouter } from "next/navigation";

/** True when running as the installed app (home-screen PWA). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Link from the customer site into the partner portal: a new tab in a browser, in place inside the installed app. */
export function PartnerLink({ href, className, children, onClick, ...rest }: { href: string; className?: string; children: ReactNode; onClick?: () => void; "aria-label"?: string }) {
  const router = useRouter();
  function go(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (isStandalone()) { e.preventDefault(); router.push(href); }
  }
  return <a href={href} className={className} target="_blank" rel="noopener" onClick={go} {...rest}>{children}</a>;
}
