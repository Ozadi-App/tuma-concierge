"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function SignUpPage() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() && !email.trim()) {
      setError("Enter a phone number or an email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLogo wordmark={false} />
        <div>
          <h1 className="text-xl font-black text-ink">Create your account</h1>
          <p className="mt-1 text-xs font-medium text-ink-500">Already have a Peebee account? <Link href="/login" className="font-black text-gold hover:underline">Sign in</Link> instead.</p>
        </div>
      </div>

      <form onSubmit={submit} className="home-card space-y-4 p-5">
        {error && <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600" role="alert">{error}</div>}
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Your name</span>
          <input required minLength={1} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Phone number</span>
          <input type="tel" autoComplete="tel" placeholder="+256 7…" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Email (optional)</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink-500">Password</span>
          <input required type="password" minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full text-sm font-medium text-ink outline-none" />
        </label>
        <button type="submit" disabled={busy} className="w-full rounded-2xl bg-gold py-3 text-sm font-black text-ink-gold shadow transition active:scale-[0.98] disabled:opacity-50">
          {busy ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
