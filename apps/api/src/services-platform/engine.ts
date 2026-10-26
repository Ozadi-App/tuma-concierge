import { db } from "../db/client.js";
import { getOptions } from "../lib/option-settings.js";
import { hasTable } from "../lib/schema.js";
import { eatInstant } from "../lib/validation.js";
import { getServicesPlatformSettings } from "./settings.js";

type Row = Record<string, unknown>;

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";

/** Where a booking can go next. Anything else is refused. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};
export const ACTIVE_STATUSES = ["pending", "confirmed", "in_progress"] as const;

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as BookingStatus] ?? []).includes(to as BookingStatus);
}

/* ------------------------------------------------------------------ money */

/** What the whole service costs. Hourly is the rate for the length of the booking; a quote has no price until given. */
export function totalFor(offering: Row): number {
  const price = Number(offering.price_ugx) || 0;
  const pricing = String(offering.pricing_type || "fixed");
  if (pricing === "custom_quote") return 0;
  if (pricing === "hourly") return Math.round((price * (Number(offering.duration_minutes) || 60)) / 60);
  return price;
}

/**
 * What to collect online right now. A deposit service, or the "deposit online, balance at the venue" mode, takes the
 * deposit (30% when the business set none); everything else takes the full price. A quote takes nothing until priced.
 */
export function dueNow(offering: Row, total: number, collectionMode: string): number {
  if (total <= 0) return 0;
  const deposit = Number(offering.deposit_ugx) || 0;
  const wantsDeposit = String(offering.pricing_type) === "deposit" || collectionMode === "deposit_online_balance_at_venue";
  if (!wantsDeposit) return total;
  return Math.min(total, deposit > 0 ? deposit : Math.round(total * 0.3));
}

export function paymentStatusFor(total: number, paid: number): "unpaid" | "deposit_paid" | "paid_full" {
  if (paid <= 0) return "unpaid";
  return total > 0 && paid >= total ? "paid_full" : "deposit_paid";
}

/** Peebee's share of money collected online. Rounded down, so the provider never gets less than their share. */
export function splitCollected(amount: number, commissionPercent: number): { commission: number; payout: number } {
  const commission = Math.floor((amount * Math.max(0, Math.min(100, commissionPercent))) / 100);
  return { commission, payout: amount - commission };
}

/* ------------------------------------------------------------------ slots */

export type Slot = { date: string; time: string; startsAt: number; seatsFree: number };

const HHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** East Africa Time weekday (0 = Sunday) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export async function hoursTablesReady(): Promise<boolean> {
  return (await hasTable("service_hours")) && (await hasTable("service_blackouts"));
}

/** How many people can be served at once: the active team, or one. */
export async function seatCount(businessId: string): Promise<number> {
  if (!(await hasTable("service_staff_members"))) return 1;
  const n = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM service_staff_members WHERE business_id = ? AND is_active = 1", args: [businessId] })).rows[0]?.n) || 0;
  return Math.max(1, n);
}

async function windowsFor(businessId: string, date: string): Promise<Array<{ open: number; close: number }>> {
  const blackout = await db.execute({ sql: "SELECT 1 FROM service_blackouts WHERE business_id = ? AND blackout_date = ?", args: [businessId, date] });
  if (blackout.rows.length > 0) return [];
  const res = await db.execute({ sql: "SELECT open_time, close_time FROM service_hours WHERE business_id = ? AND weekday = ? ORDER BY open_time", args: [businessId, weekdayOf(date)] });
  return (res.rows as Row[]).map((r) => ({ open: toMinutes(String(r.open_time)), close: toMinutes(String(r.close_time)) }));
}

/** The start times a customer can pick on a day: inside opening hours, on the service's own rhythm, in the future. */
export async function slotsForDay(businessId: string, offering: Row, date: string, now = Date.now()): Promise<Slot[]> {
  const platform = await getServicesPlatformSettings();
  const step = Math.max(5, (Number(offering.duration_minutes) || 60) + (Number(offering.buffer_minutes) || 0));
  const length = Number(offering.duration_minutes) || 60;
  const seats = await seatCount(businessId);
  const out: Slot[] = [];
  const taken = new Map<number, number>();
  const rows = await db.execute({
    sql: `SELECT starts_at, COUNT(*) AS n FROM service_bookings WHERE business_id = ? AND scheduled_date = ? AND starts_at IS NOT NULL AND status IN ('pending', 'confirmed', 'in_progress') GROUP BY starts_at`,
    args: [businessId, date],
  });
  for (const r of rows.rows as Row[]) taken.set(Number(r.starts_at), Number(r.n));

  for (const w of await windowsFor(businessId, date)) {
    for (let start = w.open; start + length <= w.close; start += step) {
      const time = HHMM(start);
      const startsAt = eatInstant(date, time);
      if (startsAt == null || startsAt < now + platform.leadTimeHours * 3600_000) continue;
      const free = seats - (taken.get(startsAt) ?? 0);
      if (free > 0) out.push({ date, time, startsAt, seatsFree: free });
    }
  }
  return out;
}

/** Whether a requested time is one of the offered slots (and still has a seat). */
export async function slotIsOffered(businessId: string, offering: Row, date: string, time: string): Promise<boolean> {
  return (await slotsForDay(businessId, offering, date)).some((s) => s.time === time);
}

export async function schedulingMode(): Promise<"weekly_schedule_with_slots" | "free_text_request"> {
  const mode = (await getOptions(["services_availability_mode"])).services_availability_mode;
  return mode === "weekly_schedule_with_slots" ? "weekly_schedule_with_slots" : "free_text_request";
}

/* ----------------------------------------------------------------- codes */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newBookingCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

/* --------------------------------------------------------- cancellations */

export type RefundDecision = { refund: "full" | "none" | "review"; reason: string };

/**
 * What a cancellation is worth. A provider cancelling always refunds in full. For a customer the admin chooses: the
 * business's own free-cancellation window, one platform-wide window, no refunds, or "the provider decides".
 */
export async function refundPolicy(input: { by: "customer" | "provider"; startsAt: number | null; businessFreeHours: number | null; now?: number }): Promise<RefundDecision> {
  if (input.by === "provider") return { refund: "full", reason: "The provider cancelled." };
  const o = await getOptions(["services_cancellation_refund_mode", "services_cancellation_window_hours"]);
  const mode = String(o.services_cancellation_refund_mode);
  if (mode === "no_refund") return { refund: "none", reason: "This platform does not refund cancelled bookings." };
  if (mode === "manual_review") return { refund: "review", reason: "The provider will decide on a refund." };
  const hours = mode === "policy_based" && input.businessFreeHours != null ? input.businessFreeHours : Number(o.services_cancellation_window_hours);
  if (input.startsAt == null) return { refund: "full", reason: "No fixed time was booked." };
  const before = (input.startsAt - (input.now ?? Date.now())) / 3600_000;
  return before >= hours
    ? { refund: "full", reason: `Cancelled at least ${hours} hour(s) before the booking.` }
    : { refund: "none", reason: `Free cancellation ends ${hours} hour(s) before the booking.` };
}
