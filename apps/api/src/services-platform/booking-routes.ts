import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { migrationPending, publicRateLimit } from "../lib/guards.js";
import { getOptions } from "../lib/option-settings.js";
import { proofIsValid } from "../lib/phone-proof.js";
import { isOnlineRail, railsOffered } from "../lib/rails.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { sendSms } from "../lib/sms-gateway.js";
import { dateString, eatInstant, normalizePhone, phoneString, timeString } from "../lib/validation.js";
import {
  ACTIVE_STATUSES, canTransition, dueNow, hoursTablesReady, newBookingCode, paymentStatusFor, refundPolicy, schedulingMode, seatCount,
  slotIsOffered, slotsForDay, totalFor,
} from "./engine.js";
import { pollBookingPayments, refundOnlinePayments, releaseEscrow, startOnlinePayment } from "./payments.js";
import { getServicesPlatformSettings } from "./settings.js";

type Row = Record<string, unknown>;

export const serviceBookingRoutes = new Hono();

const MIGRATION = "0138_services_hardening.sql";

async function ready(): Promise<boolean> {
  return (await hasColumn("service_bookings", "booking_code")) && (await hasTable("service_payments"));
}

async function businessOf(userId: string): Promise<Row | null> {
  if (!(await hasTable("service_businesses"))) return null;
  return ((await db.execute({ sql: "SELECT * FROM service_businesses WHERE owner_id = ? LIMIT 1", args: [userId] })).rows[0] as Row | undefined) ?? null;
}

const sameNumber = (a: unknown, b: unknown): boolean => {
  const x = normalizePhone(String(a ?? ""));
  return !!x && x === normalizePhone(String(b ?? ""));
};

async function textCustomer(booking: Row, body: string): Promise<void> {
  if (!booking.customer_phone) return;
  const sent = await sendSms(String(booking.customer_phone), body);
  await db.execute({ sql: "UPDATE service_bookings SET customer_sms_status = ? WHERE id = ?", args: [sent.status, String(booking.id)] });
}

/* ------------------------------------------------------------------ public */

async function publicBusiness(slug: string): Promise<Row | null> {
  if (!(await hasTable("service_businesses"))) return null;
  const res = await db.execute({ sql: "SELECT * FROM service_businesses WHERE status = 'active' AND (slug = ? OR id = ?) LIMIT 1", args: [slug, slug] });
  return (res.rows[0] as Row | undefined) ?? null;
}

serviceBookingRoutes.get("/public/:slug/slots", async (c) => {
  const biz = await publicBusiness(c.req.param("slug")!);
  if (!biz) return c.json({ error: "not_found", message: "Service provider not found" }, 404);
  const serviceId = c.req.query("service_id") ?? "";
  const offering = (await db.execute({ sql: "SELECT * FROM service_offerings WHERE id = ? AND business_id = ? AND is_active = 1", args: [serviceId, String(biz.id)] })).rows[0] as Row | undefined;
  if (!offering) return c.json({ error: "unknown_service", message: "That service is not offered by this business." }, 400);
  const mode = await schedulingMode();
  if (mode === "free_text_request" || !(await hoursTablesReady())) return c.json({ mode: "free_text_request", slots: [] });

  const from = c.req.query("from") && dateString.safeParse(c.req.query("from")).success ? c.req.query("from")! : new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const days = Math.max(1, Math.min(31, Number(c.req.query("days")) || 7));
  const out: Array<{ date: string; time: string; seatsFree: number }> = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(new Date(`${from}T12:00:00Z`).getTime() + i * 86400000).toISOString().slice(0, 10);
    for (const s of await slotsForDay(String(biz.id), offering, date)) out.push({ date: s.date, time: s.time, seatsFree: s.seatsFree });
  }
  return c.json({ mode, slots: out });
});

const bookSchema = z.object({
  service_id: z.string(),
  customer_name: z.string().min(2).max(120),
  customer_phone: phoneString,
  payment_phone: phoneString.optional(),
  customer_email: z.string().email().optional().or(z.literal("")),
  scheduled_date: dateString,
  scheduled_time: timeString,
  location_type: z.enum(["in_facility", "client_site", "virtual"]).default("in_facility"),
  address: z.string().max(300).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  payment_rail: z.enum(["momo_mtn", "momo_airtel", "cash_at_venue", "bank_wire"]).default("momo_mtn"),
});

function summary(b: Row, extra: Row = {}): Row {
  return {
    code: b.booking_code, status: b.status, payment_status: b.payment_status,
    service_title: b.service_title, business_name: b.business_name, business_phone: b.business_phone, business_address: b.business_address,
    scheduled_date: b.scheduled_date, scheduled_time: b.scheduled_time, duration_minutes: b.duration_minutes, location_type: b.location_type,
    total_price_ugx: Number(b.total_price_ugx), paid_ugx: Number(b.paid_ugx), balance_ugx: Math.max(0, Number(b.total_price_ugx) - Number(b.paid_ugx)),
    payment_rail: b.payment_rail, refund_ugx: Number(b.refund_ugx), refund_state: b.refund_state,
    ...extra,
  };
}

async function loadSummary(code: string): Promise<Row | null> {
  const row = (await db.execute({
    sql: `SELECT b.*, o.title AS service_title, s.name AS business_name, s.phone AS business_phone, s.address AS business_address
          FROM service_bookings b JOIN service_offerings o ON o.id = b.service_id JOIN service_businesses s ON s.id = b.business_id
          WHERE b.booking_code = ?`,
    args: [code],
  })).rows[0] as Row | undefined;
  return row ?? null;
}

serviceBookingRoutes.post("/public/:slug/book", async (c) => {
  const platform = await getServicesPlatformSettings();
  if (!platform.enabled) return c.json({ error: "platform_paused", message: "Service booking platform is temporarily paused for scheduled maintenance." }, 503);
  const pending = await migrationPending(c, "0134_standalone_services_platform.sql", "service_businesses", "service_offerings", "service_bookings");
  if (pending) return pending;

  const biz = await publicBusiness(c.req.param("slug")!);
  if (!biz) return c.json({ error: "not_found", message: "Service business not found" }, 404);
  if (!Number(biz.is_open)) return c.json({ error: "business_closed", message: "This business is not taking bookings right now." }, 409);

  const parsed = bookSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
  const d = parsed.data;

  const limited = await publicRateLimit(c, "svc-book", d.customer_phone, "rate_limit_public_booking_per_hour", 3600);
  if (limited) return limited;
  const opts = await getOptions(["services_booking_verification", "services_booking_confirmation", "services_online_collection_mode"]);
  if (opts.services_booking_verification === "phone_otp" && !(await proofIsValid(c.req.header("x-phone-proof"), d.customer_phone, "service_booking"))) {
    return c.json({ error: "phone_proof_required", message: "Confirm your phone number with the code we text you, then send the booking again." }, 403);
  }

  const offering = (await db.execute({ sql: "SELECT * FROM service_offerings WHERE id = ? AND business_id = ? AND is_active = 1", args: [d.service_id, String(biz.id)] })).rows[0] as Row | undefined;
  if (!offering) return c.json({ error: "unknown_service", message: "That service is not offered by this business." }, 400);
  if (d.location_type === "virtual" && !platform.virtualConsultationsEnabled) return c.json({ error: "virtual_disabled", message: "Virtual consultations are not available right now." }, 403);
  if (d.location_type !== String(offering.location_type) && String(offering.location_type) !== "in_facility") {
    return c.json({ error: "location_mismatch", message: `This service is ${String(offering.location_type).replace("_", " ")}.` }, 400);
  }

  const startsAt = eatInstant(d.scheduled_date, d.scheduled_time);
  if (startsAt == null || startsAt < Date.now() + platform.leadTimeHours * 3600_000) {
    return c.json({ error: "too_soon", message: `Bookings need at least ${platform.leadTimeHours} hour(s) notice.` }, 400);
  }
  const mode = await schedulingMode();
  const useSlots = mode === "weekly_schedule_with_slots" && (await hoursTablesReady());
  if (useSlots && !(await slotIsOffered(String(biz.id), offering, d.scheduled_date, d.scheduled_time))) {
    return c.json({ error: "slot_unavailable", message: "That time isn't available. Please pick another." }, 409);
  }

  // Payment method: the business's list, narrowed by the platform's. Online collection must be switched on.
  let businessRails: string[] = [];
  try { businessRails = JSON.parse(String(biz.allowed_payment_rails || "[]")); } catch { businessRails = []; }
  const offered = await railsOffered(businessRails);
  if (!offered.includes(d.payment_rail)) {
    return c.json({ error: "unsupported_service_rail", message: `The payment method '${d.payment_rail}' is not accepted for services at this business. Please select Mobile Money (MTN/Airtel) or Pay on completion.` }, 400);
  }
  const collection = String(opts.services_online_collection_mode);
  const online = isOnlineRail(d.payment_rail);
  if (online && collection === "pay_at_venue_only") return c.json({ error: "online_payment_off", message: "This platform takes payment at the venue only. Choose Pay on completion." }, 400);
  const payPhone = d.payment_phone ?? d.customer_phone;
  if (online && ((d.payment_rail === "momo_mtn") !== /^\+256(77|78|76|39)/.test(payPhone))) {
    return c.json({ error: "rail_mismatch", message: d.payment_rail === "momo_mtn" ? "That isn't an MTN number." : "That isn't an Airtel number." }, 400);
  }

  const total = totalFor(offering);
  const due = online ? dueNow(offering, total, collection) : 0;
  const confirmed = opts.services_booking_confirmation === "auto_confirm";
  const ready0 = await ready();

  // Take a place in the schedule: one seat per team member, claimed by the unique index so two people can't get it.
  const seats = useSlots && ready0 ? await seatCount(String(biz.id)) : 0;
  const bookingId = newId("sbk");
  let code = newBookingCode();
  let seat: number | null = null;
  const insert = async (seatNo: number | null) => {
    await db.execute({
      sql: `INSERT INTO service_bookings (
              id, business_id, service_id, customer_name, customer_phone, customer_email, scheduled_date, scheduled_time, duration_minutes,
              location_type, address, virtual_meeting_url, notes, pricing_type, total_price_ugx, deposit_ugx, payment_rail, payment_status,
              status, staff_id, staff_name, created_at, updated_at${ready0 ? ", booking_code, starts_at, slot_seat" : ""}
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, NULL, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP${ready0 ? ", ?, ?, ?" : ""})`,
      args: [
        bookingId, String(biz.id), d.service_id, d.customer_name, d.customer_phone, d.customer_email || "", d.scheduled_date, d.scheduled_time,
        Number(offering.duration_minutes) || 60, d.location_type, d.address || "", String(offering.virtual_meeting_url || ""), d.notes || "",
        String(offering.pricing_type || "fixed"), total, Number(offering.deposit_ugx) || 0, d.payment_rail, confirmed ? "confirmed" : "pending",
        ...(ready0 ? [code, startsAt, seatNo] : []),
      ],
    });
  };
  if (useSlots && ready0) {
    let placed = false;
    for (let attempt = 1; attempt <= seats && !placed; attempt++) {
      try { await insert(attempt); seat = attempt; placed = true; }
      catch (err) { if (!/UNIQUE|constraint/i.test(String((err as Error).message))) throw err; }
    }
    if (!placed) return c.json({ error: "slot_taken", message: "Someone just took that time. Please pick another." }, 409);
  } else {
    for (let attempt = 0; ; attempt++) {
      try { await insert(null); break; }
      catch (err) { if (attempt > 4 || !/UNIQUE|constraint/i.test(String((err as Error).message))) throw err; code = newBookingCode(); }
    }
  }
  void seat;
  await db.execute({ sql: "UPDATE service_offerings SET bookings_count = bookings_count + 1 WHERE id = ?", args: [d.service_id] });

  // Ask for the money. The booking is not paid until the provider says the money arrived.
  let payment: { status: string; redirectUrl: string | null; message: string } = { status: "none", redirectUrl: null, message: online ? "Nothing to pay yet; the provider will confirm the price." : "Pay when you arrive." };
  if (online && due > 0 && ready0) {
    const started = await startOnlinePayment({ bookingId, businessId: String(biz.id), kind: due >= total ? "full" : "deposit", amount: due, rail: d.payment_rail, msisdn: payPhone });
    if (!started.ok) {
      await db.execute({ sql: "UPDATE service_bookings SET status = 'cancelled', cancelled_by = 'system', cancelled_at = datetime('now') WHERE id = ?", args: [bookingId] });
      return c.json({ error: started.error, message: started.message }, started.status);
    }
    payment = {
      status: started.status, redirectUrl: started.redirectUrl,
      message: started.status === "successful" ? "Payment received." : started.status === "failed" ? "The payment didn't go through. You can try again from your booking page." : "Approve the payment on your phone to secure your booking.",
    };
  }

  const booking = (await loadSummary(code)) ?? ({ booking_code: code } as Row);
  await textCustomer({ id: bookingId, customer_phone: d.customer_phone }, `${String(biz.name)}: booking ${code} for ${String(offering.title)} on ${d.scheduled_date} at ${d.scheduled_time} (${String(booking.status ?? "pending")}). Check or cancel it with your code ${code}.`);
  if (biz.phone) await sendSms(String(biz.phone), `New booking ${code}: ${d.customer_name} wants ${String(offering.title)} on ${d.scheduled_date} at ${d.scheduled_time}.`).catch(() => undefined);

  return c.json({
    ok: true,
    booking: summary(booking, {
      id: bookingId, due_now_ugx: online ? due : 0,
      instructions: confirmed ? "Your booking is confirmed. The provider will contact you if anything changes." : "Your request has been sent. The provider will confirm your booking.",
    }),
    payment,
  });
});

/** A customer finds their booking with the code they were given and the phone they booked with. */
async function ownBooking(code: string, phone: string): Promise<Row | null> {
  if (!(await ready())) return null;
  const b = await loadSummary(code.toUpperCase());
  return b && sameNumber(b.customer_phone, phone) ? b : null;
}

serviceBookingRoutes.get("/public/bookings/:code", async (c) => {
  const limited = await publicRateLimit(c, "svc-lookup", c.req.param("code")!, "rate_limit_token_download_per_minute", 60);
  if (limited) return limited;
  const b = await ownBooking(c.req.param("code")!, c.req.query("phone") ?? "");
  if (!b) return c.json({ error: "not_found", message: "We couldn't find a booking with that code and phone number." }, 404);
  await pollBookingPayments(String(b.id));
  const fresh = (await loadSummary(String(b.booking_code)))!;
  const pay = (await db.execute({ sql: "SELECT status, redirect_url, kind FROM service_payments WHERE booking_id = ? AND kind != 'refund' ORDER BY created_at DESC LIMIT 1", args: [String(b.id)] })).rows[0] as Row | undefined;
  const biz = (await db.execute({ sql: "SELECT free_cancel_hours FROM service_businesses WHERE id = ?", args: [String(b.business_id)] })).rows[0] as Row | undefined;
  const policy = await refundPolicy({ by: "customer", startsAt: b.starts_at == null ? null : Number(b.starts_at), businessFreeHours: biz?.free_cancel_hours == null ? null : Number(biz.free_cancel_hours) });
  return c.json({ booking: summary(fresh, { payment_state: pay?.status ?? "none", pay_url: pay?.status === "pending" ? pay.redirect_url ?? null : null, if_cancelled_now: policy.refund, cancellation_note: policy.reason }) });
});

const lookupSchema = z.object({ phone: z.string().min(6).max(30), payment_phone: z.string().min(6).max(30).optional() });

serviceBookingRoutes.post("/public/bookings/:code/cancel", async (c) => {
  const parsed = lookupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the phone number you booked with." }, 400);
  const limited = await publicRateLimit(c, "svc-cancel", c.req.param("code")!, "rate_limit_token_download_per_minute", 60);
  if (limited) return limited;
  const b = await ownBooking(c.req.param("code")!, parsed.data.phone);
  if (!b) return c.json({ error: "not_found", message: "We couldn't find a booking with that code and phone number." }, 404);
  if (!canTransition(String(b.status), "cancelled")) return c.json({ error: "not_cancellable", message: `A ${String(b.status).replace("_", " ")} booking can't be cancelled.` }, 409);
  return c.json(await cancelBooking(b, "customer"));
});

serviceBookingRoutes.post("/public/bookings/:code/pay", async (c) => {
  const parsed = lookupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the phone number you booked with." }, 400);
  const limited = await publicRateLimit(c, "svc-pay", c.req.param("code")!, "rate_limit_public_booking_per_hour", 3600);
  if (limited) return limited;
  const b = await ownBooking(c.req.param("code")!, parsed.data.phone);
  if (!b) return c.json({ error: "not_found", message: "We couldn't find a booking with that code and phone number." }, 404);
  if (!(ACTIVE_STATUSES as readonly string[]).includes(String(b.status))) return c.json({ error: "not_payable", message: "This booking is closed." }, 409);
  if (!isOnlineRail(String(b.payment_rail))) return c.json({ error: "pay_at_venue", message: "This booking is paid at the venue." }, 400);
  const collection = String((await getOptions(["services_online_collection_mode"])).services_online_collection_mode);
  if (collection === "pay_at_venue_only") return c.json({ error: "online_payment_off", message: "This platform takes payment at the venue only." }, 400);
  const total = Number(b.total_price_ugx);
  if (total <= 0) return c.json({ error: "no_price_yet", message: "The provider hasn't set a price yet." }, 409);
  const balance = total - Number(b.paid_ugx);
  if (balance <= 0) return c.json({ error: "already_paid", message: "This booking is already paid." }, 409);
  const open = (await db.execute({ sql: "SELECT id, redirect_url FROM service_payments WHERE booking_id = ? AND status = 'pending' AND kind != 'refund'", args: [String(b.id)] })).rows[0] as Row | undefined;
  if (open) return c.json({ ok: true, payment: { status: "pending", redirectUrl: open.redirect_url ?? null, message: "Approve the payment on your phone." } });
  const offering = (await db.execute({ sql: "SELECT * FROM service_offerings WHERE id = ?", args: [String(b.service_id)] })).rows[0] as Row;
  const due = Number(b.paid_ugx) === 0 ? Math.min(balance, dueNow(offering, total, collection)) : balance;
  const payPhone = normalizePhone(parsed.data.payment_phone ?? "") ?? String(b.customer_phone);
  const started = await startOnlinePayment({ bookingId: String(b.id), businessId: String(b.business_id), kind: due >= balance ? "full" : "deposit", amount: due, rail: String(b.payment_rail), msisdn: payPhone });
  if (!started.ok) return c.json({ error: started.error, message: started.message }, started.status);
  return c.json({ ok: true, payment: { status: started.status, redirectUrl: started.redirectUrl, amount_ugx: due, message: started.status === "successful" ? "Payment received." : "Approve the payment on your phone." } });
});

/* ---------------------------------------------------------- cancel + refund */

async function cancelBooking(b: Row, by: "customer" | "provider", reason = ""): Promise<Row> {
  const biz = (await db.execute({ sql: "SELECT name, free_cancel_hours FROM service_businesses WHERE id = ?", args: [String(b.business_id)] })).rows[0] as Row;
  await pollBookingPayments(String(b.id));
  const fresh = (await db.execute({ sql: "SELECT * FROM service_bookings WHERE id = ?", args: [String(b.id)] })).rows[0] as Row;
  const policy = await refundPolicy({ by, startsAt: fresh.starts_at == null ? null : Number(fresh.starts_at), businessFreeHours: biz.free_cancel_hours == null ? null : Number(biz.free_cancel_hours) });
  await db.execute({
    sql: "UPDATE service_bookings SET status = 'cancelled', cancelled_by = ?, cancelled_at = datetime('now'), notes = CASE WHEN ? != '' THEN notes || char(10) || ? ELSE notes END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('pending', 'confirmed', 'in_progress')",
    args: [by, reason, `Cancelled: ${reason}`, String(b.id)],
  });
  const paid = Number(fresh.paid_ugx);
  let refund: Row = { state: "none", amount_ugx: 0, note: policy.reason };
  if (paid > 0) {
    if (policy.refund === "full") {
      const r = await refundOnlinePayments(String(b.id), `cancelled by ${by}`);
      refund = r.ok ? { state: r.pending ? "pending" : "refunded", amount_ugx: r.refunded, note: policy.reason } : { state: "failed", amount_ugx: 0, note: r.message };
      if (!r.ok) await db.execute({ sql: "UPDATE service_bookings SET refund_state = 'review' WHERE id = ?", args: [String(b.id)] });
    } else if (policy.refund === "review") {
      await db.execute({ sql: "UPDATE service_bookings SET refund_state = 'review' WHERE id = ?", args: [String(b.id)] });
      refund = { state: "review", amount_ugx: 0, note: policy.reason };
    } else {
      await releaseEscrow(String(b.id)); // the money was earned: late cancellation
      await db.execute({ sql: "UPDATE service_bookings SET refund_state = 'kept' WHERE id = ?", args: [String(b.id)] });
      refund = { state: "kept", amount_ugx: 0, note: policy.reason };
    }
  }
  await textCustomer(fresh, `${String(biz.name)}: booking ${String(fresh.booking_code)} was cancelled.${refund.state === "refunded" ? ` UGX ${Number(refund.amount_ugx).toLocaleString("en-UG")} is being refunded.` : refund.state === "pending" ? " Your refund is on its way." : ""}`);
  return { ok: true, status: "cancelled", refund };
}

/* ---------------------------------------------------------------- provider */

serviceBookingRoutes.get("/hours", requireAuth, async (c) => {
  const biz = await businessOf(c.get("user").sub);
  if (!biz || !(await hoursTablesReady())) return c.json({ hours: [], blackouts: [] });
  const hours = (await db.execute({ sql: "SELECT weekday, open_time, close_time FROM service_hours WHERE business_id = ? ORDER BY weekday, open_time", args: [String(biz.id)] })).rows;
  const blackouts = (await db.execute({ sql: "SELECT blackout_date, reason FROM service_blackouts WHERE business_id = ? ORDER BY blackout_date", args: [String(biz.id)] })).rows;
  return c.json({ hours, blackouts });
});

const hoursSchema = z.object({
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), open_time: timeString, close_time: timeString })).max(28),
}).superRefine((v, ctx) => {
  const byDay = new Map<number, Array<[string, string]>>();
  for (const h of v.hours) {
    if (h.open_time >= h.close_time) ctx.addIssue({ code: "custom", message: "Opening time must be before closing time." });
    const list = byDay.get(h.weekday) ?? [];
    for (const [o, cl] of list) if (h.open_time < cl && o < h.close_time) ctx.addIssue({ code: "custom", message: "Opening windows on one day can't overlap." });
    list.push([h.open_time, h.close_time]);
    byDay.set(h.weekday, list);
  }
});

serviceBookingRoutes.put("/hours", requireAuth, async (c) => {
  const biz = await businessOf(c.get("user").sub);
  if (!biz) return c.json({ error: "no_business" }, 404);
  const pending = await migrationPending(c, MIGRATION, "service_hours");
  if (pending) return pending;
  const parsed = hoursSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.issues[0]?.message ?? "Check the opening hours.", details: parsed.error.issues }, 400);
  await db.execute({ sql: "DELETE FROM service_hours WHERE business_id = ?", args: [String(biz.id)] });
  for (const h of parsed.data.hours) {
    await db.execute({ sql: "INSERT INTO service_hours (id, business_id, weekday, open_time, close_time) VALUES (?, ?, ?, ?, ?)", args: [newId("shr"), String(biz.id), h.weekday, h.open_time, h.close_time] });
  }
  return c.json({ ok: true, hours: parsed.data.hours });
});

serviceBookingRoutes.post("/blackouts", requireAuth, async (c) => {
  const biz = await businessOf(c.get("user").sub);
  if (!biz) return c.json({ error: "no_business" }, 404);
  const pending = await migrationPending(c, MIGRATION, "service_blackouts");
  if (pending) return pending;
  const parsed = z.object({ date: dateString, reason: z.string().max(200).optional().default("") }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose a real date." }, 400);
  await db.execute({ sql: "INSERT OR REPLACE INTO service_blackouts (id, business_id, blackout_date, reason) VALUES (?, ?, ?, ?)", args: [newId("sbo"), String(biz.id), parsed.data.date, parsed.data.reason] });
  return c.json({ ok: true });
});

serviceBookingRoutes.delete("/blackouts/:date", requireAuth, async (c) => {
  const biz = await businessOf(c.get("user").sub);
  if (!biz || !(await hasTable("service_blackouts"))) return c.json({ error: "no_business" }, 404);
  await db.execute({ sql: "DELETE FROM service_blackouts WHERE business_id = ? AND blackout_date = ?", args: [String(biz.id), c.req.param("date")!] });
  return c.json({ ok: true });
});

async function ownedBooking(userId: string, id: string): Promise<{ biz: Row; booking: Row } | null> {
  const biz = await businessOf(userId);
  if (!biz) return null;
  const booking = (await db.execute({ sql: "SELECT * FROM service_bookings WHERE id = ? AND business_id = ?", args: [id, String(biz.id)] })).rows[0] as Row | undefined;
  return booking ? { biz, booking } : null;
}

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  staff_id: z.string().optional().nullable(),
  rescheduled_date: dateString.optional(),
  rescheduled_time: timeString.optional(),
  reason: z.string().max(300).optional().default(""),
});

serviceBookingRoutes.patch("/bookings/:id/status", requireAuth, async (c) => {
  const pending = await migrationPending(c, "0134_standalone_services_platform.sql", "service_businesses", "service_bookings");
  if (pending) return pending;
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found", message: "That booking isn't yours." }, 404);
  const parsed = statusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", details: parsed.error.issues }, 400);
  const d = parsed.data;
  const { biz, booking } = owned;
  const current = String(booking.status);

  const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const args: Array<string | number | null> = [];

  if (d.staff_id !== undefined) {
    let name = "";
    if (d.staff_id) {
      const s = (await db.execute({ sql: "SELECT name FROM service_staff_members WHERE id = ? AND business_id = ? AND is_active = 1", args: [d.staff_id, String(biz.id)] })).rows[0] as Row | undefined;
      if (!s) return c.json({ error: "unknown_staff", message: "That team member is not on your roster." }, 400);
      name = String(s.name);
    }
    updates.push("staff_id = ?", "staff_name = ?");
    args.push(d.staff_id, name);
  }

  if (d.rescheduled_date !== undefined || d.rescheduled_time !== undefined) {
    if (!["pending", "confirmed"].includes(current)) return c.json({ error: "not_reschedulable", message: "Only a pending or confirmed booking can be moved." }, 409);
    const date = d.rescheduled_date ?? String(booking.scheduled_date);
    const time = d.rescheduled_time ?? String(booking.scheduled_time);
    const startsAt = eatInstant(date, time);
    if (startsAt == null) return c.json({ error: "invalid_body", message: "Choose a real date and time." }, 400);
    updates.push("scheduled_date = ?", "scheduled_time = ?");
    args.push(date, time);
    if (await ready()) {
      updates.push("starts_at = ?");
      args.push(startsAt);
      if (booking.slot_seat != null) {
        // Moving a seated booking means claiming a seat at the new time; the unique index decides.
        const seats = await seatCount(String(biz.id));
        const offering = (await db.execute({ sql: "SELECT * FROM service_offerings WHERE id = ?", args: [String(booking.service_id)] })).rows[0] as Row;
        if (!(await slotIsOffered(String(biz.id), offering, date, time))) return c.json({ error: "slot_unavailable", message: "That time isn't available." }, 409);
        let moved = false;
        for (let seat = 1; seat <= seats && !moved; seat++) {
          try {
            await db.execute({ sql: "UPDATE service_bookings SET scheduled_date = ?, scheduled_time = ?, starts_at = ?, slot_seat = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [date, time, startsAt, seat, String(booking.id)] });
            moved = true;
          } catch (err) { if (!/UNIQUE|constraint/i.test(String((err as Error).message))) throw err; }
        }
        if (!moved) return c.json({ error: "slot_taken", message: "That time is full." }, 409);
        updates.splice(updates.indexOf("scheduled_date = ?"), 3); // already written
        args.splice(args.length - 3, 3);
        if (updates.length === 1 && d.status === undefined) return c.json({ ok: true, id: String(booking.id), status: current });
      }
    }
  }

  let outcome: Row = {};
  if (d.status !== undefined && d.status !== current) {
    if (!canTransition(current, d.status)) return c.json({ error: "invalid_transition", message: `A ${current.replace("_", " ")} booking can't become ${d.status.replace("_", " ")}.` }, 409);
    if (d.status === "cancelled") {
      if (updates.length > 1) await db.execute({ sql: `UPDATE service_bookings SET ${updates.join(", ")} WHERE id = ?`, args: [...args, String(booking.id)] });
      return c.json({ ...(await cancelBooking(booking, "provider", d.reason)), id: String(booking.id) });
    }
    updates.push("status = ?");
    args.push(d.status);
    if (d.status === "completed" || d.status === "no_show") {
      // The service happened (or the customer didn't come): what was paid in escrow is the provider's.
      await db.execute({ sql: `UPDATE service_bookings SET ${updates.join(", ")} WHERE id = ?`, args: [...args, String(booking.id)] });
      const released = await releaseEscrow(String(booking.id));
      return c.json({ ok: true, id: String(booking.id), status: d.status, released_ugx: released });
    }
    if (d.status === "confirmed") outcome = { notified: true };
  }

  if (updates.length > 1) await db.execute({ sql: `UPDATE service_bookings SET ${updates.join(", ")} WHERE id = ?`, args: [...args, String(booking.id)] });
  if (outcome.notified) await textCustomer(booking, `${String(biz.name)}: your booking ${String(booking.booking_code ?? "")} on ${String(booking.scheduled_date)} at ${String(booking.scheduled_time)} is confirmed.`);
  return c.json({ ok: true, id: String(booking.id), status: d.status ?? current, updatedStatus: d.status });
});

serviceBookingRoutes.post("/bookings/:id/venue-payment", requireAuth, async (c) => {
  if (!(await ready())) return migrationPending(c, MIGRATION, "service_payments") as Promise<Response>;
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found", message: "That booking isn't yours." }, 404);
  const parsed = z.object({ amount_ugx: z.number().int().positive().max(100_000_000), rail: z.enum(["cash_at_venue", "bank_wire"]).default("cash_at_venue") }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the amount received." }, 400);
  const { booking } = owned;
  await pollBookingPayments(String(booking.id));
  const fresh = (await db.execute({ sql: "SELECT * FROM service_bookings WHERE id = ?", args: [String(booking.id)] })).rows[0] as Row;
  if (!(ACTIVE_STATUSES as readonly string[]).concat(["completed"]).includes(String(fresh.status))) return c.json({ error: "closed", message: "This booking is closed." }, 409);
  const total = Number(fresh.total_price_ugx);
  const outstanding = fresh.payment_status === "waived" ? 0 : Math.max(0, total - Number(fresh.paid_ugx));
  if (total > 0 && parsed.data.amount_ugx > outstanding) return c.json({ error: "too_much", message: `Only UGX ${outstanding.toLocaleString("en-UG")} is outstanding.` }, 400);
  const open = (await db.execute({ sql: "SELECT 1 FROM service_payments WHERE booking_id = ? AND status = 'pending' AND kind != 'refund'", args: [String(booking.id)] })).rows.length > 0;
  if (open) return c.json({ error: "payment_in_progress", message: "An online payment is still in progress." }, 409);
  await db.execute({
    sql: "INSERT INTO service_payments (id, booking_id, business_id, kind, amount_ugx, rail, status, released, environment) VALUES (?, ?, ?, 'venue', ?, ?, 'successful', 1, ?)",
    args: [newId("spy"), String(booking.id), String(fresh.business_id), parsed.data.amount_ugx, parsed.data.rail, await getPlatformEnvironment()],
  });
  const paid = Number(fresh.paid_ugx) + parsed.data.amount_ugx;
  await db.execute({ sql: "UPDATE service_bookings SET paid_ugx = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [paid, paymentStatusFor(total, paid), String(booking.id)] });
  return c.json({ ok: true, paid_ugx: paid, payment_status: paymentStatusFor(total, paid) });
});

serviceBookingRoutes.post("/bookings/:id/waive", requireAuth, async (c) => {
  if (!(await ready())) return migrationPending(c, MIGRATION, "service_payments") as Promise<Response>;
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found", message: "That booking isn't yours." }, 404);
  const { booking } = owned;
  await pollBookingPayments(String(booking.id));
  const fresh = (await db.execute({ sql: "SELECT * FROM service_bookings WHERE id = ?", args: [String(booking.id)] })).rows[0] as Row;
  const outstanding = fresh.payment_status === "waived" ? 0 : Math.max(0, Number(fresh.total_price_ugx) - Number(fresh.paid_ugx));
  if (outstanding <= 0) return c.json({ error: "nothing_owed", message: "Nothing is outstanding." }, 409);
  if ((await db.execute({ sql: "SELECT 1 FROM service_payments WHERE booking_id = ? AND status = 'pending' AND kind != 'refund'", args: [String(booking.id)] })).rows.length > 0) return c.json({ error: "payment_in_progress", message: "An online payment is still in progress." }, 409);
  await db.execute({ sql: "INSERT INTO service_payments (id, booking_id, business_id, kind, amount_ugx, rail, status, released, environment) VALUES (?, ?, ?, 'waiver', ?, 'waiver', 'successful', 1, ?)", args: [newId("spy"), String(booking.id), String(fresh.business_id), outstanding, await getPlatformEnvironment()] });
  await db.execute({ sql: "UPDATE service_bookings SET payment_status = 'waived', updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [String(booking.id)] });
  return c.json({ ok: true, waived_ugx: outstanding });
});

serviceBookingRoutes.post("/bookings/:id/quote", requireAuth, async (c) => {
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found", message: "That booking isn't yours." }, 404);
  const parsed = z.object({ total_ugx: z.number().int().positive().max(100_000_000) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the price in whole shillings." }, 400);
  const { booking, biz } = owned;
  if (Number(booking.paid_ugx) > 0 || !(ACTIVE_STATUSES as readonly string[]).includes(String(booking.status))) return c.json({ error: "not_quotable", message: "The price can only be set before anything is paid." }, 409);
  await db.execute({ sql: "UPDATE service_bookings SET total_price_ugx = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [parsed.data.total_ugx, String(booking.id)] });
  await textCustomer(booking, `${String(biz.name)}: your quote for booking ${String(booking.booking_code ?? "")} is UGX ${parsed.data.total_ugx.toLocaleString("en-UG")}. Pay from your booking page.`);
  return c.json({ ok: true, total_ugx: parsed.data.total_ugx });
});

serviceBookingRoutes.post("/bookings/:id/refund-decision", requireAuth, async (c) => {
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found", message: "That booking isn't yours." }, 404);
  const parsed = z.object({ decision: z.enum(["refund", "keep"]) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const { booking } = owned;
  if (booking.refund_state !== "review") return c.json({ error: "nothing_to_decide", message: "There is no refund waiting for your decision." }, 409);
  if (parsed.data.decision === "keep") {
    await releaseEscrow(String(booking.id));
    await db.execute({ sql: "UPDATE service_bookings SET refund_state = 'kept', updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [String(booking.id)] });
    return c.json({ ok: true, refund_state: "kept" });
  }
  const r = await refundOnlinePayments(String(booking.id), "provider decision");
  if (!r.ok) return c.json({ error: r.error, message: r.message }, r.status);
  return c.json({ ok: true, refund_state: r.pending ? "pending" : "refunded", refunded_ugx: r.refunded });
});

serviceBookingRoutes.get("/bookings/:id/payments", requireAuth, async (c) => {
  const owned = await ownedBooking(c.get("user").sub, c.req.param("id")!);
  if (!owned) return c.json({ error: "not_found" }, 404);
  await pollBookingPayments(String(owned.booking.id));
  const rows = await db.execute({ sql: "SELECT id, kind, amount_ugx, rail, status, created_at FROM service_payments WHERE booking_id = ? ORDER BY created_at", args: [String(owned.booking.id)] });
  return c.json({ payments: rows.rows });
});
