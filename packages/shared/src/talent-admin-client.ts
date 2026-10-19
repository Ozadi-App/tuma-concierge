/**
 * Typed calls for the Peebee Hire admin endpoints (`/v1/talent/admin/*`).
 * Mirrors apps/api/src/talent/admin.ts.
 */
import type { TalentFeeKind, TalentJobType } from "./talent-client.js";

export type TalentAdminSettings = {
  enabled: boolean;
  jobTypes: TalentJobType[];
  workerSearchEnabled: boolean;
  paymentModes: ("escrow" | "direct")[];
  defaultPaymentMode: "escrow" | "direct";
  ridersCanWork: boolean;
  workerApproval: "review" | "auto";
  jobReview: boolean;
  freeAccess: boolean;
  freeOnboarding: boolean;
  trialDays: number;
  maxOpenJobs: number;
  applicationsPerDay: number;
  postsPerHour: number;
  minJobUgx: number;
  maxJobUgx: number;
  jobExpiryDays: number;
  autoConfirmHours: number;
  maxMilestones: number;
  maxWorkersPerJob: number;
  searchRadiusKm: number;
  maxSkills: number;
  boostDays: number;
  reviewsEnabled: boolean;
  chatEnabled: boolean;
  hideContacts: boolean;
  unpaidCommissionLimitUgx: number;
  recurringEnabled: boolean;
  recurringFrequencies: ("daily" | "weekly" | "biweekly" | "monthly")[];
  recurringMaxActive: number;
  recurringMaxRuns: number;
  recurringMaxFailures: number;
  cancelFreeMinutes: number;
  lateCancelFeeMode: "flat" | "percent";
  lateCancelFeeUgx: number;
  lateCancelFeePercent: number;
  lateCancelPartySharePercent: number;
};

export type TalentAdminOverview = {
  settings: { enabled: boolean; freeAccess: boolean };
  counts: { jobsOpen: number; jobsReview: number; workers: number; workersPending: number; openReports: number; disputes: number; contracts: number };
  money: { heldInEscrowUgx: number; owedToPeebeeUgx: number };
  revenue30d: { kind: string; totalUgx: number; count: number }[];
  revenue30dTotalUgx: number;
  waived30d: { reason: string; count: number }[];
};

export type TalentAdminFeeRule = {
  id: string; kind: TalentFeeKind; job_type: "" | TalentJobType; model: "free" | "flat" | "percent"; flat_ugx: number; percent: number; min_ugx: number; max_ugx: number;
  free_first_n: number; active: number; note: string;
};
export type TalentAdminFeeRuleInput = {
  kind: TalentFeeKind; jobType?: "" | TalentJobType; model: "free" | "flat" | "percent"; flatUgx?: number; percent?: number; minUgx?: number; maxUgx?: number; freeFirstN?: number; active?: boolean; note?: string;
};

export type TalentAdminPlan = {
  id: string; code: string; audience: "worker" | "employer"; name: string; description: string; price_ugx: number; period_days: number; trial_days: number;
  features: string[]; waived_kinds: TalentFeeKind[]; worker_commission_percent: number | null; employer_commission_percent: number | null; active: number; sort_order: number; subscribers: number;
};
export type TalentAdminPlanInput = {
  code: string; audience: "worker" | "employer"; name: string; description?: string; priceUgx: number; periodDays?: number; trialDays?: number; features?: string[];
  waivedKinds?: TalentFeeKind[]; workerCommissionPercent?: number | null; employerCommissionPercent?: number | null; active?: boolean; sortOrder?: number;
};

export type TalentAdminFeature = { key: string; label: string; description: string; audience: string; pro: number; sort_order: number };
export type TalentAdminCategory = { id: string; parent_id: string | null; name: string; segment: "informal" | "professional" | "both"; icon: string | null; sort_order: number; active: number };
export type TalentAdminTerm = { id: string; term: string; category: string; action: "block" | "review"; active: number };

export type TalentAdminWorker = {
  userId: string; name: string; phone: string; isRider: boolean; headline: string; area: string | null; status: "pending" | "approved" | "suspended" | "rejected"; statusNote: string | null;
  activated: boolean; idVerified: boolean; rating: number | null; ratingCount: number; jobsCompleted: number; createdAt: string;
};

export type TalentAdminJob = {
  id: string; type: TalentJobType; title: string; description: string; status: string; category: string | null; employer: { id: string; name: string; phone: string }; area: string | null;
  budgetMaxUgx: number; paymentMode: string; moderationState: string; applicationCount: number; createdAt: string;
};

export type TalentAdminReport = { id: string; targetType: string; targetId: string; reason: string; source: "user" | "screening"; status: string; reporter: string | null; createdAt: string };
export type TalentAdminDispute = { contractId: string; title: string; priceUgx: number; heldUgx: number; paymentMode: string; employer: string; worker: string; reason: string; raisedBy: "worker" | "employer"; raisedAt: string | null };
export type TalentAdminCharge = { id: string; user_id: string; user_name: string; kind: string; amount_ugx: number; status: string; reason: string; created_at: string };

export type TalentWorkerAction = "approve" | "reject" | "suspend" | "reinstate";
export type TalentResolve = { outcome: "release" | "refund"; note?: string } | { outcome: "split"; refundUgx: number; note?: string };

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function talentAdminMethods(request: Request) {
  const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
  const send = <T>(method: string, path: string, body: unknown) => request<T>(path, { method, body: JSON.stringify(body) });
  const enc = encodeURIComponent;
  const q = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return s ? `?${s}` : "";
  };
  return {
    talentAdminSeedSandbox() {
      return post<{ ok: true; workers: number; employers: number; jobs: number }>("/v1/talent/admin/sandbox/seed");
    },
    talentAdminClearSandbox() {
      return post<{ ok: true; removed: number }>("/v1/talent/admin/sandbox/clear");
    },
    talentAdminOverview() {
      return request<TalentAdminOverview>("/v1/talent/admin/overview");
    },
    talentAdminGetSettings() {
      return request<{ settings: TalentAdminSettings }>("/v1/talent/admin/settings");
    },
    talentAdminUpdateSettings(input: Partial<TalentAdminSettings>) {
      return send<{ settings: TalentAdminSettings }>("PUT", "/v1/talent/admin/settings", input);
    },
    talentAdminCategories() {
      return request<{ categories: TalentAdminCategory[] }>("/v1/talent/admin/categories");
    },
    talentAdminCreateCategory(input: { name: string; segment?: "informal" | "professional" | "both"; sortOrder?: number }) {
      return post<{ id: string }>("/v1/talent/admin/categories", input);
    },
    talentAdminUpdateCategory(id: string, input: Partial<{ name: string; segment: "informal" | "professional" | "both"; sortOrder: number; active: boolean }>) {
      return send<{ ok: true }>("PATCH", `/v1/talent/admin/categories/${enc(id)}`, input);
    },
    talentAdminFeeRules() {
      return request<{ rules: TalentAdminFeeRule[]; kinds: TalentFeeKind[] }>("/v1/talent/admin/fee-rules");
    },
    talentAdminSaveFeeRule(input: TalentAdminFeeRuleInput) {
      return send<{ id: string }>("PUT", "/v1/talent/admin/fee-rules", input);
    },
    talentAdminDeleteFeeRule(id: string) {
      return request<{ ok: true }>(`/v1/talent/admin/fee-rules/${enc(id)}`, { method: "DELETE" });
    },
    talentAdminPlans() {
      return request<{ plans: TalentAdminPlan[] }>("/v1/talent/admin/plans");
    },
    talentAdminCreatePlan(input: TalentAdminPlanInput) {
      return post<{ id: string }>("/v1/talent/admin/plans", input);
    },
    talentAdminUpdatePlan(id: string, input: Partial<Omit<TalentAdminPlanInput, "code" | "audience">>) {
      return send<{ ok: true }>("PATCH", `/v1/talent/admin/plans/${enc(id)}`, input);
    },
    talentAdminFeatures() {
      return request<{ features: TalentAdminFeature[] }>("/v1/talent/admin/features");
    },
    talentAdminUpdateFeature(key: string, input: { pro?: boolean; label?: string; description?: string }) {
      return send<{ ok: true }>("PATCH", `/v1/talent/admin/features/${enc(key)}`, input);
    },
    talentAdminCharges(filter: { status?: string; kind?: string } = {}) {
      return request<{ charges: TalentAdminCharge[] }>(`/v1/talent/admin/charges${q(filter)}`);
    },
    talentAdminProhibited() {
      return request<{ terms: TalentAdminTerm[] }>("/v1/talent/admin/prohibited");
    },
    talentAdminAddProhibited(input: { term: string; category?: string; action?: "block" | "review" }) {
      return post<{ id: string }>("/v1/talent/admin/prohibited", input);
    },
    talentAdminUpdateProhibited(id: string, input: { active?: boolean; action?: "block" | "review" }) {
      return send<{ ok: true }>("PATCH", `/v1/talent/admin/prohibited/${enc(id)}`, input);
    },
    talentAdminWorkers(filter: { status?: string; q?: string } = {}) {
      return request<{ workers: TalentAdminWorker[] }>(`/v1/talent/admin/workers${q(filter)}`);
    },
    talentAdminWorkerAction(userId: string, action: TalentWorkerAction, note?: string) {
      return post<{ ok: true }>(`/v1/talent/admin/workers/${enc(userId)}/${action}`, { note });
    },
    talentAdminVerifyId(userId: string, verified = true) {
      return post<{ ok: true }>(`/v1/talent/admin/workers/${enc(userId)}/verify-id`, { verified });
    },
    talentAdminJobs(filter: { status?: string; type?: string } = {}) {
      return request<{ jobs: TalentAdminJob[] }>(`/v1/talent/admin/jobs${q(filter)}`);
    },
    talentAdminApproveJob(id: string) {
      return post<{ ok: true }>(`/v1/talent/admin/jobs/${enc(id)}/approve`);
    },
    talentAdminRejectJob(id: string, reason: string) {
      return post<{ ok: true }>(`/v1/talent/admin/jobs/${enc(id)}/reject`, { reason });
    },
    talentAdminReports(status = "open") {
      return request<{ reports: TalentAdminReport[] }>(`/v1/talent/admin/reports?status=${enc(status)}`);
    },
    talentAdminResolveReport(id: string, action: "dismiss" | "take_down", note = "") {
      return post<{ ok: true }>(`/v1/talent/admin/reports/${enc(id)}/resolve`, { action, note });
    },
    talentAdminDisputes() {
      return request<{ disputes: TalentAdminDispute[] }>("/v1/talent/admin/disputes");
    },
    talentAdminContract(id: string) {
      return request<{ contract: Record<string, unknown>; milestones: Record<string, unknown>[]; events: Record<string, unknown>[]; messages: Record<string, unknown>[] }>(`/v1/talent/admin/contracts/${enc(id)}`);
    },
    talentAdminResolveDispute(contractId: string, input: TalentResolve) {
      return post<{ ok: true }>(`/v1/talent/admin/contracts/${enc(contractId)}/resolve`, input);
    },
  };
}
