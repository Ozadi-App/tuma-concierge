import { Hono, type Context } from "hono";
import { requireAuth } from "../auth/middleware.js";
import { verifyToken } from "../auth/jwt.js";
import { clientIp, consume, hashKey } from "../lib/ratelimit.js";
import { getAsset } from "../video/service.js";
import { AD_EVENTS, AD_SLOTS, adPlan, adsReady, clickTarget, creatorEarnings, decide, recordEvent, type AdEvent, type AdSlot } from "./service.js";
import { getAdsConfig } from "./settings.js";
import { buildVast, EMPTY_VAST } from "./vast.js";

/**
 * What a player calls to show ads. Open to people who are not signed in, because public channel and
 * campaign pages are watched without an account; those viewers are told apart by a hash of their
 * network address and browser, which is only used to cap how often they see ads.
 */
export const adsRoutes = new Hono();

/** The signed-in viewer's id if there is a valid token, otherwise a hash of the visitor. */
async function viewerKey(c: Context): Promise<string> {
  const header = c.req.header("Authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    try {
      return (await verifyToken(header.slice(7))).sub;
    } catch {
      /* fall through to the anonymous key */
    }
  }
  return `anon_${await hashKey(`${clientIp(c)}|${c.req.header("user-agent") ?? ""}`)}`;
}

const origin = (c: Context) => new URL(c.req.url).origin;

async function ask(c: Context) {
  const assetId = c.req.query("asset") ?? "";
  const slot = c.req.query("slot") ?? "preroll";
  if (!assetId || !(AD_SLOTS as readonly string[]).includes(slot)) return { error: c.json({ error: "invalid_query" }, 400) } as const;
  const viewer = await viewerKey(c);
  const quota = await consume(`ad-decision:${viewer}`, 120, 3600);
  if (!quota.allowed) return { error: c.json({ error: "rate_limited", retryAfterSeconds: quota.retryAfterSeconds }, 429) } as const;
  return { ad: await decide({ assetId, slot: slot as AdSlot, viewerKey: viewer }) } as const;
}

/** When ads run on one video: a pre-roll, and where the mid-rolls fall. Nothing is charged for asking. */
adsRoutes.get("/ads/plan", async (c) => {
  const config = await getAdsConfig();
  const asset = c.req.query("asset") ? await getAsset(c.req.query("asset")!) : null;
  c.header("Cache-Control", "public, max-age=60");
  if (!asset || !(await adsReady())) return c.json({ preroll: false, midrollAtSeconds: [], skipAfterSeconds: config.skipAfterSeconds });
  return c.json({ ...adPlan(config, asset.duration_seconds), skipAfterSeconds: config.skipAfterSeconds });
});

/** The ad to play for a slot, as JSON for Peebee's own player. `ad` is null when there is none. */
adsRoutes.get("/ads/decision", async (c) => {
  const r = await ask(c);
  if ("error" in r) return r.error;
  c.header("Cache-Control", "no-store");
  return c.json({ ad: r.ad });
});

/** The same decision as VAST 4.0, for a standard video player. */
adsRoutes.get("/ads/vast", async (c) => {
  const r = await ask(c);
  if ("error" in r) return r.error;
  c.header("Cache-Control", "no-store");
  c.header("Content-Type", "application/xml; charset=utf-8");
  const ad = r.ad;
  return c.body(ad && ad.creative.kind === "video" ? buildVast(ad, origin(c)) : EMPTY_VAST);
});

/** Player beacons. GET so a VAST tracking pixel can call it; always answers 204 so a player never stalls on it. */
adsRoutes.on(["GET", "POST"], "/ads/e/:token/:event", async (c) => {
  const event = (c.req.param("event") as string);
  if ((AD_EVENTS as readonly string[]).includes(event) && event !== "click") {
    await recordEvent((c.req.param("token") as string), event as AdEvent).catch((err) => console.error("ad event failed:", err));
  }
  return c.body(null, 204);
});

/** A click: counted once, then the viewer goes to the advertiser's page. */
adsRoutes.get("/ads/click/:token", async (c) => {
  const token = (c.req.param("token") as string);
  const result = await recordEvent(token, "click").catch(() => ({ recorded: false, clickUrl: null as string | null }));
  const target = result.clickUrl ?? (await clickTarget(token));
  // Only ever send people to an https address the admin approved with the creative.
  if (!target || !/^https:\/\//i.test(target)) return c.body(null, 204);
  return c.redirect(target, 302);
});

/** What the signed-in creator has earned from ads on their videos. */
adsRoutes.get("/ads/earnings", requireAuth, async (c) => {
  const days = Math.max(1, Math.min(365, Number(c.req.query("days")) || 30));
  return c.json(await creatorEarnings(c.get("user").sub, days));
});
