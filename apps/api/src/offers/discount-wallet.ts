/**
 * The rider discount wallet. When a customer rides with an offer and the rider is out of pocket, the difference goes
 * here instead of being lost. It is settled against Peebee's commission on the rider's next rides; whatever is left is
 * paid out to their active wallet (or queued for mobile money) under the admin's clearing rules.
 *
 * Boda and delivery riders keep their wallet on `riders`; car drivers keep theirs on `users`, so a "holder" says which.
 */
import { commissionOffset, payoutDue, type DiscountWalletConfig } from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { creditWallet } from "../wallet/service.js";
import { getDiscountWalletConfig } from "./config.js";

type Row = Record<string, unknown>;
export type WalletHolder = "rider" | "driver";

const table = (h: WalletHolder) => (h === "rider" ? "riders" : "users");
const idColumn = (h: WalletHolder) => (h === "rider" ? "user_id" : "id");
const balanceCol = (env: PlatformEnvironment) => (env === "sandbox" ? "discount_wallet_balance_sandbox" : "discount_wallet_balance");
const activeCol = (env: PlatformEnvironment) => (env === "sandbox" ? "wallet_balance_sandbox" : "wallet_balance");

export async function discountWalletAvailable(): Promise<boolean> {
  return (await hasTable("rider_discount_ledger")) && (await hasColumn("riders", "discount_wallet_balance")) && (await hasColumn("users", "discount_wallet_balance"));
}

export async function discountBalance(holder: WalletHolder, id: string, env: PlatformEnvironment): Promise<number> {
  if (!(await discountWalletAvailable())) return 0;
  const res = await db.execute({ sql: `SELECT ${balanceCol(env)} AS b FROM ${table(holder)} WHERE ${idColumn(holder)} = ?`, args: [id] });
  return Math.max(0, Number((res.rows[0] as Row | undefined)?.b ?? 0));
}

async function writeLedger(input: { id: string; type: string; amount: number; balanceAfter: number; orderId?: string | null; env: PlatformEnvironment; note?: string }) {
  await db.execute({
    sql: `INSERT INTO rider_discount_ledger (id, rider_id, type, amount, balance_after, order_id, environment, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [newId("rdl"), input.id, input.type, input.amount, input.balanceAfter, input.orderId ?? null, input.env, input.note ?? null],
  });
}

/** Credits the discount wallet. Once per (rider, order): a retried settlement cannot credit twice. */
export async function accrueDiscount(input: { holder: WalletHolder; id: string; amount: number; env: PlatformEnvironment; orderId: string; note?: string }): Promise<number> {
  const amount = Math.floor(input.amount);
  if (amount <= 0 || !(await discountWalletAvailable())) return 0;
  const done = await db.execute({ sql: "SELECT 1 FROM rider_discount_ledger WHERE rider_id = ? AND order_id = ? AND type = 'accrual'", args: [input.id, input.orderId] });
  if (done.rows.length > 0) return 0;
  await db.execute({ sql: `UPDATE ${table(input.holder)} SET ${balanceCol(input.env)} = ${balanceCol(input.env)} + ? WHERE ${idColumn(input.holder)} = ?`, args: [amount, input.id] });
  await writeLedger({ id: input.id, type: "accrual", amount, balanceAfter: await discountBalance(input.holder, input.id, input.env), orderId: input.orderId, env: input.env, note: input.note ?? "Customer offer on a ride" });
  return amount;
}

/**
 * Settles part of a ride's commission from the discount wallet. Returns how much of the commission is waived, which the
 * caller adds to what the rider keeps. The debit is guarded so a balance can never go negative.
 */
export async function offsetCommission(input: { holder: WalletHolder; id: string; commission: number; env: PlatformEnvironment; orderId: string; cfg?: DiscountWalletConfig }): Promise<number> {
  if (input.commission <= 0 || !(await discountWalletAvailable())) return 0;
  const cfg = input.cfg ?? (await getDiscountWalletConfig());
  const done = await db.execute({ sql: "SELECT 1 FROM rider_discount_ledger WHERE rider_id = ? AND order_id = ? AND type = 'commission_offset'", args: [input.id, input.orderId] });
  if (done.rows.length > 0) return 0;
  const balance = await discountBalance(input.holder, input.id, input.env);
  const offset = commissionOffset(cfg, balance, input.commission);
  if (offset <= 0) return 0;
  const res = await db.execute({
    sql: `UPDATE ${table(input.holder)} SET ${balanceCol(input.env)} = ${balanceCol(input.env)} - ? WHERE ${idColumn(input.holder)} = ? AND ${balanceCol(input.env)} >= ?`,
    args: [offset, input.id, offset],
  });
  if (!res.rowsAffected) return 0;
  await writeLedger({ id: input.id, type: "commission_offset", amount: -offset, balanceAfter: await discountBalance(input.holder, input.id, input.env), orderId: input.orderId, env: input.env, note: "Settled against Peebee commission" });
  return offset;
}

/** The date of the oldest part of the balance that has not yet been used (balances are used oldest first). */
export async function oldestAccrualAt(id: string, env: PlatformEnvironment, balance: number): Promise<Date | null> {
  if (balance <= 0) return null;
  const rows = await db.execute({
    sql: "SELECT amount, created_at FROM rider_discount_ledger WHERE rider_id = ? AND environment = ? AND type = 'accrual' ORDER BY created_at DESC LIMIT 300",
    args: [id, env],
  });
  let sum = 0;
  let oldest: Date | null = null;
  for (const r of rows.rows as Row[]) {
    sum += Number(r.amount);
    oldest = new Date(`${String(r.created_at).replace(" ", "T")}Z`);
    if (sum >= balance) break;
  }
  return oldest;
}

/** Moves money out of the discount wallet into the active wallet. Debits first (guarded), then credits. */
export async function payOutToActiveWallet(input: { holder: WalletHolder; id: string; amount: number; env: PlatformEnvironment; note?: string }): Promise<number> {
  const amount = Math.floor(input.amount);
  if (amount <= 0 || !(await discountWalletAvailable())) return 0;
  const res = await db.execute({
    sql: `UPDATE ${table(input.holder)} SET ${balanceCol(input.env)} = ${balanceCol(input.env)} - ? WHERE ${idColumn(input.holder)} = ? AND ${balanceCol(input.env)} >= ?`,
    args: [amount, input.id, amount],
  });
  if (!res.rowsAffected) return 0;
  try {
    if (input.holder === "rider") {
      await db.execute({ sql: `UPDATE riders SET ${activeCol(input.env)} = ${activeCol(input.env)} + ?, updated_at = datetime('now') WHERE user_id = ?`, args: [amount, input.id] });
    } else {
      await creditWallet(input.id, amount, { type: "adjustment", environment: input.env, note: input.note ?? "Discount wallet payout" });
    }
  } catch (err) {
    // Put the debit back so nothing is lost.
    await db.execute({ sql: `UPDATE ${table(input.holder)} SET ${balanceCol(input.env)} = ${balanceCol(input.env)} + ? WHERE ${idColumn(input.holder)} = ?`, args: [amount, input.id] });
    throw err;
  }
  await writeLedger({ id: input.id, type: "payout", amount: -amount, balanceAfter: await discountBalance(input.holder, input.id, input.env), env: input.env, note: input.note ?? "Paid out to active wallet" });
  return amount;
}

/** Admin marks a mobile-money payout as sent: the balance is debited without crediting any wallet. */
export async function markPaidExternally(input: { holder: WalletHolder; id: string; amount: number; env: PlatformEnvironment; note: string }): Promise<number> {
  const amount = Math.floor(input.amount);
  if (amount <= 0 || !(await discountWalletAvailable())) return 0;
  const res = await db.execute({
    sql: `UPDATE ${table(input.holder)} SET ${balanceCol(input.env)} = ${balanceCol(input.env)} - ? WHERE ${idColumn(input.holder)} = ? AND ${balanceCol(input.env)} >= ?`,
    args: [amount, input.id, amount],
  });
  if (!res.rowsAffected) return 0;
  await writeLedger({ id: input.id, type: "payout", amount: -amount, balanceAfter: await discountBalance(input.holder, input.id, input.env), env: input.env, note: input.note });
  return amount;
}

async function hasPendingRequest(id: string, env: PlatformEnvironment): Promise<boolean> {
  if (!(await hasTable("rider_discount_requests"))) return false;
  const res = await db.execute({ sql: "SELECT 1 FROM rider_discount_requests WHERE rider_id = ? AND environment = ? AND status = 'pending'", args: [id, env] });
  return res.rows.length > 0;
}

/** Applies the clearing rule to one balance. Returns what was paid to the active wallet or queued for mobile money. */
export async function clearIfDue(input: { holder: WalletHolder; id: string; env: PlatformEnvironment; now?: Date; requested?: boolean; cfg?: DiscountWalletConfig }): Promise<{ paid: number; queued: number }> {
  const cfg = input.cfg ?? (await getDiscountWalletConfig());
  const now = input.now ?? new Date();
  const balance = await discountBalance(input.holder, input.id, input.env);
  const oldest = await oldestAccrualAt(input.id, input.env, balance);
  if (!payoutDue(cfg, { balance, oldestAccrualAt: oldest, now, requested: input.requested })) return { paid: 0, queued: 0 };
  if (cfg.payoutMethod === "active_wallet") return { paid: await payOutToActiveWallet({ ...input, amount: balance }), queued: 0 };
  if (cfg.payoutMethod === "mobile_money") {
    if (await hasPendingRequest(input.id, input.env)) return { paid: 0, queued: 0 };
    await db.execute({ sql: "INSERT INTO rider_discount_requests (id, rider_id, environment) VALUES (?, ?, ?)", args: [newId("rdr"), input.id, input.env] });
    return { paid: 0, queued: balance };
  }
  return { paid: 0, queued: 0 };
}

/** Removes the part of a balance older than the expiry window. */
export async function expireStale(holder: WalletHolder, id: string, env: PlatformEnvironment, cfg: DiscountWalletConfig, now: Date): Promise<number> {
  if (cfg.expiryDays <= 0) return 0;
  const cutoff = new Date(now.getTime() - cfg.expiryDays * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
  const old = await db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM rider_discount_ledger WHERE rider_id = ? AND environment = ? AND type = 'accrual' AND created_at < ?", args: [id, env, cutoff] });
  const used = await db.execute({ sql: "SELECT COALESCE(SUM(-amount), 0) AS s FROM rider_discount_ledger WHERE rider_id = ? AND environment = ? AND type IN ('commission_offset', 'payout', 'expiry')", args: [id, env] });
  const stale = Math.max(0, Number((old.rows[0] as Row).s) - Number((used.rows[0] as Row).s));
  const balance = await discountBalance(holder, id, env);
  const amount = Math.min(stale, balance);
  if (amount <= 0) return 0;
  const res = await db.execute({ sql: `UPDATE ${table(holder)} SET ${balanceCol(env)} = ${balanceCol(env)} - ? WHERE ${idColumn(holder)} = ? AND ${balanceCol(env)} >= ?`, args: [amount, id, amount] });
  if (!res.rowsAffected) return 0;
  await writeLedger({ id, type: "expiry", amount: -amount, balanceAfter: await discountBalance(holder, id, env), env, note: `Unused for ${cfg.expiryDays} days` });
  return amount;
}

/** Scheduled sweep: expiry, then payouts that have come due. Cheap when nothing is waiting. */
export async function sweepDiscountWallets(now = new Date()): Promise<{ paid: number; queued: number; expired: number }> {
  const out = { paid: 0, queued: 0, expired: 0 };
  if (!(await discountWalletAvailable())) return out;
  const cfg = await getDiscountWalletConfig();
  if (!cfg.enabled) return out;
  for (const env of ["live", "sandbox"] as const) {
    for (const holder of ["rider", "driver"] as const) {
      const rows = await db.execute({ sql: `SELECT ${idColumn(holder)} AS id FROM ${table(holder)} WHERE ${balanceCol(env)} > 0 LIMIT 500`, args: [] });
      for (const row of rows.rows as Row[]) {
        const id = String(row.id);
        out.expired += await expireStale(holder, id, env, cfg, now);
        const r = await clearIfDue({ holder, id, env, now, cfg });
        out.paid += r.paid;
        out.queued += r.queued;
      }
    }
  }
  return out;
}
