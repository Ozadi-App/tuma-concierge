"use client";

import type { FareCounter, FareOffer, OrderRow } from "@peebee/shared";
import { Check, ShieldCheck, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { formatUgx } from "../../lib/ride-home";

function secondsLeft(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * While a Name-your-fare request is open: the live offer, riders' counters
 * (accept / decline), raise the offer, or switch to the app fare. A rider who
 * accepts the offer as-is simply takes the ride — the home then moves on to
 * "Pay to confirm".
 */
export function OfferLivePanel({
  order,
  offer,
  counters,
  onChanged,
}: {
  order: OrderRow;
  offer: FareOffer;
  counters: FareCounter[];
  onChanged: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = secondsLeft(offer.expiresAt, now);
  const open = counters.filter((c) => (secondsLeft(c.expires_at, now) ?? 1) > 0);
  const raises = [500, 1000, 2000].map((d) => offer.amount + d).filter((a) => a <= offer.max);
  const canRaise = offer.raisesLeft > 0;

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Your fare offer" className="ride-offer-live space-y-3 rounded-[22px] p-3.5">
      <div className="flex items-start gap-3">
        <span className="ride-live-dot mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-ink-500">Your offer{order.destination_area ? ` · to ${order.destination_area}` : ""}</span>
          <span className="block text-[26px] font-extrabold leading-tight tracking-tight tabular-nums text-ink">{formatUgx(offer.amount)}</span>
          <span className="block text-xs text-ink-500" role="status" aria-live="polite">
            {open.length > 0
              ? `${open.length} rider${open.length === 1 ? "" : "s"} countered · or wait for one to accept`
              : offer.expired || left === 0
                ? "Counters closed — raise your offer or use the app fare"
                : `Riders nearby can accept or counter${left != null ? ` · ${clock(left)}` : ""}`}
          </span>
        </span>
        <span className="shrink-0 text-right text-[11px] font-semibold text-ink-500">App fare<br /><span className="text-[13px] font-bold text-ink">{formatUgx(offer.quote)}</span></span>
      </div>

      {open.length > 0 && (
        <ul className="space-y-2" aria-label="Counters from riders">
          {open.map((c) => {
            const s = secondsLeft(c.expires_at, now);
            const name = c.rider_name ?? "A rider";
            return (
              <li key={c.id} className="ride-counter flex items-center gap-3 rounded-2xl p-2.5">
                <span className="ride-trip-card__avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">{name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[14px] font-bold text-ink">
                    <span className="truncate">{name}</span>
                    {!!c.rider_verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green" aria-label="Verified" />}
                    {c.rider_rating != null && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-ink-500"><Star className="h-3 w-3" aria-hidden />{Number(c.rider_rating).toFixed(1)}</span>}
                  </span>
                  <span className="block text-xs text-ink-500">
                    <b className="tabular-nums text-ink">{formatUgx(c.amount)}</b> · +{formatUgx(c.amount - offer.amount).replace("UGX ", "")}{s != null ? ` · ${clock(s)}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void act(`d-${c.id}`, () => api.decideFeeProposal(order.id, c.id, false))}
                  disabled={!!busy}
                  aria-label={`Decline ${name}'s counter of ${formatUgx(c.amount)}`}
                  className="ride-icon-btn"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void act(`a-${c.id}`, () => api.decideFeeProposal(order.id, c.id, true))}
                  disabled={!!busy}
                  className="ride-accept-btn flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-extrabold"
                  aria-label={`Accept ${name} at ${formatUgx(c.amount)}`}
                >
                  <Check className="h-4 w-4" aria-hidden />{busy === `a-${c.id}` ? "…" : "Accept"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canRaise && (
        <div>
          <p className="mb-1.5 text-xs font-bold text-ink-500">Raise your offer</p>
          <div className="flex flex-wrap gap-2">
            {raises.map((a) => (
              <button key={a} type="button" disabled={!!busy} onClick={() => void act(`r-${a}`, () => api.raiseFareOffer(order.id, { amount: a }, `raise-${order.id}-${a}`))} className="ride-chip">
                {formatUgx(a)}
              </button>
            ))}
            {offer.amount < offer.quote && (
              <button type="button" disabled={!!busy} onClick={() => void act("std", () => api.raiseFareOffer(order.id, { standard: true }, `raise-${order.id}-std`))} className="ride-chip is-on">
                App fare {formatUgx(offer.quote)}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-500">Nothing is charged until you accept a rider.</span>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void act("cancel", () => api.customerCancelOrder(order.id))}
          className="min-h-10 shrink-0 rounded-full px-3 text-xs font-bold text-ink-500 underline-offset-2 hover:underline"
        >
          Cancel request
        </button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[rgb(var(--color-red,200_40_40))]">{error}</p>}
    </section>
  );
}
