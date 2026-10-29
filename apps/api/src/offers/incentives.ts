/**
 * Rider incentives: paying the awards that the shared rules (packages/shared/src/offers.ts) say a rider has earned.
 * Per-ride awards are paid as a ride settles; day, week and month awards are paid by `sweepIncentives`. Every award is
 * keyed (rider, kind, period) so a retry or a second sweep can never pay twice, and the whole programme is capped by the
 * admin's monthly budget.
 */
import {
  budgetLeft, inWindows, leaderboardAwards, localClock, milestoneAwards, periodAwards, perRideAwards, welcomeBackDue,
  type IncentiveAward, type IncentiveConfig, type IncentiveKind, type RiderPeriodStats, type RiderVehicle,
} from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { creditWallet } from "../wallet/service.js";
import { getIncentiveConfig } from "./config.js";
import type { WalletHolder } from "./discount-wallet.js";

type Row = Record<string, unknown>;

export async function incentivesAvailable(): Promise<boolean> {
  return hasTable("rider_incentive_awards");
}

const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const fromSql = (s: unknown) => new Date(`${String(s).replace(" ", "T")}Z`);

/** Start of the local day / week (Monday) / month containing `now`, as a UTC instant. */
export function localStart(now: Date, unit: "day" | "week" | "month", tzMinutes: number): Date {
  const local = new Date(now.getTime() + tzMinutes * 60_000);
  let y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  if (unit === "week") d -= (local.getUTCDay() + 6) % 7;
  if (unit === "month") d = 1;
  return new Date(Date.UTC(y, m, d) - tzMinutes * 60_000);
}

export function dayKey(now: Date, tz: number): string {
  return new Date(now.getTime() + tz * 60_000).toISOString().slice(0, 10);
}
function weekKey(start: Date, tz: number): string {
  const local = new Date(start.getTime() + tz * 60_000);
  const thursday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 3));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whether a user is a car driver (their wallet is on users) rather than a boda / delivery rider. */
export async function holderOf(userId: string): Promise<WalletHolder> {
  if (!(await hasTable("car_partners"))) return "rider";
  const res = await db.execute({ sql: "SELECT 1 FROM car_partners WHERE user_id = ? AND driver_status = 'approved'", args: [userId] });
  return res.rows.length > 0 ? "driver" : "rider";
}

export async function creditActiveWallet(holder: WalletHolder, id: string, amount: number, env: PlatformEnvironment, note: string, orderId?: string): Promise<void> {
  if (amount <= 0) return;
  if (holder === "rider") {
    const col = env === "sandbox" ? "wallet_balance_sandbox" : "wallet_balance";
    await db.execute({ sql: `UPDATE riders SET ${col} = ${col} + ?, updated_at = datetime('now') WHERE user_id = ?`, args: [amount, id] });
  } else {
    await creditWallet(id, amount, { type: "adjustment", environment: env, orderId, note });
  }
}

export async function spentThisMonth(env: PlatformEnvironment, now: Date, tz: number): Promise<number> {
  const res = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM rider_incentive_awards WHERE environment = ? AND status = 'paid' AND kind <> 'sweep' AND created_at >= ?",
    args: [env, sqlTime(localStart(now, "month", tz))],
  });
  return Number((res.rows[0] as Row).s);
}

/** Pays one award once. Returns what was paid (0 when it was a repeat, over budget, or incentives are off). */
export async function awardRider(input: { holder: WalletHolder; riderId: string; award: IncentiveAward; periodKey: string; orderId?: string | null; env: PlatformEnvironment; now?: Date; cfg?: IncentiveConfig }): Promise<number> {
  if (!(await incentivesAvailable())) return 0;
  const cfg = input.cfg ?? (await getIncentiveConfig());
  if (!cfg.enabled || input.award.amount <= 0) return 0;
  const now = input.now ?? new Date();
  const left = budgetLeft(cfg, await spentThisMonth(input.env, now, cfg.tzOffsetMinutes));
  const amount = Math.floor(Math.min(input.award.amount, left));
  if (amount <= 0) return 0;
  const inserted = await db.execute({
    sql: `INSERT OR IGNORE INTO rider_incentive_awards (id, rider_id, kind, amount, period_key, order_id, note, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [newId("ria"), input.riderId, input.award.kind, amount, input.periodKey, input.orderId ?? null, input.award.note, input.env],
  });
  if (!inserted.rowsAffected) return 0;
  try {
    await creditActiveWallet(input.holder, input.riderId, amount, input.env, `Incentive: ${input.award.note}`, input.orderId ?? undefined);
  } catch (err) {
    await db.execute({ sql: "DELETE FROM rider_incentive_awards WHERE rider_id = ? AND kind = ? AND period_key = ?", args: [input.riderId, input.award.kind, input.periodKey] });
    throw err;
  }
  return amount;
}

export type RiderFacts = { createdAt: Date; completedRides: number; ridesThisMonth: number };

export async function riderFacts(riderId: string, env: PlatformEnvironment, now: Date, tz: number): Promise<RiderFacts> {
  const [created, completed, month] = await Promise.all([
    db.execute({ sql: "SELECT created_at FROM users WHERE id = ?", args: [riderId] }),
    db.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE rider_id = ? AND environment = ? AND stage = 'Settle'", args: [riderId, env] }),
    db.execute({ sql: "SELECT COUNT(*) AS n FROM orders WHERE rider_id = ? AND environment = ? AND stage = 'Settle' AND updated_at >= ?", args: [riderId, env, sqlTime(localStart(now, "month", tz))] }),
  ]);
  return {
    createdAt: fromSql((created.rows[0] as Row | undefined)?.created_at ?? sqlTime(now)),
    completedRides: Number((completed.rows[0] as Row).n),
    ridesThisMonth: Number((month.rows[0] as Row).n),
  };
}

/** Pays the awards a single settled ride earns: per-ride boosts, today's streak, milestones and welcome-back. */
export async function awardsForSettledRide(order: Row, vehicle: RiderVehicle, holder: WalletHolder, now = new Date()): Promise<number> {
  if (!(await incentivesAvailable()) || !order.rider_id) return 0;
  const cfg = await getIncentiveConfig();
  if (!cfg.enabled || !cfg.vehicles[vehicle]) return 0;
  const riderId = String(order.rider_id);
  const env: PlatformEnvironment = order.environment === "sandbox" ? "sandbox" : "live";
  const orderId = String(order.id);
  const tz = cfg.tzOffsetMinutes;
  const facts = await riderFacts(riderId, env, now, tz);
  const pickupDistanceKm = (await hasColumn("orders", "pickup_distance_km")) && order.pickup_distance_km != null ? Number(order.pickup_distance_km) : null;
  let paid = 0;

  const rideAwards = perRideAwards(cfg, {
    vehicle, fare: Math.max(0, Number(order.final_total ?? order.estimated_total ?? 0)), now, pickupDistanceKm,
    pickup: order.pickup_lat != null && order.pickup_lng != null ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) } : null,
    rider: facts,
  });
  for (const award of rideAwards) paid += await awardRider({ holder, riderId, award, periodKey: `order:${orderId}`, orderId, env, now, cfg });

  for (const award of milestoneAwards(cfg, facts.completedRides - 1, facts.completedRides)) {
    paid += await awardRider({ holder, riderId, award, periodKey: `milestone:${facts.completedRides}`, orderId, env, now, cfg });
  }

  if (cfg.kinds.rider_referral.enabled && (await hasTable("customer_offer_profiles"))) {
    const profile = (await db.execute({ sql: "SELECT referred_by FROM customer_offer_profiles WHERE user_id = ?", args: [riderId] })).rows[0] as Row | undefined;
    if (profile?.referred_by && facts.completedRides === cfg.kinds.rider_referral.afterRides) {
      const referrer = String(profile.referred_by);
      paid += await awardRider({
        holder: await holderOf(referrer), riderId: referrer, env, now, cfg, periodKey: `referral:${riderId}`,
        award: { kind: "rider_referral", amount: cfg.kinds.rider_referral.bonus, note: "A rider you recruited reached their first rides" },
      });
    }
  }

  if (cfg.kinds.trip_streak.enabled) {
    const dayStart = localStart(now, "day", tz);
    const today = await db.execute({
      sql: `SELECT SUM(CASE WHEN stage = 'Settle' THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN stage = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
            FROM orders WHERE rider_id = ? AND environment = ? AND updated_at >= ?`,
      args: [riderId, env, sqlTime(dayStart)],
    });
    const t = today.rows[0] as Row;
    const stats = emptyStats({ ridesToday: Number(t.done ?? 0), cancelledToday: Number(t.cancelled ?? 0) });
    for (const award of periodAwards(cfg, "day", stats)) paid += await awardRider({ holder, riderId, award, periodKey: `day:${dayKey(now, tz)}`, env, now, cfg });
  }

  if (cfg.kinds.welcome_back.enabled) {
    const need = cfg.kinds.welcome_back.afterRides;
    const recent = await db.execute({
      sql: "SELECT id, updated_at FROM orders WHERE rider_id = ? AND environment = ? AND stage = 'Settle' ORDER BY updated_at DESC LIMIT ?",
      args: [riderId, env, need + 1],
    });
    const rows = recent.rows as Row[];
    if (rows.length > need) {
      const firstOfReturn = fromSql(rows[need - 1].updated_at);
      const before = fromSql(rows[need].updated_at);
      const due = welcomeBackDue(cfg, { daysAwayBeforeReturn: (firstOfReturn.getTime() - before.getTime()) / 86_400_000, ridesSinceReturn: need });
      if (due) paid += await awardRider({ holder, riderId, award: due, periodKey: `return:${String(rows[need - 1].id)}`, env, now, cfg });
    }
  }
  return paid;
}

function emptyStats(over: Partial<RiderPeriodStats> = {}): RiderPeriodStats {
  return { ridesInPeriod: 0, cancelledInPeriod: 0, completedRides: 0, ratingAverage: null, ratingCount: 0, onlineHours: 0, ridesToday: 0, cancelledToday: 0, daysSinceLastRide: null, ...over };
}

// --- online time -----------------------------------------------------------

/** Opens or closes a rider's online session. Called wherever a rider or driver goes online or offline. */
export async function trackOnline(riderId: string, online: boolean): Promise<void> {
  try {
    if (!(await hasTable("rider_online_sessions"))) return;
    if (online) {
      const open = await db.execute({ sql: "SELECT 1 FROM rider_online_sessions WHERE rider_id = ? AND ended_at IS NULL LIMIT 1", args: [riderId] });
      if (open.rows.length === 0) await db.execute({ sql: "INSERT INTO rider_online_sessions (id, rider_id) VALUES (?, ?)", args: [newId("ros"), riderId] });
    } else {
      await db.execute({ sql: "UPDATE rider_online_sessions SET ended_at = datetime('now') WHERE rider_id = ? AND ended_at IS NULL", args: [riderId] });
    }
  } catch (err) {
    console.error("Online session tracking failed", err);
  }
}

async function onlineHoursByRider(from: Date, to: Date, cfg: IncentiveConfig): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!(await hasTable("rider_online_sessions"))) return out;
  const rows = await db.execute({
    sql: "SELECT rider_id, started_at, ended_at FROM rider_online_sessions WHERE started_at < ? AND (ended_at IS NULL OR ended_at > ?)",
    args: [sqlTime(to), sqlTime(from)],
  });
  const windows = cfg.kinds.online_hours.windows;
  for (const r of rows.rows as Row[]) {
    const start = Math.max(fromSql(r.started_at).getTime(), from.getTime());
    const end = Math.min(r.ended_at ? fromSql(r.ended_at).getTime() : to.getTime(), to.getTime());
    let minutes = 0;
    for (let t = start; t < end; t += 15 * 60_000) if (windows.length === 0 || inWindows(new Date(t), windows, cfg.tzOffsetMinutes)) minutes += Math.min(15, (end - t) / 60_000);
    out.set(String(r.rider_id), (out.get(String(r.rider_id)) ?? 0) + minutes / 60);
  }
  return out;
}

// --- period sweeps -----------------------------------------------------------

async function sweepDone(key: string, env: PlatformEnvironment): Promise<boolean> {
  const res = await db.execute({ sql: "SELECT 1 FROM rider_incentive_awards WHERE rider_id = '__sweep__' AND kind = 'sweep' AND period_key = ? AND environment = ?", args: [key, env] });
  return res.rows.length > 0;
}
async function markSwept(key: string, env: PlatformEnvironment): Promise<void> {
  await db.execute({ sql: "INSERT OR IGNORE INTO rider_incentive_awards (id, rider_id, kind, amount, period_key, note, environment) VALUES (?, '__sweep__', 'sweep', 0, ?, 'sweep', ?)", args: [newId("ria"), key, env] });
}

async function periodStats(env: PlatformEnvironment, from: Date, to: Date, cfg: IncentiveConfig): Promise<Map<string, RiderPeriodStats>> {
  const stats = new Map<string, RiderPeriodStats>();
  const get = (id: string) => stats.get(id) ?? stats.set(id, emptyStats()).get(id)!;
  const orders = await db.execute({
    sql: `SELECT rider_id, SUM(CASE WHEN stage = 'Settle' THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN stage = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
          FROM orders WHERE rider_id IS NOT NULL AND environment = ? AND updated_at >= ? AND updated_at < ? GROUP BY rider_id`,
    args: [env, sqlTime(from), sqlTime(to)],
  });
  for (const r of orders.rows as Row[]) {
    const s = get(String(r.rider_id));
    s.ridesInPeriod = Number(r.done ?? 0);
    s.cancelledInPeriod = Number(r.cancelled ?? 0);
  }
  if (await hasTable("order_ratings")) {
    const ratings = await db.execute({
      sql: "SELECT rider_id, AVG(rating) AS avg, COUNT(*) AS n FROM order_ratings WHERE created_at >= ? AND created_at < ? GROUP BY rider_id",
      args: [sqlTime(from), sqlTime(to)],
    });
    for (const r of ratings.rows as Row[]) {
      const s = get(String(r.rider_id));
      s.ratingAverage = Number(r.avg);
      s.ratingCount = Number(r.n);
    }
  }
  for (const [id, hours] of await onlineHoursByRider(from, to, cfg)) get(id).onlineHours = hours;
  return stats;
}

/**
 * Pays last week's and last month's awards once the week or month has ended. Safe to call as often as the scheduler
 * runs: a finished period is marked and skipped, and every individual award is idempotent anyway.
 */
export async function sweepIncentives(now = new Date()): Promise<{ weekly: number; monthly: number }> {
  const out = { weekly: 0, monthly: 0 };
  if (!(await incentivesAvailable())) return out;
  const cfg = await getIncentiveConfig();
  if (!cfg.enabled) return out;
  const tz = cfg.tzOffsetMinutes;
  const thisWeek = localStart(now, "week", tz);
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86_400_000);
  const thisMonth = localStart(now, "month", tz);
  const lastMonth = localStart(new Date(thisMonth.getTime() - 86_400_000), "month", tz);

  for (const env of ["live", "sandbox"] as const) {
    const weekId = `week:${weekKey(lastWeek, tz)}`;
    const wk = cfg.kinds;
    const weeklyOn = wk.weekly_ladder.enabled || wk.rating_bonus.enabled || wk.fuel_support.enabled || wk.online_hours.enabled || wk.leaderboard.enabled;
    if (weeklyOn && !(await sweepDone(weekId, env))) {
      const stats = await periodStats(env, lastWeek, thisWeek, cfg);
      for (const [riderId, s] of stats) {
        const holder = await holderOf(riderId);
        for (const award of periodAwards(cfg, "week", s)) out.weekly += await awardRider({ holder, riderId, award, periodKey: weekId, env, now, cfg });
      }
      if (cfg.kinds.leaderboard.enabled && cfg.kinds.leaderboard.period === "week") {
        const ranked = [...stats].map(([riderId, s]) => ({ riderId, rides: s.ridesInPeriod })).sort((a, b) => b.rides - a.rides);
        for (const { riderId, award } of leaderboardAwards(cfg, ranked)) out.weekly += await awardRider({ holder: await holderOf(riderId), riderId, award, periodKey: weekId, env, now, cfg });
      }
      await markSwept(weekId, env);
    }

    const monthId = `month:${dayKey(lastMonth, tz).slice(0, 7)}`;
    const monthlyOn = wk.reliability_bonus.enabled || (wk.leaderboard.enabled && wk.leaderboard.period === "month");
    if (monthlyOn && !(await sweepDone(monthId, env))) {
      const stats = await periodStats(env, lastMonth, thisMonth, cfg);
      for (const [riderId, s] of stats) {
        const holder = await holderOf(riderId);
        for (const award of periodAwards(cfg, "month", s)) out.monthly += await awardRider({ holder, riderId, award, periodKey: monthId, env, now, cfg });
      }
      if (cfg.kinds.leaderboard.enabled && cfg.kinds.leaderboard.period === "month") {
        const ranked = [...stats].map(([riderId, s]) => ({ riderId, rides: s.ridesInPeriod })).sort((a, b) => b.rides - a.rides);
        for (const { riderId, award } of leaderboardAwards(cfg, ranked)) out.monthly += await awardRider({ holder: await holderOf(riderId), riderId, award, periodKey: monthId, env, now, cfg });
      }
      await markSwept(monthId, env);
    }
  }
  return out;
}

export type { IncentiveKind };
export { localClock };
