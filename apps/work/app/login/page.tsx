"use client";

import { KeyRound, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pt-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLogo wordmark={false} />
        <div>
          <h1 className="text-xl font-black text-ink">Peebee Work</h1>
          <p className="mt-1 text-xs font-medium text-ink-500">Cleaning, repair and laundry jobs near you. Sign in to take work.</p>
        </div>
      </div>

      <form onSubmit={submit} className="home-card space-y-4 p-5">
        {error && <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div>}
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Phone number or email</span>
          <div className="field-box flex items-center gap-2 px-3 py-2.5">
            <Phone className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            <input required autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Password</span>
          <div className="field-box flex items-center gap-2 px-3 py-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
          </div>
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-2xl bg-gold py-3 text-sm font-black text-ink-gold shadow transition active:scale-[0.98] disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-xs font-medium text-ink-500">
        New to Peebee?{" "}
        <Link href="/signup" className="font-black text-gold hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
