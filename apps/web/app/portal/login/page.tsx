"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { portalFetch, PortalError, setToken } from "../../../lib/portal";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await portalFetch<{ token: string }>("/auth/login", { method: "POST", auth: false, body: { identifier: identifier.trim(), password } });
      setToken(r.token);
      router.push("/portal/dashboard");
    } catch (err) {
      setError((err as PortalError).message);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-8 max-w-md space-y-4">
      <h1 className="text-2xl font-black text-ink">Sign in</h1>
      <p className="text-sm text-ink-500">Use the same phone or email and password as your Peebee account.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Phone or email</span>
        <input required autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl p-3" />
      </label>
      <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Password</span>
        <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl p-3" />
      </label>
      <button disabled={busy} className="button button-primary w-full disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm text-ink-500">New here? <Link href="/portal/register" className="font-bold text-gold">Register your business</Link></p>
    </form>
  );
}
