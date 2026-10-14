import { db } from "../db/client.js";
import { hasColumn } from "../lib/schema.js";
import { getPlatformEnvironment, type PlatformEnvironment } from "../lib/settings.js";
import { creditWallet } from "../wallet/service.js";

type Row = Record<string, any>;

/** Vouchers move money, so they only run once migration 0096 has been applied. */
export async function vouchersReady(): Promise<boolean> {
  return (await hasColumn("fuel_codes", "held")) && (await hasColumn("fuel_codes", "environment"));
}

export const voucherEnvironment = (row: Row): PlatformEnvironment =>
  (row.environment === "sandbox" ? "sandbox" : "live");

/** Exact voucher lookup. Codes are PBGAS- plus six digits; no partial matching. */
export function normalizeVoucherCode(raw: string): string | null {
  const digits = raw.trim().toUpperCase().replace(/^PBGAS-/, "");
  return /^\d{6}$/.test(digits) ? `PBGAS-${digits}` : null;
}

export async function findVoucher(code: string): Promise<Row | null> {
  const res = await db.execute({ sql: "SELECT * FROM fuel_codes WHERE code = ? LIMIT 1", args: [code] });
  return (res.rows[0] as Row | undefined) ?? null;
}

/** Gives money back to the rider's wallet; failures are logged with the voucher id so they can be reconciled. */
export async function refundToRider(row: Row, amountUgx: number, note: string): Promise<boolean> {
  if (amountUgx <= 0 || Number(row.held) !== 1) return true;
  try {
    await creditWallet(String(row.rider_id), amountUgx, { type: "refund", environment: voucherEnvironment(row), note });
    return true;
  } catch (err) {
    console.error(`[gas] refund of UGX ${amountUgx} for voucher ${row.id} failed:`, err);
    return false;
  }
}

/**
 * Ends an unused voucher. The status change is a single conditional UPDATE,
 * so a voucher can only be closed (and refunded) once even if the rider
 * cancels, the clock expires it and an attendant scans it at the same moment.
 */
export async function closeVoucher(id: string, to: "cancelled" | "expired", note: string): Promise<boolean> {
  const res = await db.execute({ sql: "UPDATE fuel_codes SET status = ? WHERE id = ? AND status = 'active'", args: [to, id] });
  if ((res.rowsAffected ?? 0) !== 1) return false;
  const row = (await db.execute({ sql: "SELECT * FROM fuel_codes WHERE id = ?", args: [id] })).rows[0] as Row;
  await refundToRider(row, Number(row.authorized_amount_ugx), note);
  return true;
}

/** Expires (and refunds) vouchers whose time ran out. Run lazily on voucher calls and by the cron sweep. */
export async function expireStaleVouchers(riderId?: string): Promise<number> {
  if (!(await vouchersReady())) return 0;
  const res = await db.execute({
    sql: `SELECT id FROM fuel_codes WHERE status = 'active' AND expires_at <= ? ${riderId ? "AND rider_id = ?" : ""} LIMIT 100`,
    args: riderId ? [new Date().toISOString(), riderId] : [new Date().toISOString()],
  });
  let closed = 0;
  for (const r of res.rows as Row[]) {
    if (await closeVoucher(String(r.id), "expired", "Fuel voucher expired — hold released")) closed += 1;
  }
  return closed;
}

export { getPlatformEnvironment };
