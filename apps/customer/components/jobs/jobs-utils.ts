import { ApiError } from "@peebee/shared";
import type { TalentJobType } from "@peebee/shared";
import { errorMessage } from "../../lib/api";
import { formatUgx, formatWorkDate, parseWorkDate } from "../work/work-utils";

export { formatUgx, formatWorkDate, parseWorkDate };

/** Text-like form fields take the app's single field fill; no tinted boxes inside them. */
export const fieldClass = "w-full rounded-2xl border border-[var(--border-faint)] px-4 py-3 text-sm text-ink placeholder:text-ink-500";
export const chipOn = "border-gold bg-gold/15 text-ink";
export const chipOff = "border-[var(--border-faint)] text-ink-500";

export const JOB_TYPE: Record<TalentJobType, { label: string; blurb: string; short: string }> = {
  gig: { label: "Quick gig", short: "Gig", blurb: "A job for today or this week with a fixed price: errands, cleaning, moving, events." },
  project: { label: "Project", short: "Project", blurb: "Bigger work with a budget. Workers send offers and you can pay in steps." },
  hiring: { label: "Hiring", short: "Hiring", blurb: "Looking for a longer-term worker. Candidates apply and you choose." },
};

export const EMPLOYMENT: Record<string, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", casual: "Casual", internship: "Internship" };
export const RATE_TYPE: Record<string, string> = { hour: "per hour", day: "per day", job: "per job", negotiable: "negotiable" };

export const STATUS: Record<string, { label: string; tone: "gold" | "neutral" | "good" | "bad" }> = {
  pending_review: { label: "Waiting for review", tone: "gold" },
  open: { label: "Open", tone: "gold" },
  in_progress: { label: "In progress", tone: "good" },
  filled: { label: "Filled", tone: "good" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
  rejected: { label: "Removed", tone: "bad" },
  applied: { label: "Applied", tone: "gold" },
  shortlisted: { label: "Shortlisted", tone: "good" },
  accepted: { label: "Hired", tone: "good" },
  hired: { label: "Hired", tone: "good" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  active: { label: "In progress", tone: "good" },
  settled: { label: "Paid & done", tone: "neutral" },
  disputed: { label: "Problem raised", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
  pending: { label: "Not submitted", tone: "neutral" },
  submitted: { label: "Waiting for approval", tone: "gold" },
  released: { label: "Paid", tone: "good" },
};

export type JobsFailure = { code?: string; message: string; topUp: boolean; pro: boolean; disabled: boolean; pending: boolean; needed?: number };

/** Turns any thrown error into friendly copy, flagging the states the screens treat specially. */
export function jobsFailure(err: unknown): JobsFailure {
  if (err instanceof ApiError) {
    const code = err.code;
    const message = errorMessage(err);
    if (code === "talent_upgrade_pending") return { code, message: "Peebee Hire is being set up. Please try again shortly.", topUp: false, pro: false, disabled: false, pending: true };
    if (code === "service_disabled") return { code, message: "Peebee Hire isn't available right now.", topUp: false, pro: false, disabled: true, pending: false };
    if (code === "insufficient_funds") return { code, message, topUp: true, pro: false, disabled: false, pending: false };
    if (code === "pro_required") return { code, message, topUp: false, pro: true, disabled: false, pending: false };
    return { code, message, topUp: false, pro: false, disabled: false, pending: false };
  }
  return { message: errorMessage(err), topUp: false, pro: false, disabled: false, pending: false };
}

export function budgetLabel(job: { type: TalentJobType; budgetMinUgx: number; budgetMaxUgx: number }): string {
  if (job.budgetMaxUgx <= 0) return "Pay to be agreed";
  if (job.type === "project" && job.budgetMinUgx > 0 && job.budgetMinUgx !== job.budgetMaxUgx) return `${formatUgx(job.budgetMinUgx)} – ${formatUgx(job.budgetMaxUgx)}`;
  return formatUgx(job.budgetMaxUgx);
}

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function stars(rating: number | null, count: number): string {
  if (rating == null || count === 0) return "New";
  return `★ ${rating.toFixed(1)} (${count})`;
}
