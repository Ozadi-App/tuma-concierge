import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Ads over creator videos are controlled from Admin: the master switch, which slots run, how often a
 * viewer sees them, how long they last and how much of the revenue the creator keeps. Everything is
 * clamped on the way in and out. The creator share can never reach 100%, so Peebee always keeps a
 * share to cover running the platform.
 */
export type AdsConfig = {
  enabled: boolean;
  prerollEnabled: boolean;
  midrollEnabled: boolean;
  /** Ads only run on videos at least this long. A video of unknown length gets a pre-roll at most. */
  minVideoSeconds: number;
  midrollEveryMinutes: number;
  /** Most ads one viewer sees on one video within half an hour. */
  maxAdsPerView: number;
  /** Longest an ad may run. Longer creatives are not served. */
  maxAdSeconds: number;
  /** Seconds before the viewer may skip. 0 = skippable at once. */
  skipAfterSeconds: number;
  /** Most ads one viewer sees across the platform in an hour. */
  viewerCapPerHour: number;
  /** Creator's share of what advertisers pay, in percent. */
  creatorSharePercent: number;
  /** Peebee's own promotions fill the slot when no paid campaign qualifies. */
  houseAdsFallback: boolean;
  /** Paying members of a channel watch that channel without ads. */
  adFreeForMembers: boolean;
};

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  enabled: false,
  prerollEnabled: true,
  midrollEnabled: false,
  minVideoSeconds: 30,
  midrollEveryMinutes: 5,
  maxAdsPerView: 2,
  maxAdSeconds: 30,
  skipAfterSeconds: 5,
  viewerCapPerHour: 6,
  creatorSharePercent: 55,
  houseAdsFallback: true,
  adFreeForMembers: true,
};

const int = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function parseAdsConfig(raw: string): AdsConfig {
  let o: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) o = parsed as Record<string, unknown>;
  } catch {
    /* defaults */
  }
  const d = DEFAULT_ADS_CONFIG;
  return {
    enabled: o.enabled === true,
    prerollEnabled: flag(o.prerollEnabled, d.prerollEnabled),
    midrollEnabled: flag(o.midrollEnabled, d.midrollEnabled),
    minVideoSeconds: int(o.minVideoSeconds, d.minVideoSeconds, 0, 3600),
    midrollEveryMinutes: int(o.midrollEveryMinutes, d.midrollEveryMinutes, 1, 120),
    maxAdsPerView: int(o.maxAdsPerView, d.maxAdsPerView, 1, 20),
    maxAdSeconds: int(o.maxAdSeconds, d.maxAdSeconds, 5, 180),
    skipAfterSeconds: int(o.skipAfterSeconds, d.skipAfterSeconds, 0, 60),
    viewerCapPerHour: int(o.viewerCapPerHour, d.viewerCapPerHour, 1, 200),
    // Structural rail: the creator share is always under 100%.
    creatorSharePercent: int(o.creatorSharePercent, d.creatorSharePercent, 0, 95),
    houseAdsFallback: flag(o.houseAdsFallback, d.houseAdsFallback),
    adFreeForMembers: flag(o.adFreeForMembers, d.adFreeForMembers),
  };
}

export async function getAdsConfig(): Promise<AdsConfig> {
  return parseAdsConfig(await getSetting("ads_config"));
}

export async function saveAdsConfig(patch: Partial<AdsConfig>): Promise<{ before: AdsConfig; after: AdsConfig }> {
  const before = await getAdsConfig();
  const after = parseAdsConfig(JSON.stringify({ ...before, ...patch }));
  await setSetting("ads_config", JSON.stringify(after));
  return { before, after };
}
