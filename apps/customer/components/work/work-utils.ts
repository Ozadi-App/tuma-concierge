import { ApiError } from "@peebee/shared";
import type { WorkJobStatus, WorkServiceType } from "@peebee/shared";
import { errorMessage } from "../../lib/api";

export { formatUgx } from "../../lib/order-display";

export const WORK_TYPES: Record<WorkServiceType, { title: string; eyebrow: string; blurb: string; href: string }> = {
  clean: { title: "Clean", eyebrow: "Home & office cleaning", blurb: "Houses, offices, cars and more, cleaned by independent providers.", href: "/services/clean" },
  fix: { title: "Fix & Repairs", eyebrow: "Skilled handyman", blurb: "Plumbing, electrical, appliances and other repairs.", href: "/services/fix" },
  laundry: { title: "Laundry", eyebrow: "Wash, dry & fold", blurb: "Laundry done by independent providers.", href: "/services/laundry" },
};

/** Job dates come from the API as "YYYY-MM-DD HH:MM:SS" in UTC. */
export function parseWorkDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatWorkDate(value: string | null | undefined): string {
  const d = parseWorkDate(value);
  if (!d) return "";
  return d.toLocaleString("en-UG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export const ACTIVE_STATUSES: WorkJobStatus[] = ["open", "assigned", "quoted", "booked", "in_progress", "completed", "disputed"];
export const isActiveStatus = (s: string) => (ACTIVE_STATUSES as string[]).includes(s);

export const STATUS_LABEL: Record<string, { label: string; tone: "gold" | "neutral" | "good" | "bad" }> = {
  open: { label: "Finding a provider", tone: "gold" },
  assigned: { label: "Waiting for a quote", tone: "gold" },
  quoted: { label: "Quote ready", tone: "gold" },
  booked: { label: "Booked", tone: "good" },
  in_progress: { label: "In progress", tone: "good" },
  completed: { label: "Done, please confirm", tone: "gold" },
  settled: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  disputed: { label: "Problem reported", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export type WorkFailure = { code?: string; message: string; topUp: boolean; upgradePending: boolean; disabled: boolean };

/** Turns any thrown error into friendly copy, flagging the states the screens treat specially. */
export function workFailure(err: unknown): WorkFailure {
  if (err instanceof ApiError) {
    if (err.code === "work_upgrade_pending") {
      return { code: err.code, message: "Peebee Work is being set up. Please try again shortly.", topUp: false, upgradePending: true, disabled: false };
    }
    if (err.code === "service_disabled" || err.code === "service_closed") {
      return { code: err.code, message: "This service isn't available right now.", topUp: false, upgradePending: false, disabled: true };
    }
    if (err.code === "insufficient_wallet") {
      const serverMessage = err.message.replace(/^API \d+: /, "");
      return { code: err.code, message: serverMessage, topUp: true, upgradePending: false, disabled: false };
    }
    if (err.code === "too_many_requests") {
      return { code: err.code, message: "You've booked several jobs already. Please try again a little later.", topUp: false, upgradePending: false, disabled: false };
    }
    return { code: err.code, message: errorMessage(err), topUp: false, upgradePending: false, disabled: false };
  }
  return { message: errorMessage(err), topUp: false, upgradePending: false, disabled: false };
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Formats a Date for a datetime-local input in the viewer's own timezone. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function hoursLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
