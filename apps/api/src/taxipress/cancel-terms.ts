import { db } from "../db/client.js";
import type { TaxipressSettings } from "./settings.js";

type Row = Record<string, unknown>;

/** What a passenger would get back if they cancelled now. */
export type CancelTerms = {
  allowed: boolean;
  reason: string | null;
  /** Inside the free-cancel window (or nothing was paid in the app), so nothing is kept. */
  free: boolean;
  /** Kept from the payment. */
  fee: number;
  /** Goes back to the passenger's wallet. */
  refund: number;
};

/** What escrow still holds for an order: successful collections less successful refunds. */
export async function collectedFor(orderId: string): Promise<number> {
  const [collected, refunded] = await Promise.all([
    db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = ? AND type = 'collection' AND status = 'successful'", args: [orderId] }),
    db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = ? AND type = 'refund' AND status = 'successful'", args: [orderId] }),
  ]);
  return Math.max(0, Number((collected.rows[0] as Row).total ?? 0) - Number((refunded.rows[0] as Row).total ?? 0));
}

export function minutesSince(dbTime: string, now = Date.now()): number {
  const ms = Date.parse(`${dbTime.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? Math.floor((now - ms) / 60_000) : 0;
}

/** A fee as a share of the fare, never more than what was actually collected. */
export function feeOf(fare: number, percent: number, collected: number): number {
  return Math.max(0, Math.min(collected, Math.round((fare * percent) / 100)));
}

/** The terms for a passenger cancelling a booking that has not boarded and whose taxi has not left. */
export function cancelTermsFor(
  input: { status: string; queueStatus: string; method: "app" | "cash"; amount: number; createdAt: string; collected: number },
  settings: Pick<TaxipressSettings, "freeCancelMinutes" | "cancelRetentionPercent">,
  now = Date.now(),
): CancelTerms {
  if (input.status !== "booked") return { allowed: false, reason: "This booking can't be cancelled.", free: true, fee: 0, refund: 0 };
  if (input.queueStatus !== "in_line" && input.queueStatus !== "boarding") {
    return { allowed: false, reason: "The taxi has already left.", free: true, fee: 0, refund: 0 };
  }
  // Nothing paid in the app (cash, or an unpaid seat): there is nothing to keep or give back.
  if (input.method !== "app" || input.collected <= 0) return { allowed: true, reason: null, free: true, fee: 0, refund: 0 };
  const free = minutesSince(input.createdAt, now) <= settings.freeCancelMinutes;
  const fee = free ? 0 : feeOf(input.amount, settings.cancelRetentionPercent, input.collected);
  return { allowed: true, reason: null, free: free || fee === 0, fee, refund: input.collected - fee };
}
