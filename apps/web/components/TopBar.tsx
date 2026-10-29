"use client";

import Link from "next/link";
import { Download, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useShell } from "./ShellContext";
import { usePathname } from "next/navigation";
import { APP_URL } from "../lib/content";

export function TopBar() {
  const { menuOpen, setMenuOpen } = useShell();
  const path = usePathname() ?? "/";
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="menu"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>
      <Link href="/" className="brand" aria-label="Peebee home">
        <Logo className="brand-mark" />
        <span className="brand-word">Peebee</span>
      </Link>
      <nav className="topnav" aria-label="Site">
        <Link href="/" className="topnav-link" aria-current={path === "/" ? "page" : undefined}>Home</Link>
        <Link href="/about" className="topnav-link" aria-current={path.startsWith("/about") ? "page" : undefined}>About</Link>
        <Link href="/how-it-works" className="topnav-link" aria-current={path.startsWith("/how-it-works") ? "page" : undefined}>How it works</Link>
        <Link href="/contact" className="topnav-link" aria-current={path.startsWith("/contact") ? "page" : undefined}>Contact us</Link>
      </nav>
      <span className="grow" />
      <a href={APP_URL} className="btn btn-gold topbar-cta">
        Download the app <Download size={16} aria-hidden />
      </a>
      <ThemeToggle />
    </header>
  );
}
