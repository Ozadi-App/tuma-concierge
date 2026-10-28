import type { AppUpdateApp, AppUpdatesSettings } from "@peebee/shared";
import { APP_UPDATE_APPS } from "@peebee/shared";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { getSetting, getSettingRaw, setSetting, type SettingKey } from "../lib/settings.js";
import { clientIp } from "../lib/ratelimit.js";
import { getR2Bucket } from "../storage/r2.js";
import { MAX_FILES_PER_VERSION, MAX_FILE_BYTES, MAX_VERSION_BYTES, addVersion, decideCheck, fileKey, isSafePath, isSha256, isUpdateApp, isValidVersionId, manifestKey, parseManifest, parseRegistry, safeEqual, sha256Hex, type ManifestEntry } from "./logic.js";

const registryKey = (app: AppUpdateApp): SettingKey => `app_updates_${app}` as SettingKey;

async function loadRegistry(app: AppUpdateApp) {
  return parseRegistry(await getSettingRaw(registryKey(app)));
}

async function saveRegistry(app: AppUpdateApp, registry: ReturnType<typeof parseRegistry>) {
  await setSetting(registryKey(app), JSON.stringify(registry));
}

async function loadManifest(app: AppUpdateApp, id: string): Promise<ManifestEntry[] | null> {
  const object = await getR2Bucket().get(manifestKey(app, id));
  return object ? parseManifest(await new Response(object.body).text()) : null;
}

/**
 * Removes the stored lists of deleted versions, and any file no remaining version uses. It must never fail the request
 * that triggered it: a leftover file is harmless.
 */
async function dropVersions(app: AppUpdateApp, ids: string[], remaining: string[]) {
  if (!ids.length) return;
  try {
    const bucket = getR2Bucket();
    const stillUsed = new Set<string>();
    for (const id of remaining) for (const e of (await loadManifest(app, id)) ?? []) stillUsed.add(e.sha256);
    const orphans = new Set<string>();
    for (const id of ids) {
      for (const e of (await loadManifest(app, id)) ?? []) if (!stillUsed.has(e.sha256)) orphans.add(e.sha256);
      await bucket.delete(manifestKey(app, id));
    }
    await Promise.all([...orphans].map((sha) => bucket.delete(fileKey(app, sha))));
  } catch {
    /* leftovers are harmless */
  }
}

/** The publish token check shared by every upload call. Returns an error response, or null when the caller may publish. */
function publishDenied(c: Context): Response | null {
  const expected = process.env.APP_UPDATES_PUBLISH_TOKEN ?? "";
  if (expected.length < 24) return c.json({ error: "publishing_not_configured", message: "Set APP_UPDATES_PUBLISH_TOKEN (at least 24 characters) on the API." }, 503);
  const given = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return safeEqual(given, expected) ? null : c.json({ error: "unauthorized" }, 401);
}

/**
 * The part of the update server that phones and the build pipeline call. No sign-in: a phone is not a user. What a
 * phone can learn here (which version is live, the app's own screens) is not secret, and publishing needs the token.
 */
export const appUpdatesRoutes = new Hono();

/**
 * The phone's update check (the Capgo updater's protocol): it sends what it runs now and expects either the new
 * version with the list of its files (the phone keeps the ones it has and downloads only the others), or an `error` +
 * `kind: "up_to_date"` when there is nothing to do.
 */
appUpdatesRoutes.post("/app-updates/:app/check", async (c) => {
  const app = c.req.param("app");
  if (!isUpdateApp(app)) return c.json({ error: "unknown_app", message: "Unknown app", kind: "failed" }, 404);
  const device = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const [enabled, registry] = await Promise.all([getSetting("app_updates_enabled"), loadRegistry(app)]);
  const answer = decideCheck(enabled === "1", registry, { versionName: device.version_name, versionCode: device.version_code });
  if (answer.kind === "update") {
    const manifest = await loadManifest(app, answer.version.id);
    if (!manifest) return c.json({ error: "no_new_version_available", message: "The new version is not ready", kind: "up_to_date" });
    const origin = new URL(c.req.url).origin;
    return c.json({
      version: answer.version.id,
      // The updater insists on a link here; with a file list it downloads the files below instead.
      url: `${origin}/v1/app-updates/${app}/manifests/${answer.version.id}.json`,
      manifest: manifest.map((e) => ({ file_name: e.path, file_hash: e.sha256, download_url: `${origin}/v1/app-updates/${app}/files/${e.sha256}` })),
    });
  }
  if (answer.kind === "blocked") return c.json({ error: answer.error, message: answer.message, kind: "blocked" });
  return c.json({ error: "no_new_version_available", message: answer.message, kind: "up_to_date" });
});

/** A file of the app, by the checksum of its contents: it never changes, so phones and the network can keep it forever. */
appUpdatesRoutes.get("/app-updates/:app/files/:sha256", async (c) => {
  const app = c.req.param("app");
  const sha = c.req.param("sha256");
  if (!isUpdateApp(app) || !isSha256(sha)) return c.json({ error: "not_found" }, 404);
  const object = await getR2Bucket().get(fileKey(app, sha));
  if (!object) return c.json({ error: "not_found" }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(object.size ? { "Content-Length": String(object.size) } : {}),
    },
  });
});

/** The list of files of one version (what the check answer carries), for people and tools to look at. */
appUpdatesRoutes.get("/app-updates/:app/manifests/:file", async (c) => {
  const app = c.req.param("app");
  const id = c.req.param("file").replace(/\.json$/, "");
  if (!isUpdateApp(app) || !isValidVersionId(id)) return c.json({ error: "not_found" }, 404);
  const manifest = await loadManifest(app, id);
  return manifest ? c.json(manifest) : c.json({ error: "not_found" }, 404);
});

/** Which of these checksums the server does not have yet. The pipeline uploads only those. */
appUpdatesRoutes.post("/app-updates/:app/files/missing", async (c) => {
  const app = c.req.param("app");
  if (!isUpdateApp(app)) return c.json({ error: "unknown_app" }, 404);
  const denied = publishDenied(c);
  if (denied) return denied;
  const body = (await c.req.json().catch(() => ({}))) as { hashes?: unknown };
  const hashes = Array.isArray(body.hashes) ? body.hashes : [];
  if (hashes.length > 40 || !hashes.every(isSha256)) return c.json({ error: "invalid_body", message: "Send up to 40 checksums." }, 400);
  const bucket = getR2Bucket();
  const present = await Promise.all(hashes.map(async (sha) => Boolean(await (bucket.head ? bucket.head(fileKey(app, sha)) : bucket.get(fileKey(app, sha))))));
  return c.json({ missing: hashes.filter((_, i) => !present[i]) });
});

/** Uploads one file. The server works out its checksum itself and refuses a body that does not match the one in the path. */
appUpdatesRoutes.put("/app-updates/:app/files/:sha256", async (c) => {
  const app = c.req.param("app");
  const sha = c.req.param("sha256");
  if (!isUpdateApp(app)) return c.json({ error: "unknown_app" }, 404);
  const denied = publishDenied(c);
  if (denied) return denied;
  if (!isSha256(sha)) return c.json({ error: "invalid_checksum" }, 400);
  if (Number(c.req.header("Content-Length") ?? 0) > MAX_FILE_BYTES) return c.json({ error: "too_large" }, 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) return c.json({ error: "too_large" }, 413);
  if ((await sha256Hex(bytes)) !== sha) return c.json({ error: "checksum_mismatch", message: "The upload does not match its checksum." }, 400);
  await getR2Bucket().put(fileKey(app, sha), bytes);
  return c.json({ ok: true });
});

const publishSchema = z.object({
  id: z.string(),
  label: z.string().max(200).optional(),
  note: z.string().max(400).optional(),
  minNative: z.number().int().min(1).max(1_000_000).optional(),
  files: z.array(z.object({ path: z.string(), sha256: z.string(), size: z.number().int().min(0) })).min(1).max(MAX_FILES_PER_VERSION),
});

/**
 * Publishes a version once all its files are uploaded: stores the list, and (unless the admin turned automatic
 * go-live off) makes it the live one. Publishing the same id with the same files again changes nothing.
 */
appUpdatesRoutes.post("/app-updates/:app/publish", async (c) => {
  const app = c.req.param("app");
  if (!isUpdateApp(app)) return c.json({ error: "unknown_app" }, 404);
  const denied = publishDenied(c);
  if (denied) return denied;
  const parsed = publishSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { id, files } = parsed.data;
  if (!isValidVersionId(id)) return c.json({ error: "invalid_version", message: "Use 3-64 lower-case letters, digits, dots, dashes or underscores." }, 400);
  if (!files.every((f) => isSafePath(f.path) && isSha256(f.sha256)) || new Set(files.map((f) => f.path)).size !== files.length) {
    return c.json({ error: "invalid_files", message: "Every file needs a unique, safe path and a SHA-256 checksum." }, 400);
  }
  if (!files.some((f) => f.path === "index.html")) return c.json({ error: "not_an_app", message: "The files must include index.html." }, 400);
  const size = files.reduce((sum, f) => sum + f.size, 0);
  if (size > MAX_VERSION_BYTES) return c.json({ error: "too_large" }, 413);

  const bucket = getR2Bucket();
  const unique = [...new Set(files.map((f) => f.sha256))];
  const present = await Promise.all(unique.map(async (sha) => Boolean(await (bucket.head ? bucket.head(fileKey(app, sha)) : bucket.get(fileKey(app, sha))))));
  const missing = unique.filter((_, i) => !present[i]);
  if (missing.length) return c.json({ error: "files_missing", message: "Upload every file before publishing.", missing: missing.slice(0, 40) }, 409);

  const registry = await loadRegistry(app);
  const entries: ManifestEntry[] = files.map((f) => ({ path: f.path, sha256: f.sha256, size: f.size }));
  const existing = registry.versions.find((v) => v.id === id);
  if (existing) {
    const old = await loadManifest(app, id);
    const same = old && old.length === entries.length && old.every((e) => entries.some((n) => n.path === e.path && n.sha256 === e.sha256));
    if (!same) return c.json({ error: "version_exists", message: "That version id was already published with different contents." }, 409);
    return c.json({ ok: true, version: id, live: registry.live === id, alreadyPublished: true });
  }

  await bucket.put(manifestKey(app, id), JSON.stringify(entries), { httpMetadata: { contentType: "application/json" } });
  const { registry: next, removed } = addVersion(
    registry,
    {
      id,
      label: (parsed.data.label ?? id).slice(0, 80),
      files: files.length,
      size,
      minNative: parsed.data.minNative ?? 1,
      note: (parsed.data.note ?? "").slice(0, 200),
      publishedAt: new Date().toISOString(),
    },
    (await getSetting("app_updates_auto_live")) === "1",
  );
  await saveRegistry(app, next);
  await dropVersions(app, removed, next.versions.map((v) => v.id));
  return c.json({ ok: true, version: id, live: next.live === id, files: files.length, size });
});

// --- Admin -----------------------------------------------------------------------------------------------------------

export const appUpdatesAdminRoutes = new Hono();

async function adminPayload(): Promise<AppUpdatesSettings> {
  const [enabled, autoLive, ...registries] = await Promise.all([getSetting("app_updates_enabled"), getSetting("app_updates_auto_live"), ...APP_UPDATE_APPS.map(loadRegistry)]);
  return {
    enabled: enabled === "1",
    autoLive: autoLive === "1",
    publishConfigured: (process.env.APP_UPDATES_PUBLISH_TOKEN ?? "").length >= 24,
    apps: Object.fromEntries(APP_UPDATE_APPS.map((app, i) => [app, registries[i]!])) as AppUpdatesSettings["apps"],
  };
}

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  autoLive: z.boolean().optional(),
  live: z.record(z.enum(APP_UPDATE_APPS), z.string().nullable()).optional(),
  remove: z.array(z.object({ app: z.enum(APP_UPDATE_APPS), id: z.string() })).max(20).optional(),
});

appUpdatesAdminRoutes.get("/admin/app-updates", requireAuth, requireRole("admin"), requirePermission("settings.manage"), async (c) => c.json(await adminPayload()));

/** Switches the updater on or off, chooses which published version is live (so a bad one is rolled back here), and deletes old ones. */
appUpdatesAdminRoutes.put("/admin/app-updates", requireAuth, requireRole("admin"), requirePermission("settings.manage"), async (c) => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { enabled, autoLive, live, remove } = parsed.data;
  const before = await adminPayload();

  // Check everything first, so a refused change does not leave half of the others applied.
  for (const [app, id] of Object.entries(live ?? {}) as Array<[AppUpdateApp, string | null]>) {
    if (id !== null && !before.apps[app].versions.some((v) => v.id === id)) return c.json({ error: "unknown_version", message: `There is no version ${id}.` }, 400);
  }
  for (const { app, id } of remove ?? []) {
    const stays = (live && app in live ? live[app] : before.apps[app].live) === id;
    if (stays) return c.json({ error: "version_is_live", message: "Make another version live before deleting this one." }, 400);
  }

  if (enabled !== undefined) await setSetting("app_updates_enabled", enabled ? "1" : "0");
  if (autoLive !== undefined) await setSetting("app_updates_auto_live", autoLive ? "1" : "0");
  const touched = new Set<AppUpdateApp>([...(Object.keys(live ?? {}) as AppUpdateApp[]), ...(remove ?? []).map((r) => r.app)]);
  for (const app of touched) {
    const registry = await loadRegistry(app);
    const gone = new Set((remove ?? []).filter((r) => r.app === app).map((r) => r.id));
    const next = { live: live && app in live ? live[app]! : registry.live, versions: registry.versions.filter((v) => !gone.has(v.id)) };
    await saveRegistry(app, next);
    await dropVersions(app, [...gone], next.versions.map((v) => v.id));
  }

  const after = await adminPayload();
  const changed: string[] = [];
  if (before.enabled !== after.enabled) changed.push(`updates ${after.enabled ? "on" : "off"}`);
  if (before.autoLive !== after.autoLive) changed.push(`new versions go live by themselves ${after.autoLive ? "on" : "off"}`);
  for (const app of APP_UPDATE_APPS) {
    if (before.apps[app].live !== after.apps[app].live) changed.push(`${app} live version ${after.apps[app].live ?? "none"}`);
    const removed = before.apps[app].versions.length - after.apps[app].versions.length;
    if (removed > 0) changed.push(`${app} deleted ${removed} version${removed === 1 ? "" : "s"}`);
  }
  if (changed.length) {
    await logActivity({
      actor: c.get("user"), action: "app_updates.update", entityType: "app_updates",
      summary: `App updates: ${changed.join(", ")}`, before, after, revertible: false, ip: clientIp(c),
    });
  }
  return c.json(after);
});
