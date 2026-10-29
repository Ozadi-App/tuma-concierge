"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { formatUgx } from "../lib/order-display";

type Discount = Awaited<ReturnType<typeof api.getRiderDiscountWallet>>;
type Incentives = Awaited<ReturnType<typeof api.getRiderIncentives>>;

/**
 * Two cards under the wallet balance: the discount wallet (what customers' offers owe the rider, settled against Peebee's
 * commission) and the incentives on offer. Each shows only when an admin has it switched on and it applies to this rider.
 */
export function RiderEarningsExtras() {
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [incentives, setIncentives] = useState<Incentives | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.getRiderDiscountWallet(), api.getRiderIncentives()]).then(([d, i]) => {
      if (!alive) return;
      if (d.status === "fulfilled") setDiscount(d.value);
      if (i.status === "fulfilled") setIncentives(i.value);
    });
    return () => { alive = false; };
  }, []);

  async function ask() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.requestRiderDiscountPayout();
      setMessage(res.paid > 0 ? `${formatUgx(res.paid)} added to your wallet.` : `${formatUgx(res.queued)} will be sent to your mobile money.`);
      setDiscount(await api.getRiderDiscountWallet());
    } catch (err) { setMessage(errorMessage(err)); }
    finally { setBusy(false); }
  }

  const showDiscount = !!discount?.enabled && (discount.balance > 0 || discount.ledger.length > 0);
  const showIncentives = !!incentives?.enabled && (incentives.active.length > 0 || incentives.earnedThisMonth > 0);
  if (!showDiscount && !showIncentives) return null;

  return (
    <div className="space-y-4">
      {showDiscount && discount && (
        <section className="home-card space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Discount wallet</p>
          <p className="text-2xl font-bold text-ink">{formatUgx(discount.balance)}</p>
          <p className="text-sm text-ink-500">
            When a customer rides with an offer, what you would have lost is added here.
            {discount.offsetsCommission ? " Peebee's commission on your next rides is taken from it first, so you keep more of each fare." : ""}
            {discount.payoutMethod === "active_wallet" ? " Whatever is left is added to your wallet." : discount.payoutMethod === "mobile_money" ? " Whatever is left is sent to your mobile money." : ""}
          </p>
          {discount.canRequest && <button type="button" onClick={() => void ask()} disabled={busy} className="rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-50">{busy ? "Please wait…" : "Pay me now"}</button>}
          {discount.requestPending && <p className="text-sm text-ink-500">Your payout request is on its way.</p>}
          {message && <p className="text-sm text-ink-500" role="status">{message}</p>}
          {discount.ledger.length > 0 && (
            <>
              <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-ink-500">{open ? "Hide history" : "Show history"}</button>
              {open && (
                <ul className="space-y-1 text-xs text-ink-500">
                  {discount.ledger.slice(0, 10).map((l, i) => <li key={i}>{l.amount > 0 ? "+" : ""}{formatUgx(l.amount)} · {l.note ?? l.type.replace("_", " ")}</li>)}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {showIncentives && incentives && (
        <section className="home-card space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bonuses you can earn</p>
          {incentives.earnedThisMonth > 0 && <p className="text-sm text-ink">You earned <strong>{formatUgx(incentives.earnedThisMonth)}</strong> in bonuses this month.</p>}
          <ul className="space-y-2">
            {incentives.active.map((a) => (
              <li key={a.kind} className="text-sm"><p className="font-bold text-ink">{a.label}</p><p className="text-ink-500">{a.detail}</p></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
