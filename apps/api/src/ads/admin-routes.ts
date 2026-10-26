import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { clientIp } from "../lib/ratelimit.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { parsePublicHttpsUrl } from "../video/url-guard.js";
import { adsReady, campaignReport } from "./service.js";
import { getAdsConfig, saveAdsConfig } from "./settings.js";

/** Admin: ad switches and timing, campaigns, and creatives. Everything is recorded in the activity log. */
export const adsAdminRoutes = new Hono();

const gate = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;
type Row = Record<string, unknown>;

adsAdminRoutes.get("/admin/ads", ...gate, async (c) => {
  const ready = await adsReady();
  return c.json({ config: await getAdsConfig(), migrationApplied: ready, campaigns: ready ? await campaignReport() : [] });
});

const configSchema = z.object({
  enabled: z.boolean().optional(),
  prerollEnabled: z.boolean().optional(),
  midrollEnabled: z.boolean().optional(),
  minVideoSeconds: z.number().optional(),
  midrollEveryMinutes: z.number().optional(),
  maxAdsPerView: z.number().optional(),
  maxAdSeconds: z.number().optional(),
  skipAfterSeconds: z.number().optional(),
  viewerCapPerHour: z.number().optional(),
  creatorSharePercent: z.number().optional(),
  houseAdsFallback: z.boolean().optional(),
  adFreeForMembers: z.boolean().optional(),
});

adsAdminRoutes.put("/admin/ads/config", ...gate, async (c) => {
  const body = configSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body", issues: body.error.issues }, 400);
  const { before, after } = await saveAdsConfig(body.data);
  await logActivity({ actor: c.get("user"), action: "ads.config.update", entityType: "settings", entityId: "ads_config", summary: "Updated ad settings", before, after, ip: clientIp(c) });
  return c.json({ config: after });
});

const campaignSchema = z.object({
  advertiserName: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  pricingModel: z.enum(["cpm", "cpv", "cpc"]).default("cpm"),
  rateUgx: z.number().int().min(0).max(100_000_000).default(0),
  budgetUgx: z.number().int().min(0).max(10_000_000_000).default(0),
  dailyCapUgx: z.number().int().min(0).max(10_000_000_000).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isHouse: z.boolean().default(false),
});

adsAdminRoutes.post("/admin/ads/campaigns", ...gate, async (c) => {
  if (!(await adsReady())) return c.json({ error: "not_ready", message: "Apply migration 0135_video_and_ads.sql first." }, 503);
  const body = campaignSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body", issues: body.error.issues }, 400);
  const d = body.data;
  const id = newId("cmp");
  // New campaigns start as drafts; they run only after a creative is approved and the campaign is activated.
  await db.execute({
    sql: `INSERT INTO ad_campaigns (id, advertiser_name, name, status, pricing_model, rate_ugx, budget_ugx, daily_cap_ugx, starts_at, ends_at, is_house, created_by, environment)
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, d.advertiserName, d.name, d.pricingModel, d.isHouse ? 0 : d.rateUgx, d.isHouse ? 0 : d.budgetUgx, d.dailyCapUgx, d.startsAt ?? null, d.endsAt ?? null, d.isHouse ? 1 : 0, c.get("user").sub, await getPlatformEnvironment()],
  });
  await logActivity({ actor: c.get("user"), action: "ads.campaign.create", entityType: "ad_campaign", entityId: id, summary: `Created ad campaign "${d.name}" for ${d.advertiserName}`, after: d, ip: clientIp(c) });
  return c.json({ id }, 201);
});

const statusSchema = z.object({ status: z.enum(["active", "paused", "ended"]) });

adsAdminRoutes.put("/admin/ads/campaigns/:id/status", ...gate, async (c) => {
  const id = (c.req.param("id") as string);
  const body = statusSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const camp = (await db.execute({ sql: "SELECT * FROM ad_campaigns WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!camp) return c.json({ error: "not_found" }, 404);
  if (body.data.status === "active") {
    const approved = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM ad_creatives WHERE campaign_id = ? AND status = 'approved'", args: [id] })).rows[0] as Row).n);
    if (!approved) return c.json({ error: "no_approved_creative", message: "Approve at least one creative first." }, 400);
    if (camp.is_house !== 1 && (Number(camp.budget_ugx) <= 0 || Number(camp.rate_ugx) <= 0)) {
      return c.json({ error: "needs_budget", message: "A paid campaign needs a rate and a budget." }, 400);
    }
  }
  await db.execute({ sql: "UPDATE ad_campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [body.data.status, id] });
  await logActivity({ actor: c.get("user"), action: "ads.campaign.status", entityType: "ad_campaign", entityId: id, summary: `Set ad campaign "${camp.name}" to ${body.data.status}`, before: { status: camp.status }, after: { status: body.data.status }, ip: clientIp(c) });
  return c.json({ ok: true });
});

const creativeSchema = z.object({
  kind: z.enum(["video", "image"]).default("video"),
  mediaUrl: z.string().max(2000),
  posterUrl: z.string().max(2000).nullable().optional(),
  clickUrl: z.string().max(2000).nullable().optional(),
  headline: z.string().max(80).nullable().optional(),
  ctaLabel: z.string().max(24).nullable().optional(),
  durationSeconds: z.number().int().min(1).max(180).default(15),
  skipAfterSeconds: z.number().int().min(0).max(60).nullable().optional(),
});

adsAdminRoutes.get("/admin/ads/campaigns/:id/creatives", ...gate, async (c) => {
  const res = await db.execute({ sql: "SELECT * FROM ad_creatives WHERE campaign_id = ? ORDER BY created_at DESC", args: [(c.req.param("id") as string)] });
  return c.json({ creatives: res.rows });
});

adsAdminRoutes.post("/admin/ads/campaigns/:id/creatives", ...gate, async (c) => {
  const campaignId = (c.req.param("id") as string);
  if (!(await db.execute({ sql: "SELECT 1 FROM ad_campaigns WHERE id = ?", args: [campaignId] })).rows[0]) return c.json({ error: "not_found" }, 404);
  const body = creativeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body", issues: body.error.issues }, 400);
  const d = body.data;
  // Ad media and the click-through are played and followed by viewers, so they must be public https addresses.
  for (const [label, value] of [["Media", d.mediaUrl], ["Poster", d.posterUrl], ["Click-through", d.clickUrl]] as const) {
    if (value && !parsePublicHttpsUrl(value)) return c.json({ error: "invalid_url", message: `${label} must be a public https address.` }, 400);
  }
  const id = newId("crv");
  // Admin-created creatives are approved on creation; a self-serve advertiser flow would start them as 'pending'.
  await db.execute({
    sql: `INSERT INTO ad_creatives (id, campaign_id, kind, media_url, poster_url, click_url, headline, cta_label, duration_seconds, skip_after_seconds, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
    args: [id, campaignId, d.kind, d.mediaUrl, d.posterUrl ?? null, d.clickUrl ?? null, d.headline ?? null, d.ctaLabel ?? null, d.durationSeconds, d.skipAfterSeconds ?? null],
  });
  await logActivity({ actor: c.get("user"), action: "ads.creative.create", entityType: "ad_creative", entityId: id, summary: `Added an ad creative to campaign ${campaignId}`, after: d, ip: clientIp(c) });
  return c.json({ id }, 201);
});

const reviewSchema = z.object({ status: z.enum(["approved", "rejected", "paused"]), reason: z.string().max(300).optional() });

adsAdminRoutes.put("/admin/ads/creatives/:id/status", ...gate, async (c) => {
  const id = (c.req.param("id") as string);
  const body = reviewSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  if (body.data.status === "rejected" && !body.data.reason) return c.json({ error: "reason_required", message: "Give a reason for rejecting a creative." }, 400);
  const res = await db.execute({ sql: "UPDATE ad_creatives SET status = ?, rejection_reason = ? WHERE id = ?", args: [body.data.status, body.data.status === "rejected" ? body.data.reason! : null, id] });
  if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
  await logActivity({ actor: c.get("user"), action: "ads.creative.review", entityType: "ad_creative", entityId: id, summary: `Set ad creative ${id} to ${body.data.status}`, after: body.data, ip: clientIp(c) });
  return c.json({ ok: true });
});
