"use client";

import { Building2, KeyRound, ShieldCheck, UserCheck, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { PWA_LOGIN_PROMPT_KEY } from "../../components/PwaInstallPrompt";
import { SESSION_START_KEY } from "../../components/PracticeProposalPrompt";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginManager, outlets } = useAuth();
  const [selectedRole, setSelectedRole] = useState<"attendant" | "manager">("attendant");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PWA_LOGIN_PROMPT_KEY, "1");
        sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
      }
      if (selectedRole === "manager") {
        await loginManager(code.trim().toUpperCase() || undefined, pin.trim() || undefined, selectedOutletId || undefined);
        router.push("/manager");
      } else {
        if (!code.trim()) {
          setError("Please enter your attendant badge code.");
          setBusy(false);
          return;
        }
        await login(code.trim().toUpperCase(), pin.trim() || undefined, selectedOutletId || undefined);
        router.push("/");
      }
    } catch (err) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PWA_LOGIN_PROMPT_KEY);
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6 pb-12">
      {/* Brand Hero Header with Peebee Logo */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <BrandLogo wordmark={false} className="justify-center" />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <h1 className="text-2xl font-black tracking-tight text-ink">Peebee</h1>
          <span className="rounded-md bg-gold/20 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-gold">
            Gas
          </span>
        </div>
        <p className="text-xs font-medium text-ink-500">
          Petrol Station Terminal & Management System
        </p>
      </div>

      {/* Role Selector: Attendant vs Station Manager */}
      <div className="flex rounded-2xl bg-[var(--surface-muted)] p-1 border border-[var(--border-faint)]">
        <button
          type="button"
          onClick={() => {
            setSelectedRole("attendant");
            setCode("");
            setError(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
            selectedRole === "attendant"
              ? "bg-[var(--surface-raised)] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Pump Attendant</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedRole("manager");
            setCode("");
            setError(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
            selectedRole === "manager"
              ? "bg-[var(--surface-raised)] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>Station Manager</span>
        </button>
      </div>

      {/* Login Card */}
      <form onSubmit={handleLogin} className="home-card space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-ink-500">Petrol Station Outlet</label>
          <div className="field-box mt-1.5 flex items-center gap-2 px-3 py-2">
            <Building2 className="h-4 w-4 text-ink-500 shrink-0" />
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full text-xs font-bold text-ink bg-transparent outline-none cursor-pointer"
            >
              <option value="">
                {selectedRole === "manager" ? "Select Petrol Station" : "Auto-detect from Attendant Badge"}
              </option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-500">
            {selectedRole === "manager" ? "Station Manager Code" : "Attendant Badge Code"}
          </label>
          <div className="field-box mt-1.5 flex items-center gap-2 px-3 py-2">
            {selectedRole === "manager" ? (
              <Briefcase className="h-4 w-4 text-ink-500 shrink-0" />
            ) : (
              <UserCheck className="h-4 w-4 text-ink-500 shrink-0" />
            )}
            <input
              required={selectedRole === "attendant"}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={selectedRole === "manager" ? "e.g. MGR-TOT-01 (or leave blank if outlet selected)" : "e.g. ATT-1001"}
              className="w-full text-xs font-bold uppercase text-ink outline-none"
            />
          </div>
          {selectedRole === "manager" && (
            <p className="mt-1 text-[11px] text-ink-500">
              Demo codes: <span className="font-mono font-bold text-ink">MGR-TOT-01</span>, <span className="font-mono font-bold text-ink">MGR-SHL-02</span>
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-ink-500">
            {selectedRole === "manager" ? "Station Manager PIN" : "Station Staff PIN"}
          </label>
          <div className="field-box mt-1.5 flex items-center gap-2 px-3 py-2">
            <KeyRound className="h-4 w-4 text-ink-500 shrink-0" />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-xs font-bold text-ink outline-none"
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Default station terminal PIN: <span className="font-mono font-bold text-ink">1234</span>
          </p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-gold py-3.5 text-center text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy
            ? "Verifying Credentials…"
            : selectedRole === "manager"
              ? "Open Station Manager Portal"
              : "Start Fuel Shift"}
        </button>
      </form>

      {/* Staff Practice Link */}
      <div className="text-center">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gold hover:underline"
        >
          <span>Need training? Open Attendant Practice Mode &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
