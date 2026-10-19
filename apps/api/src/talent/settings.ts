import { z } from "zod";
import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Peebee Jobs is controlled from Admin: which kinds of work are open, how they
 * are paid for, who may work, whether charging is on at all, and every limit and
 * window. Nothing here is a constant in the code beyond structural safety rails.
 */

export const TALENT_JOB_TYPES = ["gig", "project", "hiring"] as const;
export const TALENT_PAYMENT_MODES = ["escrow", "direct"] as const;
export type TalentJobType = (typeof TALENT_JOB_TYPES)[number];
export type TalentPaymentMode = (typeof TALENT_PAYMENT_MODES)[number];

export type TalentSettings = {
  /** Master switch. Off until staff turn Jobs on. */
  enabled: boolean;
  /** Which kinds of job can be posted right now. */
  jobTypes: TalentJobType[];
  /** The "find a worker" directory. */
  workerSearchEnabled: boolean;
  /** How gigs and projects are paid. If both are on the employer chooses; otherwise the default is used. */
  paymentModes: TalentPaymentMode[];
  defaultPaymentMode: TalentPaymentMode;
  /** Riders can also register as workers. */
  ridersCanWork: boolean;
  /** "review": staff approve each new worker profile. "auto": profiles go live once activated. */
  workerApproval: "review" | "auto";
  /** Every new job waits for staff before it is shown. */
  jobReview: boolean;
  /** Master "everything is free" switch. Overrides every fee rule and plan. */
  freeAccess: boolean;
  /** Joining (worker profile or first job) is free even when onboarding fees exist. */
  freeOnboarding: boolean;
  /** Days of every Pro feature given free to a new worker or employer. 0 turns the trial off. */
  trialDays: number;
  maxOpenJobs: number;
  applicationsPerDay: number;
  postsPerHour: number;
  minJobUgx: number;
  maxJobUgx: number;
  jobExpiryDays: number;
  /** A submitted piece of work pays out by itself after this long if the employer says nothing. */
  autoConfirmHours: number;
  maxMilestones: number;
  maxWorkersPerJob: number;
  searchRadiusKm: number;
  maxSkills: number;
  /** How long a boost lasts. */
  boostDays: number;
  reviewsEnabled: boolean;
  chatEnabled: boolean;
  /** Phone numbers stay hidden until the employer hires or unlocks the contact. */
  hideContacts: boolean;
  /** For direct-pay work: a worker who owes Peebee more than this in unpaid commission can't take new work. */
  unpaidCommissionLimitUgx: number;
};

const KEYS = [
  "talent_enabled", "talent_gigs_enabled", "talent_projects_enabled", "talent_hiring_enabled", "talent_worker_search_enabled",
  "talent_payment_modes", "talent_default_payment_mode", "talent_riders_can_work", "talent_worker_approval", "talent_job_review",
  "talent_free_access", "talent_free_onboarding", "talent_trial_days", "talent_max_open_jobs", "talent_applications_per_day",
  "talent_posts_per_hour", "talent_min_job_ugx", "talent_max_job_ugx", "talent_job_expiry_days", "talent_auto_confirm_hours",
  "talent_max_milestones", "talent_max_workers_per_job", "talent_search_radius_km", "talent_max_skills",
  "talent_boost_days", "talent_reviews_enabled", "talent_chat_enabled", "talent_hide_contacts", "talent_unpaid_commission_limit_ugx",
] as const;

const int = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== "" ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export async function getTalentSettings(): Promise<TalentSettings> {
  const v = Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await getSetting(k)]))) as Record<(typeof KEYS)[number], string>;
  const wantedModes = new Set(v.talent_payment_modes.split(",").map((m) => m.trim()));
  let paymentModes = TALENT_PAYMENT_MODES.filter((m) => wantedModes.has(m));
  // Gigs and projects must have some way to be paid; fall back to escrow, the safe one.
  if (paymentModes.length === 0) paymentModes = ["escrow"];
  const asked = v.talent_default_payment_mode as TalentPaymentMode;
  const jobTypes: TalentJobType[] = [];
  if (v.talent_gigs_enabled !== "0") jobTypes.push("gig");
  if (v.talent_projects_enabled !== "0") jobTypes.push("project");
  if (v.talent_hiring_enabled !== "0") jobTypes.push("hiring");
  return {
    enabled: v.talent_enabled === "1",
    jobTypes,
    workerSearchEnabled: v.talent_worker_search_enabled !== "0",
    paymentModes,
    defaultPaymentMode: paymentModes.includes(asked) ? asked : paymentModes[0],
    ridersCanWork: v.talent_riders_can_work !== "0",
    workerApproval: v.talent_worker_approval === "auto" ? "auto" : "review",
    jobReview: v.talent_job_review === "1",
    freeAccess: v.talent_free_access !== "0",
    freeOnboarding: v.talent_free_onboarding !== "0",
    trialDays: int(v.talent_trial_days, 14, 0, 365),
    maxOpenJobs: int(v.talent_max_open_jobs, 20, 1, 1000),
    applicationsPerDay: int(v.talent_applications_per_day, 30, 1, 1000),
    postsPerHour: int(v.talent_posts_per_hour, 10, 1, 200),
    minJobUgx: int(v.talent_min_job_ugx, 5000, 0, 1_000_000_000),
    maxJobUgx: int(v.talent_max_job_ugx, 50_000_000, 1000, 10_000_000_000),
    jobExpiryDays: int(v.talent_job_expiry_days, 30, 1, 365),
    autoConfirmHours: int(v.talent_auto_confirm_hours, 72, 1, 24 * 30),
    maxMilestones: int(v.talent_max_milestones, 10, 1, 50),
    maxWorkersPerJob: int(v.talent_max_workers_per_job, 20, 1, 500),
    searchRadiusKm: int(v.talent_search_radius_km, 25, 1, 500),
    maxSkills: int(v.talent_max_skills, 15, 1, 50),
    boostDays: int(v.talent_boost_days, 7, 1, 90),
    reviewsEnabled: v.talent_reviews_enabled !== "0",
    chatEnabled: v.talent_chat_enabled !== "0",
    hideContacts: v.talent_hide_contacts !== "0",
    unpaidCommissionLimitUgx: int(v.talent_unpaid_commission_limit_ugx, 50_000, 0, 1_000_000_000),
  };
}

/** The admin settings form. Ranges match getTalentSettings. */
export const talentSettingsSchema = z
  .object({
    enabled: z.boolean(),
    jobTypes: z.array(z.enum(TALENT_JOB_TYPES)).max(3),
    workerSearchEnabled: z.boolean(),
    paymentModes: z.array(z.enum(TALENT_PAYMENT_MODES)).min(1, "Allow at least one way to pay for gigs and projects.").max(2),
    defaultPaymentMode: z.enum(TALENT_PAYMENT_MODES),
    ridersCanWork: z.boolean(),
    workerApproval: z.enum(["review", "auto"]),
    jobReview: z.boolean(),
    freeAccess: z.boolean(),
    freeOnboarding: z.boolean(),
    trialDays: z.number().int().min(0).max(365),
    maxOpenJobs: z.number().int().min(1).max(1000),
    applicationsPerDay: z.number().int().min(1).max(1000),
    postsPerHour: z.number().int().min(1).max(200),
    minJobUgx: z.number().int().min(0).max(1_000_000_000),
    maxJobUgx: z.number().int().min(1000).max(10_000_000_000),
    jobExpiryDays: z.number().int().min(1).max(365),
    autoConfirmHours: z.number().int().min(1).max(720),
    maxMilestones: z.number().int().min(1).max(50),
    maxWorkersPerJob: z.number().int().min(1).max(500),
    searchRadiusKm: z.number().int().min(1).max(500),
    maxSkills: z.number().int().min(1).max(50),
    boostDays: z.number().int().min(1).max(90),
    reviewsEnabled: z.boolean(),
    chatEnabled: z.boolean(),
    hideContacts: z.boolean(),
    unpaidCommissionLimitUgx: z.number().int().min(0).max(1_000_000_000),
  })
  .partial()
  .superRefine((d, ctx) => {
    if (d.paymentModes && d.defaultPaymentMode && !d.paymentModes.includes(d.defaultPaymentMode)) {
      ctx.addIssue({ code: "custom", path: ["defaultPaymentMode"], message: "The default way to pay must be one that is switched on." });
    }
    if (d.minJobUgx != null && d.maxJobUgx != null && d.minJobUgx > d.maxJobUgx) {
      ctx.addIssue({ code: "custom", path: ["minJobUgx"], message: "The smallest job can't be more than the largest." });
    }
  });

export type TalentSettingsInput = z.infer<typeof talentSettingsSchema>;

export async function setTalentSettings(next: TalentSettingsInput): Promise<void> {
  const writes: Promise<void>[] = [];
  const put = (key: (typeof KEYS)[number], value: string) => writes.push(setSetting(key, value));
  const flag = (b: boolean) => (b ? "1" : "0");
  if (next.enabled != null) put("talent_enabled", flag(next.enabled));
  if (next.jobTypes) {
    put("talent_gigs_enabled", flag(next.jobTypes.includes("gig")));
    put("talent_projects_enabled", flag(next.jobTypes.includes("project")));
    put("talent_hiring_enabled", flag(next.jobTypes.includes("hiring")));
  }
  if (next.workerSearchEnabled != null) put("talent_worker_search_enabled", flag(next.workerSearchEnabled));
  if (next.paymentModes) put("talent_payment_modes", next.paymentModes.join(","));
  if (next.defaultPaymentMode) put("talent_default_payment_mode", next.defaultPaymentMode);
  if (next.ridersCanWork != null) put("talent_riders_can_work", flag(next.ridersCanWork));
  if (next.workerApproval) put("talent_worker_approval", next.workerApproval);
  if (next.jobReview != null) put("talent_job_review", flag(next.jobReview));
  if (next.freeAccess != null) put("talent_free_access", flag(next.freeAccess));
  if (next.freeOnboarding != null) put("talent_free_onboarding", flag(next.freeOnboarding));
  const nums: Array<[keyof TalentSettingsInput, (typeof KEYS)[number]]> = [
    ["trialDays", "talent_trial_days"], ["maxOpenJobs", "talent_max_open_jobs"], ["applicationsPerDay", "talent_applications_per_day"],
    ["postsPerHour", "talent_posts_per_hour"], ["minJobUgx", "talent_min_job_ugx"], ["maxJobUgx", "talent_max_job_ugx"],
    ["jobExpiryDays", "talent_job_expiry_days"], ["autoConfirmHours", "talent_auto_confirm_hours"],
    ["maxMilestones", "talent_max_milestones"], ["maxWorkersPerJob", "talent_max_workers_per_job"], ["searchRadiusKm", "talent_search_radius_km"],
    ["maxSkills", "talent_max_skills"], ["boostDays", "talent_boost_days"], ["unpaidCommissionLimitUgx", "talent_unpaid_commission_limit_ugx"],
  ];
  for (const [field, key] of nums) if (next[field] != null) put(key, String(next[field]));
  if (next.reviewsEnabled != null) put("talent_reviews_enabled", flag(next.reviewsEnabled));
  if (next.chatEnabled != null) put("talent_chat_enabled", flag(next.chatEnabled));
  if (next.hideContacts != null) put("talent_hide_contacts", flag(next.hideContacts));
  await Promise.all(writes);
}
