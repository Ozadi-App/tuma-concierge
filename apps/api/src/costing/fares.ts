/**
 * Fares for the API: the shared engine (packages/shared/src/pricing.ts) fed with the admin's settings and the live
 * conditions around the order (time of day, demand). Quotes, bookings and receipts all come through here.
 */
import { computeFare, type FareBreakdown, type FareInput, type FareService } from "@peebee/shared";
import { db } from "../db/client.js";
import { hasColumn } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { getPricingConfig } from "./config.js";

type Row = Record<string, unknown>;

let demandCache: { at: number; env: string; value: number | null } | null = null;

/** Open requests divided by riders online right now, or null when it cannot be told. Cached for a minute. */
export async function currentDemandRatio(): Promise<number | null> {
  try {
    const env = await getPlatformEnvironment();
    if (demandCache && demandCache.env === env && Date.now() - demandCache.at < 60_000) return demandCache.value;
    const [open, online] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE environment = ? AND stage = 'Match' AND rider_id IS NULL AND created_at > datetime('now', '-30 minutes')", args: [env] }),
      db.execute({ sql: "SELECT COUNT(*) AS n FROM riders WHERE is_online = 1 AND verified = 1", args: [] }),
    ]);
    const riders = Number((online.rows[0] as Row).n);
    const value = riders > 0 ? Number((open.rows[0] as Row).n) / riders : null;
    demandCache = { at: Date.now(), env, value };
    return value;
  } catch {
    return null;
  }
}

/** One fare under the admin's pricing settings. The ratio is only looked up when the demand multiplier is switched on. */
export async function engineFare(input: Omit<FareInput, "now"> & { now?: Date }): Promise<FareBreakdown> {
  const cfg = await getPricingConfig();
  const demandRatio = input.demandRatio !== undefined ? input.demandRatio : cfg.multipliers.demand.enabled ? await currentDemandRatio() : null;
  return computeFare(cfg, { ...input, now: input.now ?? new Date(), demandRatio });
}

export type { FareService };

/** Saves how a fare was built beside the order, so a later settings change can't alter what the customer was shown. */
export async function saveFareBreakdown(orderId: string, breakdown: FareBreakdown | null): Promise<void> {
  if (!breakdown || !(await hasColumn("orders", "fare_breakdown"))) return;
  await db.execute({ sql: "UPDATE orders SET fare_breakdown = ? WHERE id = ?", args: [JSON.stringify(breakdown), orderId] });
}
