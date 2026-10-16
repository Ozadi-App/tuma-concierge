"use client";

import type { AvailableJob } from "@peebee/shared";
import { HandCoins, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useTranslate } from "../lib/i18n";
import { formatUgx } from "../lib/order-display";

const STEP = 500;

function secondsLeft(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Name your fare on a rider's job card: the customer's offer against the
 * app's fare, and a counter control. Accepting at the offer is the card's
 * normal Claim/Apply button (its label becomes "Accept UGX X").
 */
export function FareOfferPanel({
  job,
  online,
  onChanged,
}: {
  job: AvailableJob & { fareOffer: NonNullable<AvailableJob["fareOffer"]> };
  online: boolean;
  onChanged: () => void;
}) {
  const t = useTranslate();
  const offer = job.fareOffer;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => Math.min(offer.max, offer.amount + 1000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const minCounter = offer.amount + STEP;
  const clamp = (n: number) => Math.min(offer.max, Math.max(minCounter, Math.round(n / STEP) * STEP));
  const mine = offer.myCounter;
  const mineLeft = secondsLeft(mine?.expiresAt, now);
  const offerLeft = secondsLeft(offer.expiresAt, now);
  const canCounter = !offer.expired && (offerLeft == null || offerLeft > 0) && minCounter <= offer.max;
  const diff = offer.amount - offer.quote;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.counterFareOffer(job.id, clamp(amount), `counter-${job.id}-${clamp(amount)}`);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-gold/30 bg-gold/10 p-3">
      <div className="flex items-start gap-2">
        <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-gold" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-ink">{t("offer_customer_offers", { price: formatUgx(offer.amount) })}</p>
          <p className="text-xs text-ink-500">
            {t("offer_app_fare", { price: formatUgx(offer.quote) })}
            {diff !== 0 && (
              <span className={diff < 0 ? "" : "font-semibold text-green"}> · {diff < 0 ? "−" : "+"}{formatUgx(Math.abs(diff))}</span>
            )}
            {canCounter && offerLeft != null && <span> · {clock(offerLeft)}</span>}
          </p>
        </div>
      </div>

      {mine && mineLeft != null && mineLeft > 0 ? (
        <p className="rounded-lg bg-[rgb(var(--surface))] px-3 py-2 text-sm font-semibold text-ink" role="status">
          {t("offer_counter_waiting", { price: formatUgx(mine.amount) })} · {clock(mineLeft)}
        </p>
      ) : !canCounter ? (
        <p className="text-xs text-ink-500">{t("offer_closed")}</p>
      ) : open ? (
        <div className="space-y-2">
          <label htmlFor={`counter-${job.id}`} className="text-xs font-semibold text-ink-500">{t("offer_counter_amount")}</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("offer_lower")}
              onClick={() => setAmount((a) => clamp(a - STEP))}
              disabled={clamp(amount) <= minCounter}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <input
              id={`counter-${job.id}`}
              inputMode="numeric"
              value={String(amount)}
              onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
              onBlur={() => setAmount((a) => clamp(a))}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border-faint)] px-3 text-center text-base font-bold tabular-nums text-ink outline-none focus:border-gold"
            />
            <button
              type="button"
              aria-label={t("offer_higher")}
              onClick={() => setAmount((a) => clamp(a + STEP))}
              disabled={clamp(amount) >= offer.max}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="text-xs text-ink-500">{t("offer_counter_range", { max: formatUgx(offer.max) })}</p>
          <button
            type="button"
            onClick={send}
            disabled={busy || !online}
            className="min-h-12 w-full rounded-xl bg-gradient-to-r from-[#f3d27a] to-gold px-3 text-sm font-bold text-ink-gold disabled:opacity-60"
          >
            {t("offer_send_counter", { price: formatUgx(clamp(amount)) })}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!online}
          className="min-h-11 w-full rounded-xl border border-gold/50 bg-[rgb(var(--surface))] px-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {t("offer_counter")}
        </button>
      )}
      {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
    </div>
  );
}
