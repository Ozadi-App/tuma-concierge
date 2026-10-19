/**
 * Typed calls for Peebee Jobs (`/v1/talent`): finding workers, posting and finding
 * work, contracts and payment, and plans. Mirrors apps/api/src/talent.
 */

export type TalentJobType = "gig" | "project" | "hiring";
export type TalentPaymentMode = "escrow" | "direct";
export type TalentSegment = "informal" | "professional" | "both";
export type TalentJobStatus = "pending_review" | "open" | "in_progress" | "filled" | "completed" | "cancelled" | "expired" | "closed" | "rejected";
export type TalentApplicationStatus = "applied" | "shortlisted" | "accepted" | "hired" | "rejected" | "withdrawn";
export type TalentContractStatus = "active" | "settled" | "cancelled" | "disputed" | "refunded";
export type TalentFeeKind =
  | "worker_onboarding" | "employer_onboarding" | "listing" | "boost" | "application" | "hire_fee" | "contact_unlock" | "employer_commission" | "worker_commission";
export type TalentFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type TalentCategory = { id: string; parentId: string | null; name: string; segment: TalentSegment; icon: string | null };

export type TalentFee = { kind: TalentFeeKind; jobType: "" | TalentJobType; model: "flat" | "percent"; flatUgx: number; percent: number; minUgx: number; maxUgx: number; freeFirstN: number; note: string };

export type TalentConfig = {
  enabled: boolean;
  jobTypes: TalentJobType[];
  workerSearchEnabled: boolean;
  paymentModes: TalentPaymentMode[];
  defaultPaymentMode: TalentPaymentMode;
  ridersCanWork: boolean;
  freeAccess: boolean;
  freeOnboarding: boolean;
  trialDays: number;
  reviewsEnabled: boolean;
  chatEnabled: boolean;
  limits: {
    minJobUgx: number; maxJobUgx: number; maxMilestones: number; maxWorkersPerJob: number; maxSkills: number;
    searchRadiusKm: number; boostDays: number; autoConfirmHours: number; jobExpiryDays: number;
  };
  recurring: { enabled: boolean; frequencies: TalentFrequency[]; maxRuns: number; maxActive: number };
  cancellation: { freeMinutes: number; mode: "flat" | "percent"; feeUgx: number; feePercent: number; partySharePercent: number };
  categories: TalentCategory[];
  fees: TalentFee[];
};

export type TalentWorker = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  skills: string[];
  languages: string[];
  categories: string[];
  area: string | null;
  remote: boolean;
  radiusKm: number;
  rateType: "hour" | "day" | "job" | "negotiable";
  rateUgx: number;
  experienceYears: number;
  portfolio: string[];
  availability: "available" | "busy" | "offline";
  verified: boolean;
  featured: boolean;
  rating: number | null;
  ratingCount: number;
  jobsCompleted: number;
  distanceKm: number | null;
  phone: string | null;
  isRider: boolean;
};

export type TalentMyProfile = Omit<TalentWorker, "categories"> & {
  categories: string[];
  status: "pending" | "approved" | "suspended" | "rejected";
  statusNote: string | null;
  visible: boolean;
  activated: boolean;
  lat: number | null;
  lng: number | null;
};

export type TalentFeature = { key: string; label: string; description: string; audience: string; pro: boolean; unlocked: boolean; via: string | null };

export type TalentMembershipSide = { trial: { expiresAt: string } | null; subscriptions: { id: string; planCode: string | null; planName: string | null; status: string; expiresAt: string; autoRenew: boolean }[] };
export type TalentMembership = { freeAccess: boolean; worker: TalentMembershipSide; employer: TalentMembershipSide; owedUgx: number; features: TalentFeature[] };

export type TalentMe = {
  profile: TalentMyProfile | null;
  employer: { businessName: string | null; about: string; verified: boolean; status: string; rating: number | null; ratingCount: number } | null;
  counts: { openJobs: number; pendingApplications: number; workInProgress: number; hiringInProgress: number; invites: number };
  membership: TalentMembership;
  canWork: boolean;
};

export type TalentProfileInput = {
  headline: string;
  bio?: string;
  skills?: string[];
  languages?: string[];
  categoryIds: string[];
  area?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  remote?: boolean;
  rateType?: "hour" | "day" | "job" | "negotiable";
  rateUgx?: number;
  experienceYears?: number;
  portfolio?: string[];
  availability?: "available" | "busy" | "offline";
};

export type TalentWorkerSearch = {
  q?: string; category?: string; segment?: "informal" | "professional"; lat?: number; lng?: number; radiusKm?: number; remote?: boolean;
  sort?: "best" | "rating" | "nearest" | "rate_low" | "newest"; limit?: number; offset?: number;
  /** Advanced filters: a Pro feature when admin makes it one. */
  minRating?: number; maxRate?: number; verifiedOnly?: boolean; availableNow?: boolean;
};

export type TalentJob = {
  id: string;
  type: TalentJobType;
  title: string;
  description: string;
  status: TalentJobStatus;
  category: { id: string; name: string } | null;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  remote: boolean;
  skills: string[];
  startsAt: string | null;
  deadline: string | null;
  budgetMinUgx: number;
  budgetMaxUgx: number;
  paymentMode: TalentPaymentMode | "none";
  workersNeeded: number;
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "internship" | null;
  boosted: boolean;
  applicationCount: number;
  expiresAt: string | null;
  createdAt: string;
  employer: { id: string; name: string; verified: boolean; rating: number | null; ratingCount: number };
  distanceKm?: number | null;
  myApplication?: string | { id: string; status: TalentApplicationStatus; bidUgx: number; message: string; contractId: string | null; contractStatus: string | null } | null;
  invited?: boolean;
  isMine?: boolean;
  pendingApplications?: number;
  boostable?: boolean;
  freeAccess?: boolean;
};

export type TalentJobInput = {
  type: TalentJobType;
  title: string;
  description: string;
  categoryId: string;
  area?: string;
  address?: string;
  lat?: number;
  lng?: number;
  remote?: boolean;
  skills?: string[];
  startsAt?: string;
  deadline?: string;
  budgetMinUgx?: number;
  budgetMaxUgx?: number;
  paymentMode?: TalentPaymentMode;
  workersNeeded?: number;
  employmentType?: "full_time" | "part_time" | "contract" | "casual" | "internship";
  idempotencyKey?: string;
  acceptRules: true;
};

export type TalentJobSearch = {
  type?: TalentJobType; category?: string; segment?: "informal" | "professional"; q?: string; lat?: number; lng?: number; radiusKm?: number; remote?: boolean;
  minBudget?: number; sort?: "newest" | "budget" | "nearest"; limit?: number; offset?: number;
};

export type TalentApplicant = {
  id: string;
  status: TalentApplicationStatus;
  message: string;
  bidUgx: number;
  appliedAt: string;
  contractId: string | null;
  contractStatus: string | null;
  worker: TalentWorker;
  phoneLocked: boolean;
};

export type TalentMyApplication = {
  id: string; jobId: string; jobTitle: string; jobType: TalentJobType; jobStatus: string; area: string | null; status: TalentApplicationStatus;
  bidUgx: number; budgetMaxUgx: number; message: string; createdAt: string; contractId: string | null; contractStatus: string | null;
};

export type TalentContractSummary = {
  id: string; jobId: string; applicationId: string; title: string; status: TalentContractStatus; paymentMode: TalentPaymentMode; priceUgx: number; heldUgx: number;
  paidToWorkerUgx: number; refundedUgx: number; feeUgx: number; role: "worker" | "employer"; otherParty: { id: string; name: string; phone: string }; createdAt: string; settledAt: string | null;
};

export type TalentMilestone = {
  id: string; position: number; title: string; amountUgx: number; status: "pending" | "submitted" | "released"; note: string | null;
  submittedAt: string | null; confirmBy: string | null; releasedAt: string | null; payoutUgx: number;
};

export type TalentContractDetail = {
  contract: TalentContractSummary;
  job: { id: string; type: TalentJobType };
  milestones: TalentMilestone[];
  actions: { submit: boolean; release: boolean; cancel: boolean; dispute: boolean; review: boolean };
  disputeReason: string | null;
  resolutionNote: string | null;
  reviewReceived: { rating: number; comment: string } | null;
  cancelQuote: TalentCancelQuote;
  cancelFeeUgx: number;
  recurring: { canRepeat: boolean; frequencies: TalentFrequency[]; existing: { id: string; frequency: TalentFrequency; status: string; nextRunAt: string } | null };
  timeline: { action: string; by: string; at: string }[];
};

export type TalentCancelQuote = { feeUgx: number; compensationUgx: number; baseUgx: number; free: boolean; mode: "flat" | "percent"; percent: number; flatUgx: number; freeUntil: string | null };

export type TalentRecurrence = {
  id: string; kind: "rehire" | "repost"; title: string; priceUgx: number; frequency: TalentFrequency; nextRunAt: string; endsAt: string | null; maxRuns: number; runsDone: number;
  status: "active" | "paused" | "ended"; lastError: string | null; sourceJobId: string; worker: { id: string; name: string } | null; role: "employer" | "worker";
};

export type TalentPlan = {
  id: string; code: string; audience: "worker" | "employer"; name: string; description: string; priceUgx: number; listPriceUgx: number; periodDays: number; trialDays: number;
  features: { key: string; label: string; description: string; pro: boolean }[]; waivedKinds: TalentFeeKind[];
  workerCommissionPercent: number | null; employerCommissionPercent: number | null; subscribed: boolean; trialAvailable: boolean;
};

export type TalentMessage = { id: string; mine: boolean; body: string; createdAt: string };

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

function qs(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export function talentMethods(request: Request) {
  const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
  const enc = encodeURIComponent;
  return {
    talentConfig() {
      return request<TalentConfig>("/v1/talent/config");
    },
    talentMe() {
      return request<TalentMe>("/v1/talent/me");
    },

    // ---- Worker profile ----
    talentSaveProfile(input: TalentProfileInput) {
      return request<{ ok: true; activation: { required: boolean; amountUgx: number }; status: { status: string; activated: boolean } | null }>("/v1/talent/profile", { method: "PUT", body: JSON.stringify(input) });
    },
    talentActivateProfile() {
      return post<{ ok: true; activated: true }>("/v1/talent/profile/activate");
    },
    talentSetAvailability(input: { availability?: "available" | "busy" | "offline"; visible?: boolean }) {
      return request<{ ok: true }>("/v1/talent/profile/availability", { method: "PATCH", body: JSON.stringify(input) });
    },
    talentBoostProfile() {
      return post<{ ok: true; featuredUntil: string; charged: number }>("/v1/talent/profile/boost");
    },
    talentSaveEmployer(input: { businessName?: string; about?: string }) {
      return request<{ ok: true }>("/v1/talent/employer", { method: "PUT", body: JSON.stringify(input) });
    },

    // ---- Find workers ----
    talentSearchWorkers(params: TalentWorkerSearch = {}) {
      return request<{ total: number; workers: TalentWorker[] }>(`/v1/talent/workers${qs(params)}`);
    },
    talentWorker(id: string) {
      return request<{ worker: TalentWorker; phoneLocked: boolean; reviews: { rating: number; comment: string; createdAt: string; from: string }[] }>(`/v1/talent/workers/${enc(id)}`);
    },
    talentUnlockContact(id: string) {
      return post<{ ok: true; phone: string; charged: number }>(`/v1/talent/workers/${enc(id)}/unlock-contact`);
    },

    // ---- Find work ----
    talentFeed(params: TalentJobSearch = {}) {
      return request<{ total: number; jobs: TalentJob[] }>(`/v1/talent/jobs${qs(params)}`);
    },
    talentJob(id: string) {
      return request<{ job: TalentJob }>(`/v1/talent/jobs/${enc(id)}`);
    },
    talentApply(jobId: string, input: { message?: string; bidUgx?: number } = {}) {
      return post<{ application: { id: string; status: string; bidUgx: number }; charged: number }>(`/v1/talent/jobs/${enc(jobId)}/apply`, input);
    },
    talentMyApplications() {
      return request<{ applications: TalentMyApplication[] }>("/v1/talent/applications/mine");
    },
    talentWithdrawApplication(id: string) {
      return post<{ ok: true }>(`/v1/talent/applications/${enc(id)}/withdraw`);
    },

    // ---- Hire ----
    talentPostJob(input: TalentJobInput) {
      return post<{ job: TalentJob; charged: number; needsReview: boolean }>("/v1/talent/jobs", input);
    },
    talentMyJobs() {
      return request<{ jobs: TalentJob[] }>("/v1/talent/jobs/mine");
    },
    talentUpdateJob(id: string, input: { title?: string; description?: string; deadline?: string; skills?: string[] }) {
      return request<{ job: TalentJob }>(`/v1/talent/jobs/${enc(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    },
    talentCloseJob(id: string) {
      return post<{ ok: true }>(`/v1/talent/jobs/${enc(id)}/close`);
    },
    talentBoostJob(id: string) {
      return post<{ ok: true; boostedUntil: string; charged: number }>(`/v1/talent/jobs/${enc(id)}/boost`);
    },
    talentInvite(jobId: string, workerId: string) {
      return post<{ ok: true }>(`/v1/talent/jobs/${enc(jobId)}/invite`, { workerId });
    },
    talentApplicants(jobId: string) {
      return request<{ applicants: TalentApplicant[] }>(`/v1/talent/jobs/${enc(jobId)}/applications`);
    },
    talentShortlist(applicationId: string) {
      return post<{ ok: true }>(`/v1/talent/applications/${enc(applicationId)}/shortlist`);
    },
    talentReject(applicationId: string) {
      return post<{ ok: true }>(`/v1/talent/applications/${enc(applicationId)}/reject`);
    },
    talentHire(applicationId: string) {
      return post<{ ok: true; charged: number; workerPhone: string }>(`/v1/talent/applications/${enc(applicationId)}/hire`);
    },
    talentAccept(applicationId: string, input: { milestones?: { title: string; amountUgx: number }[] } = {}) {
      return post<{ contractId: string; priceUgx: number; heldUgx: number; paymentMode: TalentPaymentMode; employerFeeUgx: number; workerFeeUgx: number }>(`/v1/talent/applications/${enc(applicationId)}/accept`, input);
    },
    talentMessages(applicationId: string) {
      return request<{ messages: TalentMessage[] }>(`/v1/talent/applications/${enc(applicationId)}/messages`);
    },
    talentSendMessage(applicationId: string, body: string) {
      return post<{ message: TalentMessage }>(`/v1/talent/applications/${enc(applicationId)}/messages`, { body });
    },

    // ---- Contracts ----
    talentContracts(role?: "worker" | "employer") {
      return request<{ contracts: TalentContractSummary[] }>(`/v1/talent/contracts${qs({ role })}`);
    },
    talentContract(id: string) {
      return request<TalentContractDetail>(`/v1/talent/contracts/${enc(id)}`);
    },
    talentSubmitWork(contractId: string, input: { milestoneId?: string; note?: string } = {}) {
      return post<{ ok: true; autoReleaseAt: string }>(`/v1/talent/contracts/${enc(contractId)}${input.milestoneId ? `/milestones/${enc(input.milestoneId)}` : ""}/submit`, { note: input.note });
    },
    talentReleasePayment(contractId: string, milestoneId?: string) {
      return post<{ ok: true; settled: boolean }>(`/v1/talent/contracts/${enc(contractId)}${milestoneId ? `/milestones/${enc(milestoneId)}` : ""}/release`);
    },
    talentCancelContract(contractId: string, reason: string, acceptFee = false) {
      return post<{ ok: true; lateFeeUgx: number; lateFeeStatus: "paid" | "due" | "none" }>(`/v1/talent/contracts/${enc(contractId)}/cancel`, { reason, acceptFee });
    },
    talentCancelQuote(contractId: string) {
      return request<TalentCancelQuote>(`/v1/talent/contracts/${enc(contractId)}/cancel-quote`);
    },

    // ---- Recurring jobs ----
    talentRecurrences() {
      return request<{ recurrences: TalentRecurrence[]; enabled: boolean; frequencies: TalentFrequency[] }>("/v1/talent/recurrences");
    },
    talentRepeatContract(contractId: string, input: { frequency: TalentFrequency; maxRuns?: number; startsAt?: string; endsAt?: string }) {
      return post<{ id: string }>(`/v1/talent/contracts/${enc(contractId)}/repeat`, input);
    },
    talentRepeatJob(jobId: string, input: { frequency: TalentFrequency; maxRuns?: number; startsAt?: string; endsAt?: string }) {
      return post<{ id: string }>(`/v1/talent/jobs/${enc(jobId)}/repeat`, input);
    },
    talentRecurrenceAction(id: string, action: "pause" | "resume" | "end") {
      return post<{ ok: true }>(`/v1/talent/recurrences/${enc(id)}/${action}`);
    },
    talentDispute(contractId: string, reason: string) {
      return post<{ ok: true }>(`/v1/talent/contracts/${enc(contractId)}/dispute`, { reason });
    },
    talentReview(contractId: string, rating: number, comment = "") {
      return post<{ ok: true }>(`/v1/talent/contracts/${enc(contractId)}/review`, { rating, comment });
    },
    talentEarnings() {
      return request<{ worker: { paidUgx: number; upcomingUgx: number; contracts: number }; employer: { heldInEscrowUgx: number; contracts: number }; owedUgx: number }>("/v1/talent/earnings");
    },
    talentPayDue() {
      return post<{ ok: true; paid: number; stillOwed: number }>("/v1/talent/pay-due");
    },

    // ---- Plans ----
    talentPlans() {
      return request<{ freeAccess: boolean; plans: TalentPlan[] }>("/v1/talent/plans");
    },
    talentSubscribe(planId: string) {
      return post<{ ok: true; trial: boolean; expiresAt: string }>(`/v1/talent/plans/${enc(planId)}/subscribe`);
    },
    talentCancelSubscription(id: string) {
      return post<{ ok: true }>(`/v1/talent/subscriptions/${enc(id)}/cancel`);
    },

    talentReport(input: { targetType: "job" | "profile" | "contract" | "user"; targetId: string; reason: string }) {
      return post<{ ok: true }>("/v1/talent/report", input);
    },
  };
}
