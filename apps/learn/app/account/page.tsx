"use client";

import { useState } from "react";
import {
  UserRound,
  CreditCard,
  Moon,
  Sun,
  Laptop,
  Bell,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Building,
  CheckCircle2,
} from "lucide-react";
import { useLearnAuth } from "@/lib/auth-context";
import { DEMO_TUITION_INVOICE, DEMO_INSTITUTIONS } from "@peebee/shared";

export default function LearnAccountPage() {
  const { user, activeStream, setActiveStream, logout } = useLearnAuth();
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");
  const [tuitionBalance, setTuitionBalance] = useState(DEMO_TUITION_INVOICE.balanceUgx);
  const [paySuccessNotice, setPaySuccessNotice] = useState<string | null>(null);

  const handleThemeChange = (newTheme: "light" | "dark" | "auto") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("peebee-theme", newTheme);
      let effective = newTheme;
      if (newTheme === "auto") {
        const hour = new Date().getHours();
        effective = hour >= 6 && hour < 19 ? "light" : "dark";
      }
      document.documentElement.setAttribute("data-theme", effective);
    } catch {}
  };

  const handlePayInstallment = () => {
    const installmentAmount = 100000;
    const nextBalance = Math.max(0, tuitionBalance - installmentAmount);
    setTuitionBalance(nextBalance);
    setPaySuccessNotice("Payment of UGX 100,000 received via MTN Mobile Money! Receipt #REC_PB_849201 generated.");
    setTimeout(() => setPaySuccessNotice(null), 5000);
  };

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-gold">
          Account & Institutional Records
        </p>
        <h1 className="text-xl font-black text-ink">Student Profile & Settings</h1>
      </div>

      {paySuccessNotice && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-500/15 p-3 text-xs font-bold text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <span>{paySuccessNotice}</span>
        </div>
      )}

      {/* Student Profile Card */}
      <section className="home-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/20 text-gold text-xl font-black">
            {user?.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-ink">{user?.name}</h2>
            <p className="text-xs text-ink-500">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-bold">
              <span className="font-mono text-gold">ID: PB-STU-2026-092</span>
              <span>•</span>
              <span className="capitalize text-ink-500">{activeStream} Track</span>
            </div>
          </div>
        </div>

        {/* Enrolled School */}
        <div className="mt-4 rounded-xl border border-[var(--border-faint)] bg-cream-50/50 p-3 text-xs dark:bg-black/30">
          <div className="flex items-center gap-2 text-ink-500 font-bold">
            <Building className="h-4 w-4 text-gold" />
            <span>Enrolled Institution:</span>
          </div>
          <p className="mt-1 font-black text-ink">{DEMO_INSTITUTIONS[0].name}</p>
          <p className="text-[10px] text-ink-500">{DEMO_INSTITUTIONS[0].address} • MoES Accredited</p>
        </div>
      </section>

      {/* Tuition & Billing Overview */}
      <section className="home-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-black text-ink">Term Tuition & Fee Schedule</h2>
          </div>
          <span className="rounded bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold uppercase">
            {DEMO_TUITION_INVOICE.termName}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-[var(--border-faint)] p-3">
            <p className="text-[10px] text-ink-500">Total Term Tuition</p>
            <p className="text-sm font-black text-ink">
              UGX {DEMO_TUITION_INVOICE.totalTuitionUgx.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-faint)] p-3">
            <p className="text-[10px] text-ink-500">Remaining Balance</p>
            <p className="text-sm font-black text-red-600 dark:text-red-400">
              UGX {tuitionBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {tuitionBalance > 0 && (
          <button
            onClick={handlePayInstallment}
            className="w-full rounded-2xl bg-gold px-4 py-2.5 text-xs font-black text-black shadow-sm transition hover:opacity-90 active:scale-95"
          >
            Pay Next Installment (UGX 100,000 via MoMo)
          </button>
        )}
      </section>

      {/* Appearance Theme Switcher */}
      <section className="home-card p-5 space-y-3">
        <h2 className="text-sm font-black text-ink">Appearance & Theme</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleThemeChange("light")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition ${
              theme === "light"
                ? "border-gold bg-gold/10 text-gold font-black"
                : "border-[var(--border-faint)] text-ink-500 hover:text-ink"
            }`}
          >
            <Sun className="h-5 w-5" />
            <span>Light</span>
          </button>

          <button
            onClick={() => handleThemeChange("dark")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition ${
              theme === "dark"
                ? "border-gold bg-gold/10 text-gold font-black"
                : "border-[var(--border-faint)] text-ink-500 hover:text-ink"
            }`}
          >
            <Moon className="h-5 w-5" />
            <span>Dark</span>
          </button>

          <button
            onClick={() => handleThemeChange("auto")}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition ${
              theme === "auto"
                ? "border-gold bg-gold/10 text-gold font-black"
                : "border-[var(--border-faint)] text-ink-500 hover:text-ink"
            }`}
          >
            <Laptop className="h-5 w-5" />
            <span>Auto</span>
          </button>
        </div>
      </section>

      {/* Sign Out Button */}
      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 p-3 text-xs font-bold text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
      >
        <LogOut className="h-4 w-4" />
        <span>Switch Account or Sign Out</span>
      </button>
    </div>
  );
}
