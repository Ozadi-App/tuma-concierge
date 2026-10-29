/**
 * The bonus a wallet top-up earns. The amount comes from the shared rule (depositBonus); the limits that need the
 * database live here: bonus deposits per day, the monthly cap per customer, and one bonus per phone number.
 */
import { depositBonus } from "@peebee/shared";
import { db } from "../db/client.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { getCreditConfig } from "./config.js";
import { creditAvailable, grantCredit } from "./credit.js";

type Row = Record<string, unknown>;

/** Credits the bonus for one successful top-up, once. Returns the bonus given (0 when none applies). Never throws. */
export async function applyDepositBonus(input: { userId: string; topupId: string; amount: number; env: PlatformEnvironment }): Promise<number> {
  try {
    if (!(await creditAvailable())) return 0;
    const cfg = await getCreditConfig();
    const b = cfg.topup.bonus;
    if (!cfg.enabled || !b.enabled) return 0;

    const already = await db.execute({ sql: "SELECT 1 FROM credit_ledger WHERE topup_id = ? AND type = 'bonus'", args: [input.topupId] });
    if (already.rows.length > 0) return 0;

    const user = (await db.execute({ sql: "SELECT phone_verified_at, email_verified_at FROM users WHERE id = ?", args: [input.userId] })).rows[0] as Row | undefined;
    const verified = !!(user?.phone_verified_at || user?.email_verified_at);
    const earlier = await db.execute({ sql: "SELECT COUNT(*) AS n FROM wallet_topups WHERE user_id = ? AND status = 'successful' AND id <> ? AND environment = ?", args: [input.userId, input.topupId, input.env] });
    let bonus = depositBonus(cfg, { amount: input.amount, now: new Date(), verified, isFirstDeposit: Number((earlier.rows[0] as Row).n) === 0 });
    if (bonus <= 0) return 0;

    if (b.maxBonusDepositsPerDay > 0) {
      const today = await db.execute({ sql: "SELECT COUNT(*) AS n FROM credit_ledger WHERE user_id = ? AND type = 'bonus' AND environment = ? AND created_at >= datetime('now', 'start of day')", args: [input.userId, input.env] });
      if (Number((today.rows[0] as Row).n) >= b.maxBonusDepositsPerDay) return 0;
    }
    if (b.maxBonusPerMonth > 0) {
      const month = await db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM credit_ledger WHERE user_id = ? AND type = 'bonus' AND environment = ? AND created_at >= datetime('now', 'start of month')", args: [input.userId, input.env] });
      bonus = Math.min(bonus, Math.max(0, b.maxBonusPerMonth - Number((month.rows[0] as Row).s)));
      if (bonus <= 0) return 0;
    }
    if (cfg.withdrawal.oneBonusPerPhone) {
      // The same mobile-money number cannot earn a bonus on several accounts.
      const topup = (await db.execute({ sql: "SELECT msisdn FROM wallet_topups WHERE id = ?", args: [input.topupId] })).rows[0] as Row | undefined;
      if (topup?.msisdn) {
        const other = await db.execute({
          sql: `SELECT 1 FROM credit_ledger l JOIN wallet_topups t ON t.id = l.topup_id
                WHERE l.type = 'bonus' AND t.msisdn = ? AND l.user_id <> ? AND l.environment = ? LIMIT 1`,
          args: [String(topup.msisdn), input.userId, input.env],
        });
        if (other.rows.length > 0) return 0;
      }
    }
    const lot = await grantCredit({ userId: input.userId, amount: bonus, kind: "bonus", env: input.env, topupId: input.topupId, campaign: "deposit_bonus", note: "Top-up bonus" });
    return lot ? bonus : 0;
  } catch (err) {
    console.error("Deposit bonus failed; the top-up itself is unaffected", err);
    return 0;
  }
}
