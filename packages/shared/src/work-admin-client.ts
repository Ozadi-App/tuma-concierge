/**
 * Typed calls for the Peebee Work admin endpoints (`/v1/work/admin/*`) and the
 * `work` settings group. Mirrors apps/api/src/work/admin.ts. Rows that the API
 * returns straight from the database keep their snake_case column names.
 */
import type { WorkJob, WorkMatchingMode, WorkPricingMode, WorkServiceType } from "./work-client.js";

export type WorkProviderStatus = "pending" | "approved" | "suspended" | "rejected";
export type WorkProviderKind = "individual" | "company";
export type WorkProviderAction = "approve" | "reject" | "suspend" | "reinstate";
export type WorkResolveOutcome = "release" | "refund" | "split";

/** A `work_services` row. */
export type WorkAdminService = {
  id: string;
  type: WorkServiceType;
  category: string;
  name: string;
  description: string;
  pricing_mode: WorkPricingMode;
  unit_label: string;
  unit_price_ugx: number;
  callout_fee_ugx: number;
  min_quantity: number;
  max_quantity: number;
  commission_percent: number | null;
  sort_order: number;
  active: number;
  created_at?: string;
  updated_at?: string;
};

/** Create/update body. On update every field is optional; `commissionPercent: null` clears the override. */
export type WorkAdminServiceInput = {
  type: WorkServiceType;
  category: string;
  name: string;
  description: string;
  pricingMode: WorkPricingMode;
  unitLabel: string;
  unitPriceUgx: number;
  calloutFeeUgx: number;
  minQuantity: number;
  maxQuantity: number;
  commissionPercent: number | null;
  sortOrder: number;
  active: boolean;
};

/** A `work_providers` row plus the owner's name/phone, team size and services. */
export type WorkAdminProviderRow = {
  id: string;
  user_id: string;
  kind: WorkProviderKind;
  display_name: string;
  company_name: string | null;
  phone: string | null;
  bio: string;
  status: WorkProviderStatus;
  online: number;
  rating_sum: number;
  rating_count: number;
  jobs_completed: number;
  status_note: string | null;
  approved_at: string | null;
  created_at: string;
};

export type WorkAdminProvider = WorkAdminProviderRow & {
  user_name: string | null;
  user_phone: string | null;
  team_size: number;
  /** Comma-separated service names. */
  services: string | null;
};

/** On the admin job view `provider` is the raw `work_providers` row. */
export type WorkAdminJob = Omit<WorkJob, "provider" | "customer"> & {
  customer: null;
  provider: WorkAdminProviderRow | null;
};

export type WorkAdminEvent = {
  id: string;
  job_id: string;
  actor_id: string | null;
  actor_kind: "customer" | "provider" | "worker" | "admin" | "system";
  action: string;
  detail: string | null;
  created_at: string;
};

export type WorkAdminMoney = {
  id: string;
  user_id: string;
  kind: "hold" | "refund" | "payout";
  amount_ugx: number;
  status: "pending" | "done";
  note: string;
  created_at: string;
  done_at: string | null;
};

export type WorkAdminOffer = {
  id: string;
  job_id: string;
  provider_id: string;
  price_ugx: number;
  eta_minutes: number | null;
  message: string;
  status: "pending" | "selected" | "declined" | "withdrawn";
  created_at: string;
};

export type WorkAdminPhoto = {
  id: string;
  uploader_kind: "customer" | "provider" | "worker" | "admin" | "system";
  phase: string;
  note: string | null;
  size_bytes: number;
  created_at: string;
};

export type WorkAdminMessage = {
  id: string;
  sender_kind: "customer" | "provider" | "worker" | "admin" | "system";
  body: string;
  created_at: string;
  sender_name: string | null;
};

export type WorkAdminJobDetail = {
  job: WorkAdminJob;
  events: WorkAdminEvent[];
  money: WorkAdminMoney[];
  offers: WorkAdminOffer[];
  /** Empty until the photos/chat migration is applied. */
  photos?: WorkAdminPhoto[];
  messages?: WorkAdminMessage[];
};

/** The `work` settings group (GET /v1/settings, PUT /v1/admin/settings). */
export type WorkAdminSettings = {
  enabled: boolean;
  serviceTypes: WorkServiceType[];
  pricingModes: WorkPricingMode[];
  matchingModes: WorkMatchingMode[];
  defaultMatching: WorkMatchingMode;
  providerKinds: WorkProviderKind[];
  commissionPercent: number;
  requireApproval: boolean;
  offerWindowMinutes: number;
  radiusKm: number;
  maxNotified: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  quoteValidHours: number;
  maxQuoteUgx: number;
  freeCancelMinutes: number;
  lateCancelFeePercent: number;
  autoConfirmHours: number;
  disputeWindowHours: number;
  jobsPerHour: number;
  /** Optional until the API adds them; the admin app falls back to WORK_SETTINGS_EXTRA_DEFAULTS. */
  rematchOnProviderCancel?: boolean;
  maxRematches?: number;
  photosEnabled?: boolean;
  maxPhotosPerJob?: number;
  maxPhotoKb?: number;
  chatEnabled?: boolean;
  trackingEnabled?: boolean;
  /** On-site checks (migration 0100). Optional until the API returns them. */
  onsiteCheckEnabled?: boolean;
  onsiteRadiusM?: number;
  onsiteMinMinutes?: number;
  onsiteAction?: "flag" | "suspend";
  onsiteFlagNoLocation?: boolean;
  onsiteRequireLocation?: boolean;
  onsiteSuspendAfterFlags?: number;
  onsiteWindowDays?: number;
  locationRetentionDays?: number;
};

export const WORK_SETTINGS_EXTRA_DEFAULTS = {
  rematchOnProviderCancel: true,
  maxRematches: 2,
  photosEnabled: true,
  maxPhotosPerJob: 8,
  maxPhotoKb: 4096,
  chatEnabled: true,
  trackingEnabled: true,
  onsiteCheckEnabled: false,
  onsiteRadiusM: 150,
  onsiteMinMinutes: 20,
  onsiteAction: "flag",
  onsiteFlagNoLocation: true,
  onsiteRequireLocation: true,
  onsiteSuspendAfterFlags: 0,
  onsiteWindowDays: 30,
  locationRetentionDays: 30,
} as const;

export type WorkFlagKind = "cancel_after_onsite" | "cancel_no_location";
export type WorkFlagStatus = "open" | "dismissed" | "warned" | "suspended";
export type WorkFlagOutcome = "dismiss" | "warn" | "suspend";

/** A `work_flags` row joined with the provider and job it is about. */
export type WorkAdminFlag = {
  id: string;
  job_id: string;
  provider_id: string;
  customer_id: string;
  kind: WorkFlagKind;
  cancelled_by: string;
  onsite_minutes: number;
  closest_m: number | null;
  points: number;
  first_onsite_at: string | null;
  last_onsite_at: string | null;
  radius_m: number;
  min_minutes: number;
  status: WorkFlagStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  provider_name: string;
  provider_status: WorkProviderStatus;
  service_name: string;
  address: string;
  provider_flag_count: number;
};

export type WorkFlagDetail = {
  flag: WorkAdminFlag & { customer_name: string; provider_status_note: string | null };
  job: { id: string; serviceName: string; address: string; lat: number | null; lng: number | null; status: string; assignedAt: string | null; cancelledAt: string | null; cancelledBy: string | null; cancelReason: string | null };
  /** Holes in the on-site trail (phone locked, page closed) and the longest one; null when the job has no address position. */
  dwell: { gaps: number; longestGapMinutes: number } | null;
  /** When the provider tapped "I've arrived" (checked against their location), if they did. */
  arrivedAt: string | null;
  trail: { lat: number; lng: number; accuracyM: number | null; at: string }[];
  trailTotal: number;
  events: { id: string; action: string; actor_kind: string; detail: string | null; created_at: string }[];
  otherFlags: { id: string; kind: WorkFlagKind; status: WorkFlagStatus; onsite_minutes: number; created_at: string }[];
};

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function workAdminMethods(request: Request) {
  const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
  const enc = encodeURIComponent;
  return {
    // ---- Catalogue ----
    workAdminServices(type?: WorkServiceType) {
      return request<{ services: WorkAdminService[] }>(`/v1/work/admin/services${type ? `?type=${type}` : ""}`);
    },
    workAdminCreateService(input: Partial<WorkAdminServiceInput> & Pick<WorkAdminServiceInput, "type" | "name" | "pricingMode">) {
      return post<{ id: string }>("/v1/work/admin/services", input);
    },
    workAdminUpdateService(serviceId: string, input: Partial<WorkAdminServiceInput>) {
      return request<{ ok: true }>(`/v1/work/admin/services/${enc(serviceId)}`, { method: "PATCH", body: JSON.stringify(input) });
    },

    // ---- Providers ----
    workAdminProviders(status?: WorkProviderStatus) {
      return request<{ providers: WorkAdminProvider[] }>(`/v1/work/admin/providers${status ? `?status=${status}` : ""}`);
    },
    /** `note` is optional on the API (trimmed to 300 characters). */
    workAdminProviderAction(providerId: string, action: WorkProviderAction, note?: string) {
      return post<{ ok: true }>(`/v1/work/admin/providers/${enc(providerId)}/${action}`, { note });
    },

    // ---- Jobs ----
    /** The endpoint filters by status only; it returns at most 200 jobs, newest first. */
    workAdminJobs(status?: string) {
      return request<{ jobs: WorkAdminJob[] }>(`/v1/work/admin/jobs${status ? `?status=${enc(status)}` : ""}`);
    },
    workAdminJob(jobId: string) {
      return request<WorkAdminJobDetail>(`/v1/work/admin/jobs/${enc(jobId)}`);
    },
    workAdminAssign(jobId: string, providerId: string) {
      return post<{ job: WorkAdminJob }>(`/v1/work/admin/jobs/${enc(jobId)}/assign`, { providerId });
    },
    workAdminBroadcast(jobId: string) {
      return post<{ notified: number }>(`/v1/work/admin/jobs/${enc(jobId)}/broadcast`);
    },
    workAdminCancel(jobId: string, reason?: string) {
      return post<{ ok: true }>(`/v1/work/admin/jobs/${enc(jobId)}/cancel`, { reason });
    },
    /** `refundPercent` (1-99) is required for `split`; `note` is required (3-500 characters). */
    workAdminResolve(jobId: string, input: { outcome: WorkResolveOutcome; refundPercent?: number; note: string }) {
      return post<{ ok: true }>(`/v1/work/admin/jobs/${enc(jobId)}/resolve`, input);
    },

    // ---- On-site flags (cancellations after a long stay at the customer's address) ----
    /** `ready` is false until migration 0100 is applied. */
    workAdminFlags(status?: WorkFlagStatus) {
      return request<{ ready: boolean; flags: WorkAdminFlag[]; openCount: number }>(`/v1/work/admin/flags${status ? `?status=${status}` : ""}`);
    },
    workAdminFlag(flagId: string) {
      return request<WorkFlagDetail>(`/v1/work/admin/flags/${enc(flagId)}`);
    },
    workAdminReviewFlag(flagId: string, outcome: WorkFlagOutcome, note?: string) {
      return post<{ ok: true }>(`/v1/work/admin/flags/${enc(flagId)}/review`, { outcome, note });
    },

    // ---- Work settings (the `work` group of the general settings endpoints) ----
    workAdminGetSettings() {
      return request<{ settings: { work: WorkAdminSettings } }>("/v1/settings");
    },
    workAdminUpdateSettings(work: Partial<WorkAdminSettings>) {
      return request<{ settings: { work: WorkAdminSettings } }>("/v1/admin/settings", { method: "PUT", body: JSON.stringify({ work }) });
    },
  };
}
