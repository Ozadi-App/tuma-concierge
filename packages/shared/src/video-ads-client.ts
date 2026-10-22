/**
 * Typed calls for creator video and ads: the Admin endpoints (`/v1/admin/video*`, `/v1/admin/ads*`)
 * and the creator-facing ones (`/v1/video/*`, `/v1/ads/*`). Mirrors apps/api/src/video and apps/api/src/ads.
 */

export type VideoProviderKey = "cloudflare_stream" | "mux" | "cloudinary" | "bunny" | "link" | "mock";

export type VideoConfig = {
  enabled: boolean;
  platformProviders: VideoProviderKey[];
  byoEnabled: boolean;
  byoProviders: VideoProviderKey[];
  maxDurationSeconds: number;
  maxVideosPerDay: number;
  signedPlaybackTtlSeconds: number;
};

export type VideoCredentialField = { key: string; label: string; secret: boolean; required: boolean; placeholder?: string; helpText?: string; set: boolean };

export type VideoAdminProvider = {
  key: VideoProviderKey;
  displayName: string;
  summary: string;
  configured: boolean;
  supportsProtectedPlayback: boolean;
  credentialFields: VideoCredentialField[];
};

export type VideoAdminOverview = { config: VideoConfig; migrationApplied: boolean; providers: VideoAdminProvider[] };

export type AdsConfig = {
  enabled: boolean;
  prerollEnabled: boolean;
  midrollEnabled: boolean;
  minVideoSeconds: number;
  midrollEveryMinutes: number;
  maxAdsPerView: number;
  maxAdSeconds: number;
  skipAfterSeconds: number;
  viewerCapPerHour: number;
  creatorSharePercent: number;
  houseAdsFallback: boolean;
  adFreeForMembers: boolean;
};

export type AdCampaignStatus = "draft" | "active" | "paused" | "ended";
export type AdPricingModel = "cpm" | "cpv" | "cpc";

export type AdCampaignReport = {
  id: string; name: string; advertiser: string; status: AdCampaignStatus; pricingModel: AdPricingModel; rateUgx: number;
  budgetUgx: number; spentUgx: number; house: boolean; impressions: number; completes: number; clicks: number; skips: number; creatorEarnedUgx: number;
};

export type AdsAdminOverview = { config: AdsConfig; migrationApplied: boolean; campaigns: AdCampaignReport[] };

export type AdCampaignInput = {
  advertiserName: string; name: string; pricingModel?: AdPricingModel; rateUgx?: number; budgetUgx?: number; dailyCapUgx?: number;
  startsAt?: string | null; endsAt?: string | null; isHouse?: boolean;
};

export type AdCreativeInput = {
  kind?: "video" | "image"; mediaUrl: string; posterUrl?: string | null; clickUrl?: string | null; headline?: string | null;
  ctaLabel?: string | null; durationSeconds?: number; skipAfterSeconds?: number | null;
};

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function videoAdsMethods(request: Request) {
  const send = <T>(method: string, path: string, body?: unknown) => request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const enc = encodeURIComponent;
  return {
    adminGetVideo() {
      return request<VideoAdminOverview>("/v1/admin/video");
    },
    adminSaveVideoConfig(patch: Partial<VideoConfig>) {
      return send<{ config: VideoConfig }>("PUT", "/v1/admin/video/config", patch);
    },
    adminSaveVideoCredentials(provider: VideoProviderKey, fields: Record<string, string>) {
      return send<{ changed: string[] }>("PUT", `/v1/admin/video/credentials/${enc(provider)}`, { fields });
    },
    adminClearVideoCredentials(provider: VideoProviderKey) {
      return send<{ ok: true }>("DELETE", `/v1/admin/video/credentials/${enc(provider)}`);
    },
    adminTestVideoCredentials(provider: VideoProviderKey) {
      return send<{ ok: boolean; message?: string }>("POST", `/v1/admin/video/credentials/${enc(provider)}/test`);
    },
    adminGetAds() {
      return request<AdsAdminOverview>("/v1/admin/ads");
    },
    adminSaveAdsConfig(patch: Partial<AdsConfig>) {
      return send<{ config: AdsConfig }>("PUT", "/v1/admin/ads/config", patch);
    },
    adminCreateAdCampaign(input: AdCampaignInput) {
      return send<{ id: string }>("POST", "/v1/admin/ads/campaigns", input);
    },
    adminSetAdCampaignStatus(id: string, status: Exclude<AdCampaignStatus, "draft">) {
      return send<{ ok: true }>("PUT", `/v1/admin/ads/campaigns/${enc(id)}/status`, { status });
    },
    adminAddAdCreative(campaignId: string, input: AdCreativeInput) {
      return send<{ id: string }>("POST", `/v1/admin/ads/campaigns/${enc(campaignId)}/creatives`, input);
    },
  };
}
