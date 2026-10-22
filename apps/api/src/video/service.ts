/**
 * The one seam the rest of the app uses for creator video: start an upload, bring in an existing
 * video, check on it, get an address to play it, remove it. Which provider handles a call comes from
 * the Admin settings (platform providers) or from the creator's own connected account (bring your
 * own). Peebee only keeps the video's address and facts — monetisation stays on Peebee's side.
 */
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { VIDEO_ADAPTERS } from "./adapters/index.js";
import { hasRequiredFields, loadCredentials, PLATFORM } from "./credentials.js";
import { getVideoConfig } from "./settings.js";
import { VIDEO_PROVIDERS, VideoProviderError, type AssetInfo, type PlaybackSources, type UploadInstructions, type VideoProviderKey, type VideoSource } from "./types.js";

type Row = Record<string, unknown>;

export class VideoRequestError extends Error {
  constructor(readonly code: string, readonly clientMessage: string, readonly status: 400 | 403 | 404 | 409 | 429 | 502 | 503 = 400) {
    super(code);
    this.name = "VideoRequestError";
  }
}

export type VideoAssetRow = {
  id: string;
  owner_id: string;
  provider: VideoProviderKey;
  source: VideoSource;
  external_id: string;
  title: string | null;
  status: "uploading" | "processing" | "ready" | "failed" | "deleted";
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  poster_url: string | null;
  hls_url: string | null;
  mp4_url: string | null;
  visibility: "public" | "protected";
  error: string | null;
  environment: "live" | "sandbox";
  created_at: string;
  updated_at: string;
};

export function isProviderKey(v: unknown): v is VideoProviderKey {
  return typeof v === "string" && (VIDEO_PROVIDERS as readonly string[]).includes(v);
}

export async function videoReady(): Promise<boolean> {
  return hasTable("video_assets");
}

async function requireReady() {
  const config = await getVideoConfig();
  if (!config.enabled || !(await videoReady())) {
    throw new VideoRequestError("video_unavailable", "Video uploads are not available yet.", 503);
  }
  return config;
}

/** Provider failures keep their safe message; anything else is a plain 502. */
function wrap(err: unknown): never {
  if (err instanceof VideoRequestError) throw err;
  if (err instanceof VideoProviderError) {
    const status = err.code === "invalid_reference" || err.code === "unsupported" ? 400 : err.code === "not_configured" ? 503 : 502;
    throw new VideoRequestError(`provider_${err.code}`, err.clientMessage, status);
  }
  console.error("video service error:", err);
  throw new VideoRequestError("video_failed", "Something went wrong with the video. Please try again.", 502);
}

async function ownedToday(userId: string): Promise<number> {
  const res = await db.execute({ sql: "SELECT COUNT(*) AS n FROM video_assets WHERE owner_id = ? AND created_at > datetime('now', '-1 day')", args: [userId] });
  return Number((res.rows[0] as Row | undefined)?.n ?? 0);
}

/** Which provider and credentials a new platform-hosted upload uses: the first configured one that can do the job. */
async function pickPlatformProvider(protectedPlayback: boolean, preferred?: VideoProviderKey) {
  const env = await getPlatformEnvironment();
  if (env === "sandbox") return { provider: "mock" as const, creds: {} };
  const config = await getVideoConfig();
  const order = preferred ? config.platformProviders.filter((p) => p === preferred) : config.platformProviders;
  for (const provider of order) {
    const adapter = VIDEO_ADAPTERS[provider];
    if (!adapter.supportsDirectUpload) continue;
    const creds = await loadCredentials(PLATFORM, provider);
    if (!hasRequiredFields(provider, creds)) continue;
    if (protectedPlayback && !adapter.supportsSignedPlayback(creds)) continue;
    return { provider, creds };
  }
  throw new VideoRequestError(
    "no_platform_provider",
    protectedPlayback ? "No video provider that can lock videos is set up yet." : "No video provider is set up yet.",
    503,
  );
}

export async function startUpload(
  userId: string,
  input: { source: "platform" | "byo"; provider?: VideoProviderKey; title?: string; maxDurationSeconds?: number; protectedPlayback?: boolean },
): Promise<{ asset: VideoAssetRow; upload: UploadInstructions }> {
  const config = await requireReady();
  const protectedPlayback = !!input.protectedPlayback;
  if ((await ownedToday(userId)) >= config.maxVideosPerDay) {
    throw new VideoRequestError("daily_limit", "You have reached today's video limit. Try again tomorrow.", 429);
  }
  const maxDurationSeconds = Math.min(input.maxDurationSeconds ?? config.maxDurationSeconds, config.maxDurationSeconds);
  const environment = await getPlatformEnvironment();

  try {
    let provider: VideoProviderKey;
    let creds;
    if (input.source === "platform") {
      ({ provider, creds } = await pickPlatformProvider(protectedPlayback, input.provider));
    } else {
      if (!config.byoEnabled) throw new VideoRequestError("byo_disabled", "Bringing your own video account is not available yet.", 403);
      if (!input.provider || !config.byoProviders.includes(input.provider)) throw new VideoRequestError("provider_not_allowed", "That provider is not available.", 400);
      provider = input.provider;
      creds = await loadCredentials(userId, provider);
      if (!hasRequiredFields(provider, creds)) throw new VideoRequestError("not_connected", "Connect your account for this provider first.", 400);
    }
    const adapter = VIDEO_ADAPTERS[provider];
    if (!adapter.supportsDirectUpload) throw new VideoRequestError("upload_unsupported", "This provider cannot take uploads. Add the video by reference instead.", 400);
    const upload = await adapter.createUpload(creds, { maxDurationSeconds, title: input.title, protectedPlayback });

    const id = newId("vid");
    await db.execute({
      sql: `INSERT INTO video_assets (id, owner_id, provider, source, external_id, title, status, visibility, environment)
            VALUES (?, ?, ?, ?, ?, ?, 'uploading', ?, ?)`,
      args: [id, userId, provider, input.source, upload.externalId, input.title?.slice(0, 120) ?? null, protectedPlayback ? "protected" : "public", environment],
    });
    return { asset: await mustGet(id), upload };
  } catch (err) {
    wrap(err);
  }
}

/** Brings in a video that already exists: in the creator's own provider account, or at a plain address. */
export async function importVideo(
  userId: string,
  input: { provider: VideoProviderKey; reference: string; title?: string },
): Promise<VideoAssetRow> {
  const config = await requireReady();
  if (!config.byoEnabled) throw new VideoRequestError("byo_disabled", "Bringing your own video is not available yet.", 403);
  if (input.provider === "mock" || !config.byoProviders.includes(input.provider)) throw new VideoRequestError("provider_not_allowed", "That provider is not available.", 400);
  if ((await ownedToday(userId)) >= config.maxVideosPerDay) {
    throw new VideoRequestError("daily_limit", "You have reached today's video limit. Try again tomorrow.", 429);
  }
  const source: VideoSource = input.provider === "link" ? "link" : "byo";
  try {
    const adapter = VIDEO_ADAPTERS[input.provider];
    const creds = source === "link" ? {} : await loadCredentials(userId, input.provider);
    if (source === "byo" && !hasRequiredFields(input.provider, creds)) throw new VideoRequestError("not_connected", "Connect your account for this provider first.", 400);
    const info = await adapter.importAsset(creds, input.reference);
    if (info.status === "failed") throw new VideoRequestError("video_failed", info.error ?? "That video could not be used.", 400);
    if (info.durationSeconds && info.durationSeconds > config.maxDurationSeconds) {
      throw new VideoRequestError("too_long", `Videos can be up to ${Math.floor(config.maxDurationSeconds / 60)} minutes long.`, 400);
    }
    const existing = await db.execute({ sql: "SELECT id FROM video_assets WHERE owner_id = ? AND provider = ? AND external_id = ? AND status != 'deleted'", args: [userId, input.provider, info.externalId] });
    if (existing.rows[0]) return mustGet((existing.rows[0] as Row).id as string);

    const id = newId("vid");
    await db.execute({
      sql: `INSERT INTO video_assets (id, owner_id, provider, source, external_id, title, status, duration_seconds, width, height, poster_url, hls_url, mp4_url, visibility, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?)`,
      args: [id, userId, input.provider, source, info.externalId, input.title?.slice(0, 120) ?? null, info.status, info.durationSeconds ?? null, info.width ?? null, info.height ?? null, info.posterUrl ?? null, info.hlsUrl ?? null, info.mp4Url ?? null, await getPlatformEnvironment()],
    });
    return await mustGet(id);
  } catch (err) {
    wrap(err);
  }
}

export async function getAsset(id: string): Promise<VideoAssetRow | null> {
  if (!(await videoReady())) return null;
  const res = await db.execute({ sql: "SELECT * FROM video_assets WHERE id = ? AND status != 'deleted'", args: [id] });
  return (res.rows[0] as unknown as VideoAssetRow | undefined) ?? null;
}

async function mustGet(id: string): Promise<VideoAssetRow> {
  const row = await getAsset(id);
  if (!row) throw new VideoRequestError("not_found", "Video not found.", 404);
  return row;
}

async function credsFor(row: VideoAssetRow) {
  if (row.source === "link" || row.provider === "mock") return {};
  return loadCredentials(row.source === "platform" ? PLATFORM : row.owner_id, row.provider);
}

/** Asks the provider where an unfinished video has got to and saves the answer. */
export async function refreshAsset(row: VideoAssetRow): Promise<VideoAssetRow> {
  if (row.status === "ready" || row.status === "failed" || row.status === "deleted") return row;
  const config = await getVideoConfig();
  let info: AssetInfo;
  try {
    info = await VIDEO_ADAPTERS[row.provider].getAsset(await credsFor(row), row.external_id);
  } catch (err) {
    wrap(err);
  }

  let status = info.status;
  let error = info.error ?? null;
  if (status === "ready" && info.durationSeconds && info.durationSeconds > config.maxDurationSeconds) {
    status = "failed";
    error = `Videos can be up to ${Math.floor(config.maxDurationSeconds / 60)} minutes long.`;
    if (row.source === "platform") await removeAtProvider(row, info.externalId).catch(() => {});
  }

  const externalId = info.externalId || row.external_id;
  await db.execute({
    sql: `UPDATE video_assets SET external_id = ?, status = ?, duration_seconds = COALESCE(?, duration_seconds), width = COALESCE(?, width), height = COALESCE(?, height),
            poster_url = COALESCE(?, poster_url), hls_url = COALESCE(?, hls_url), mp4_url = COALESCE(?, mp4_url), error = ?, updated_at = datetime('now')
          WHERE id = ?`,
    args: [externalId, status, info.durationSeconds ?? null, info.width ?? null, info.height ?? null, info.posterUrl ?? null, info.hlsUrl ?? null, info.mp4Url ?? null, error, row.id],
  }).catch(async (err) => {
    // Two rows of one owner can never share a provider id; if this one now does, keep its old id.
    console.error("video refresh update failed:", err);
    await db.execute({ sql: "UPDATE video_assets SET status = ?, error = ?, updated_at = datetime('now') WHERE id = ?", args: [status, error, row.id] });
  });
  return mustGet(row.id);
}

async function removeAtProvider(row: VideoAssetRow, externalId = row.external_id) {
  await VIDEO_ADAPTERS[row.provider].deleteAsset(await credsFor(row), externalId);
}

/**
 * The addresses a player uses. A protected video only gets a signed, short-lived address, and only
 * when the caller has already been cleared to watch it (the post's access rules decide that, not this).
 */
export async function playbackFor(row: VideoAssetRow, opts: { cleared: boolean }): Promise<PlaybackSources> {
  if (row.status !== "ready") throw new VideoRequestError("not_ready", "This video is still being prepared.", 409);
  const protectedVideo = row.visibility === "protected";
  if (protectedVideo && !opts.cleared) throw new VideoRequestError("locked", "This video is locked.", 403);
  const config = await getVideoConfig();
  try {
    return await VIDEO_ADAPTERS[row.provider].playback(
      await credsFor(row),
      { externalId: row.external_id, hlsUrl: row.hls_url, mp4Url: row.mp4_url, posterUrl: row.poster_url },
      { signed: protectedVideo, ttlSeconds: config.signedPlaybackTtlSeconds },
    );
  } catch (err) {
    wrap(err);
  }
}

/** Takes a video off Peebee. Only videos Peebee itself hosts are deleted at the provider; a creator's own account is left alone. */
export async function removeAsset(row: VideoAssetRow): Promise<void> {
  if (row.source === "platform") await removeAtProvider(row).catch((err) => console.error("provider delete failed:", err));
  await db.execute({ sql: "UPDATE video_assets SET status = 'deleted', updated_at = datetime('now') WHERE id = ?", args: [row.id] });
}

/** What a client may see of a video. Never provider ids for other people's videos, never credentials. */
export function publicAsset(row: VideoAssetRow, viewerIsOwner: boolean) {
  const locked = row.visibility === "protected";
  return {
    id: row.id,
    provider: row.provider,
    source: row.source,
    title: row.title,
    status: row.status,
    durationSeconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    posterUrl: locked ? null : row.poster_url,
    visibility: row.visibility,
    error: viewerIsOwner ? row.error : null,
    createdAt: row.created_at,
    ...(viewerIsOwner ? { externalId: row.external_id } : {}),
  };
}

/** The catalogue a creator sees when choosing how to add video. */
export async function providerCatalogue(userId: string) {
  const config = await getVideoConfig();
  const env = await getPlatformEnvironment();
  const rows = [];
  for (const key of VIDEO_PROVIDERS) {
    if (key === "mock" && env !== "sandbox") continue;
    const adapter = VIDEO_ADAPTERS[key];
    const platformCreds = key === "link" || key === "mock" ? {} : await loadCredentials(PLATFORM, key);
    const mine = adapter.credentialFields.length ? await loadCredentials(userId, key) : {};
    rows.push({
      key,
      displayName: adapter.displayName,
      summary: adapter.summary,
      supportsDirectUpload: adapter.supportsDirectUpload,
      supportsProtectedPlayback: adapter.supportsSignedPlayback(key === "mock" ? {} : { ...platformCreds, ...mine }),
      platform: { available: key === "mock" ? true : config.platformProviders.includes(key) && hasRequiredFields(key, platformCreds) },
      byo: {
        allowed: config.byoEnabled && config.byoProviders.includes(key),
        needsAccount: adapter.credentialFields.length > 0,
        connected: adapter.credentialFields.length > 0 && hasRequiredFields(key, mine),
        fields: adapter.credentialFields.map((f) => ({ key: f.key, label: f.label, secret: f.secret, required: f.required, placeholder: f.placeholder, helpText: f.helpText, set: !!mine[f.key] })),
      },
    });
  }
  return rows;
}
