import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";
import { SiteFooter } from "../../components/SiteFooter";
import { ThemeModeToggle } from "../../components/ThemeModeToggle";

export const metadata: Metadata = {
  title: "Sell on Peebee — merchant sign-up",
  description: "Register your business with Peebee. Take payments, list your products in the Peebee app, or open your own web store.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-site min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/portal" aria-label="Peebee merchant portal" className="inline-flex">
          <span className="dark:hidden"><BrandLogo variant="dark" /></span>
          <span className="hidden dark:block"><BrandLogo variant="light" /></span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link href="/portal/login" className="text-ink-500 hover:text-ink">Sign in</Link>
          <Link href="/portal/register" className="button button-light">Register</Link>
          <ThemeModeToggle />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
