import { getSetting, setSetting } from "../lib/settings.js";
import { VIDEO_PROVIDERS, type VideoProviderKey } from "./types.js";

/**
 * Creator video is controlled from Admin: whether it is on at all, which providers Peebee runs for
 * creators, whether creators may bring their own, and the limits. Everything is clamped on the way
 * in and out, so a bad stored value falls back to a safe one instead of breaking uploads.
 */
export type VideoConfig = {
  enabled: boolean;
  /** Providers Peebee itself pays for and offers to every creator, in priority order. */
  platformProviders: VideoProviderKey[];
  /** May creators connect their own provider account or paste a link. */
  byoEnabled: boolean;
  /** Which providers a creator may bring. "link" is a plain video address. */
  byoProviders: VideoProviderKey[];
  maxDurationSeconds: number;
  maxVideosPerDay: number;
  /** How long a signed playback address stays valid. */
  signedPlaybackTtlSeconds: number;
};

export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  enabled: false,
  platformProviders: ["cloudflare_stream"],
  byoEnabled: false,
  byoProviders: ["cloudflare_stream", "mux", "cloudinary", "bunny", "link"],
  maxDurationSeconds: 600,
  maxVideosPerDay: 20,
  signedPlaybackTtlSeconds: 3600,
};

const int = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;

const providers = (v: unknown, fallback: VideoProviderKey[]): VideoProviderKey[] => {
  if (!Array.isArray(v)) return fallback;
  // The demo provider is never an admin choice; it is only reachable in sandbox.
  const ok = v.filter((p): p is VideoProviderKey => VIDEO_PROVIDERS.includes(p as VideoProviderKey) && p !== "mock");
  return [...new Set(ok)];
};

export function parseVideoConfig(raw: string): VideoConfig {
  let o: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) o = parsed as Record<string, unknown>;
  } catch {
    /* fall through to defaults */
  }
  const d = DEFAULT_VIDEO_CONFIG;
  // "link" is a way of bringing a video, never a provider Peebee runs.
  const platform = providers(o.platformProviders, d.platformProviders).filter((p) => p !== "link");
  return {
    enabled: o.enabled === true,
    platformProviders: platform,
    byoEnabled: o.byoEnabled === true,
    byoProviders: providers(o.byoProviders, d.byoProviders),
    maxDurationSeconds: int(o.maxDurationSeconds, d.maxDurationSeconds, 5, 14_400),
    maxVideosPerDay: int(o.maxVideosPerDay, d.maxVideosPerDay, 1, 1000),
    signedPlaybackTtlSeconds: int(o.signedPlaybackTtlSeconds, d.signedPlaybackTtlSeconds, 60, 86_400),
  };
}

export async function getVideoConfig(): Promise<VideoConfig> {
  return parseVideoConfig(await getSetting("video_config"));
}

export async function saveVideoConfig(patch: Partial<VideoConfig>): Promise<{ before: VideoConfig; after: VideoConfig }> {
  const before = await getVideoConfig();
  const after = parseVideoConfig(JSON.stringify({ ...before, ...patch }));
  await setSetting("video_config", JSON.stringify(after));
  return { before, after };
}
