import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { assignProvider, cancelJob, customerActions, getJob, getProvider, jobView, settleJob } from "./jobs.js";
import { notifyUser } from "../lib/webpush.js";
import { applyMoney, chargeCustomer, commissionFor, dropUnpaidHold, fromDb, inMinutes, logEvent, notifyProviders, publicProvider, toDb, transition, workExtrasReady, type Row } from "./service.js";
import { getWorkSettings, type WorkMatchingMode } from "./settings.js";
import { emptyNearby, summariseNearby, type NearbyRow } from "./nearby.js";

export const customerRoutes = new Hono();

const money = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

customerRoutes.get("/catalog", async (c) => {
  const settings = await getWorkSettings();
  const extras = await workExtrasReady();
  const type = c.req.query("type");
  const types = settings.serviceTypes.filter((t) => !type || t === type);
  if (types.length === 0) return c.json({ services: [], settings: publicSettings(settings, extras) });
  const rows = (
    await db.execute({
      sql: `SELECT * FROM work_services WHERE active = 1 AND type IN (${types.map(() => "?").join(", ")}) ORDER BY sort_order, name`,
      args: types,
    })
  ).rows as Row[];
  const services = rows
    .filter((r) => (settings.pricingModes as string[]).includes(String(r.pricing_mode)))
    .map((r) => ({
      id: r.id, type: r.type, category: r.category, name: r.name, description: r.description, pricingMode: r.pricing_mode,
      unitLabel: r.unit_label, unitPriceUgx: Number(r.unit_price_ugx), calloutFeeUgx: Number(r.callout_fee_ugx),
      minQuantity: Number(r.min_quantity), maxQuantity: Number(r.max_quantity),
    }));
  return c.json({ services, settings: publicSettings(settings, extras) });
});

// Nearby providers for the Hive map: counts by trade and coarse, jittered pins (see nearby.ts).
// Never fails the page: any database problem returns empty counts with degraded: true.
customerRoutes.get("/nearby", async (c) => {
  const settings = await getWorkSettings();
  const lat = Number(c.req.query("lat"));
  const lng = Number(c.req.query("lng"));
  const radiusKm = Math.min(settings.radiusKm, 10);
  if (!settings.enabled || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return c.json(emptyNearby(radiusKm));
  }
  const limited = await consume(`work-nearby:${c.get("user").sub}`, 60, 60).catch(() => null);
  if (limited && !limited.allowed) return c.json(emptyNearby(radiusKm));
  try {
    const environment = await getPlatformEnvironment();
    // A cheap bounding box first; the exact radius is applied in summariseNearby.
    const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const rows = (
      await db.execute({
        sql: `SELECT DISTINCT p.id AS provider_id, s.type AS type, p.lat AS lat, p.lng AS lng
              FROM work_providers p
              JOIN work_provider_services ps ON ps.provider_id = p.id
              JOIN work_services s ON s.id = ps.service_id AND s.active = 1
              WHERE p.online = 1 AND p.environment = ? ${settings.requireApproval ? "AND p.status = 'approved'" : "AND p.status NOT IN ('suspended', 'rejected')"}
                AND p.lat IS NOT NULL AND p.lng IS NOT NULL
                AND (p.location_at IS NULL OR p.location_at >= datetime('now', '-3 hours'))
                AND p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?
              LIMIT 2000`,
        args: [environment, lat - dLat, lat + dLat, lng - dLng, lng + dLng],
      })
    ).rows as Row[];
    const list: NearbyRow[] = rows.map((r) => ({ providerId: String(r.provider_id), type: String(r.type), lat: Number(r.lat), lng: Number(r.lng) }));
    return c.json(summariseNearby(list, { lat, lng }, { radiusKm, types: settings.serviceTypes, day: new Date().toISOString().slice(0, 10) }));
  } catch (err) {
    console.error("[work] nearby failed:", err);
    return c.json({ ...emptyNearby(radiusKm), degraded: true });
  }
});

function publicSettings(s: Awaited<ReturnType<typeof getWorkSettings>>, extras = false) {
  return {
    // Photos, chat and tracking only show as available once migration 0099 is in, so apps never offer what would fail.
    photosEnabled: extras && s.photosEnabled, maxPhotosPerJob: s.maxPhotosPerJob, maxPhotoKb: s.maxPhotoKb,
    chatEnabled: extras && s.chatEnabled, trackingEnabled: extras && s.trackingEnabled,
    enabled: s.enabled, serviceTypes: s.serviceTypes, pricingModes: s.pricingModes, matchingModes: s.matchingModes, defaultMatching: s.defaultMatching, providerKinds: s.providerKinds,
    quoteValidHours: s.quoteValidHours, freeCancelMinutes: s.freeCancelMinutes, lateCancelFeePercent: s.lateCancelFeePercent,
    autoConfirmHours: s.autoConfirmHours, disputeWindowHours: s.disputeWindowHours, minLeadMinutes: s.minLeadMinutes, maxAdvanceDays: s.maxAdvanceDays,
    scheduleQuickMinutes: s.scheduleQuickMinutes, scheduleTomorrowEnabled: s.scheduleTomorrowEnabled, scheduleTomorrowTime: s.scheduleTomorrowTime,
  };
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

const bookSchema = z.object({
  serviceId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(1000).default(1),
  details: z.string().max(1000).default(""),
  address: z.string().min(3).max(200),
  area: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  scheduledFor: z.string().max(40).optional(),
  matchingMode: z.enum(["broadcast", "customer_picks", "admin_assigns"]).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

customerRoutes.post("/jobs", async (c) => {
  const user = c.get("user");
  if (user.role === "admin") return c.json({ error: "forbidden", message: "Staff accounts can't book jobs." }, 403);
  const parsed = bookSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const settings = await getWorkSettings();

  // A repeat of the same booking (a double tap, a retry) returns the first one.
  if (d.idempotencyKey) {
    const existing = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE customer_id = ? AND idempotency_key = ?", args: [user.sub, d.idempotencyKey] })).rows[0] as Row | undefined;
    if (existing) return c.json({ job: await jobView(existing, "customer"), actions: customerActions(existing, settings), repeated: true });
  }

  const service = (await db.execute({ sql: "SELECT * FROM work_services WHERE id = ? AND active = 1", args: [d.serviceId] })).rows[0] as Row | undefined;
  if (!service) return c.json({ error: "service_not_found", message: "That service isn't available." }, 404);
  if (!(settings.serviceTypes as string[]).includes(String(service.type))) {
    return c.json({ error: "service_closed", message: "That kind of service isn't open right now." }, 403);
  }
  if (!(settings.pricingModes as string[]).includes(String(service.pricing_mode))) {
    return c.json({ error: "pricing_unavailable", message: "That service can't be booked right now." }, 409);
  }

  const pricingMode = String(service.pricing_mode) as "fixed" | "quote";
  const quantity = pricingMode === "quote" ? 1 : d.quantity;
  if (quantity < Number(service.min_quantity) || quantity > Number(service.max_quantity)) {
    return c.json({ error: "invalid_quantity", message: `Choose between ${service.min_quantity} and ${service.max_quantity}.` }, 400);
  }

  const matchingMode: WorkMatchingMode = d.matchingMode ?? settings.defaultMatching;
  if (!settings.matchingModes.includes(matchingMode)) {
    return c.json({ error: "matching_unavailable", message: "That way of finding a provider isn't available." }, 400);
  }
  if (matchingMode === "broadcast" && (d.lat == null || d.lng == null)) {
    return c.json({ error: "location_required", message: "Share your location so nearby providers can be found." }, 400);
  }

  let scheduledFor: string | null = null;
  if (d.scheduledFor) {
    const when = new Date(d.scheduledFor);
    if (Number.isNaN(when.getTime())) return c.json({ error: "invalid_schedule", message: "That date and time isn't valid." }, 400);
    const minutesAhead = (when.getTime() - Date.now()) / 60_000;
    if (minutesAhead < settings.minLeadMinutes) return c.json({ error: "too_soon", message: `Book at least ${settings.minLeadMinutes} minutes ahead.` }, 400);
    if (minutesAhead > settings.maxAdvanceDays * 1440) return c.json({ error: "too_far", message: `You can book up to ${settings.maxAdvanceDays} days ahead.` }, 400);
    scheduledFor = toDb(when);
  }

  const limit = await consume(`work-book:${user.sub}`, settings.jobsPerHour, 3600);
  if (!limit.allowed) {
    return c.json({ error: "too_many_requests", message: "You've booked several jobs already. Try again later.", retryAfterSeconds: limit.retryAfterSeconds }, 429);
  }

  // Price and commission come from the catalogue and settings, never from the request.
  const unitPrice = Number(service.unit_price_ugx);
  const callout = Number(service.callout_fee_ugx);
  const price = pricingMode === "fixed" ? unitPrice * quantity : 0;
  const hold = pricingMode === "fixed" ? price : callout;
  if (pricingMode === "fixed" && price <= 0) return c.json({ error: "pricing_unavailable", message: "That service can't be booked right now." }, 409);

  const environment = await getPlatformEnvironment();
  const id = newId("wjob");
  try {
    await db.execute({
      sql: `INSERT INTO work_jobs (id, customer_id, service_id, service_type, service_name, pricing_mode, matching_mode, status, quantity, details,
              address, area, lat, lng, scheduled_for, unit_price_ugx, callout_fee_ugx, price_ugx, commission_percent, idempotency_key, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.sub, service.id, service.type, service.name, pricingMode, matchingMode, quantity, d.details, d.address, d.area ?? null, d.lat ?? null, d.lng ?? null,
        scheduledFor, unitPrice, callout, price, commissionFor(service, settings), d.idempotencyKey ?? null, environment],
    });
  } catch (err) {
    const again = d.idempotencyKey && (await db.execute({ sql: "SELECT * FROM work_jobs WHERE customer_id = ? AND idempotency_key = ?", args: [user.sub, d.idempotencyKey] })).rows[0];
    if (again) return c.json({ job: await jobView(again as Row, "customer"), actions: customerActions(again as Row, settings), repeated: true });
    throw err;
  }

  const open = { sql: "UPDATE work_jobs SET status = 'open', held_ugx = ?, expires_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending_payment'", args: [hold, inMinutes(settings.offerWindowMinutes), id] };
  if (hold > 0) {
    const result = await chargeCustomer({ jobId: id, key: "booking", customerId: user.sub, amount: hold, environment, note: `Peebee Work — ${service.name}`, then: open });
    if (!result.charged) {
      await dropUnpaidHold(id, "booking");
      await db.execute({ sql: "DELETE FROM work_jobs WHERE id = ? AND status = 'pending_payment'", args: [id] });
      return c.json({ error: "insufficient_wallet", message: `You need ${money(hold)} in your wallet to book this. Top up and try again.` }, 402);
    }
  } else {
    await db.execute(open);
  }
  await logEvent(id, user.sub, "customer", "created", { serviceId: service.id, quantity, pricingMode, matchingMode });

  const job = (await getJob(id)) as Row;
  if (matchingMode !== "admin_assigns") await notifyProviders(job, settings);
  return c.json({ job: await jobView(job, "customer"), actions: customerActions(job, settings) }, 201);
});

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

customerRoutes.get("/jobs", async (c) => {
  const user = c.get("user");
  const settings = await getWorkSettings();
  const rows = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE customer_id = ? AND status != 'pending_payment' ORDER BY created_at DESC LIMIT 50", args: [user.sub] })).rows as Row[];
  return c.json({ jobs: await Promise.all(rows.map(async (r) => ({ ...(await jobView(r, "customer")), actions: customerActions(r, settings) }))) });
});

async function ownJob(c: { get: (k: "user") => { sub: string }; req: { param: (k: string) => string | undefined } }): Promise<Row | null> {
  const job = await getJob(c.req.param("id") as string);
  return job && job.customer_id === c.get("user").sub && job.status !== "pending_payment" ? job : null;
}

customerRoutes.get("/jobs/:id", async (c) => {
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const settings = await getWorkSettings();
  let offers: unknown[] = [];
  if (job.status === "open" && job.matching_mode === "customer_picks") {
    const rows = (
      await db.execute({
        sql: `SELECT o.*, p.* , o.id AS offer_id, o.price_ugx AS offer_price FROM work_offers o JOIN work_providers p ON p.id = o.provider_id
              WHERE o.job_id = ? AND o.status = 'pending' ORDER BY o.created_at`,
        args: [job.id],
      })
    ).rows as Row[];
    offers = rows.map((o) => ({
      id: o.offer_id, priceUgx: job.pricing_mode === "fixed" ? Number(job.price_ugx) : Number(o.offer_price), etaMinutes: o.eta_minutes ?? null,
      message: o.message ?? "", provider: publicProvider(o),
    }));
  }
  const events = (await db.execute({ sql: "SELECT action, actor_kind, created_at FROM work_events WHERE job_id = ? ORDER BY created_at, rowid", args: [job.id] })).rows;
  return c.json({ job: await jobView(job, "customer"), actions: customerActions(job, settings), offers, timeline: events });
});

// ---------------------------------------------------------------------------
// Choosing a provider (customer_picks)
// ---------------------------------------------------------------------------

customerRoutes.post("/jobs/:id/offers/:offerId/select", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  if (job.matching_mode !== "customer_picks" || job.status !== "open") return c.json({ error: "not_open", message: "You can't choose a provider for this job now." }, 409);
  const offer = (await db.execute({ sql: "SELECT * FROM work_offers WHERE id = ? AND job_id = ? AND status = 'pending'", args: [c.req.param("offerId") as string, job.id] })).rows[0] as Row | undefined;
  if (!offer) return c.json({ error: "offer_not_found", message: "That offer is no longer available." }, 404);
  const provider = await getProvider(offer.provider_id);
  if (!provider || provider.status === "suspended" || provider.status === "rejected") return c.json({ error: "provider_unavailable", message: "That provider isn't available." }, 409);

  const result = await assignProvider(job, provider, { actor: { id: user.sub, kind: "customer" }, offerPriceUgx: job.pricing_mode === "quote" ? Number(offer.price_ugx) : undefined });
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  await db.execute({ sql: "UPDATE work_offers SET status = CASE WHEN id = ? THEN 'selected' ELSE 'declined' END WHERE job_id = ? AND status = 'pending'", args: [offer.id, job.id] });
  const fresh = (await getJob(String(job.id))) as Row;
  return c.json({ job: await jobView(fresh, "customer"), actions: customerActions(fresh, await getWorkSettings()) });
});

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

customerRoutes.post("/jobs/:id/quote/accept", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  if (job.status !== "quoted") return c.json({ error: "no_quote", message: "There's no quote to accept." }, 409);
  if (job.quote_expires_at && fromDb(String(job.quote_expires_at)).getTime() < Date.now()) {
    return c.json({ error: "quote_expired", message: "That quote has expired. Ask the provider for a new one." }, 409);
  }
  const price = Number(job.price_ugx);
  const extra = price - Number(job.held_ugx);
  const now = toDb();
  const book = { sql: "UPDATE work_jobs SET status = 'booked', held_ugx = ?, booked_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'quoted' AND price_ugx = ?", args: [price, now, job.id, price] };

  if (extra > 0) {
    const result = await chargeCustomer({
      jobId: String(job.id), key: `quote:${price}`, customerId: user.sub, amount: extra, environment: job.environment === "sandbox" ? "sandbox" : "live",
      note: `Peebee Work — ${job.service_name}`, then: book,
    });
    if (!result.charged) {
      await dropUnpaidHold(String(job.id), `quote:${price}`);
      return c.json({ error: "insufficient_wallet", message: `Add ${money(extra)} to your wallet to accept this quote.` }, 402);
    }
    if (!result.applied && !result.debited) {
      // A repeat of the same tap: the first request is handling it (or already finished).
      const now = (await getJob(String(job.id))) as Row;
      if (now.status === "booked" && Number(now.price_ugx) === price) {
        return c.json({ job: await jobView(now, "customer"), actions: customerActions(now, await getWorkSettings()) });
      }
      return c.json({ error: "quote_changed", message: "The quote just changed. Have another look." }, 409);
    }
    if (!result.applied) {
      // The quote changed while paying: give the money back; they can look at the new quote.
      const id = `refund:${job.id}:quote-${price}`;
      await db.execute({ sql: "INSERT OR IGNORE INTO work_money (id, job_id, user_id, kind, amount_ugx, status, note, environment) VALUES (?, ?, ?, 'refund', ?, 'pending', ?, ?)", args: [id, job.id, user.sub, extra, "Peebee Work — quote changed before payment", job.environment] });
      await applyMoney(id);
      return c.json({ error: "quote_changed", message: "The quote just changed. Your payment was returned — have another look." }, 409);
    }
    await logEvent(String(job.id), user.sub, "customer", "quote_accepted", { priceUgx: price });
  } else {
    const ok = await transition({
      jobId: String(job.id), from: ["quoted"], to: "booked", set: { held_ugx: Number(job.held_ugx), booked_at: now }, where: { sql: "price_ugx = ?", args: [price] },
      environment: job.environment === "sandbox" ? "sandbox" : "live", actor: { id: user.sub, kind: "customer" }, action: "quote_accepted", detail: { priceUgx: price },
    });
    if (!ok) return c.json({ error: "quote_changed", message: "The quote just changed. Have another look." }, 409);
  }
  const fresh = (await getJob(String(job.id))) as Row;
  const provider = await getProvider(fresh.provider_id);
  if (provider) notifyProviderOfAcceptance(provider, fresh);
  return c.json({ job: await jobView(fresh, "customer"), actions: customerActions(fresh, await getWorkSettings()) });
});

function notifyProviderOfAcceptance(provider: Row, job: Row) {
  notifyUser(String(provider.user_id), { title: "Quote accepted", body: String(job.service_name), url: "/jobs", tag: `work-${job.id}` }).catch(() => {});
}

customerRoutes.post("/jobs/:id/quote/decline", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  if (job.status !== "quoted") return c.json({ error: "no_quote", message: "There's no quote to decline." }, 409);
  // The provider came and inspected, so the call-out fee (all that is held) is theirs, less Peebee's commission.
  const result = await settleJob(job, { from: ["quoted"], to: "settled", refundUgx: 0, actor: { id: user.sub, kind: "customer" }, action: "quote_declined" });
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Cancel, confirm, report a problem, rate
// ---------------------------------------------------------------------------

customerRoutes.post("/jobs/:id/cancel", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  const result = await cancelJob(job, "customer", user.sub, await getWorkSettings(), String(body.reason ?? "Cancelled by customer"));
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  return c.json({ ok: true });
});

customerRoutes.post("/jobs/:id/confirm", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  if (job.status !== "completed") return c.json({ error: "not_completed", message: "The provider hasn't marked this job done yet." }, 409);
  const result = await settleJob(job, { from: ["completed"], to: "settled", refundUgx: 0, actor: { id: user.sub, kind: "customer" }, action: "confirmed" });
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  return c.json({ ok: true });
});

customerRoutes.post("/jobs/:id/dispute", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const parsed = z.object({ reason: z.string().min(5).max(500) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Tell us what went wrong (a few words at least)." }, 400);
  const settings = await getWorkSettings();
  const deadline = job.completed_at ? fromDb(String(job.completed_at)).getTime() + settings.disputeWindowHours * 3_600_000 : 0;
  if (job.status !== "completed" || Date.now() > deadline) {
    return c.json({ error: "cannot_dispute", message: "You can only report a problem on a finished job within the review window." }, 409);
  }
  const ok = await transition({
    jobId: String(job.id), from: ["completed"], to: "disputed", set: { dispute_reason: parsed.data.reason },
    environment: job.environment === "sandbox" ? "sandbox" : "live", actor: { id: user.sub, kind: "customer" }, action: "disputed", detail: { reason: parsed.data.reason },
  });
  if (!ok) return c.json({ error: "cannot_dispute", message: "This job just changed. Refresh and try again." }, 409);
  return c.json({ ok: true });
});

customerRoutes.post("/jobs/:id/rate", async (c) => {
  const user = c.get("user");
  const job = await ownJob(c);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const parsed = z.object({ rating: z.number().int().min(1).max(5), review: z.string().max(500).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose 1 to 5 stars." }, 400);
  const res = await db.execute({
    sql: "UPDATE work_jobs SET rating = ?, review = ?, updated_at = datetime('now') WHERE id = ? AND customer_id = ? AND status = 'settled' AND rating IS NULL AND provider_id IS NOT NULL",
    args: [parsed.data.rating, parsed.data.review ?? null, job.id, user.sub],
  });
  if ((res.rowsAffected ?? 0) !== 1) return c.json({ error: "cannot_rate", message: "This job can't be rated (or already was)." }, 409);
  await db.execute({ sql: "UPDATE work_providers SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?", args: [parsed.data.rating, job.provider_id] });
  return c.json({ ok: true });
});

