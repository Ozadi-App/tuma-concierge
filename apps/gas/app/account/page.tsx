"use client";

import { Building2, ChevronRight, Fuel, LogOut, ShieldCheck, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const router = useRouter();
  const { attendant, outlet, outlets, selectOutlet, toggleDuty, logout } = useAuth();

  function handleSignOut() {
    logout();
    router.push("/login");
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-black text-ink">Attendant Account</h1>
        <p className="text-xs text-ink-500">Workspace settings and station assignment</p>
      </header>

      {/* Attendant Profile Card */}
      <section className="home-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-ink-gold">
            <User className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-ink">{attendant?.name ?? "Attendant"}</h2>
              <ShieldCheck className="h-4 w-4 text-green" />
            </div>
            <p className="font-mono text-xs text-ink-500">Badge: {attendant?.code ?? "ATT-1001"}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-xs">
          <span className="text-ink-500">Current Shift Status</span>
          <button
            type="button"
            onClick={() => toggleDuty(!attendant?.on_duty)}
            className={`rounded-full px-3 py-1 font-bold transition ${
              attendant?.on_duty
                ? "bg-green/15 text-green"
                : "bg-ink-muted/15 text-ink-500"
            }`}
          >
            {attendant?.on_duty ? "On Duty (Active)" : "Off Duty (Paused)"}
          </button>
        </div>
      </section>

      {/* Station Assignment */}
      <section className="home-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-bold text-ink">Assigned Petrol Station</h3>
          </div>
          <Link href="/stations" className="text-xs font-bold text-gold">
            Browse all →
          </Link>
        </div>

        <div>
          <select
            value={outlet?.id ?? ""}
            onChange={(e) => selectOutlet(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 text-xs font-bold text-ink outline-none"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-ink-500">
          Address: {outlet?.address}
        </p>
      </section>

      {/* Training / Practice Mode Link */}
      <Link
        href="/practice"
        className="home-card flex items-center justify-between p-4 hover:border-gold/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Practice Training Simulator</h3>
            <p className="text-xs text-ink-500">Train dispensing with mock riders without real fuel</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-ink-500" />
      </Link>

      {/* Sign Out Button */}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out of Station</span>
      </button>
    </div>
  );
}
