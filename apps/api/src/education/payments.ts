import { type PlatformEnvironment } from "../lib/settings.js";
import { creditWallet, debitWallet } from "../wallet/service.js";

/** Splits a sale between the educator and Peebee. The commission is rounded down, so the educator never gets less than their share. */
export function splitPayment(amount: number, commissionPercent: number): { commission: number; payout: number } {
  const commission = Math.floor((amount * commissionPercent) / 100);
  return { commission, payout: amount - commission };
}

/**
 * Takes `amount` from the payer's wallet and pays the educator their share.
 * If paying the educator fails after the payer was charged, the payer is refunded,
 * so money is never left half-moved.
 */
export async function chargeAndPayOut(input: {
  payerId: string;
  ownerId: string;
  amount: number;
  commissionPercent: number;
  environment: PlatformEnvironment;
  note: string;
}): Promise<{ ok: true; commission: number } | { ok: false }> {
  const balance = await debitWallet(input.payerId, input.amount, { type: "order_payment", environment: input.environment, counterpartyId: input.ownerId, note: input.note });
  if (balance === null) return { ok: false };
  const { commission, payout } = splitPayment(input.amount, input.commissionPercent);
  try {
    if (payout > 0) await creditWallet(input.ownerId, payout, { type: "adjustment", environment: input.environment, counterpartyId: input.payerId, note: input.note });
  } catch (err) {
    await creditWallet(input.payerId, input.amount, { type: "refund", environment: input.environment, note: `Refund: ${input.note}` });
    throw err;
  }
  return { ok: true, commission };
}

