"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { PARTNER_DOORS, PARTNER_TYPES } from "../lib/partners";

const NAV = [
  { href: "/partners", label: "Home" },
  { href: "/partners#ways", label: "Ways to earn" },
  { href: "/partners#how", label: "How it works" },
  { href: "/partners#questions", label: "Questions" },
  { href: "/partners#contact", label: "Contact" },
];

export function PartnerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="pp">
      <a href="#pp-main" className="skip">Skip to content</a>
      <header className="pp-head">
        <div className="pp-wrap pp-head-in">
          <Link href="/partners" className="pp-brand" aria-label="Peebee Partners home">
            <Logo className="pp-mark" /><b>Peebee Partners</b>
          </Link>
          <nav className="pp-nav" aria-label="Partners" data-open={open}>
            {NAV.map((n) => <Link key={n.label} href={n.href} onClick={() => setOpen(false)}>{n.label}</Link>)}
          </nav>
          <span className="pp-grow" />
          <ThemeToggle />
          <button type="button" className="pp-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </header>
      <main id="pp-main" className="pp-main" tabIndex={-1}>{children}</main>
      <footer className="pp-foot">
        <div className="pp-wrap pp-foot-in">
          <div className="pp-foot-brand">
            <Link href="/partners" className="pp-brand"><Logo className="pp-mark" /><b>Peebee Partners</b></Link>
            <p>Earn with Peebee across Uganda: rides, shops, kitchens, classes and home services.</p>
          </div>
          {PARTNER_DOORS.map((d) => (
            <div key={d.id}>
              <p className="pp-foot-h">{d.title}</p>
              {PARTNER_TYPES.filter((t) => t.door === d.id).map((t) => <Link key={t.slug} href={`/partners/${t.slug}`}>{t.short}</Link>)}
            </div>
          ))}
        </div>
        <div className="pp-wrap pp-foot-base">
          <span>© {new Date().getFullYear()} Peebee · Plot 15, Mugula Road, Entebbe</span>
          <a href="mailto:support@peebee.online">support@peebee.online</a>
          <Link href="/">Peebee for customers</Link>
          <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
