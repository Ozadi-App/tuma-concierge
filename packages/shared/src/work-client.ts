/**
 * Typed calls for the Peebee Work engine (`/v1/work`): used by the Peebee Work
 * provider app and, later, the customer app. Mirrors apps/api/src/work.
 */

export type WorkServiceType = "clean" | "fix" | "laundry";
export type WorkPricingMode = "fixed" | "quote";
export type WorkMatchingMode = "broadcast" | "customer_picks" | "admin_assigns";

export type WorkService = {
  id: string;
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
};

export type WorkPublicSettings = {
  enabled: boolean;
  serviceTypes: WorkServiceType[];
  pricingModes: WorkPricingMode[];
  matchingModes: WorkMatchingMode[];
  defaultMatching: WorkMatchingMode;
  providerKinds?: string[];
  /** Photos, chat and live location for jobs; each is off until its migration is in and admin allows it. */
  photosEnabled?: boolean;
  maxPhotosPerJob?: number;
  maxPhotoKb?: number;
  chatEnabled?: boolean;
  trackingEnabled?: boolean;
  quoteValidHours: number;
  freeCancelMinutes: number;
  lateCancelFeePercent: number;
  autoConfirmHours: number;
  disputeWindowHours: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
};

export type WorkJobStatus =
  | "open" | "assigned" | "quoted" | "booked" | "in_progress" | "completed" | "settled" | "cancelled" | "expired" | "disputed" | "refunded";

export type WorkJobProvider = { id: string; kind: string; name: string; bio: string; rating: number | null; ratingCount: number; jobsCompleted: number };

export type WorkJob = {
  id: string;
  status: WorkJobStatus;
  /** Only present for a provider once the job is theirs. */
  customer: { name: string; phone: string | null } | null;
  service: { id: string; type: WorkServiceType; name: string };
  pricingMode: WorkPricingMode;
  matchingMode: WorkMatchingMode;
  quantity: number;
  details: string;
  address: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  scheduledFor: string | null;
  unitPriceUgx: number;
  calloutFeeUgx: number;
  priceUgx: number;
  heldUgx: number;
  commissionPercent: number;
  commissionUgx: number;
  expiresAt: string | null;
  quoteExpiresAt: string | null;
  confirmBy: string | null;
  provider: WorkJobProvider | null;
  workerName: string | null;
  rating: number | null;
  review: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  disputeReason: string | null;
  resolutionNote: string | null;
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  settledAt: string | null;
  /** How many times this job has gone back out to other providers. */
  rematchCount?: number;
  /** Where the provider is while the job is booked or in progress (customer and staff only). */
  providerLocation?: { lat: number; lng: number; updatedAt: string | null } | null;
  /** On the provider's open-jobs feed: their own offer, if any. */
  myOffer?: { price_ugx: number; eta_minutes: number | null; status: string } | null;
};

export type WorkCustomerAction = "cancel" | "accept_quote" | "decline_quote" | "choose_provider" | "confirm" | "report_problem" | "rate";

export type WorkProviderProfile = {
  id: string;
  kind: "individual" | "company";
  displayName: string;
  companyName: string | null;
  phone: string | null;
  bio: string;
  status: "pending" | "approved" | "suspended" | "rejected";
  statusNote: string | null;
  online: boolean;
  role: "owner" | "staff";
  rating: number | null;
  ratingCount: number;
  jobsCompleted: number;
  services: { id: string; type: WorkServiceType; category: string; name: string }[];
};

export type WorkStaffMember = { user_id: string; role: "owner" | "staff"; status: "active" | "revoked"; name: string; phone: string | null };

export type WorkPhoto = { id: string; phase: "request" | "before" | "after"; uploaderKind: "customer" | "provider"; note: string | null; sizeBytes: number; createdAt: string };
export type WorkMessage = { id: string; from: "customer" | "provider"; senderName?: string; body: string; createdAt: string };

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function workMethods(request: Request) {
  const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
  return {
    // ---- Customer ----
    workCatalog(type?: WorkServiceType) {
      return request<{ services: WorkService[]; settings: WorkPublicSettings }>(`/v1/work/catalog${type ? `?type=${type}` : ""}`);
    },
    workBook(input: {
      serviceId: string;
      quantity?: number;
      details?: string;
      address: string;
      area?: string;
      lat?: number;
      lng?: number;
      scheduledFor?: string;
      matchingMode?: WorkMatchingMode;
      idempotencyKey?: string;
    }) {
      return post<{ job: WorkJob; actions: WorkCustomerAction[]; repeated?: boolean }>("/v1/work/jobs", input);
    },
    workMyJobs() {
      return request<{ jobs: (WorkJob & { actions: WorkCustomerAction[] })[] }>("/v1/work/jobs");
    },
    workJob(id: string) {
      return request<{ job: WorkJob; actions: WorkCustomerAction[]; offers: { id: string; priceUgx: number; etaMinutes: number | null; message: string; provider: WorkJobProvider }[]; timeline: { action: string; actor_kind: string; created_at: string }[] }>(`/v1/work/jobs/${encodeURIComponent(id)}`);
    },
    workSelectOffer(jobId: string, offerId: string) {
      return post<{ job: WorkJob }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/offers/${encodeURIComponent(offerId)}/select`);
    },
    workAcceptQuote(jobId: string) {
      return post<{ job: WorkJob }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/quote/accept`);
    },
    workDeclineQuote(jobId: string) {
      return post<{ ok: true }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/quote/decline`);
    },
    workCancel(jobId: string, reason?: string) {
      return post<{ ok: true }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/cancel`, { reason });
    },
    workConfirm(jobId: string) {
      return post<{ ok: true }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/confirm`);
    },
    workReportProblem(jobId: string, reason: string) {
      return post<{ ok: true }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/dispute`, { reason });
    },
    workRate(jobId: string, rating: number, review?: string) {
      return post<{ ok: true }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/rate`, { rating, review });
    },

    workJobPhotos(jobId: string) {
      return request<{ photos: WorkPhoto[] }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/photos`);
    },
    workUploadJobPhoto(jobId: string, file: Blob, note?: string) {
      const form = new FormData();
      form.append("file", file, "photo.jpg");
      if (note) form.append("note", note);
      return request<{ photo: WorkPhoto }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/photos`, { method: "POST", body: form });
    },
    workJobMessages(jobId: string, after?: string) {
      return request<{ messages: WorkMessage[] }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`);
    },
    workSendJobMessage(jobId: string, body: string) {
      return post<{ message: WorkMessage }>(`/v1/work/jobs/${encodeURIComponent(jobId)}/messages`, { body });
    },

    // ---- Provider ----
    workProviderRegister(input: { kind: "individual" | "company"; displayName: string; companyName?: string; phone?: string; bio?: string; serviceIds: string[] }) {
      return post<{ provider: WorkProviderProfile }>("/v1/work/provider/register", input);
    },
    workProviderMe() {
      return request<{ provider: WorkProviderProfile; canWork: boolean }>("/v1/work/provider/me");
    },
    workProviderUpdate(input: { displayName?: string; companyName?: string; phone?: string; bio?: string; serviceIds?: string[]; online?: boolean; lat?: number; lng?: number }) {
      return request<{ provider: WorkProviderProfile }>("/v1/work/provider/me", { method: "PUT", body: JSON.stringify(input) });
    },
    workStaff() {
      return request<{ staff: WorkStaffMember[] }>("/v1/work/provider/staff");
    },
    workAddStaff(identifier: string) {
      return post<{ ok: true; staff: { userId: string; name: string } }>("/v1/work/provider/staff", { identifier });
    },
    workRemoveStaff(userId: string) {
      return request<{ ok: true }>(`/v1/work/provider/staff/${encodeURIComponent(userId)}`, { method: "DELETE" });
    },
    workOpenJobs() {
      return request<{ jobs: WorkJob[] }>("/v1/work/provider/jobs/open");
    },
    workProviderJob(jobId: string) {
      return request<{ job: WorkJob; role: "owner" | "staff" }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}`);
    },
    workProviderJobs(status?: string) {
      return request<{ jobs: WorkJob[] }>(`/v1/work/provider/jobs${status ? `?status=${encodeURIComponent(status)}` : ""}`);
    },
    workAcceptJob(jobId: string) {
      return post<{ job: WorkJob }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/accept`);
    },
    workOfferOnJob(jobId: string, input: { priceUgx?: number; etaMinutes?: number; message?: string }) {
      return post<{ ok: true; priceUgx: number }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/offer`, input);
    },
    workWithdrawOffer(jobId: string) {
      return request<{ ok: true }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/offer`, { method: "DELETE" });
    },
    workQuote(jobId: string, priceUgx: number) {
      return post<{ job: WorkJob }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/quote`, { priceUgx });
    },
    workAssignWorker(jobId: string, workerId: string) {
      return post<{ job: WorkJob }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/assign-worker`, { workerId });
    },
    workStartJob(jobId: string) {
      return post<{ job: WorkJob }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/start`);
    },
    workCompleteJob(jobId: string, note?: string) {
      return post<{ job: WorkJob }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/complete`, { note });
    },
    workProviderCancel(jobId: string, reason?: string) {
      return post<{ ok: true; rematched?: boolean }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/cancel`, { reason });
    },
    workProviderJobPhotos(jobId: string) {
      return request<{ photos: WorkPhoto[] }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/photos`);
    },
    workProviderUploadPhoto(jobId: string, file: Blob, phase: "before" | "after", note?: string) {
      const form = new FormData();
      form.append("file", file, "photo.jpg");
      form.append("phase", phase);
      if (note) form.append("note", note);
      return request<{ photo: WorkPhoto }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/photos`, { method: "POST", body: form });
    },
    workProviderMessages(jobId: string, after?: string) {
      return request<{ messages: WorkMessage[] }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`);
    },
    workProviderSendMessage(jobId: string, body: string) {
      return post<{ message: WorkMessage }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/messages`, { body });
    },
    /** `accuracy` is the device's own estimate of its error in metres; low-quality fixes are ignored by the on-site checks. */
    workShareLocation(jobId: string, lat: number, lng: number, accuracy?: number) {
      return post<{ ok: true; stored: boolean }>(`/v1/work/provider/jobs/${encodeURIComponent(jobId)}/location`, { lat, lng, ...(accuracy != null && Number.isFinite(accuracy) ? { accuracy } : {}) });
    },
    workEarnings() {
      return request<{ paidUgx: number; paidJobs: number; upcomingUgx: number; upcomingJobs: number; jobsCompleted: number }>("/v1/work/provider/earnings");
    },
  };
}
