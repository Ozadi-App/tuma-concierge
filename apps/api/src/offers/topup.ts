/**
 * What a wallet top-up is worth once the payment gateway has taken its fee. The admin chooses (Admin → Wallet credit):
 *  - customer_pays: the wallet gets the amount minus the fee (and tax on it).
 *  - make_whole: the wallet shows the full amount. Cash is credited as usual and Peebee adds what the fee took as credit
 *    ("fee_cover"), which can be spent anywhere on Peebee but never withdrawn.
 * With no gateway rate set up (the default until an admin confirms the rates) there is no fee and nothing changes.
 */
import { gatewayFee, type CreditConfig, type MoneyFlowConfig } from "@peebee/shared";
import { db } from "../db/client.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { getMoneyFlowConfig } from "../costing/config.js";
import { getCreditConfig } from "./config.js";
import { creditAvailable } from "./credit.js";

type Row = Record<string, unknown>;

export type TopupPlan = {
  amount: number;
  gatewayFee: number;
  taxOnFee: number;
  /** Cash that lands in the wallet. */
  cash: number;
  /** Credit Peebee adds to make up the fee. */
  feeCover: number;
  /** What the customer loses (0 when Peebee covers everything). */
  customerBears: number;
};

/** Tax charged on the gateway's fee (for example an excise duty on mobile-money fees), from the admin's tax rules. */
export function taxOnGatewayFee(cfg: MoneyFlowConfig, fee: number, on: Date): number {
  const day = on.toISOString().slice(0, 10);
  return cfg.taxes
    .filter((t) => t.enabled && t.appliesTo === "gateway_fee" && t.effectiveFrom <= day)
    .reduce((sum, t) => sum + Math.round(t.mode === "inclusive" ? fee - fee / (1 + t.percent / 100) : (fee * t.percent) / 100), 0);
}

/** Pure part of the plan: no database. `coverUsedByCustomer` / `coverUsedByEveryone` are this month's fee cover so far. */
export function planTopup(
  credit: CreditConfig,
  flow: MoneyFlowConfig,
  topup: { amount: number; provider: string; network?: string | null },
  used: { coverUsedByCustomer: number; coverUsedByEveryone: number },
  on = new Date(),
): TopupPlan {
  const fee = gatewayFee(flow.providerFees, { provider: topup.provider, direction: "collection", network: topup.network, amount: topup.amount, on }).fee;
  const tax = fee > 0 ? taxOnGatewayFee(flow, fee, on) : 0;
  const deducted = Math.min(topup.amount, fee + tax);
  if (deducted <= 0) return { amount: topup.amount, gatewayFee: fee, taxOnFee: tax, cash: topup.amount, feeCover: 0, customerBears: 0 };

  const cash = topup.amount - deducted;
  const t = credit.topup;
  if (!credit.enabled || t.feeMode !== "make_whole" || topup.amount < t.makeWholeMinTopup) {
    return { amount: topup.amount, gatewayFee: fee, taxOnFee: tax, cash, feeCover: 0, customerBears: deducted };
  }
  let cover = t.makeWholeIncludesTax ? deducted : Math.min(deducted, fee);
  if (t.makeWholeMonthlyCapPerCustomer > 0) cover = Math.min(cover, Math.max(0, t.makeWholeMonthlyCapPerCustomer - used.coverUsedByCustomer));
  if (t.makeWholeMonthlyBudget > 0) cover = Math.min(cover, Math.max(0, t.makeWholeMonthlyBudget - used.coverUsedByEveryone));
  cover = Math.max(0, cover);
  return { amount: topup.amount, gatewayFee: fee, taxOnFee: tax, cash, feeCover: cover, customerBears: deducted - cover };
}

/** The plan for one real top-up, with this month's cover read from the database. */
export async function planTopupFor(topup: Row, env: PlatformEnvironment): Promise<TopupPlan> {
  const [credit, flow] = await Promise.all([getCreditConfig(), getMoneyFlowConfig()]);
  const base = { amount: Number(topup.amount), provider: String(topup.provider ?? ""), network: topup.network ? String(topup.network) : null };
  let used = { coverUsedByCustomer: 0, coverUsedByEveryone: 0 };
  if (credit.topup.feeMode === "make_whole" && (await creditAvailable())) {
    const [mine, all] = await Promise.all([
      db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM credit_ledger WHERE user_id = ? AND type = 'fee_cover' AND environment = ? AND created_at >= datetime('now', 'start of month')", args: [String(topup.user_id), env] }),
      db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM credit_ledger WHERE type = 'fee_cover' AND environment = ? AND created_at >= datetime('now', 'start of month')", args: [env] }),
    ]);
    used = { coverUsedByCustomer: Number((mine.rows[0] as Row).s), coverUsedByEveryone: Number((all.rows[0] as Row).s) };
  }
  return planTopup(credit, flow, base, used);
}
