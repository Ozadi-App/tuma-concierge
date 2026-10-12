"use client";

import {
  Briefcase,
  Building2,
  ChevronRight,
  Fuel,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../../components/BrandLogo";
import { useAuth } from "../../lib/auth-context";

export default function AccountPage() {
  const router = useRouter();
  const {
    attendant,
    manager,
    isManager,
    role,
    activeMode,
    switchToPumpMode,
    switchToManagerMode,
    outlet,
    outlets,
    selectOutlet,
    toggleDuty,
    logout,
  } = useAuth();

  function handleSignOut() {
    logout();
    router.push("/login");
  }

  return (
    <div className="space-y-4 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">
            {isManager ? "Station Manager Account" : "Attendant Account"}
          </h1>
          <p className="text-xs text-ink-500">Workspace settings and station operational mode</p>
        </div>
        <BrandLogo wordmark={false} className="!h-8 !w-8" />
      </header>

      {/* Manager / Attendant Profile Card */}
      <section className="home-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold font-bold">
            {isManager ? <Briefcase className="h-6 w-6" /> : <User className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-ink">
                {isManager ? manager?.full_name : attendant?.name ?? "Attendant"}
              </h2>
              <ShieldCheck className="h-4 w-4 text-green" />
            </div>
            <p className="font-mono text-xs text-ink-500">
              {isManager
                ? `Manager Code: ${manager?.manager_code ?? "MGR-TOT-01"}`
                : `Badge: ${attendant?.code ?? "ATT-1001"}`}
            </p>
          </div>
        </div>

        {/* Manager Selling Fuel Mode Toggle */}
        {isManager && (
          <div className="border-t border-[var(--border-faint)] pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Active Terminal Work Mode</span>
              <span className="rounded-md bg-gold/20 px-2 py-0.5 text-[10px] font-black uppercase text-gold">
                {activeMode === "attendant" ? "Selling Fuel (Attendant)" : "Station Manager"}
              </span>
            </div>
            <p className="text-[11px] text-ink-500">
              Toggle between managerial tasks and dispensing fuel directly on the pump terminal:
            </p>
            <div className="flex rounded-2xl bg-[var(--surface-muted)] p-1 border border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => {
                  switchToPumpMode();
                  router.push("/");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  activeMode === "attendant"
                    ? "bg-gold text-ink-gold shadow-sm"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                <Fuel size={14} />
                <span>Sell Fuel (Pump Mode)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  switchToManagerMode();
                  router.push("/manager");
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  activeMode === "manager"
                    ? "bg-[var(--surface-raised)] text-ink shadow-sm"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                <Briefcase size={14} />
                <span>Manager Mode</span>
              </button>
            </div>
          </div>
        )}

        {/* Shift status for attendants */}
        {!isManager && attendant && (
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
        )}
      </section>

      {/* Link to Station Manager Portal */}
      {isManager && (
        <Link
          href="/manager"
          className="home-card flex items-center justify-between p-4 hover:border-gold/50 transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Station Manager Section</h3>
              <p className="text-xs text-ink-500">Commission attendants, view sales reports & withdraw funds</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-500" />
        </Link>
      )}

      {/* Station Assignment */}
      <section className="home-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-bold text-ink">Assigned Petrol Station</h3>
          </div>
          <Link href="/stations" className="text-xs font-bold text-gold hover:underline">
            Browse all →
          </Link>
        </div>

        <div className="field-box px-3 py-1">
          <select
            value={outlet?.id ?? ""}
            onChange={(e) => selectOutlet(e.target.value)}
            className="min-h-11 w-full text-xs font-bold text-ink bg-transparent outline-none cursor-pointer"
          >
            {outlets.map((o) => (
              <option key={o.id} value={o.id} className="text-black bg-white">
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
        className="home-card flex items-center justify-between p-4 hover:border-gold/50 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold">
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
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 font-bold text-red-500 transition hover:bg-red-500/20 active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out of Station</span>
      </button>
    </div>
  );
}
