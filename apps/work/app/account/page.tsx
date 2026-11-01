"use client";

import Link from "next/link";

import { LogOut, LifeBuoy, ChevronRight } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const { user, provider, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-ink">Account</h1>
      <section className="home-card space-y-1 p-4">
        <p className="text-sm font-black text-ink">{provider?.companyName || provider?.displayName || user.name}</p>
        <p className="text-xs font-medium text-ink-500">{user.phone || user.email}</p>
        {provider && (
          <p className="pt-1 text-xs font-medium text-ink-500">
            {provider.kind === "company" ? "Company" : "Individual"} · {provider.status}
            {provider.rating != null ? ` · ★ ${provider.rating.toFixed(1)} (${provider.ratingCount})` : ""} · {provider.jobsCompleted} jobs
          </p>
        )}
      </section>
      {provider && provider.services.length > 0 && (
        <section className="home-card space-y-2 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-ink-500">Services you offer</p>
          <div className="flex flex-wrap gap-1.5">
            {provider.services.map((s) => <span key={s.id} className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">{s.name}</span>)}
          </div>
        </section>
      )}
      <Link href="/help" className="home-card flex items-center gap-3 !rounded-2xl !py-3 text-sm font-semibold text-ink">
        <LifeBuoy className="h-5 w-5 text-gold" strokeWidth={1.75} aria-hidden />
        <span className="flex-1">Help &amp; support</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-500/60" strokeWidth={1.75} aria-hidden />
      </Link>
      <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] py-3 text-sm font-black text-ink transition active:scale-[0.98]">
        <LogOut className="h-4 w-4" aria-hidden />Sign out
      </button>
    </div>
  );
}
