import type { WorkJob, WorkJobStatus } from "@peebee/shared";

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-UG")}`;

/** SQLite timestamps are UTC without a "Z". */
export function parseDbTime(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function timeAgo(value: string): string {
  const mins = Math.max(0, Math.round((Date.now() - parseDbTime(value).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

export function whenLabel(value: string | null): string {
  if (!value) return "As soon as possible";
  return parseDbTime(value).toLocaleString("en-UG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const STATUS_LABEL: Record<WorkJobStatus, string> = {
  open: "Open",
  assigned: "Needs your quote",
  quoted: "Quote sent",
  booked: "Ready to start",
  in_progress: "In progress",
  completed: "Awaiting confirmation",
  settled: "Paid",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Problem reported",
  refunded: "Refunded",
};

/** What you earn from a job at its commission, before it has been paid out. */
export function estimatedEarnings(job: Pick<WorkJob, "priceUgx" | "heldUgx" | "commissionPercent">): number {
  const base = job.heldUgx || job.priceUgx;
  return base - Math.round((base * job.commissionPercent) / 100);
}

export const ACTIVE_STATUSES: WorkJobStatus[] = ["assigned", "quoted", "booked", "in_progress", "completed", "disputed"];
