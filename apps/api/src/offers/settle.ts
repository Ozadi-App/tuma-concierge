/**
 * What happens to offers, the discount wallet and incentives when a ride is settled. One entry point, called from the
 * settle handler, that never throws: a problem here is logged and must never stop a rider being paid.
 */
import { commissionWaivePercent, discountCompensation } from "@peebee/shared";
import { db } from "../db/client.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { getDiscountWalletConfig, getIncentiveConfig, getOffersConfig } from "./config.js";
import { hasTable } from "../lib/schema.js";
import { accrueDiscount, offsetCommission, type WalletHolder } from "./discount-wallet.js";
import { awardsForSettledRide, riderFacts } from "./incentives.js";
import { grantCredit } from "./credit.js";
import { offersAvailable, serviceOfOrder } from "./service.js";

type Row = Record<string, unknown>;

export type SettleOutcome = {
  /** Commission the rider is excused (holiday plus discount-wallet offset): add this to what they keep. */
  commissionRelief: number;
  /** Paid into the discount wallet for this ride. */
  compensation: number;
  notes: string[];
};

const NOTHING: SettleOutcome = { commissionRelief: 0, compensation: 0, notes: [] };

/**
 * `commission` is what Peebee takes from this ride from the rider's side (UGX). The returned `commissionRelief` is how much
 * of it the rider is excused. The caller decides where that money goes, because each payout path differs.
 */
export async function settleOffersForOrder(order: Row, commission: number): Promise<SettleOutcome> {
  try {
    if (!order.rider_id) return NOTHING;
    const now = new Date();
    const riderId = String(order.rider_id);
    const env: PlatformEnvironment = order.environment === "sandbox" ? "sandbox" : "live";
    const orderId = String(order.id);
    const meta = await serviceOfOrder(order);
    const holder: WalletHolder = meta.vehicle === "car" ? "driver" : "rider";
    const out: SettleOutcome = { commissionRelief: 0, compensation: 0, notes: [] };

    // 1. Customer offers on this ride: compensate the rider, return cashback to the customer.
    if (await offersAvailable()) {
      const held = await db.execute({ sql: "SELECT * FROM offer_redemptions WHERE order_id = ? AND status IN ('pending', 'applied')", args: [orderId] });
      const rows = held.rows as Row[];
      if (rows.length > 0) {
        const cfg = await getDiscountWalletConfig();
        const fullFare = Math.max(...rows.map((r) => Number(r.full_fare)), 0);
        const platformDiscount = rows.filter((r) => r.funder !== "rider").reduce((s, r) => s + Number(r.discount), 0);
        const riderFunded = rows.some((r) => r.funder === "rider") && platformDiscount === 0;
        const compensation = discountCompensation(cfg, {
          vehicle: meta.vehicle, fullFare, paid: Math.max(0, fullFare - platformDiscount), minimumFare: meta.minimumFare, funder: riderFunded ? "rider" : "platform",
        });
        if (compensation > 0) {
          out.compensation = await accrueDiscount({ holder, id: riderId, amount: compensation, env, orderId });
          if (out.compensation > 0) out.notes.push(`${out.compensation.toLocaleString("en-UG")} added to the rider discount wallet`);
        }
        for (const r of rows) {
          const share = compensation > 0 && platformDiscount > 0 && r.funder !== "rider" ? Math.floor((compensation * Number(r.discount)) / platformDiscount) : 0;
          await db.execute({ sql: "UPDATE offer_redemptions SET status = 'settled', rider_compensation = ?, updated_at = datetime('now') WHERE id = ?", args: [share, String(r.id)] });
          if (Number(r.cashback) > 0) {
            await grantCredit({ userId: String(r.user_id), amount: Number(r.cashback), kind: "cashback", env, orderId, note: "Ride cashback" });
          }
        }
      }
    }

    // 2. Commission: the new-rider holiday first, then the discount wallet settles what is left.
    if (commission > 0) {
      const incentives = await getIncentiveConfig();
      const facts = await riderFacts(riderId, env, now, incentives.tzOffsetMinutes);
      const waive = commissionWaivePercent(incentives, facts, now);
      const holiday = Math.floor((commission * waive) / 100);
      const offset = await offsetCommission({ holder, id: riderId, commission: commission - holiday, env, orderId });
      out.commissionRelief = holiday + offset;
      if (holiday > 0) out.notes.push(`commission holiday waived ${holiday.toLocaleString("en-UG")}`);
      if (offset > 0) out.notes.push(`discount wallet settled ${offset.toLocaleString("en-UG")} of commission`);
    }

    return out;
  } catch (err) {
    console.error("Offer settlement failed; the ride is settled without it", err);
    return NOTHING;
  }
}

/**
 * Runs once the order is marked settled, so ride counts include it: incentives this ride earns, and the reward for the
 * customer who invited this one. Never throws.
 */
export async function afterRideSettled(order: Row): Promise<void> {
  try {
    const now = new Date();
    if (order.rider_id) {
      const meta = await serviceOfOrder(order);
      await awardsForSettledRide(order, meta.vehicle, meta.vehicle === "car" ? "driver" : "rider", now);
    }
    await rewardReferrer(order);
  } catch (err) {
    console.error("Post-settlement incentives failed; the ride is settled without them", err);
  }
}

async function rewardReferrer(order: Row): Promise<void> {
  if (!(await hasTable("customer_offer_profiles"))) return;
  const cfg = await getOffersConfig();
  if (!cfg.enabled || !cfg.referral.enabled || cfg.referral.referrerCreditUgx <= 0) return;
  const env: PlatformEnvironment = order.environment === "sandbox" ? "sandbox" : "live";
  const customerId = String(order.customer_id);
  const profile = (await db.execute({ sql: "SELECT referred_by, referral_rewarded_at FROM customer_offer_profiles WHERE user_id = ?", args: [customerId] })).rows[0] as Row | undefined;
  if (!profile?.referred_by || profile.referral_rewarded_at) return;
  // Claim first, so two settlements can never pay the reward twice.
  const claimed = await db.execute({ sql: "UPDATE customer_offer_profiles SET referral_rewarded_at = datetime('now') WHERE user_id = ? AND referral_rewarded_at IS NULL", args: [customerId] });
  if (!claimed.rowsAffected) return;
  await grantCredit({ userId: String(profile.referred_by), amount: cfg.referral.referrerCreditUgx, kind: "offer", env, orderId: String(order.id), note: "A friend you invited took their first ride" });
}
