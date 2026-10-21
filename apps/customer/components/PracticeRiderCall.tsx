"use client";

import { isPracticeMode } from "@peebee/shared";
import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";

const seenKey = (orderId: string) => `peebee_practice_rider_call_${orderId}`;

/**
 * Practice mode only: when the practice rider (or driver) reaches the door or the pickup point they ring the
 * customer, as a real one would. Nothing is dialled; it is a screen, so the arrival moment can be tried with your own account.
 */
export function PracticeRiderCall({ orderId, stage, riderName, isRide }: { orderId: string; stage: string; riderName: string | null; isRide: boolean }) {
  const [open, setOpen] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (stage !== "Arrived" || !isPracticeMode()) return;
    let seen = false;
    try { seen = window.sessionStorage.getItem(seenKey(orderId)) === "1"; } catch { /* storage blocked: ring once per visit */ }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [orderId, stage]);

  function close() {
    try { window.sessionStorage.setItem(seenKey(orderId), "1"); } catch { /* ring again next visit */ }
    setOpen(false);
  }

  if (!open) return null;
  const name = riderName ?? (isRide ? "Your driver" : "Your rider");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="alertdialog" aria-live="assertive" aria-label={`Incoming call from ${name}`}>
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-[rgb(var(--surface-card))] p-6 text-center shadow-xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold"><Phone className={`h-7 w-7 ${answered ? "" : "animate-pulse"}`} aria-hidden /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{answered ? "On a call (practice)" : "Incoming call (practice)"}</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{name}</h2>
          <p className="text-sm text-ink-500">{isRide ? "Your Peebee driver" : "Your Peebee rider"}</p>
        </div>
        {answered ? (
          <p className="rounded-xl bg-[rgb(var(--surface-muted))] p-3 text-sm text-ink">{isRide ? <>&ldquo;Hello, I&apos;ve arrived at your pickup point. I&apos;m waiting for you outside.&rdquo;</> : <>&ldquo;Hello, your order has arrived. I&apos;m at the gate. Please come and receive it and give me your PIN.&rdquo;</>}</p>
        ) : (
          <p className="text-sm text-ink-500">{isRide ? "Your driver has arrived." : "Your order has arrived."}</p>
        )}
        <div className="flex gap-3">
          {answered ? (
            <button type="button" onClick={close} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold font-bold text-ink-gold"><PhoneOff className="h-4 w-4" aria-hidden /> End call</button>
          ) : (
            <>
              <button type="button" onClick={close} className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] font-bold text-ink">Decline</button>
              <button type="button" onClick={() => setAnswered(true)} className="min-h-12 flex-1 rounded-full bg-gold font-bold text-ink-gold">Answer</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
