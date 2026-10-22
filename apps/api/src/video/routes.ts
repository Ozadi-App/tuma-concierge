import { Hono, type Context } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { consume } from "../lib/ratelimit.js";
import { VIDEO_ADAPTERS } from "./adapters/index.js";
import { clearCredentials, hasRequiredFields, loadCredentials, saveCredentials, validFieldKeys } from "./credentials.js";
import { getVideoConfig } from "./settings.js";
import {
  getAsset, importVideo, isProviderKey, playbackFor, providerCatalogue, publicAsset, refreshAsset, removeAsset, startUpload, VideoRequestError,
} from "./service.js";
import { VideoProviderError } from "./types.js";

/**
 * Creator video. A creator adds a video by uploading through Peebee's provider, by uploading to their
 * own connected provider account, or by bringing one that already exists. Peebee keeps only the
 * video's address; ads and access rules stay Peebee's.
 */
export const videoRoutes = new Hono();

function fail(c: Context, err: unknown) {
  if (err instanceof VideoRequestError) return c.json({ error: err.code, message: err.clientMessage }, err.status);
  console.error("video route error:", err);
  return c.json({ error: "video_failed", message: "Something went wrong with the video. Please try again." }, 500);
}

/** How a creator can add video right now, and which of their own accounts are connected. */
videoRoutes.get("/video/providers", requireAuth, async (c) => {
  const user = c.get("user");
  const config = await getVideoConfig();
  return c.json({
    enabled: config.enabled,
    byoEnabled: config.byoEnabled,
    maxDurationSeconds: config.maxDurationSeconds,
    providers: await providerCatalogue(user.sub),
  });
});

const connectSchema = z.object({ fields: z.record(z.string(), z.string().max(2000)) });

/** Connect (or update) the creator's own account for a provider, after checking the keys really work. */
videoRoutes.put("/video/connections/:provider", requireAuth, async (c) => {
  const user = c.get("user");
  const provider = (c.req.param("provider") as string);
  if (!isProviderKey(provider) || !VIDEO_ADAPTERS[provider].credentialFields.length) return c.json({ error: "invalid_provider" }, 400);
  const config = await getVideoConfig();
  if (!config.enabled || !config.byoEnabled || !config.byoProviders.includes(provider)) {
    return c.json({ error: "byo_disabled", message: "Bringing your own video account is not available yet." }, 403);
  }
  const body = connectSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const unknown = Object.keys(body.data.fields).filter((k) => !validFieldKeys(provider).includes(k));
  if (unknown.length) return c.json({ error: "unknown_field", fields: unknown }, 400);

  // Each check calls the provider with the creator's keys, so it is limited.
  const limit = await consume(`video-connect:${user.sub}`, 10, 3600);
  if (!limit.allowed) return c.json({ error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds }, 429);

  // Check the keys as they would end up (saved fields plus these), and only keep them if they work.
  const merged = { ...(await loadCredentials(user.sub, provider)), ...Object.fromEntries(Object.entries(body.data.fields).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) };
  if (!hasRequiredFields(provider, merged)) return c.json({ error: "missing_fields", message: "Fill in every required field." }, 400);
  try {
    await VIDEO_ADAPTERS[provider].verifyCredentials(merged);
  } catch (err) {
    if (err instanceof VideoProviderError) return c.json({ error: `provider_${err.code}`, message: err.clientMessage }, 400);
    return fail(c, err);
  }
  const changed = await saveCredentials(user.sub, provider, body.data.fields);
  return c.json({ connected: true, changed });
});

videoRoutes.delete("/video/connections/:provider", requireAuth, async (c) => {
  const provider = (c.req.param("provider") as string);
  if (!isProviderKey(provider)) return c.json({ error: "invalid_provider" }, 400);
  await clearCredentials(c.get("user").sub, provider);
  return c.json({ ok: true });
});

const uploadSchema = z.object({
  source: z.enum(["platform", "byo"]),
  provider: z.string().optional(),
  title: z.string().max(120).optional(),
  maxDurationSeconds: z.number().int().positive().optional(),
  protectedPlayback: z.boolean().optional(),
});

/** Start an upload. The device then sends the file straight to the provider using the instructions returned. */
videoRoutes.post("/video/uploads", requireAuth, async (c) => {
  const user = c.get("user");
  const body = uploadSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  if (body.data.provider !== undefined && !isProviderKey(body.data.provider)) return c.json({ error: "invalid_provider" }, 400);
  try {
    const { asset, upload } = await startUpload(user.sub, { ...body.data, provider: body.data.provider as never });
    return c.json({ asset: publicAsset(asset, true), upload }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

const importSchema = z.object({ provider: z.string(), reference: z.string().min(1).max(2000), title: z.string().max(120).optional() });

/** Bring in a video that already exists in the creator's account, or at a public address. */
videoRoutes.post("/video/assets/import", requireAuth, async (c) => {
  const user = c.get("user");
  const body = importSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success || !isProviderKey(body.data.provider)) return c.json({ error: "invalid_body" }, 400);
  const limit = await consume(`video-import:${user.sub}`, 30, 3600);
  if (!limit.allowed) return c.json({ error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  try {
    const asset = await importVideo(user.sub, { provider: body.data.provider, reference: body.data.reference, title: body.data.title });
    return c.json({ asset: publicAsset(asset, true) }, 201);
  } catch (err) {
    return fail(c, err);
  }
});

/** One video, with its status refreshed from the provider while it is still being prepared. Owner only. */
videoRoutes.get("/video/assets/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const row = await getAsset((c.req.param("id") as string));
  if (!row || row.owner_id !== user.sub) return c.json({ error: "not_found" }, 404);
  try {
    return c.json({ asset: publicAsset(await refreshAsset(row), true) });
  } catch (err) {
    return fail(c, err);
  }
});

/**
 * Addresses to play a video. Public videos play for anyone. A protected video is signed only once the
 * post that carries it has cleared the viewer; until posts exist only the owner qualifies.
 */
videoRoutes.get("/video/assets/:id/playback", requireAuth, async (c) => {
  const user = c.get("user");
  const row = await getAsset((c.req.param("id") as string));
  if (!row) return c.json({ error: "not_found" }, 404);
  try {
    const sources = await playbackFor(row, { cleared: row.owner_id === user.sub });
    c.header("Cache-Control", "private, no-store");
    return c.json({ playback: sources, asset: publicAsset(row, row.owner_id === user.sub) });
  } catch (err) {
    return fail(c, err);
  }
});

videoRoutes.delete("/video/assets/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const row = await getAsset((c.req.param("id") as string));
  if (!row || row.owner_id !== user.sub) return c.json({ error: "not_found" }, 404);
  await removeAsset(row);
  return c.json({ ok: true });
});
