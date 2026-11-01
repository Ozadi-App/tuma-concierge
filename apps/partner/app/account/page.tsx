"use client";

import Link from "next/link";

import { LogOut, LifeBuoy, ChevronRight } from "lucide-react";
import { AppearanceSettings } from "../../components/AppearanceSettings";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const { user, me, logout } = useAuth();
  return (
    <div className="space-y-5 px-4 py-5">
      <header>
        <h1 className="text-2xl font-black">Account</h1>
        <p className="text-sm text-ink-500">{user?.name}</p>
      </header>
      <section className="home-card space-y-1 text-sm">
        <p>Owner: <strong>{me?.ownerStatus ?? "none"}</strong></p>
        <p>Driver: <strong>{me?.driverStatus ?? "none"}</strong></p>
      </section>
      <Link href="/help" className="home-card flex items-center gap-3 !rounded-2xl !py-3 text-sm font-semibold text-ink">
        <LifeBuoy className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
        <span className="flex-1">Help &amp; support</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
      </Link>
      <AppearanceSettings />
      <button onClick={logout} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-red-300 font-bold text-red-600">
        <LogOut className="h-4 w-4" />Log out
      </button>
    </div>
  );
}
