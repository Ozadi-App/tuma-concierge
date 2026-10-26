import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { ChannelsError, requireChannels, utcDay, type Row } from "./common.js";
import { creditCreator } from "./money.js";
import { getPost, type PostRow } from "./posts.js";

/**
 * Views → points → money. Points are earned by counted views of a channel's posts. How much a point
 * is worth comes from the dated rate table in Admin, so it can rise as the platform grows. Turning
 * points into money credits the creator's balance (no ID needed); withdrawing that balance needs
 * verification. Every limit here is an Admin setting.
 */

/** UGX per 1,000 points right now (0 if no rate has been set yet). */
export async function currentRate(): Promise<number> {
  if (!(await hasTable("reward_rates"))) return 0;
  const row = (await db.execute({ sql: "SELECT ugx_per_1000_points FROM reward_rates WHERE effective_from <= datetime('now') ORDER BY effective_from DESC, created_at DESC LIMIT 1", args: [] })).rows[0] as Row | undefined;
  return Number(row?.ugx_per_1000_points ?? 0);
}

export async function listRates(): Promise<Row[]> {
  if (!(await hasTable("reward_rates"))) return [];
  return (await db.execute({ sql: "SELECT * FROM reward_rates ORDER BY effective_from DESC, created_at DESC LIMIT 100", args: [] })).rows as Row[];
}

export async function addRate(input: { effectiveFrom: string; ugxPer1000Points: number; note?: string; createdBy: string }): Promise<string> {
  const at = new Date(input.effectiveFrom);
  if (Number.isNaN(at.getTime())) throw new ChannelsError("invalid_date", "That date is not valid.", 400);
  const rate = Math.round(input.ugxPer1000Points);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100_000_000) throw new ChannelsError("invalid_rate", "That rate is not valid.", 400);
  const id = newId("rte");
  await db.execute({
    sql: "INSERT INTO reward_rates (id, effective_from, ugx_per_1000_points, note, created_by) VALUES (?, ?, ?, ?, ?)",
    args: [id, at.toISOString().slice(0, 19).replace("T", " "), rate, input.note?.slice(0, 200) ?? null, input.createdBy],
  });
  return id;
}

/**
 * A viewer has watched part of a post. Counts the view once per viewer and day, and, when it has
 * been watched long enough on a channel's post, earns the creator points. Returns whether it counted.
 */
export async function recordView(post: PostRow, viewer: { key: string; userId: string | null }, seconds: number): Promise<{ counted: boolean; qualified: boolean }> {
  const cfg = await requireChannels();
  if (!(await hasTable("post_views")) || post.status !== "published") return { counted: false, qualified: false };
  if (viewer.userId && viewer.userId === post.author_id) return { counted: false, qualified: false };
  const watched = Math.max(0, Math.min(86_400, Number(seconds) || 0));
  const day = utcDay();

  const created = await db.execute({
    sql: "INSERT OR IGNORE INTO post_views (id, post_id, viewer_key, day, seconds) VALUES (?, ?, ?, ?, ?)",
    args: [newId("vw"), post.id, viewer.key, day, watched],
  });
  if (created.rowsAffected) {
    await db.execute({ sql: "UPDATE posts SET view_count = view_count + 1 WHERE id = ?", args: [post.id] });
  } else {
    await db.execute({ sql: "UPDATE post_views SET seconds = MAX(seconds, ?) WHERE post_id = ? AND viewer_key = ? AND day = ?", args: [watched, post.id, viewer.key, day] });
  }

  const rewardable = cfg.rewards.enabled && post.publisher_type === "channel" && (viewer.userId || cfg.rewards.countAnonymousViews);
  if (!rewardable || watched < cfg.rewards.qualifiedViewSeconds) return { counted: !!created.rowsAffected, qualified: false };

  // A fraud guard: only so many counted views per viewer per hour.
  const recent = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM post_views WHERE viewer_key = ? AND qualified = 1 AND created_at > datetime('now', '-1 hour')", args: [viewer.key] })).rows[0] as Row).n);
  if (recent >= cfg.rewards.qualifiedViewsPerViewerPerHour) return { counted: !!created.rowsAffected, qualified: false };

  const points = cfg.rewards.pointsPerQualifiedView;
  const flipped = await db.execute({ sql: "UPDATE post_views SET qualified = 1, points = ? WHERE post_id = ? AND viewer_key = ? AND day = ? AND qualified = 0", args: [points, post.id, viewer.key, day] });
  if (!flipped.rowsAffected) return { counted: !!created.rowsAffected, qualified: false };

  const rate = await currentRate();
  const env = await getPlatformEnvironment();
  await db.execute({
    sql: `INSERT INTO creator_points (user_id, environment, points, value_milli, lifetime_points) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, environment) DO UPDATE SET points = points + excluded.points, value_milli = value_milli + excluded.value_milli, lifetime_points = lifetime_points + excluded.lifetime_points`,
    // A point is worth `rate` thousandths of a shilling (rate is shillings per 1,000 points).
    args: [post.author_id, env, points, points * rate, points],
  });
  return { counted: !!created.rowsAffected, qualified: true };
}

export async function rewardsSummary(userId: string) {
  const cfg = await requireChannels();
  const env = await getPlatformEnvironment();
  const row = (await db.execute({ sql: "SELECT points, value_milli, lifetime_points FROM creator_points WHERE user_id = ? AND environment = ?", args: [userId, env] })).rows[0] as Row | undefined;
  const points = Number(row?.points ?? 0);
  const rate = await currentRate();
  const valueUgx = cfg.rewards.rateLock === "at_earn" ? Math.floor(Number(row?.value_milli ?? 0) / 1000) : Math.floor((points * rate) / 1000);
  const last = (await db.execute({ sql: "SELECT created_at FROM reward_conversions WHERE creator_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 1", args: [userId, env] })).rows[0] as Row | undefined;
  const history = (await db.execute({ sql: "SELECT id, points, requested_ugx, paid_ugx, scale_percent, created_at FROM reward_conversions WHERE creator_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 20", args: [userId, env] })).rows as Row[];
  let nextAt: string | null = null;
  if (last && cfg.rewards.cashoutCooldownDays > 0) {
    const t = new Date(`${String(last.created_at).replace(" ", "T")}Z`).getTime() + cfg.rewards.cashoutCooldownDays * 86_400_000;
    if (t > Date.now()) nextAt = new Date(t).toISOString();
  }
  return {
    enabled: cfg.rewards.enabled,
    points,
    lifetimePoints: Number(row?.lifetime_points ?? 0),
    estimatedValueUgx: valueUgx,
    currentRateUgxPer1000: rate,
    rateBasis: cfg.rewards.rateLock,
    minCashoutPoints: cfg.rewards.minCashoutPoints,
    nextCashoutAt: nextAt,
    history: history.map((h) => ({ id: String(h.id), points: Number(h.points), requestedUgx: Number(h.requested_ugx), paidUgx: Number(h.paid_ugx), scalePercent: Number(h.scale_percent), createdAt: String(h.created_at) })),
  };
}

async function monthPaid(where: string, args: Array<string>): Promise<number> {
  const row = (await db.execute({ sql: `SELECT COALESCE(SUM(paid_ugx), 0) AS n FROM reward_conversions WHERE environment = ? AND created_at >= date('now', 'start of month') ${where}`, args })).rows[0] as Row;
  return Number(row.n);
}

/** Turns some of a creator's points into money in their balance. Withdrawing it later needs verification. */
export async function cashOut(userId: string, requestedPoints?: number): Promise<{ points: number; paidUgx: number; scalePercent: number }> {
  const cfg = await requireChannels();
  if (!cfg.rewards.enabled) throw new ChannelsError("rewards_unavailable", "Rewards are not available yet.", 503);
  const env = await getPlatformEnvironment();
  const row = (await db.execute({ sql: "SELECT points, value_milli FROM creator_points WHERE user_id = ? AND environment = ?", args: [userId, env] })).rows[0] as Row | undefined;
  const have = Number(row?.points ?? 0);
  const points = Math.min(have, Math.max(0, Math.round(requestedPoints ?? have)));
  if (points < cfg.rewards.minCashoutPoints) throw new ChannelsError("below_minimum", `You need at least ${cfg.rewards.minCashoutPoints.toLocaleString()} points to cash out.`, 409);

  const last = (await db.execute({ sql: "SELECT created_at FROM reward_conversions WHERE creator_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 1", args: [userId, env] })).rows[0] as Row | undefined;
  if (last && cfg.rewards.cashoutCooldownDays > 0) {
    const t = new Date(`${String(last.created_at).replace(" ", "T")}Z`).getTime() + cfg.rewards.cashoutCooldownDays * 86_400_000;
    if (t > Date.now()) throw new ChannelsError("cooldown", `You can cash out again on ${new Date(t).toDateString()}.`, 429);
  }

  const rate = await currentRate();
  let requested: number;
  if (cfg.rewards.rateLock === "at_earn") requested = Math.floor((Number(row?.value_milli ?? 0) * (points / have)) / 1000);
  else requested = Math.floor((points * rate) / 1000);
  if (requested <= 0) throw new ChannelsError("no_rate", "Points cannot be cashed out until a rate is set.", 409);

  let allowed = requested;
  if (cfg.rewards.monthlyCapPerCreatorUgx > 0) {
    allowed = Math.min(allowed, Math.max(0, cfg.rewards.monthlyCapPerCreatorUgx - (await monthPaid("AND creator_id = ?", [env, userId]))));
  }
  if (cfg.rewards.monthlyBudgetUgx > 0) {
    allowed = Math.min(allowed, Math.max(0, cfg.rewards.monthlyBudgetUgx - (await monthPaid("", [env]))));
  }
  if (allowed <= 0) throw new ChannelsError("budget_reached", "This month's rewards budget has been used. Try again next month.", 409);
  const scalePercent = Math.floor((allowed / requested) * 100);

  // Take the points first, only if they are all still there (two requests cannot both spend them).
  const valueTaken = cfg.rewards.rateLock === "at_earn" ? Math.floor(Number(row?.value_milli ?? 0) * (points / have)) : points * rate;
  const took = await db.execute({
    sql: "UPDATE creator_points SET points = points - ?, value_milli = MAX(0, value_milli - ?) WHERE user_id = ? AND environment = ? AND points >= ?",
    args: [points, valueTaken, userId, env, points],
  });
  if (!took.rowsAffected) throw new ChannelsError("balance_changed", "Your points just changed. Please try again.", 409);

  const conversionId = newId("rcv");
  try {
    await creditCreator({ creatorId: userId, kind: "reward", grossUgx: allowed, sourceId: conversionId, note: `${points.toLocaleString()} points`, clearingPurpose: "rewards_pool", environment: env });
    await db.execute({
      sql: "INSERT INTO reward_conversions (id, creator_id, points, requested_ugx, paid_ugx, basis, scale_percent, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [conversionId, userId, points, requested, allowed, cfg.rewards.rateLock, scalePercent, env],
    });
  } catch (err) {
    await db.execute({
      sql: `INSERT INTO creator_points (user_id, environment, points, value_milli, lifetime_points) VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(user_id, environment) DO UPDATE SET points = points + excluded.points, value_milli = value_milli + excluded.value_milli`,
      args: [userId, env, points, valueTaken],
    });
    throw err;
  }
  return { points, paidUgx: allowed, scalePercent };
}

/** Voids points (fraud). Used by staff. */
export async function voidPoints(userId: string, points: number): Promise<void> {
  const env = await getPlatformEnvironment();
  const row = (await db.execute({ sql: "SELECT points, value_milli FROM creator_points WHERE user_id = ? AND environment = ?", args: [userId, env] })).rows[0] as Row | undefined;
  if (!row || Number(row.points) <= 0) return;
  const take = Math.min(Number(row.points), Math.max(0, Math.round(points)));
  const value = Math.floor(Number(row.value_milli) * (take / Number(row.points)));
  await db.execute({ sql: "UPDATE creator_points SET points = points - ?, value_milli = MAX(0, value_milli - ?) WHERE user_id = ? AND environment = ?", args: [take, value, userId, env] });
}

/** Moves a creator's share of ad revenue into their earnings. Safe to repeat; only unsettled events are taken. */
export async function settleAdShare(userId: string): Promise<number> {
  const cfg = await requireChannels().catch(() => null);
  if (!cfg || !cfg.rewards.adShareEnabled) return 0;
  if (!(await hasTable("ad_events")) || !(await hasColumn("ad_events", "settled_at"))) return 0;
  const env = await getPlatformEnvironment();
  const rows = (await db.execute({
    sql: "SELECT id, creator_share_milli FROM ad_events WHERE creator_id = ? AND settled_at IS NULL AND creator_share_milli > 0 AND environment = ? ORDER BY id LIMIT 5000",
    args: [userId, env],
  })).rows as Row[];
  const total = rows.reduce((sum, r) => sum + Number(r.creator_share_milli), 0);
  const ugx = Math.floor(total / 1000);
  if (ugx <= 0) return 0;

  // Claim the events first and credit exactly what was claimed: if another request got some of them
  // already, those are theirs and are not counted twice.
  const ids = rows.map((r) => String(r.id));
  let claimedMilli = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const res = await db.execute({
      sql: `UPDATE ad_events SET settled_at = datetime('now') WHERE settled_at IS NULL AND id IN (${chunk.map(() => "?").join(",")}) RETURNING creator_share_milli`,
      args: chunk,
    });
    claimedMilli += (res.rows as Row[]).reduce((sum, r) => sum + Number(r.creator_share_milli), 0);
  }
  const credit = Math.floor(claimedMilli / 1000);
  if (credit <= 0) return 0;
  await creditCreator({ creatorId: userId, kind: "ad_share", grossUgx: credit, sourceId: `ad:${userId}:${ids[ids.length - 1]}:${claimedMilli}`, note: `Ad revenue share (${ids.length} ads)`, clearingPurpose: "ad_revenue", environment: env });
  return credit;
}

export async function postForView(postId: string): Promise<PostRow | null> {
  return getPost(postId);
}
