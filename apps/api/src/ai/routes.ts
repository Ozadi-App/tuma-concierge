import { Hono } from "hono";
import { z } from "zod";
import { isAiFeature } from "@peebee/shared";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { isCredentialsEncryptionConfigured } from "../lib/crypto.js";
import { clientIp } from "../lib/ratelimit.js";
import { aiFeaturesOverview, setFeatureEnabled, setSeparate } from "./features.js";

/** Admin → AI features: which AI features are on, and whether they share one set of Google AI keys or each has its own. */
export const aiFeatureRoutes = new Hono();
const gate = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;

aiFeatureRoutes.get("/admin/ai-features", ...gate, async (c) => c.json({ ...(await aiFeaturesOverview()), encryptionConfigured: isCredentialsEncryptionConfigured() }));

const separateSchema = z.object({
  separate: z.boolean(),
  /** Raw keys per feature, added (and checked with Google) before the switch is saved. */
  keys: z.record(z.string(), z.array(z.string().max(200)).max(20)).optional(),
});

aiFeatureRoutes.put("/admin/ai-features/separate", ...gate, async (c) => {
  const parsed = separateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  if (parsed.data.separate && Object.values(parsed.data.keys ?? {}).some((l) => l.length > 0) && !isCredentialsEncryptionConfigured()) {
    return c.json({ error: "no_encryption", message: "CREDENTIALS_ENCRYPTION_KEY isn't set, so keys can't be stored safely." }, 503);
  }
  const user = c.get("user");
  const result = await setSeparate(parsed.data.separate, parsed.data.keys ?? {}, user, clientIp(c), user.sub);
  if (!result.ok) return c.json({ error: result.error, message: result.message, missing: result.missing, results: result.results, overview: await aiFeaturesOverview() }, result.status);
  return c.json({ results: result.results, overview: await aiFeaturesOverview() });
});

aiFeatureRoutes.put("/admin/ai-features/:id/enabled", ...gate, async (c) => {
  const id = c.req.param("id") ?? "";
  if (!isAiFeature(id)) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const result = await setFeatureEnabled(id, parsed.data.enabled, c.get("user"), clientIp(c));
  if (!result.ok) return c.json({ error: "keys_required", message: result.message }, result.status ?? 400);
  return c.json({ overview: await aiFeaturesOverview() });
});
