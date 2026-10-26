"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { rememberReturnTo } from "../../lib/return-to";
import { BrandLogo } from "../BrandLogo";

/** The top bar a signed-out visitor sees on a shared link: Peebee, and a way in that brings them back here. */
export function PublicFrame({ children, returnTo }: { children: React.ReactNode; returnTo: string }) {
  const { user, ready } = useAuth();
  return (
    <div className="mx-auto max-w-lg">
      {ready && !user && (
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="Peebee home"><BrandLogo /></Link>
          <Link href="/login" onClick={() => rememberReturnTo(returnTo)} className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink-gold">Sign in</Link>
        </header>
      )}
      {children}
    </div>
  );
}
