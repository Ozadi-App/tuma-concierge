/**
 * Peebee's ad server for creator videos. Peebee alone decides what ads run, on any video, whichever
 * provider holds the file: a viewer's player asks for an ad for a slot, plays it, and reports what
 * happened with signed beacons. Advertisers are charged per the campaign's pricing, and the creator
 * whose video carried the ad earns their share (an Admin setting).
 */
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { getAsset } from "../video/service.js";
import { getAdsConfig, type AdsConfig } from "./settings.js";
import { signServe, verifyServe, type ServeClaims } from "./token.js";

type Row = Record<string, unknown>;

export const AD_SLOTS = ["preroll", "midroll"] as const;
export type AdSlot = (typeof AD_SLOTS)[number];
export const AD_EVENTS = ["impression", "q25", "q50", "q75", "complete", "click", "skip"] as const;
export type AdEvent = (typeof AD_EVENTS)[number];

const SERVE_TTL_SECONDS = 30 * 60;

export type AdDecision = {
  serveId: string;
  token: string;
  slot: AdSlot;
  creative: {
    kind: "video" | "image";
    mediaUrl: string;
    posterUrl: string | null;
    headline: string | null;
    ctaLabel: string | null;
    hasClickThrough: boolean;
    durationSeconds: number;
    /** Seconds before the viewer may skip. */
    skipAfterSeconds: number;
  };
};

export async function adsReady(): Promise<boolean> {
  return (await hasTable("ad_campaigns")) && (await hasTable("ad_creatives")) && (await hasTable("ad_events"));
}

/** Which ad slots a video of this length gets, from the admin settings. */
export function adPlan(config: AdsConfig, durationSeconds: number | null): { preroll: boolean; midrollAtSeconds: number[] } {
  if (!config.enabled) return { preroll: false, midrollAtSeconds: [] };
  if (durationSeconds !== null && durationSeconds < config.minVideoSeconds) return { preroll: false, midrollAtSeconds: [] };
  const mid: number[] = [];
  // A video of unknown length gets a pre-roll at most: there is no way to place a mid-roll.
  if (config.midrollEnabled && durationSeconds !== null) {
    const every = config.midrollEveryMinutes * 60;
    // Never within the first interval, never in the last 30 seconds.
    for (let t = every; t < durationSeconds - 30 && mid.length < config.maxAdsPerView; t += every) mid.push(t);
  }
  return { preroll: config.prerollEnabled, midrollAtSeconds: mid };
}

async function count(sql: string, args: Array<string | number>): Promise<number> {
  const res = await db.execute({ sql, args });
  return Number((res.rows[0] as Row | undefined)?.n ?? 0);
}

type Candidate = {
  creative_id: string; campaign_id: string; kind: "video" | "image"; media_url: string; poster_url: string | null; click_url: string | null;
  headline: string | null; cta_label: string | null; duration_seconds: number; skip_after_seconds: number | null;
  is_house: number; daily_cap_ugx: number; today_milli: number;
};

/** Picks the ad for a slot, or null when there should be none. */
export async function decide(input: {
  assetId: string;
  slot: AdSlot;
  viewerKey: string;
  /** True when the viewer pays for this channel and the admin setting gives members an ad-free view. */
  adFree?: boolean;
}): Promise<AdDecision | null> {
  const config = await getAdsConfig();
  if (!config.enabled || !(await adsReady())) return null;
  if (input.slot === "preroll" ? !config.prerollEnabled : !config.midrollEnabled) return null;
  if (input.adFree && config.adFreeForMembers) return null;

  const asset = await getAsset(input.assetId);
  if (!asset || asset.status !== "ready") return null;
  const plan = adPlan(config, asset.duration_seconds);
  if (input.slot === "preroll" ? !plan.preroll : plan.midrollAtSeconds.length === 0) return null;

  if ((await count("SELECT COUNT(*) AS n FROM ad_events WHERE viewer_key = ? AND event = 'impression' AND created_at > datetime('now', '-1 hour')", [input.viewerKey])) >= config.viewerCapPerHour) return null;
  if ((await count("SELECT COUNT(*) AS n FROM ad_events WHERE viewer_key = ? AND video_asset_id = ? AND event = 'impression' AND created_at > datetime('now', '-30 minutes')", [input.viewerKey, asset.id])) >= config.maxAdsPerView) return null;

  const env = await getPlatformEnvironment();
  const res = await db.execute({
    sql: `SELECT cr.id AS creative_id, cr.campaign_id, cr.kind, cr.media_url, cr.poster_url, cr.click_url, cr.headline, cr.cta_label, cr.duration_seconds, cr.skip_after_seconds,
                 c.is_house, c.daily_cap_ugx,
                 (SELECT COALESCE(SUM(e.cost_milli), 0) FROM ad_events e WHERE e.campaign_id = c.id AND e.created_at >= date('now')) AS today_milli
          FROM ad_creatives cr JOIN ad_campaigns c ON c.id = cr.campaign_id
          WHERE c.status = 'active' AND c.environment = ? AND cr.status = 'approved'
            AND (c.starts_at IS NULL OR c.starts_at <= datetime('now')) AND (c.ends_at IS NULL OR c.ends_at > datetime('now'))
            AND cr.duration_seconds <= ?
            AND (c.is_house = 1 OR c.spent_milli < c.budget_ugx * 1000)`,
    args: [env, config.maxAdSeconds],
  });
  const eligible = (res.rows as unknown as Candidate[]).filter((r) => r.is_house === 1 || r.daily_cap_ugx === 0 || r.today_milli < r.daily_cap_ugx * 1000);
  const paid = eligible.filter((r) => r.is_house !== 1);
  const pool = paid.length ? paid : config.houseAdsFallback ? eligible.filter((r) => r.is_house === 1) : [];
  if (!pool.length) return null;
  const chosen = pool[Math.floor(Math.random() * pool.length)]!;

  const serveId = newId("srv");
  const claims: ServeClaims = {
    serve: serveId, campaign: chosen.campaign_id, creative: chosen.creative_id, asset: asset.id, creator: asset.owner_id,
    viewer: input.viewerKey, slot: input.slot, exp: Math.floor(Date.now() / 1000) + SERVE_TTL_SECONDS,
  };
  return {
    serveId,
    token: signServe(claims),
    slot: input.slot,
    creative: {
      kind: chosen.kind,
      mediaUrl: chosen.media_url,
      posterUrl: chosen.poster_url,
      headline: chosen.headline,
      ctaLabel: chosen.cta_label,
      hasClickThrough: !!chosen.click_url,
      durationSeconds: chosen.duration_seconds,
      skipAfterSeconds: chosen.skip_after_seconds ?? config.skipAfterSeconds,
    },
  };
}

/** What an event costs the advertiser, in thousandths of a shilling. */
export function eventCostMilli(pricing: "cpm" | "cpv" | "cpc", rateUgx: number, event: AdEvent): number {
  if (pricing === "cpm") return event === "impression" ? rateUgx : 0; // rate per 1,000 impressions = rate milli-UGX each
  if (pricing === "cpv") return event === "complete" ? rateUgx * 1000 : 0;
  return event === "click" ? rateUgx * 1000 : 0;
}

export function creatorShareMilli(costMilli: number, percent: number): number {
  return Math.floor((costMilli * percent) / 100);
}

/**
 * Counts one event on a served ad. Safe to repeat: each event is counted once per served ad. Returns
 * whether it was counted, plus the click-through address for a click.
 */
export async function recordEvent(token: string, event: AdEvent): Promise<{ recorded: boolean; clickUrl?: string | null }> {
  const claims = verifyServe(token);
  if (!claims || !(await adsReady())) return { recorded: false };
  const camp = (await db.execute({ sql: "SELECT pricing_model, rate_ugx, is_house, budget_ugx, environment FROM ad_campaigns WHERE id = ?", args: [claims.campaign] })).rows[0] as Row | undefined;
  const creative = (await db.execute({ sql: "SELECT click_url FROM ad_creatives WHERE id = ?", args: [claims.creative] })).rows[0] as Row | undefined;
  if (!camp || !creative) return { recorded: false };
  const clickUrl = (creative.click_url as string | null) ?? null;

  // Every later event needs the impression first.
  if (event !== "impression" && (await count("SELECT COUNT(*) AS n FROM ad_events WHERE serve_id = ? AND event = 'impression'", [claims.serve])) === 0) {
    return { recorded: false, clickUrl };
  }

  const config = await getAdsConfig();
  const selfView = !!claims.creator && claims.viewer === claims.creator;
  let cost = camp.is_house === 1 || selfView ? 0 : eventCostMilli(camp.pricing_model as "cpm" | "cpv" | "cpc", Number(camp.rate_ugx), event);
  let share = claims.creator && !selfView ? creatorShareMilli(cost, config.creatorSharePercent) : 0;

  const eventId = newId("evt");
  const inserted = await db.execute({
    sql: `INSERT OR IGNORE INTO ad_events (id, serve_id, event, campaign_id, creative_id, video_asset_id, creator_id, viewer_key, slot, cost_milli, creator_share_milli, environment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [eventId, claims.serve, event, claims.campaign, claims.creative, claims.asset, claims.creator, claims.viewer, claims.slot, cost, share, camp.environment as string],
  });
  if (!inserted.rowsAffected) return { recorded: false, clickUrl };

  if (cost > 0) {
    // Reserve the spend atomically; a campaign that cannot afford this event is over budget.
    const reserved = await db.execute({
      sql: "UPDATE ad_campaigns SET spent_milli = spent_milli + ?, updated_at = datetime('now') WHERE id = ? AND spent_milli + ? <= budget_ugx * 1000",
      args: [cost, claims.campaign, cost],
    });
    if (!reserved.rowsAffected) {
      cost = 0;
      share = 0;
      await db.execute({ sql: "UPDATE ad_events SET cost_milli = 0, creator_share_milli = 0 WHERE id = ?", args: [eventId] });
      await db.execute({ sql: "UPDATE ad_campaigns SET status = 'ended', updated_at = datetime('now') WHERE id = ? AND status = 'active'", args: [claims.campaign] });
    }
  }
  return { recorded: true, clickUrl };
}

/** Where a click goes (for the redirect), without counting anything. */
export async function clickTarget(token: string): Promise<string | null> {
  const claims = verifyServe(token);
  if (!claims) return null;
  const row = (await db.execute({ sql: "SELECT click_url FROM ad_creatives WHERE id = ?", args: [claims.creative] })).rows[0] as Row | undefined;
  return (row?.click_url as string | null) ?? null;
}

const milliToUgx = (m: number) => Math.floor(m / 1000);

/** Per-campaign totals for the Admin report. */
export async function campaignReport(): Promise<Array<Record<string, unknown>>> {
  const res = await db.execute({
    sql: `SELECT c.id, c.name, c.advertiser_name, c.status, c.pricing_model, c.rate_ugx, c.budget_ugx, c.spent_milli, c.is_house,
                 COALESCE(SUM(e.event = 'impression'), 0) AS impressions, COALESCE(SUM(e.event = 'complete'), 0) AS completes,
                 COALESCE(SUM(e.event = 'click'), 0) AS clicks, COALESCE(SUM(e.event = 'skip'), 0) AS skips,
                 COALESCE(SUM(e.creator_share_milli), 0) AS creator_milli
          FROM ad_campaigns c LEFT JOIN ad_events e ON e.campaign_id = c.id
          GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
    args: [],
  });
  return (res.rows as unknown as Row[]).map((r) => ({
    id: r.id, name: r.name, advertiser: r.advertiser_name, status: r.status, pricingModel: r.pricing_model, rateUgx: r.rate_ugx,
    budgetUgx: r.budget_ugx, spentUgx: milliToUgx(Number(r.spent_milli)), house: r.is_house === 1,
    impressions: Number(r.impressions), completes: Number(r.completes), clicks: Number(r.clicks), skips: Number(r.skips),
    creatorEarnedUgx: milliToUgx(Number(r.creator_milli)),
  }));
}

/** What a creator has earned from ads on their videos. */
export async function creatorEarnings(creatorId: string, days = 30) {
  if (!(await adsReady())) return { impressions: 0, earnedUgx: 0, days };
  const res = await db.execute({
    sql: `SELECT COALESCE(SUM(event = 'impression'), 0) AS impressions, COALESCE(SUM(creator_share_milli), 0) AS milli
          FROM ad_events WHERE creator_id = ? AND created_at > datetime('now', ?)`,
    args: [creatorId, `-${days} days`],
  });
  const r = res.rows[0] as Row | undefined;
  return { impressions: Number(r?.impressions ?? 0), earnedUgx: milliToUgx(Number(r?.milli ?? 0)), days };
}
