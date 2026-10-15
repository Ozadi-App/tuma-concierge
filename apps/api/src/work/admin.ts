import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { notifyUser } from "../lib/webpush.js";
import { assignProvider, cancelJob, getJob, getProvider, jobView, settleJob } from "./jobs.js";
import { suspendForReview, trailFor } from "./onsite.js";
import { notifyCustomer, notifyProviders, workExtrasReady, workOnsiteReady, type Row } from "./service.js";
import { getWorkSettings, WORK_PRICING_MODES, WORK_SERVICE_TYPES } from "./settings.js";

export const adminRoutes = new Hono();

const ip = (c: { req: { header: (k: string) => string | undefined } }) => c.req.header("cf-connecting-ip") ?? null;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/services", requirePermission("work.view"), async (c) => {
  const type = c.req.query("type");
  const rows = (await db.execute({ sql: `SELECT * FROM work_services ${type ? "WHERE type = ?" : ""} ORDER BY type, sort_order, name`, args: type ? [type] : [] })).rows;
  return c.json({ services: rows });
});

const serviceFields = {
  type: z.enum(WORK_SERVICE_TYPES),
  category: z.string().max(40),
  name: z.string().min(2).max(100),
  description: z.string().max(300),
  pricingMode: z.enum(WORK_PRICING_MODES),
  unitLabel: z.string().min(1).max(30),
  unitPriceUgx: z.number().int().min(0).max(100_000_000),
  calloutFeeUgx: z.number().int().min(0).max(10_000_000),
  minQuantity: z.number().int().min(1).max(1000),
  maxQuantity: z.number().int().min(1).max(1000),
  commissionPercent: z.number().min(0).max(60).nullable(),
  sortOrder: z.number().int().min(0).max(100000),
  active: z.boolean(),
};

/** A fixed-price service needs a price; a quote service may have a call-out fee but no unit price. */
function consistent(d: { pricingMode?: string; unitPriceUgx?: number; minQuantity?: number; maxQuantity?: number }): string | null {
  if (d.pricingMode === "fixed" && !(d.unitPriceUgx && d.unitPriceUgx > 0)) return "A fixed-price service needs a price.";
  if (d.minQuantity != null && d.maxQuantity != null && d.minQuantity > d.maxQuantity) return "The minimum can't be more than the maximum.";
  return null;
}

adminRoutes.post("/admin/services", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ ...serviceFields, category: serviceFields.category.default(""), description: serviceFields.description.default(""), unitLabel: serviceFields.unitLabel.default("job"),
    unitPriceUgx: serviceFields.unitPriceUgx.default(0), calloutFeeUgx: serviceFields.calloutFeeUgx.default(0), minQuantity: serviceFields.minQuantity.default(1),
    maxQuantity: serviceFields.maxQuantity.default(20), commissionPercent: serviceFields.commissionPercent.default(null), sortOrder: serviceFields.sortOrder.default(0), active: serviceFields.active.default(true) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const problem = consistent(d);
  if (problem) return c.json({ error: "invalid_service", message: problem }, 400);
  const id = newId("wsv");
  await db.execute({
    sql: `INSERT INTO work_services (id, type, category, name, description, pricing_mode, unit_label, unit_price_ugx, callout_fee_ugx, min_quantity, max_quantity, commission_percent, sort_order, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, d.type, d.category, d.name, d.description, d.pricingMode, d.unitLabel, d.unitPriceUgx, d.calloutFeeUgx, d.minQuantity, d.maxQuantity, d.commissionPercent, d.sortOrder, d.active ? 1 : 0],
  });
  await logActivity({ actor: user, action: "work.service.create", summary: `Added ${d.type} service "${d.name}"`, entityType: "work_service", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/services/:id", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id") as string;
  const before = (await db.execute({ sql: "SELECT * FROM work_services WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found", message: "Service not found." }, 404);
  const parsed = z.object(serviceFields).partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const problem = consistent({
    pricingMode: d.pricingMode ?? String(before.pricing_mode), unitPriceUgx: d.unitPriceUgx ?? Number(before.unit_price_ugx),
    minQuantity: d.minQuantity ?? Number(before.min_quantity), maxQuantity: d.maxQuantity ?? Number(before.max_quantity),
  });
  if (problem) return c.json({ error: "invalid_service", message: problem }, 400);
  // Prices on jobs already booked are copies, so this only affects new bookings.
  await db.execute({
    sql: `UPDATE work_services SET type = COALESCE(?, type), category = COALESCE(?, category), name = COALESCE(?, name), description = COALESCE(?, description),
            pricing_mode = COALESCE(?, pricing_mode), unit_label = COALESCE(?, unit_label), unit_price_ugx = COALESCE(?, unit_price_ugx),
            callout_fee_ugx = COALESCE(?, callout_fee_ugx), min_quantity = COALESCE(?, min_quantity), max_quantity = COALESCE(?, max_quantity),
            commission_percent = CASE WHEN ? = 1 THEN ? ELSE commission_percent END, sort_order = COALESCE(?, sort_order), active = COALESCE(?, active),
            updated_at = datetime('now') WHERE id = ?`,
    args: [d.type ?? null, d.category ?? null, d.name ?? null, d.description ?? null, d.pricingMode ?? null, d.unitLabel ?? null, d.unitPriceUgx ?? null,
      d.calloutFeeUgx ?? null, d.minQuantity ?? null, d.maxQuantity ?? null, "commissionPercent" in d ? 1 : 0, d.commissionPercent ?? null, d.sortOrder ?? null,
      d.active == null ? null : d.active ? 1 : 0, id],
  });
  await logActivity({ actor: user, action: "work.service.update", summary: `Changed ${before.type} service "${before.name}"`, entityType: "work_service", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/providers", requirePermission("work.view"), async (c) => {
  const status = c.req.query("status");
  const rows = (
    await db.execute({
      sql: `SELECT p.*, u.name AS user_name, u.phone AS user_phone,
              (SELECT COUNT(*) FROM work_provider_members m WHERE m.provider_id = p.id AND m.status = 'active') AS team_size,
              (SELECT group_concat(s.name, ', ') FROM work_provider_services ps JOIN work_services s ON s.id = ps.service_id WHERE ps.provider_id = p.id) AS services
            FROM work_providers p JOIN users u ON u.id = p.user_id ${status ? "WHERE p.status = ?" : ""} ORDER BY p.created_at DESC LIMIT 200`,
      args: status ? [status] : [],
    })
  ).rows;
  return c.json({ providers: rows });
});

const providerDecisions = {
  approve: { to: "approved", from: ["pending", "rejected", "suspended"], label: "Approved" },
  reject: { to: "rejected", from: ["pending"], label: "Rejected" },
  suspend: { to: "suspended", from: ["approved", "pending"], label: "Suspended" },
  reinstate: { to: "approved", from: ["suspended", "rejected"], label: "Reinstated" },
} as const;

for (const [action, rule] of Object.entries(providerDecisions)) {
  adminRoutes.post(`/admin/providers/:id/${action}`, requirePermission("work.manage"), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id") as string;
    const note = String(((await c.req.json().catch(() => ({}))) as { note?: string }).note ?? "").slice(0, 300);
    const res = await db.execute({
      sql: `UPDATE work_providers SET status = ?, status_note = ?, approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
              approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
              online = CASE WHEN ? = 'approved' THEN online ELSE 0 END, updated_at = datetime('now')
            WHERE id = ? AND status IN (${rule.from.map(() => "?").join(", ")})`,
      args: [rule.to, note || null, rule.to, user.sub, rule.to, rule.to, id, ...rule.from],
    });
    if ((res.rowsAffected ?? 0) !== 1) return c.json({ error: "invalid_transition", message: `That provider can't be ${rule.label.toLowerCase()} from here.` }, 409);
    await logActivity({ actor: user, action: `work.provider.${action}`, summary: `${rule.label} provider ${id}`, entityType: "work_provider", entityId: id, after: { note }, ip: ip(c) });
    return c.json({ ok: true });
  });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/jobs", requirePermission("work.view"), async (c) => {
  const status = c.req.query("status");
  const rows = (await db.execute({ sql: `SELECT * FROM work_jobs WHERE status != 'pending_payment' ${status ? "AND status = ?" : ""} ORDER BY created_at DESC LIMIT 200`, args: status ? [status] : [] })).rows as Row[];
  return c.json({ jobs: await Promise.all(rows.map((r) => jobView(r, "admin"))) });
});

adminRoutes.get("/admin/jobs/:id", requirePermission("work.view"), async (c) => {
  const job = await getJob(c.req.param("id") as string);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const events = (await db.execute({ sql: "SELECT * FROM work_events WHERE job_id = ? ORDER BY created_at, rowid", args: [job.id] })).rows;
  const money = (await db.execute({ sql: "SELECT id, user_id, kind, amount_ugx, status, note, created_at, done_at FROM work_money WHERE job_id = ? ORDER BY created_at, rowid", args: [job.id] })).rows;
  const offers = (await db.execute({ sql: "SELECT * FROM work_offers WHERE job_id = ? ORDER BY created_at", args: [job.id] })).rows;
  // Photos and messages exist once migration 0099 is applied.
  const extras = await workExtrasReady();
  const photos = extras ? (await db.execute({ sql: "SELECT id, uploader_kind, phase, note, size_bytes, created_at FROM work_job_photos WHERE job_id = ? ORDER BY created_at", args: [job.id] })).rows : [];
  const messages = extras
    ? (await db.execute({ sql: "SELECT m.id, m.sender_kind, m.body, m.created_at, u.name AS sender_name FROM work_messages m JOIN users u ON u.id = m.sender_id WHERE m.job_id = ? ORDER BY m.created_at, m.id", args: [job.id] })).rows
    : [];
  return c.json({ job: await jobView(job, "admin"), events, money, offers, photos, messages });
});

/** Hands an open job to a chosen provider (the admin_assigns way, or to rescue a job nobody took). */
adminRoutes.post("/admin/jobs/:id/assign", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ providerId: z.string().min(1).max(80) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose a provider." }, 400);
  const job = await getJob(c.req.param("id") as string);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const provider = await getProvider(parsed.data.providerId);
  if (!provider || provider.status !== "approved") return c.json({ error: "provider_unavailable", message: "Only approved providers can be assigned." }, 409);
  const offersService = (await db.execute({ sql: "SELECT 1 FROM work_provider_services WHERE provider_id = ? AND service_id = ?", args: [provider.id, job.service_id] })).rows[0];
  if (!offersService) return c.json({ error: "service_mismatch", message: "That provider doesn't offer this service." }, 409);

  const result = await assignProvider(job, provider, { actor: { id: user.sub, kind: "admin" } });
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  await logActivity({ actor: user, action: "work.job.assign", summary: `Assigned job ${job.id} to provider ${provider.id}`, entityType: "work_job", entityId: String(job.id), after: { providerId: provider.id }, ip: ip(c) });
  notifyCustomer(job, "A provider has been assigned", String(job.service_name));
  return c.json({ job: await jobView((await getJob(String(job.id))) as Row, "admin") });
});

adminRoutes.post("/admin/jobs/:id/broadcast", requirePermission("work.manage"), async (c) => {
  const job = await getJob(c.req.param("id") as string);
  if (!job || job.status !== "open") return c.json({ error: "not_open", message: "Only open jobs can be re-sent." }, 409);
  return c.json({ notified: await notifyProviders(job, await getWorkSettings()) });
});

adminRoutes.post("/admin/jobs/:id/cancel", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  const job = await getJob(c.req.param("id") as string);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  const reason = String(((await c.req.json().catch(() => ({}))) as { reason?: string }).reason ?? "Cancelled by Peebee");
  const result = await cancelJob(job, "admin", user.sub, await getWorkSettings(), reason);
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  await logActivity({ actor: user, action: "work.job.cancel", summary: `Cancelled job ${job.id} and refunded the customer`, entityType: "work_job", entityId: String(job.id), after: { reason }, ip: ip(c) });
  return c.json({ ok: true });
});

/** Rules on a reported problem: pay the provider, refund the customer, or split it. */
adminRoutes.post("/admin/jobs/:id/resolve", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ outcome: z.enum(["release", "refund", "split"]), refundPercent: z.number().int().min(1).max(99).optional(), note: z.string().min(3).max(500) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose an outcome and add a note explaining it." }, 400);
  if (parsed.data.outcome === "split" && !parsed.data.refundPercent) return c.json({ error: "invalid_body", message: "Say what percentage goes back to the customer." }, 400);
  const job = await getJob(c.req.param("id") as string);
  if (!job) return c.json({ error: "not_found", message: "Job not found." }, 404);
  if (job.status !== "disputed") return c.json({ error: "not_disputed", message: "Only reported jobs can be resolved." }, 409);

  const held = Number(job.held_ugx);
  const refund = parsed.data.outcome === "refund" ? held : parsed.data.outcome === "release" ? 0 : Math.round((held * (parsed.data.refundPercent as number)) / 100);
  const result = await settleJob(job, {
    from: ["disputed"], to: parsed.data.outcome === "refund" ? "refunded" : "settled", refundUgx: refund,
    actor: { id: user.sub, kind: "admin" }, action: `resolved_${parsed.data.outcome}`, note: parsed.data.note, resolvedBy: user.sub,
  });
  if (!result.ok) return c.json({ error: result.error, message: result.message }, result.status);
  await logActivity({ actor: user, action: "work.job.resolve", summary: `Resolved reported job ${job.id}: ${parsed.data.outcome}`, entityType: "work_job", entityId: String(job.id), after: parsed.data, ip: ip(c) });
  return c.json({ ok: true });
});


// ---------------------------------------------------------------------------
// On-site flags: cancellations that followed a long stay at the customer's address (migration 0100)
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/flags", requirePermission("work.view"), async (c) => {
  if (!(await workOnsiteReady())) return c.json({ ready: false, flags: [], openCount: 0 });
  const status = c.req.query("status");
  const flags = (
    await db.execute({
      sql: `SELECT f.*, p.display_name AS provider_name, p.status AS provider_status, j.service_name, j.address,
              (SELECT COUNT(*) FROM work_flags o WHERE o.provider_id = f.provider_id AND o.status IN ('open', 'warned', 'suspended')) AS provider_flag_count
            FROM work_flags f JOIN work_providers p ON p.id = f.provider_id JOIN work_jobs j ON j.id = f.job_id
            ${status ? "WHERE f.status = ?" : ""} ORDER BY (f.status = 'open') DESC, f.created_at DESC LIMIT 200`,
      args: status ? [status] : [],
    })
  ).rows;
  const openCount = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM work_flags WHERE status = 'open'", args: [] })).rows[0] as Row).n);
  return c.json({ ready: true, flags, openCount });
});

adminRoutes.get("/admin/flags/:id", requirePermission("work.view"), async (c) => {
  if (!(await workOnsiteReady())) return c.json({ error: "upgrade_pending", message: "On-site checks need a database update first." }, 503);
  const flag = (
    await db.execute({
      sql: `SELECT f.*, p.display_name AS provider_name, p.status AS provider_status, p.status_note AS provider_status_note, u.name AS customer_name
            FROM work_flags f JOIN work_providers p ON p.id = f.provider_id JOIN users u ON u.id = f.customer_id WHERE f.id = ?`,
      args: [c.req.param("id") as string],
    })
  ).rows[0] as Row | undefined;
  if (!flag) return c.json({ error: "not_found", message: "Flag not found." }, 404);
  const job = (await getJob(String(flag.job_id))) as Row;
  const trail = await trailFor(String(flag.job_id), String(flag.provider_id));
  // A long trail is thinned so the page stays light; the first and last points always stay.
  const step = Math.max(1, Math.ceil(trail.length / 300));
  const points = trail.filter((_, i) => i % step === 0 || i === trail.length - 1);
  const events = (await db.execute({ sql: "SELECT * FROM work_events WHERE job_id = ? ORDER BY created_at, rowid", args: [flag.job_id] })).rows;
  const others = (await db.execute({
    sql: "SELECT id, kind, status, onsite_minutes, created_at FROM work_flags WHERE provider_id = ? AND id != ? ORDER BY created_at DESC LIMIT 20",
    args: [flag.provider_id, flag.id],
  })).rows;
  return c.json({
    flag,
    job: { id: job.id, serviceName: job.service_name, address: job.address, lat: job.lat, lng: job.lng, status: job.status, assignedAt: job.assigned_at, cancelledAt: job.cancelled_at, cancelledBy: job.cancelled_by, cancelReason: job.cancel_reason },
    trail: points, trailTotal: trail.length, events, otherFlags: others,
  });
});

const reviewSchema = z.object({ outcome: z.enum(["dismiss", "warn", "suspend"]), note: z.string().trim().max(300).default("") });

adminRoutes.post("/admin/flags/:id/review", requirePermission("work.manage"), async (c) => {
  const user = c.get("user");
  if (!(await workOnsiteReady())) return c.json({ error: "upgrade_pending", message: "On-site checks need a database update first." }, 503);
  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Choose dismiss, warn or suspend." }, 400);
  const id = c.req.param("id") as string;
  const flag = (await db.execute({ sql: "SELECT * FROM work_flags WHERE id = ?", args: [id] })).rows[0] as Row | undefined;
  if (!flag) return c.json({ error: "not_found", message: "Flag not found." }, 404);
  const { outcome, note } = parsed.data;
  if (outcome === "suspend") {
    const ok = await suspendForReview(String(flag.provider_id), note ? `Under review: ${note}` : "Under review after a flagged cancellation");
    const status = ((await db.execute({ sql: "SELECT status FROM work_providers WHERE id = ?", args: [flag.provider_id] })).rows[0] as Row | undefined)?.status;
    if (!ok && status !== "suspended") return c.json({ error: "invalid_transition", message: "That provider can't be suspended from here." }, 409);
  }
  const status = outcome === "dismiss" ? "dismissed" : outcome === "warn" ? "warned" : "suspended";
  const res = await db.execute({
    sql: "UPDATE work_flags SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'open'",
    args: [status, note || null, user.sub, id],
  });
  if ((res.rowsAffected ?? 0) !== 1) return c.json({ error: "already_reviewed", message: "Someone has already reviewed this flag." }, 409);
  if (outcome === "warn") {
    const owner = (await db.execute({ sql: "SELECT user_id FROM work_providers WHERE id = ?", args: [flag.provider_id] })).rows[0] as Row | undefined;
    if (owner) notifyUser(String(owner.user_id), { title: "A warning from Peebee Work", body: note || "Cancelling jobs after arriving can put your account at risk.", url: "/account", tag: "work-warning" }).catch(() => {});
  }
  await logActivity({ actor: user, action: `work.flag.${outcome}`, summary: `Reviewed flag ${id}: ${outcome}`, entityType: "work_flag", entityId: id, after: { note, providerId: flag.provider_id }, ip: ip(c) });
  return c.json({ ok: true });
});
