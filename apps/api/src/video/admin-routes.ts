import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { clientIp } from "../lib/ratelimit.js";
import { VIDEO_ADAPTERS } from "./adapters/index.js";
import { clearCredentials, credentialStatus, hasRequiredFields, loadCredentials, PLATFORM, saveCredentials, validFieldKeys } from "./credentials.js";
import { getVideoConfig, saveVideoConfig } from "./settings.js";
import { isProviderKey, videoReady } from "./service.js";
import { VIDEO_PROVIDERS, VideoProviderError } from "./types.js";

/** Admin: the video switches and limits, and the platform's own provider accounts. */
export const videoAdminRoutes = new Hono();

const gate = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;

videoAdminRoutes.get("/admin/video", ...gate, async (c) => {
  const providers = [];
  for (const key of VIDEO_PROVIDERS) {
    if (key === "mock" || key === "link") continue;
    const creds = await loadCredentials(PLATFORM, key);
    const adapter = VIDEO_ADAPTERS[key];
    providers.push({
      key,
      displayName: adapter.displayName,
      summary: adapter.summary,
      configured: hasRequiredFields(key, creds),
      supportsProtectedPlayback: adapter.supportsSignedPlayback(creds),
      credentialFields: await credentialStatus(PLATFORM, key),
    });
  }
  return c.json({ config: await getVideoConfig(), migrationApplied: await videoReady(), providers });
});

const configSchema = z.object({
  enabled: z.boolean().optional(),
  platformProviders: z.array(z.string()).max(10).optional(),
  byoEnabled: z.boolean().optional(),
  byoProviders: z.array(z.string()).max(10).optional(),
  maxDurationSeconds: z.number().optional(),
  maxVideosPerDay: z.number().optional(),
  signedPlaybackTtlSeconds: z.number().optional(),
});

videoAdminRoutes.put("/admin/video/config", ...gate, async (c) => {
  const user = c.get("user");
  const body = configSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body", issues: body.error.issues }, 400);
  const { before, after } = await saveVideoConfig(body.data as never);
  await logActivity({ actor: user, action: "video.config.update", entityType: "settings", entityId: "video_config", summary: "Updated creator video settings", before, after, ip: clientIp(c) });
  return c.json({ config: after });
});

const credentialsSchema = z.object({ fields: z.record(z.string(), z.string().max(2000)) });

videoAdminRoutes.put("/admin/video/credentials/:provider", ...gate, async (c) => {
  const user = c.get("user");
  const provider = (c.req.param("provider") as string);
  if (!isProviderKey(provider) || !VIDEO_ADAPTERS[provider].credentialFields.length) return c.json({ error: "invalid_provider" }, 400);
  const body = credentialsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_body" }, 400);
  const unknown = Object.keys(body.data.fields).filter((k) => !validFieldKeys(provider).includes(k));
  if (unknown.length) return c.json({ error: "unknown_field", fields: unknown }, 400);
  const changed = await saveCredentials(PLATFORM, provider, body.data.fields);
  if (changed.length) {
    // Only the names of the fields that changed are recorded, never their values.
    await logActivity({ actor: user, action: "video.credentials.update", entityType: "video_credentials", entityId: provider, summary: `Updated ${provider} video credentials: ${changed.join(", ")}`, ip: clientIp(c) });
  }
  return c.json({ changed });
});

videoAdminRoutes.delete("/admin/video/credentials/:provider", ...gate, async (c) => {
  const user = c.get("user");
  const provider = (c.req.param("provider") as string);
  if (!isProviderKey(provider)) return c.json({ error: "invalid_provider" }, 400);
  await clearCredentials(PLATFORM, provider);
  await logActivity({ actor: user, action: "video.credentials.clear", entityType: "video_credentials", entityId: provider, summary: `Cleared ${provider} video credentials`, ip: clientIp(c) });
  return c.json({ ok: true });
});

/** Calls the provider with the saved platform keys to check they work. */
videoAdminRoutes.post("/admin/video/credentials/:provider/test", ...gate, async (c) => {
  const provider = (c.req.param("provider") as string);
  if (!isProviderKey(provider)) return c.json({ error: "invalid_provider" }, 400);
  const creds = await loadCredentials(PLATFORM, provider);
  if (!hasRequiredFields(provider, creds)) return c.json({ ok: false, message: "Save every required field first." });
  try {
    await VIDEO_ADAPTERS[provider].verifyCredentials(creds);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, message: err instanceof VideoProviderError ? (err.code === "unavailable" && err.upstreamMessage ? `${err.clientMessage} (${err.upstreamMessage})` : err.clientMessage) : "The check failed." });
  }
});
