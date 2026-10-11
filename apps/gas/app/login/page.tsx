"use client";

import { Fuel, KeyRound, Phone, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await login(code, name);
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  function handleDemoLogin(attCode: string, attName: string) {
    setCode(attCode);
    setName(attName);
    void login(attCode, attName).then(() => router.push("/"));
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      {/* Brand Hero */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gold text-ink-gold shadow-md">
          <Fuel className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-black text-ink">Peebee Gas</h1>
        <p className="text-xs text-ink-500">
          Petrol Station Merchant & Pump Attendant Portal
        </p>
      </div>

      {/* Login Card */}
      <form onSubmit={handleLogin} className="home-card space-y-4">
        <div>
          <label className="text-xs font-bold text-ink-500">Attendant Badge Code</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <UserCheck className="h-4 w-4 text-ink-500" />
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
          <label className="text-xs font-bold text-ink-500">Attendant Name (Optional)</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kato Dennis"
              className="w-full text-xs font-semibold text-ink outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-ink-500">Station PIN</label>
          <div className="field-box mt-1 flex items-center gap-2 px-3 py-1">
            <KeyRound className="h-4 w-4 text-ink-500" />
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
          className="min-h-12 w-full rounded-2xl bg-gold font-bold text-ink-gold shadow transition hover:opacity-95"
        >
          {busy ? "Signing in…" : "Sign In to Pump Lane"}
        </button>

        {/* Quick Demo Sign In Chips */}
        <div className="border-t border-[var(--border-faint)] pt-3 text-center space-y-2">
          <span className="text-[11px] font-semibold text-ink-500">Fast Demo Sign In:</span>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin("ATT-1001", "Kato Dennis")}
              className="rounded-lg bg-gold/15 px-2.5 py-1 text-xs font-bold text-ink hover:bg-gold/25"
            >
              Kato (Total)
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin("ATT-1002", "Nakato Sarah")}
              className="rounded-lg bg-gold/15 px-2.5 py-1 text-xs font-bold text-ink hover:bg-gold/25"
            >
              Sarah (Shell)
            </button>
          </div>
        </div>
      </form>

      {/* Station Registration Link */}
      <div className="text-center text-xs text-ink-500">
        New petrol station dealer?{" "}
        <Link href="/apply" className="font-bold text-gold hover:underline">
          Register station here →
        </Link>
      </div>
    </div>
  );
}
