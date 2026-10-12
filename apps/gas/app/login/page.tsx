"use client";

import { Building2, Fuel, KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, outlets } = useAuth();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter your attendant badge code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(code.trim().toUpperCase(), pin.trim(), selectedOutletId || undefined);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      {/* Brand Hero */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gold text-ink-gold shadow-md">
          <Fuel className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-black text-ink">Peebee Gas</h1>
        <p className="text-xs text-ink-500">
          Petrol Station Merchant & Pump Attendant Terminal
        </p>
      </div>

      {/* Login Card */}
      <form onSubmit={handleLogin} className="home-card space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-ink-500">Petrol Station Outlet</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <Building2 className="h-4 w-4 text-ink-500 shrink-0" />
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full text-xs font-bold text-ink bg-transparent outline-none cursor-pointer"
            >
              <option value="">Select Station (Auto-detect from badge)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-500">Attendant Badge Code</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <UserCheck className="h-4 w-4 text-ink-500 shrink-0" />
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ATT-1001"
              className="w-full text-xs font-bold uppercase text-ink outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-500">Station Staff PIN</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <KeyRound className="h-4 w-4 text-ink-500 shrink-0" />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-xs font-bold text-ink outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-2xl bg-gold font-bold text-ink-gold shadow transition hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign In to Pump Terminal"}
        </button>

        <div className="border-t border-[var(--border-faint)] pt-3 text-center">
          <Link href="/apply" className="text-xs font-semibold text-gold hover:underline">
            Register a new petrol station on Peebee →
          </Link>
        </div>
      </form>

      <div className="flex items-center justify-center gap-2 text-center text-[11px] text-ink-500">
        <ShieldCheck className="h-3.5 w-3.5 text-green" />
        <span>Connected to live Peebee Gas Network</span>
      </div>
    </div>
  );
}
