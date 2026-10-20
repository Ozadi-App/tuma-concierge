"use client";

import type { GuestTrack, GuestTrackStatus } from "@peebee/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { loadGuestSessions, tidyCode } from "../../../lib/guest";

const STATUS_TEXT: Record<GuestTrackStatus, string> = {
  received: "We have your order and are arranging the delivery.",
  preparing: "A rider is collecting your order.",
  on_the_way: "Your package is on its way.",
  arrived: "Your rider has arrived.",
  delivered: "Your order has been delivered.",
  cancelled: "This order was cancelled.",
};

export function GuestTrackClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { setSession } = useAuth();
  const [code, setCode] = useState(tidyCode(params.get("code") ?? ""));
  const [track, setTrack] = useState<GuestTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);

  async function lookup(value = code) {
    setBusy(true);
    setError(null);
    setTrack(null);
    try {
      setTrack(await api.guestTrack(value));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fromLink = tidyCode(params.get("code") ?? "");
    if (fromLink.length >= 8) void lookup(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = track ? loadGuestSessions().find((s) => s.trackingCode === track.trackingCode) : null;

  async function createAccount() {
    if (!track) return;
    setBusy(true);
    setAccountError(null);
    try {
      const res = await api.guestCreateAccount(track.trackingCode, phone, password);
      setSession(res.token, res.user);
      router.push("/track");
    } catch (err) {
      setAccountError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-24 pt-6 text-ink">
      <h1 className="text-2xl font-black">Track your order</h1>
      <form onSubmit={(e) => { e.preventDefault(); void lookup(); }} className="space-y-3">
        <label className="block space-y-1 text-sm font-semibold">Tracking code
          <input value={code} onChange={(e) => setCode(tidyCode(e.target.value))} placeholder="PB-XXXXXXXX" autoCapitalize="characters" autoComplete="off" className="min-h-12 w-full rounded-xl px-3 text-base font-normal tracking-wider" />
        </label>
        <button type="submit" disabled={busy || code.length < 11} className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-ink-gold disabled:opacity-50">{busy ? "Looking…" : "Find my order"}</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {track && (
        <section className="home-card space-y-3" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Order {track.trackingCode}</p>
          {track.status ? (
            <>
              {track.item && <p className="font-bold">{track.item}</p>}
              <p className="text-sm">{STATUS_TEXT[track.status]}</p>
            </>
          ) : (
            <p className="text-sm text-ink-500">To follow this order live, sign in. You will also get updates by message as it moves.</p>
          )}
          {mine && <Link href={`/guest/order/${mine.orderId}`} className="flex min-h-12 items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-ink-gold">Open my order</Link>}
        </section>
      )}

      {track?.hasAccount && <Link href="/login" className="flex min-h-12 items-center justify-center rounded-full border border-gold px-6 text-sm font-bold">Sign in to track</Link>}
      {track?.canCreateAccount && (
        <section className="home-card space-y-3" aria-label="Create an account">
          <h2 className="text-lg font-bold">Create an account to track</h2>
          <p className="text-sm text-ink-500">Enter the phone number you ordered with and choose a password.</p>
          <label className="block space-y-1 text-sm font-semibold">Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className="min-h-12 w-full rounded-xl px-3 text-base font-normal" />
          </label>
          <label className="block space-y-1 text-sm font-semibold">Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="min-h-12 w-full rounded-xl px-3 text-base font-normal" />
          </label>
          {accountError && <p role="alert" className="text-sm text-red-700">{accountError}</p>}
          <button type="button" onClick={() => void createAccount()} disabled={busy || password.length < 8 || phone.replace(/\D/g, "").length < 9} className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-ink-gold disabled:opacity-50">Create my account</button>
        </section>
      )}
    </div>
  );
}
