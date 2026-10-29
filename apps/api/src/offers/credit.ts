/**
 * Customer wallet credit: bonus money (deposit bonuses, cashback, fee top-ups, offers) that stays on the platform.
 *
 * Cash stays in users.wallet_balance exactly as before, so every existing path that reads or moves it (transfers, shares,
 * refunds) keeps working and can never touch credit by accident. Credit lives in credit_lots (one lot per grant, so the
 * soonest-to-expire is spent first and an expiry sweep knows what is left) with users.credit_balance as the running total.
 */
import { splitWalletPayment, creditAllowedAmount, type CreditModule } from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { getCreditConfig } from "./config.js";

type Row = Record<string, unknown>;
export type CreditKind = "bonus" | "fee_cover" | "cashback" | "offer" | "admin" | "refund";

const column = (env: PlatformEnvironment) => (env === "sandbox" ? "credit_balance_sandbox" : "credit_balance");

/** Whether migration 0147's credit tables are applied. Until they are, credit is simply unavailable. */
export async function creditAvailable(): Promise<boolean> {
  return (await hasTable("credit_lots")) && (await hasTable("credit_ledger")) && (await hasColumn("users", "credit_balance"));
}

export async function getCreditBalance(userId: string, env: PlatformEnvironment): Promise<number> {
  if (!(await creditAvailable())) return 0;
  const res = await db.execute({ sql: `SELECT ${column(env)} AS balance FROM users WHERE id = ?`, args: [userId] });
  return Math.max(0, Number((res.rows[0] as Row | undefined)?.balance ?? 0));
}

async function ledger(input: { userId: string; type: string; amount: number; balanceAfter: number; env: PlatformEnvironment; lotId?: string | null; orderId?: string | null; topupId?: string | null; note?: string | null }): Promise<void> {
  await db.execute({
    sql: `INSERT INTO credit_ledger (id, user_id, type, amount, balance_after, lot_id, order_id, topup_id, note, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [newId("cl"), input.userId, input.type, input.amount, input.balanceAfter, input.lotId ?? null, input.orderId ?? null, input.topupId ?? null, input.note ?? null, input.env],
  });
}

/** Gives a customer credit. Returns the lot id, or null when credit is switched off or unavailable. */
export async function grantCredit(input: {
  userId: string;
  amount: number;
  kind: CreditKind;
  env: PlatformEnvironment;
  partnerId?: string | null;
  campaign?: string | null;
  orderId?: string | null;
  topupId?: string | null;
  note?: string;
  /** Overrides the configured expiry; 0 = never. */
  expiryDays?: number;
}): Promise<string | null> {
  const amount = Math.floor(input.amount);
  if (amount <= 0 || !(await creditAvailable())) return null;
  const cfg = await getCreditConfig();
  if (!cfg.enabled) return null;
  const days = input.expiryDays ?? cfg.expiryDays;
  const lotId = newId("clot");
  await db.execute({
    sql: `INSERT INTO credit_lots (id, user_id, amount, remaining, source, partner_id, campaign, environment, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${days > 0 ? `datetime('now', '+${Math.floor(days)} days')` : "NULL"})`,
    args: [lotId, input.userId, amount, amount, input.kind, input.partnerId ?? null, input.campaign ?? null, input.env],
  });
  await db.execute({ sql: `UPDATE users SET ${column(input.env)} = ${column(input.env)} + ?, updated_at = datetime('now') WHERE id = ?`, args: [amount, input.userId] });
  const balance = await getCreditBalance(input.userId, input.env);
  await ledger({ userId: input.userId, type: input.kind, amount, balanceAfter: balance, env: input.env, lotId, orderId: input.orderId, topupId: input.topupId, note: input.note ?? null });
  return lotId;
}

/**
 * Spends up to `amount` of credit, soonest-to-expire first, never touching a lot that is locked to a different partner.
 * Each lot is decremented with a guarded UPDATE so two requests cannot spend the same credit. Returns what was spent.
 */
export async function spendCredit(input: { userId: string; amount: number; env: PlatformEnvironment; orderId: string; partnerId?: string | null; note?: string; onlySources?: string[] }): Promise<number> {
  let need = Math.floor(input.amount);
  if (need <= 0 || !(await creditAvailable())) return 0;
  const cfg = await getCreditConfig();
  const lots = await db.execute({
    sql: `SELECT id, remaining, partner_id, source FROM credit_lots
          WHERE user_id = ? AND environment = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
          ORDER BY (expires_at IS NULL), expires_at ASC, created_at ASC`,
    args: [input.userId, input.env],
  });
  let spent = 0;
  for (const row of lots.rows as Row[]) {
    if (need <= 0) break;
    if (input.onlySources && !input.onlySources.includes(String(row.source))) continue;
    const lotPartner = row.partner_id ? String(row.partner_id) : null;
    // Credit tagged to a partner campaign only pays at that partner (admin can relax this).
    if (lotPartner && cfg.partnerCreditLocked && lotPartner !== (input.partnerId ?? null)) continue;
    const take = Math.min(need, Number(row.remaining));
    const res = await db.execute({ sql: "UPDATE credit_lots SET remaining = remaining - ? WHERE id = ? AND remaining >= ?", args: [take, String(row.id), take] });
    if (!res.rowsAffected) continue;
    need -= take;
    spent += take;
  }
  if (spent > 0) {
    await db.execute({ sql: `UPDATE users SET ${column(input.env)} = MAX(0, ${column(input.env)} - ?), updated_at = datetime('now') WHERE id = ?`, args: [spent, input.userId] });
    await ledger({ userId: input.userId, type: "spend", amount: -spent, balanceAfter: await getCreditBalance(input.userId, input.env), env: input.env, orderId: input.orderId, note: input.note ?? "Paid with credit" });
  }
  return spent;
}

/** How much credit could pay for an order right now (before the order's own cap), for showing and splitting. */
export async function spendableCredit(userId: string, env: PlatformEnvironment, partnerId?: string | null, onlySources?: string[]): Promise<number> {
  if (!(await creditAvailable())) return 0;
  const cfg = await getCreditConfig();
  const lots = await db.execute({
    sql: `SELECT remaining, partner_id, source FROM credit_lots WHERE user_id = ? AND environment = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    args: [userId, env],
  });
  return (lots.rows as Row[]).reduce((sum, r) => {
    if (onlySources && !onlySources.includes(String(r.source))) return sum;
    const lotPartner = r.partner_id ? String(r.partner_id) : null;
    return lotPartner && cfg.partnerCreditLocked && lotPartner !== (partnerId ?? null) ? sum : sum + Number(r.remaining);
  }, 0);
}

/** What an order paid with credit, so a refund can return credit to credit and cash to cash. */
export async function creditPaidForOrder(orderId: string): Promise<number> {
  if (!(await hasTable("credit_ledger"))) return 0;
  const res = await db.execute({
    sql: `SELECT COALESCE(SUM(-amount), 0) AS paid FROM credit_ledger WHERE order_id = ? AND type = 'spend'`,
    args: [orderId],
  });
  const refunded = await db.execute({ sql: `SELECT COALESCE(SUM(amount), 0) AS back FROM credit_ledger WHERE order_id = ? AND type = 'refund'`, args: [orderId] });
  return Math.max(0, Number((res.rows[0] as Row)?.paid ?? 0) - Number((refunded.rows[0] as Row)?.back ?? 0));
}

/** Credit that was spent on an order comes back as credit (never as withdrawable cash). */
export async function refundCreditForOrder(orderId: string, userId: string, env: PlatformEnvironment): Promise<number> {
  const back = await creditPaidForOrder(orderId);
  if (back <= 0) return 0;
  await grantCredit({ userId, amount: back, kind: "refund", env, orderId, note: "Order refund (credit)" });
  return back;
}

/** Credit past its expiry is removed. Run from the scheduled sweep. */
export async function expireCredit(): Promise<number> {
  if (!(await creditAvailable())) return 0;
  const lots = await db.execute({
    sql: `SELECT id, user_id, remaining, environment FROM credit_lots WHERE remaining > 0 AND expires_at IS NOT NULL AND expires_at <= datetime('now') LIMIT 200`,
    args: [],
  });
  let total = 0;
  for (const row of lots.rows as Row[]) {
    const left = Number(row.remaining);
    const res = await db.execute({ sql: "UPDATE credit_lots SET remaining = 0 WHERE id = ? AND remaining = ?", args: [String(row.id), left] });
    if (!res.rowsAffected) continue;
    const env: PlatformEnvironment = row.environment === "sandbox" ? "sandbox" : "live";
    await db.execute({ sql: `UPDATE users SET ${column(env)} = MAX(0, ${column(env)} - ?), updated_at = datetime('now') WHERE id = ?`, args: [left, String(row.user_id)] });
    await ledger({ userId: String(row.user_id), type: "expiry", amount: -left, balanceAfter: await getCreditBalance(String(row.user_id), env), env, lotId: String(row.id), note: "Credit expired" });
    total += left;
  }
  return total;
}

/**
 * Splits a wallet payment between credit and cash under the admin rules, and takes both. Returns null when the wallet
 * cannot cover it (nothing is taken). `payCash` performs the cash debit and must return false when cash was short, so
 * credit that was already taken can be put back.
 */
export async function payWithCreditAndCash(input: {
  userId: string;
  amount: number;
  env: PlatformEnvironment;
  orderId: string;
  module: CreditModule;
  partnerId?: string | null;
  cashBalance: number;
  /** False when paying from a shared or secondary wallet: credit belongs to the person, not to a wallet. */
  creditEligible: boolean;
  payCash: (cashAmount: number) => Promise<boolean>;
}): Promise<{ credit: number; cash: number } | null> {
  const cfg = await getCreditConfig();
  let allowed = input.creditEligible ? creditAllowedAmount(cfg, { module: input.module, amount: input.amount, partnerId: input.partnerId }) : 0;
  // Credit that only gives a customer back the fee on their own top-up (fee_cover) works for anything on the platform.
  let onlySources: string[] | undefined;
  if (allowed === 0 && input.creditEligible && cfg.enabled) {
    allowed = Math.floor((input.amount * Math.min(100, Math.max(1, cfg.maxSharePercent))) / 100);
    onlySources = ["fee_cover"];
  }
  const available = allowed > 0 ? await spendableCredit(input.userId, input.env, input.partnerId, onlySources) : 0;
  const split = splitWalletPayment({ amount: input.amount, cash: input.cashBalance, credit: available, creditAllowedAmount: allowed, order: cfg.spendOrder });
  if (split.shortfall > 0) return null;
  let credit = 0;
  if (split.credit > 0) {
    credit = await spendCredit({ userId: input.userId, amount: split.credit, env: input.env, orderId: input.orderId, partnerId: input.partnerId, onlySources });
    // Credit was spent by someone else in between: the cash side must cover the difference.
    if (credit < split.credit) {
      const remainder = input.amount - credit;
      if (remainder > input.cashBalance) {
        if (credit > 0) await grantCredit({ userId: input.userId, amount: credit, kind: "refund", env: input.env, orderId: input.orderId, note: "Payment could not complete" });
        return null;
      }
    }
  }
  const cash = input.amount - credit;
  if (cash > 0 && !(await input.payCash(cash))) {
    if (credit > 0) await grantCredit({ userId: input.userId, amount: credit, kind: "refund", env: input.env, orderId: input.orderId, note: "Payment could not complete" });
    return null;
  }
  return { credit, cash };
}
