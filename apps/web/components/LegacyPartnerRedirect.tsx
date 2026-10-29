"use client";
import { useEffect } from "react";
import Link from "next/link";
import { LEGACY_PARTNERS } from "../lib/partners";

/** Old grouped pages (/partners/rides#boda and so on) forward to the dedicated page. */
export function LegacyPartnerRedirect({ slug }: { slug: string }) {
  const m = LEGACY_PARTNERS[slug];
  useEffect(() => {
    const h = window.location.hash.slice(1);
    const target = m.hash?.[h] ? `/partners/${m.hash[h]}` : m.to;
    window.location.replace(target);
  }, [m]);
  return <div className="plain wrap"><p className="lead">Taking you to the right partner page… <Link href={m.to}>Continue</Link></p></div>;
}
