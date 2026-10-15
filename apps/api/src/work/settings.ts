import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Peebee Work is controlled from Admin: which kinds of work are open, how they
 * are priced and matched, who can provide them, and every limit and window.
 * Nothing here is a constant in the code beyond structural safety rails.
 */

export const WORK_SERVICE_TYPES = ["clean", "fix", "laundry"] as const;
export const WORK_PRICING_MODES = ["fixed", "quote"] as const;
export const WORK_MATCHING_MODES = ["broadcast", "customer_picks", "admin_assigns"] as const;
export const WORK_PROVIDER_KINDS = ["individual", "company"] as const;

export type WorkServiceType = (typeof WORK_SERVICE_TYPES)[number];
export type WorkPricingMode = (typeof WORK_PRICING_MODES)[number];
export type WorkMatchingMode = (typeof WORK_MATCHING_MODES)[number];
export type WorkProviderKind = (typeof WORK_PROVIDER_KINDS)[number];

export type WorkSettings = {
  enabled: boolean;
  /** Kinds of work customers can book right now. */
  serviceTypes: WorkServiceType[];
  /** Whether fixed-price and quote-after-inspection jobs are allowed. */
  pricingModes: WorkPricingMode[];
  /** How jobs reach providers. If several are on, the customer chooses; otherwise the default applies. */
  matchingModes: WorkMatchingMode[];
  defaultMatching: WorkMatchingMode;
  /** Who may register as a provider. */
  providerKinds: WorkProviderKind[];
  /** Peebee's share of each job, in percent. A service can override it. */
  commissionPercent: number;
  /** Providers must be approved by staff before they receive jobs. */
  requireApproval: boolean;
  /** How long an unclaimed job stays open before it expires and is refunded. */
  offerWindowMinutes: number;
  radiusKm: number;
  /** Most providers pinged about one job. */
  maxNotified: number;
  /** Earliest a booking can be scheduled, and how far ahead. */
  minLeadMinutes: number;
  maxAdvanceDays: number;
  quoteValidHours: number;
  maxQuoteUgx: number;
  /** Customer may cancel free for this long after a provider is assigned; later cancellations pay the provider a fee. */
  freeCancelMinutes: number;
  lateCancelFeePercent: number;
  /** A finished job pays out by itself after this long if the customer says nothing. */
  autoConfirmHours: number;
  /** How long after completion the customer can still raise a problem. */
  disputeWindowHours: number;
  /** Most jobs one customer can book per hour. */
  jobsPerHour: number;
  /** When a provider cancels after taking a job, offer it to others instead of refunding the customer. */
  rematchOnProviderCancel: boolean;
  /** Most times one job can go back to other providers before it is refunded instead. */
  maxRematches: number;
  /** Customers and providers can attach photos to a job. */
  photosEnabled: boolean;
  maxPhotosPerJob: number;
  /** Largest single photo, in kilobytes. */
  maxPhotoKb: number;
  /** Customer and provider can message each other about a job. */
  chatEnabled: boolean;
  /** Customer can see where the provider is while the job is on. */
  trackingEnabled: boolean;
  /** Record where providers are during a job and flag cancellations that follow a long stay at the address. */
  onsiteCheckEnabled: boolean;
  /** How close to the job address counts as "on site", in metres. */
  onsiteRadiusM: number;
  /** Minutes on site before a cancellation is flagged. */
  onsiteMinMinutes: number;
  /** What a flag does: "flag" puts it in the review queue; "suspend" also suspends the provider until admin reviews it. */
  onsiteAction: "flag" | "suspend";
  /** Also flag a cancellation when the provider held the job that long without ever sharing a location. */
  onsiteFlagNoLocation: boolean;
  /** Suspend a provider automatically once they have this many open or upheld flags inside the window. 0 turns it off. */
  onsiteSuspendAfterFlags: number;
  onsiteWindowDays: number;
  /** Location trails are deleted after this many days. */
  locationRetentionDays: number;
};

function list<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  const wanted = new Set((raw ?? "").split(",").map((v) => v.trim()));
  return allowed.filter((v) => wanted.has(v));
}

const int = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== "" ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export async function getWorkSettings(): Promise<WorkSettings> {
  const keys = [
    "work_enabled", "work_service_types", "work_pricing_modes", "work_matching_modes", "work_default_matching", "work_provider_kinds",
    "work_commission_percent", "work_require_approval", "work_offer_window_minutes", "work_radius_km", "work_max_notified",
    "work_min_lead_minutes", "work_max_advance_days", "work_quote_valid_hours", "work_max_quote_ugx", "work_free_cancel_minutes",
    "work_late_cancel_fee_percent", "work_auto_confirm_hours", "work_dispute_window_hours", "work_jobs_per_hour",
    "work_rematch_on_provider_cancel", "work_max_rematches", "work_photos_enabled", "work_max_photos_per_job", "work_max_photo_kb",
    "work_chat_enabled", "work_tracking_enabled",
    "work_onsite_check_enabled", "work_onsite_radius_m", "work_onsite_min_minutes", "work_onsite_action", "work_onsite_flag_no_location",
    "work_onsite_suspend_after_flags", "work_onsite_window_days", "work_location_retention_days",
  ] as const;
  const v = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)]))) as Record<(typeof keys)[number], string>;
  const matchingModes = list(v.work_matching_modes, WORK_MATCHING_MODES);
  const defaultMatching = (WORK_MATCHING_MODES as readonly string[]).includes(v.work_default_matching) ? (v.work_default_matching as WorkMatchingMode) : "broadcast";
  return {
    enabled: v.work_enabled !== "0",
    serviceTypes: list(v.work_service_types, WORK_SERVICE_TYPES),
    pricingModes: list(v.work_pricing_modes, WORK_PRICING_MODES),
    matchingModes,
    // The default is always one that is switched on.
    defaultMatching: matchingModes.includes(defaultMatching) ? defaultMatching : (matchingModes[0] ?? "broadcast"),
    providerKinds: list(v.work_provider_kinds, WORK_PROVIDER_KINDS),
    commissionPercent: int(v.work_commission_percent, 15, 0, 60),
    requireApproval: v.work_require_approval !== "0",
    offerWindowMinutes: int(v.work_offer_window_minutes, 60, 5, 7 * 24 * 60),
    radiusKm: int(v.work_radius_km, 15, 1, 200),
    maxNotified: int(v.work_max_notified, 20, 1, 200),
    minLeadMinutes: int(v.work_min_lead_minutes, 30, 0, 7 * 24 * 60),
    maxAdvanceDays: int(v.work_max_advance_days, 30, 1, 365),
    quoteValidHours: int(v.work_quote_valid_hours, 24, 1, 24 * 14),
    maxQuoteUgx: int(v.work_max_quote_ugx, 5_000_000, 1000, 1_000_000_000),
    freeCancelMinutes: int(v.work_free_cancel_minutes, 10, 0, 24 * 60),
    lateCancelFeePercent: int(v.work_late_cancel_fee_percent, 20, 0, 100),
    autoConfirmHours: int(v.work_auto_confirm_hours, 24, 1, 24 * 14),
    disputeWindowHours: int(v.work_dispute_window_hours, 48, 1, 24 * 30),
    jobsPerHour: int(v.work_jobs_per_hour, 6, 1, 100),
    rematchOnProviderCancel: v.work_rematch_on_provider_cancel !== "0",
    maxRematches: int(v.work_max_rematches, 2, 0, 10),
    photosEnabled: v.work_photos_enabled !== "0",
    maxPhotosPerJob: int(v.work_max_photos_per_job, 8, 1, 30),
    maxPhotoKb: int(v.work_max_photo_kb, 4096, 100, 10240),
    chatEnabled: v.work_chat_enabled !== "0",
    trackingEnabled: v.work_tracking_enabled !== "0",
    onsiteCheckEnabled: v.work_onsite_check_enabled === "1",
    onsiteRadiusM: int(v.work_onsite_radius_m, 150, 20, 2000),
    onsiteMinMinutes: int(v.work_onsite_min_minutes, 20, 1, 24 * 60),
    onsiteAction: v.work_onsite_action === "suspend" ? "suspend" : "flag",
    onsiteFlagNoLocation: v.work_onsite_flag_no_location !== "0",
    onsiteSuspendAfterFlags: int(v.work_onsite_suspend_after_flags, 0, 0, 50),
    onsiteWindowDays: int(v.work_onsite_window_days, 30, 1, 365),
    locationRetentionDays: int(v.work_location_retention_days, 30, 1, 365),
  };
}

export async function setWorkSettings(next: Partial<WorkSettings>): Promise<void> {
  const writes: Promise<void>[] = [];
  const put = (key: Parameters<typeof setSetting>[0], value: string) => writes.push(setSetting(key, value));
  if (next.enabled != null) put("work_enabled", next.enabled ? "1" : "0");
  if (next.serviceTypes) put("work_service_types", next.serviceTypes.join(","));
  if (next.pricingModes) put("work_pricing_modes", next.pricingModes.join(","));
  if (next.matchingModes) put("work_matching_modes", next.matchingModes.join(","));
  if (next.defaultMatching) put("work_default_matching", next.defaultMatching);
  if (next.providerKinds) put("work_provider_kinds", next.providerKinds.join(","));
  if (next.commissionPercent != null) put("work_commission_percent", String(next.commissionPercent));
  if (next.requireApproval != null) put("work_require_approval", next.requireApproval ? "1" : "0");
  if (next.offerWindowMinutes != null) put("work_offer_window_minutes", String(next.offerWindowMinutes));
  if (next.radiusKm != null) put("work_radius_km", String(next.radiusKm));
  if (next.maxNotified != null) put("work_max_notified", String(next.maxNotified));
  if (next.minLeadMinutes != null) put("work_min_lead_minutes", String(next.minLeadMinutes));
  if (next.maxAdvanceDays != null) put("work_max_advance_days", String(next.maxAdvanceDays));
  if (next.quoteValidHours != null) put("work_quote_valid_hours", String(next.quoteValidHours));
  if (next.maxQuoteUgx != null) put("work_max_quote_ugx", String(next.maxQuoteUgx));
  if (next.freeCancelMinutes != null) put("work_free_cancel_minutes", String(next.freeCancelMinutes));
  if (next.lateCancelFeePercent != null) put("work_late_cancel_fee_percent", String(next.lateCancelFeePercent));
  if (next.autoConfirmHours != null) put("work_auto_confirm_hours", String(next.autoConfirmHours));
  if (next.disputeWindowHours != null) put("work_dispute_window_hours", String(next.disputeWindowHours));
  if (next.jobsPerHour != null) put("work_jobs_per_hour", String(next.jobsPerHour));
  if (next.rematchOnProviderCancel != null) put("work_rematch_on_provider_cancel", next.rematchOnProviderCancel ? "1" : "0");
  if (next.maxRematches != null) put("work_max_rematches", String(next.maxRematches));
  if (next.photosEnabled != null) put("work_photos_enabled", next.photosEnabled ? "1" : "0");
  if (next.maxPhotosPerJob != null) put("work_max_photos_per_job", String(next.maxPhotosPerJob));
  if (next.maxPhotoKb != null) put("work_max_photo_kb", String(next.maxPhotoKb));
  if (next.chatEnabled != null) put("work_chat_enabled", next.chatEnabled ? "1" : "0");
  if (next.trackingEnabled != null) put("work_tracking_enabled", next.trackingEnabled ? "1" : "0");
  if (next.onsiteCheckEnabled != null) put("work_onsite_check_enabled", next.onsiteCheckEnabled ? "1" : "0");
  if (next.onsiteRadiusM != null) put("work_onsite_radius_m", String(next.onsiteRadiusM));
  if (next.onsiteMinMinutes != null) put("work_onsite_min_minutes", String(next.onsiteMinMinutes));
  if (next.onsiteAction) put("work_onsite_action", next.onsiteAction);
  if (next.onsiteFlagNoLocation != null) put("work_onsite_flag_no_location", next.onsiteFlagNoLocation ? "1" : "0");
  if (next.onsiteSuspendAfterFlags != null) put("work_onsite_suspend_after_flags", String(next.onsiteSuspendAfterFlags));
  if (next.onsiteWindowDays != null) put("work_onsite_window_days", String(next.onsiteWindowDays));
  if (next.locationRetentionDays != null) put("work_location_retention_days", String(next.locationRetentionDays));
  await Promise.all(writes);
}
