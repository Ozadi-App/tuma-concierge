import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { resetModerationCache } from "./moderation.js";
import { FEE_KINDS } from "./monetization.js";
import { alertMatchingWorkers } from "./jobs.js";
import { resolveDispute } from "./contracts.js";
import { inDays, parseList, tell, ratingOf, type Row } from "./service.js";
import { clearSandboxDemo, seedSandboxDemo } from "./seed.js";
import { getTalentSettings, setTalentSettings, talentSettingsSchema } from "./settings.js";

export const adminRoutes = new Hono();

const ip = (c: { req: { header: (k: string) => string | undefined } }) => c.req.header("cf-connecting-ip") ?? null;
const num = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/overview", requirePermission("talent.view"), async (c) => {
  const one = async (sql: string, args: unknown[] = []) => num(((await db.execute({ sql, args: args as never })).rows[0] as Row).n);
  const [jobsOpen, jobsReview, workers, workersPending, openReports, disputes, contracts, held, dueTotal] = await Promise.all([
    one("SELECT COUNT(*) AS n FROM talent_jobs WHERE status = 'open'"),
    one("SELECT COUNT(*) AS n FROM talent_jobs WHERE status = 'pending_review'"),
    one("SELECT COUNT(*) AS n FROM talent_profiles WHERE status = 'approved' AND activated_at IS NOT NULL"),
    one("SELECT COUNT(*) AS n FROM talent_profiles WHERE status = 'pending'"),
    one("SELECT COUNT(*) AS n FROM talent_reports WHERE status = 'open'"),
    one("SELECT COUNT(*) AS n FROM talent_contracts WHERE status = 'disputed'"),
    one("SELECT COUNT(*) AS n FROM talent_contracts WHERE status = 'active'"),
    one("SELECT COALESCE(SUM(held_ugx), 0) AS n FROM talent_contracts WHERE status IN ('active', 'disputed')"),
    one("SELECT COALESCE(SUM(amount_ugx), 0) AS n FROM talent_charges WHERE status = 'due'"),
  ]);
  const revenue = (
    await db.execute({
      sql: `SELECT kind, COALESCE(SUM(amount_ugx), 0) AS total, COUNT(*) AS n FROM talent_charges WHERE status = 'paid' AND kind != 'cancel_compensation' AND created_at >= datetime('now', '-30 days') GROUP BY kind ORDER BY total DESC`,
      args: [],
    })
  ).rows as Row[];
  const waived = (
    await db.execute({
      sql: `SELECT reason, COUNT(*) AS n FROM talent_charges WHERE status = 'waived' AND created_at >= datetime('now', '-30 days') GROUP BY reason ORDER BY n DESC`,
      args: [],
    })
  ).rows as Row[];
  const settings = await getTalentSettings();
  return c.json({
    settings: { enabled: settings.enabled, freeAccess: settings.freeAccess },
    counts: { jobsOpen, jobsReview, workers, workersPending, openReports, disputes, contracts },
    money: { heldInEscrowUgx: held, owedToPeebeeUgx: dueTotal },
    revenue30d: revenue.map((r) => ({ kind: String(r.kind), totalUgx: num(r.total), count: num(r.n) })),
    revenue30dTotalUgx: revenue.reduce((t, r) => t + num(r.total), 0),
    waived30d: waived.map((r) => ({ reason: String(r.reason), count: num(r.n) })),
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/settings", requirePermission("talent.view"), async (c) => c.json({ settings: await getTalentSettings() }));

adminRoutes.put("/admin/settings", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = talentSettingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: parsed.error.issues[0]?.message }, 400);
  const before = await getTalentSettings();
  await setTalentSettings(parsed.data);
  const after = await getTalentSettings();
  const changed = Object.keys(parsed.data).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k]));
  if (changed.length) await logActivity({ actor: user, action: "talent.settings.update", summary: `Changed Jobs settings: ${changed.join(", ")}`, entityType: "talent_settings", before, after, ip: ip(c) });
  return c.json({ settings: after });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/categories", requirePermission("talent.view"), async (c) => {
  const rows = (await db.execute({ sql: "SELECT * FROM talent_categories ORDER BY sort_order, name", args: [] })).rows;
  return c.json({ categories: rows });
});

const categoryFields = z.object({
  name: z.string().trim().min(2).max(80),
  segment: z.enum(["informal", "professional", "both"]),
  parentId: z.string().max(80).nullable(),
  icon: z.string().max(40).nullable(),
  sortOrder: z.number().int().min(0).max(100000),
  active: z.boolean(),
});

adminRoutes.post("/admin/categories", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = categoryFields.partial().required({ name: true }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const id = newId("tcat");
  await db.execute({
    sql: "INSERT INTO talent_categories (id, parent_id, name, segment, icon, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, d.parentId ?? null, d.name, d.segment ?? "both", d.icon ?? null, d.sortOrder ?? 0, d.active === false ? 0 : 1],
  });
  await logActivity({ actor: user, action: "talent.category.create", summary: `Added job category "${d.name}"`, entityType: "talent_category", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/categories/:id", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = categoryFields.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const res = await db.execute({
    sql: `UPDATE talent_categories SET name = COALESCE(?, name), segment = COALESCE(?, segment), icon = CASE WHEN ? = 1 THEN ? ELSE icon END,
            sort_order = COALESCE(?, sort_order), active = COALESCE(?, active) WHERE id = ?`,
    args: [d.name ?? null, d.segment ?? null, d.icon !== undefined ? 1 : 0, d.icon ?? null, d.sortOrder ?? null, d.active == null ? null : d.active ? 1 : 0, (c.req.param("id") as string)],
  });
  if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
  await logActivity({ actor: user, action: "talent.category.update", summary: `Updated job category ${(c.req.param("id") as string)}`, entityType: "talent_category", entityId: (c.req.param("id") as string), after: d, ip: ip(c) });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Fee rules, plans and Pro features: the monetization controls
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/fee-rules", requirePermission("talent.view"), async (c) => c.json({ rules: (await db.execute({ sql: "SELECT * FROM talent_fee_rules ORDER BY kind, job_type", args: [] })).rows, kinds: FEE_KINDS }));

const ruleSchema = z
  .object({
    kind: z.enum(FEE_KINDS as unknown as [string, ...string[]]),
    jobType: z.enum(["", "gig", "project", "hiring"]).default(""),
    model: z.enum(["free", "flat", "percent"]),
    flatUgx: z.number().int().min(0).max(100_000_000).default(0),
    percent: z.number().min(0).max(60).default(0),
    minUgx: z.number().int().min(0).max(100_000_000).default(0),
    maxUgx: z.number().int().min(0).max(100_000_000).default(0),
    freeFirstN: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(false),
    note: z.string().trim().max(200).default(""),
  })
  .superRefine((d, ctx) => {
    if (d.model === "flat" && d.flatUgx <= 0) ctx.addIssue({ code: "custom", path: ["flatUgx"], message: "A flat fee needs an amount." });
    if (d.model === "percent" && d.percent <= 0) ctx.addIssue({ code: "custom", path: ["percent"], message: "A percentage fee needs a percentage." });
    if (d.maxUgx > 0 && d.minUgx > d.maxUgx) ctx.addIssue({ code: "custom", path: ["minUgx"], message: "The minimum can't be more than the maximum." });
    if (d.jobType !== "" && ["worker_onboarding", "employer_onboarding", "contact_unlock"].includes(d.kind)) ctx.addIssue({ code: "custom", path: ["jobType"], message: "This fee applies to every kind of job." });
    if (d.jobType === "hiring" && d.kind.endsWith("_commission")) ctx.addIssue({ code: "custom", path: ["jobType"], message: "Commission applies to gigs and projects, which are paid through Peebee." });
  });

/** Create or replace the rule for a kind (and job type). */
adminRoutes.put("/admin/fee-rules", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = ruleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  const before = (await db.execute({ sql: "SELECT * FROM talent_fee_rules WHERE kind = ? AND job_type = ?", args: [d.kind, d.jobType] })).rows[0] as Row | undefined;
  const id = before ? String(before.id) : newId("tfr");
  await db.execute({
    sql: `INSERT INTO talent_fee_rules (id, kind, job_type, model, flat_ugx, percent, min_ugx, max_ugx, free_first_n, active, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(kind, job_type) DO UPDATE SET model = excluded.model, flat_ugx = excluded.flat_ugx, percent = excluded.percent, min_ugx = excluded.min_ugx,
            max_ugx = excluded.max_ugx, free_first_n = excluded.free_first_n, active = excluded.active, note = excluded.note, updated_at = datetime('now')`,
    args: [id, d.kind, d.jobType, d.model, d.flatUgx, d.percent, d.minUgx, d.maxUgx, d.freeFirstN, d.active ? 1 : 0, d.note],
  });
  await logActivity({ actor: user, action: "talent.fee_rule.save", summary: `${d.active ? "Set" : "Saved (off)"} fee: ${d.kind}${d.jobType ? ` / ${d.jobType}` : ""} → ${d.model}${d.model === "flat" ? ` UGX ${d.flatUgx}` : d.model === "percent" ? ` ${d.percent}%` : ""}`, entityType: "talent_fee_rule", entityId: id, before, after: d, ip: ip(c) });
  return c.json({ id });
});

adminRoutes.delete("/admin/fee-rules/:id", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const before = (await db.execute({ sql: "SELECT * FROM talent_fee_rules WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found" }, 404);
  await db.execute({ sql: "DELETE FROM talent_fee_rules WHERE id = ?", args: [before.id] });
  await logActivity({ actor: user, action: "talent.fee_rule.delete", summary: `Removed fee rule ${String(before.kind)}`, entityType: "talent_fee_rule", entityId: String(before.id), before, ip: ip(c) });
  return c.json({ ok: true });
});

adminRoutes.get("/admin/plans", requirePermission("talent.view"), async (c) => {
  const plans = (await db.execute({ sql: "SELECT * FROM talent_plans ORDER BY sort_order, name", args: [] })).rows as Row[];
  const subs = (await db.execute({ sql: "SELECT plan_id, COUNT(*) AS n FROM talent_subscriptions WHERE status IN ('trial', 'active') AND expires_at > datetime('now') AND plan_id IS NOT NULL GROUP BY plan_id", args: [] })).rows as Row[];
  const counts = new Map(subs.map((r) => [String(r.plan_id), num(r.n)]));
  return c.json({ plans: plans.map((p) => ({ ...p, features: parseList(p.features), waived_kinds: parseList(p.waived_kinds), subscribers: counts.get(String(p.id)) ?? 0 })) });
});

const planSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{3,40}$/, "Use lowercase letters, numbers and underscores."),
  audience: z.enum(["worker", "employer"]),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  priceUgx: z.number().int().min(0).max(100_000_000),
  periodDays: z.number().int().min(1).max(366).default(30),
  trialDays: z.number().int().min(0).max(365).default(0),
  features: z.array(z.string().max(60)).max(30).default([]),
  waivedKinds: z.array(z.enum(FEE_KINDS as unknown as [string, ...string[]])).max(20).default([]),
  workerCommissionPercent: z.number().min(0).max(60).nullable().default(null),
  employerCommissionPercent: z.number().min(0).max(60).nullable().default(null),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});

adminRoutes.post("/admin/plans", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = planSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  if ((await db.execute({ sql: "SELECT 1 FROM talent_plans WHERE code = ?", args: [d.code] })).rows.length) return c.json({ error: "code_taken", message: "That plan code is already used." }, 409);
  const id = newId("tpl");
  await db.execute({
    sql: `INSERT INTO talent_plans (id, code, audience, name, description, price_ugx, period_days, trial_days, features, waived_kinds, worker_commission_percent, employer_commission_percent, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, d.code, d.audience, d.name, d.description, d.priceUgx, d.periodDays, d.trialDays, JSON.stringify(d.features), JSON.stringify(d.waivedKinds), d.workerCommissionPercent, d.employerCommissionPercent, d.active ? 1 : 0, d.sortOrder],
  });
  await logActivity({ actor: user, action: "talent.plan.create", summary: `Created plan "${d.name}" (UGX ${d.priceUgx}/${d.periodDays} days)`, entityType: "talent_plan", entityId: id, after: d, ip: ip(c) });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/plans/:id", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = planSchema.omit({ code: true, audience: true }).partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const before = (await db.execute({ sql: "SELECT * FROM talent_plans WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!before) return c.json({ error: "not_found" }, 404);
  await db.execute({
    sql: `UPDATE talent_plans SET name = COALESCE(?, name), description = COALESCE(?, description), price_ugx = COALESCE(?, price_ugx), period_days = COALESCE(?, period_days),
            trial_days = COALESCE(?, trial_days), features = COALESCE(?, features), waived_kinds = COALESCE(?, waived_kinds),
            worker_commission_percent = CASE WHEN ? = 1 THEN ? ELSE worker_commission_percent END, employer_commission_percent = CASE WHEN ? = 1 THEN ? ELSE employer_commission_percent END,
            active = COALESCE(?, active), sort_order = COALESCE(?, sort_order), updated_at = datetime('now') WHERE id = ?`,
    args: [
      d.name ?? null, d.description ?? null, d.priceUgx ?? null, d.periodDays ?? null, d.trialDays ?? null, d.features ? JSON.stringify(d.features) : null, d.waivedKinds ? JSON.stringify(d.waivedKinds) : null,
      d.workerCommissionPercent !== undefined ? 1 : 0, d.workerCommissionPercent ?? null, d.employerCommissionPercent !== undefined ? 1 : 0, d.employerCommissionPercent ?? null,
      d.active == null ? null : d.active ? 1 : 0, d.sortOrder ?? null, before.id,
    ],
  });
  await logActivity({ actor: user, action: "talent.plan.update", summary: `Updated plan "${String(before.name)}"`, entityType: "talent_plan", entityId: String(before.id), before, after: d, ip: ip(c) });
  return c.json({ ok: true });
});

adminRoutes.get("/admin/features", requirePermission("talent.view"), async (c) => c.json({ features: (await db.execute({ sql: "SELECT * FROM talent_features ORDER BY sort_order, key", args: [] })).rows }));

/** Mark a feature as Pro (needs a plan or a trial) or open to everyone. */
adminRoutes.patch("/admin/features/:key", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ pro: z.boolean().optional(), label: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(200).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const res = await db.execute({
    sql: "UPDATE talent_features SET pro = COALESCE(?, pro), label = COALESCE(?, label), description = COALESCE(?, description) WHERE key = ?",
    args: [d.pro == null ? null : d.pro ? 1 : 0, d.label ?? null, d.description ?? null, (c.req.param("key") as string)],
  });
  if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
  await logActivity({ actor: user, action: "talent.feature.update", summary: `${d.pro === true ? "Made Pro" : d.pro === false ? "Opened to everyone" : "Updated"}: ${(c.req.param("key") as string)}`, entityType: "talent_feature", entityId: (c.req.param("key") as string), after: d, ip: ip(c) });
  return c.json({ ok: true });
});

adminRoutes.get("/admin/charges", requirePermission("talent.view"), async (c) => {
  const status = c.req.query("status");
  const kind = c.req.query("kind");
  const where: string[] = [];
  const args: unknown[] = [];
  if (status) { where.push("c.status = ?"); args.push(status); }
  if (kind) { where.push("c.kind = ?"); args.push(kind); }
  const rows = (
    await db.execute({
      sql: `SELECT c.*, u.name AS user_name FROM talent_charges c JOIN users u ON u.id = c.user_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY c.created_at DESC LIMIT 200`,
      args: args as never,
    })
  ).rows;
  return c.json({ charges: rows });
});

// ---------------------------------------------------------------------------
// Prohibited work
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/prohibited", requirePermission("talent.view"), async (c) => c.json({ terms: (await db.execute({ sql: "SELECT * FROM talent_prohibited_terms ORDER BY category, term", args: [] })).rows }));

adminRoutes.post("/admin/prohibited", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ term: z.string().trim().min(3).max(60), category: z.string().trim().min(2).max(40).default("illegal"), action: z.enum(["block", "review"]).default("block") }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: "Enter a word or phrase of at least 3 letters." }, 400);
  const id = newId("tpt");
  const res = await db.execute({ sql: "INSERT OR IGNORE INTO talent_prohibited_terms (id, term, category, action) VALUES (?, ?, ?, ?)", args: [id, parsed.data.term.toLowerCase(), parsed.data.category, parsed.data.action] });
  if (!res.rowsAffected) return c.json({ error: "exists", message: "That term is already on the list." }, 409);
  resetModerationCache();
  await logActivity({ actor: user, action: "talent.prohibited.add", summary: `Added prohibited term (${parsed.data.action}) in ${parsed.data.category}`, entityType: "talent_prohibited_term", entityId: id, ip: ip(c) });
  return c.json({ id }, 201);
});

adminRoutes.patch("/admin/prohibited/:id", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ active: z.boolean().optional(), action: z.enum(["block", "review"]).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const res = await db.execute({ sql: "UPDATE talent_prohibited_terms SET active = COALESCE(?, active), action = COALESCE(?, action) WHERE id = ?", args: [parsed.data.active == null ? null : parsed.data.active ? 1 : 0, parsed.data.action ?? null, (c.req.param("id") as string)] });
  if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
  resetModerationCache();
  await logActivity({ actor: user, action: "talent.prohibited.update", summary: `Updated prohibited term ${(c.req.param("id") as string)}`, entityType: "talent_prohibited_term", entityId: (c.req.param("id") as string), after: parsed.data, ip: ip(c) });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/workers", requirePermission("talent.view"), async (c) => {
  const status = c.req.query("status");
  const q = c.req.query("q");
  const where: string[] = [];
  const args: unknown[] = [];
  if (status) { where.push("p.status = ?"); args.push(status); }
  if (q) { where.push("(u.name LIKE ? OR u.phone LIKE ? OR p.headline LIKE ?)"); const like = `%${q}%`; args.push(like, like, like); }
  const rows = (
    await db.execute({
      sql: `SELECT p.*, u.name, u.phone, u.role FROM talent_profiles p JOIN users u ON u.id = p.user_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC LIMIT 200`,
      args: args as never,
    })
  ).rows as Row[];
  return c.json({
    workers: rows.map((p) => ({
      userId: String(p.user_id), name: String(p.name), phone: String(p.phone), isRider: p.role === "rider", headline: String(p.headline), area: p.area ? String(p.area) : null, status: String(p.status), statusNote: p.status_note ? String(p.status_note) : null,
      activated: Boolean(p.activated_at), idVerified: Number(p.id_verified) === 1, rating: ratingOf(p.rating_sum, p.rating_count), ratingCount: num(p.rating_count), jobsCompleted: num(p.jobs_completed), createdAt: String(p.created_at),
    })),
  });
});

const workerActions = {
  approve: { status: "approved", verb: "approved" },
  reject: { status: "rejected", verb: "rejected" },
  suspend: { status: "suspended", verb: "suspended" },
  reinstate: { status: "approved", verb: "reinstated" },
} as const;

for (const [action, spec] of Object.entries(workerActions)) {
  adminRoutes.post(`/admin/workers/:id/${action}`, requirePermission("talent.manage"), async (c) => {
    const user = c.get("user");
    const note = z.object({ note: z.string().trim().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
    const id = (c.req.param("id") as string);
    const res = await db.execute({ sql: "UPDATE talent_profiles SET status = ?, status_note = ?, updated_at = datetime('now') WHERE user_id = ?", args: [spec.status, note.success ? note.data.note ?? null : null, id] });
    if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
    await db.execute({ sql: "UPDATE talent_reports SET status = 'actioned', resolved_by = ?, resolved_at = datetime('now') WHERE target_type = 'profile' AND target_id = ? AND source = 'screening' AND status = 'open'", args: [user.sub, id] });
    await logActivity({ actor: user, action: `talent.worker.${action}`, summary: `Worker profile ${spec.verb}`, entityType: "talent_profile", entityId: id, after: { status: spec.status }, ip: ip(c) });
    tell(id, `Your Jobs profile was ${spec.verb}`, note.success && note.data.note ? note.data.note : spec.status === "approved" ? "You can now apply for work and appear in search." : "Open Jobs for details.", "/services/hire");
    return c.json({ ok: true });
  });
}

adminRoutes.post("/admin/workers/:id/verify-id", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ verified: z.boolean().default(true) }).safeParse(await c.req.json().catch(() => ({})));
  const verified = parsed.success ? parsed.data.verified : true;
  const res = await db.execute({ sql: "UPDATE talent_profiles SET id_verified = ?, updated_at = datetime('now') WHERE user_id = ?", args: [verified ? 1 : 0, (c.req.param("id") as string)] });
  if (!res.rowsAffected) return c.json({ error: "not_found" }, 404);
  await logActivity({ actor: user, action: "talent.worker.verify_id", summary: `Worker ID ${verified ? "verified" : "unverified"}`, entityType: "talent_profile", entityId: (c.req.param("id") as string), ip: ip(c) });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/jobs", requirePermission("talent.view"), async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const where: string[] = [];
  const args: unknown[] = [];
  if (status) { where.push("j.status = ?"); args.push(status); }
  if (type) { where.push("j.type = ?"); args.push(type); }
  const rows = (
    await db.execute({
      sql: `SELECT j.*, u.name AS employer_name, u.phone AS employer_phone, cat.name AS category_name FROM talent_jobs j JOIN users u ON u.id = j.employer_id LEFT JOIN talent_categories cat ON cat.id = j.category_id
            ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY CASE j.status WHEN 'pending_review' THEN 0 ELSE 1 END, j.created_at DESC LIMIT 200`,
      args: args as never,
    })
  ).rows as Row[];
  return c.json({
    jobs: rows.map((j) => ({
      id: String(j.id), type: String(j.type), title: String(j.title), description: String(j.description), status: String(j.status), category: j.category_name ? String(j.category_name) : null,
      employer: { id: String(j.employer_id), name: String(j.employer_name), phone: String(j.employer_phone) }, area: j.area ? String(j.area) : null, budgetMaxUgx: num(j.budget_max_ugx),
      paymentMode: String(j.payment_mode), moderationState: String(j.moderation_state), applicationCount: num(j.application_count), createdAt: String(j.created_at),
    })),
  });
});

adminRoutes.post("/admin/jobs/:id/approve", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const j = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!j) return c.json({ error: "not_found" }, 404);
  const res = await db.execute({
    sql: "UPDATE talent_jobs SET status = 'open', moderation_state = 'clear', published_at = datetime('now'), expires_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending_review'",
    args: [inDays(s.jobExpiryDays), j.id],
  });
  if (!res.rowsAffected) return c.json({ error: "not_pending", message: "This job isn't waiting for review." }, 409);
  await db.execute({ sql: "UPDATE talent_reports SET status = 'dismissed', resolution = 'approved', resolved_by = ?, resolved_at = datetime('now') WHERE target_type = 'job' AND target_id = ? AND status = 'open'", args: [user.sub, j.id] });
  await logActivity({ actor: user, action: "talent.job.approve", summary: `Approved job "${String(j.title)}"`, entityType: "talent_job", entityId: String(j.id), ip: ip(c) });
  tell(String(j.employer_id), "Your job is live", `"${String(j.title)}" was approved.`, `/services/hire/${j.id}`);
  const fresh = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [j.id] })).rows[0] as Row;
  void alertMatchingWorkers(fresh, s);
  return c.json({ ok: true });
});

/** Take a job down. Any running contracts are left alone: those go through dispute or cancel. */
adminRoutes.post("/admin/jobs/:id/reject", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Say why." }, 400);
  const j = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!j) return c.json({ error: "not_found" }, 404);
  const res = await db.execute({ sql: "UPDATE talent_jobs SET status = 'rejected', moderation_state = 'blocked', moderation_note = ?, closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('open', 'pending_review')", args: [parsed.data.reason, j.id] });
  if (!res.rowsAffected) return c.json({ error: "not_rejectable", message: "This job can't be taken down now." }, 409);
  await db.execute({ sql: "UPDATE talent_applications SET status = 'rejected', updated_at = datetime('now') WHERE job_id = ? AND status IN ('applied', 'shortlisted')", args: [j.id] });
  await db.execute({ sql: "UPDATE talent_reports SET status = 'actioned', resolution = ?, resolved_by = ?, resolved_at = datetime('now') WHERE target_type = 'job' AND target_id = ? AND status = 'open'", args: [parsed.data.reason, user.sub, j.id] });
  await logActivity({ actor: user, action: "talent.job.reject", summary: `Took down job "${String(j.title)}": ${parsed.data.reason}`, entityType: "talent_job", entityId: String(j.id), ip: ip(c) });
  tell(String(j.employer_id), "Your job was removed", parsed.data.reason, `/services/hire/${j.id}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/reports", requirePermission("talent.view"), async (c) => {
  const status = c.req.query("status") ?? "open";
  const rows = (
    await db.execute({
      sql: `SELECT r.*, u.name AS reporter_name FROM talent_reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
      args: [status],
    })
  ).rows as Row[];
  return c.json({
    reports: rows.map((r) => ({
      id: String(r.id), targetType: String(r.target_type), targetId: String(r.target_id), reason: String(r.reason), source: String(r.source), status: String(r.status),
      reporter: r.reporter_name ? String(r.reporter_name) : null, createdAt: String(r.created_at),
    })),
  });
});

adminRoutes.post("/admin/reports/:id/resolve", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z.object({ action: z.enum(["dismiss", "take_down"]), note: z.string().trim().max(300).default("") }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const r = (await db.execute({ sql: "SELECT * FROM talent_reports WHERE id = ? AND status = 'open'", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!r) return c.json({ error: "not_found" }, 404);
  if (parsed.data.action === "take_down") {
    if (r.target_type === "job") await db.execute({ sql: "UPDATE talent_jobs SET status = 'rejected', moderation_state = 'blocked', moderation_note = ?, closed_at = datetime('now') WHERE id = ? AND status IN ('open', 'pending_review')", args: [parsed.data.note || "Removed after a report", r.target_id] });
    else if (r.target_type === "profile" || r.target_type === "user") await db.execute({ sql: "UPDATE talent_profiles SET status = 'suspended', status_note = ? WHERE user_id = ?", args: [parsed.data.note || "Suspended after a report", r.target_id] });
  }
  await db.execute({ sql: "UPDATE talent_reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?", args: [parsed.data.action === "dismiss" ? "dismissed" : "actioned", parsed.data.note, user.sub, r.id] });
  await logActivity({ actor: user, action: `talent.report.${parsed.data.action}`, summary: `Report on ${String(r.target_type)} ${parsed.data.action === "dismiss" ? "dismissed" : "actioned"}`, entityType: "talent_report", entityId: String(r.id), ip: ip(c) });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

adminRoutes.get("/admin/disputes", requirePermission("talent.view"), async (c) => {
  const rows = (
    await db.execute({
      sql: `SELECT ct.*, ue.name AS employer_name, uw.name AS worker_name FROM talent_contracts ct JOIN users ue ON ue.id = ct.employer_id JOIN users uw ON uw.id = ct.worker_id
            WHERE ct.status = 'disputed' ORDER BY ct.disputed_at DESC LIMIT 100`,
      args: [],
    })
  ).rows as Row[];
  return c.json({
    disputes: rows.map((r) => ({
      contractId: String(r.id), title: String(r.title), priceUgx: num(r.price_ugx), heldUgx: num(r.held_ugx), paymentMode: String(r.payment_mode), employer: String(r.employer_name), worker: String(r.worker_name),
      reason: r.dispute_reason ? String(r.dispute_reason) : "", raisedBy: String(r.disputed_by) === String(r.worker_id) ? "worker" : "employer", raisedAt: r.disputed_at ? String(r.disputed_at) : null,
    })),
  });
});

adminRoutes.get("/admin/contracts/:id", requirePermission("talent.view"), async (c) => {
  const ct = (await db.execute({ sql: "SELECT * FROM talent_contracts WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!ct) return c.json({ error: "not_found" }, 404);
  const [milestones, events, messages] = await Promise.all([
    db.execute({ sql: "SELECT * FROM talent_milestones WHERE contract_id = ? ORDER BY position", args: [ct.id] }),
    db.execute({ sql: "SELECT action, actor_kind, detail, created_at FROM talent_events WHERE contract_id = ? ORDER BY created_at, rowid", args: [ct.id] }),
    db.execute({ sql: "SELECT sender_id, body, created_at FROM talent_messages WHERE application_id = ? ORDER BY created_at, rowid LIMIT 200", args: [ct.application_id] }),
  ]);
  return c.json({ contract: ct, milestones: milestones.rows, events: events.rows, messages: messages.rows });
});

adminRoutes.post("/admin/contracts/:id/resolve", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const parsed = z
    .discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("release"), note: z.string().trim().max(500).default("") }),
      z.object({ outcome: z.literal("refund"), note: z.string().trim().max(500).default("") }),
      z.object({ outcome: z.literal("split"), refundUgx: z.number().int().min(1), note: z.string().trim().max(500).default("") }),
    ])
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const ct = (await db.execute({ sql: "SELECT * FROM talent_contracts WHERE id = ?", args: [(c.req.param("id") as string)] })).rows[0] as Row | undefined;
  if (!ct) return c.json({ error: "not_found" }, 404);
  const d = parsed.data;
  const outcome = d.outcome === "split" ? { outcome: "split" as const, refundUgx: d.refundUgx } : { outcome: d.outcome };
  const result = await resolveDispute(ct, outcome, user.sub, d.note);
  if (!result.ok) return c.json({ error: "cannot_resolve", message: result.message }, 409);
  await logActivity({ actor: user, action: "talent.dispute.resolve", summary: `Resolved dispute on "${String(ct.title)}": ${d.outcome}${d.outcome === "split" ? ` (refund UGX ${d.refundUgx})` : ""}`, entityType: "talent_contract", entityId: String(ct.id), after: d, ip: ip(c) });
  for (const id of [String(ct.employer_id), String(ct.worker_id)]) tell(id, "Problem resolved", `Peebee settled "${String(ct.title)}".`, `/services/hire/contracts/${ct.id}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sample data (sandbox only)
// ---------------------------------------------------------------------------

adminRoutes.post("/admin/sandbox/seed", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const result = await seedSandboxDemo();
  if (!result.ok) return c.json({ error: "not_sandbox", message: result.message }, 409);
  await logActivity({ actor: user, action: "talent.sandbox.seed", summary: `Added sandbox sample data: ${result.workers} workers, ${result.jobs} jobs`, entityType: "talent_sandbox", ip: ip(c) });
  return c.json(result);
});

adminRoutes.post("/admin/sandbox/clear", requirePermission("talent.manage"), async (c) => {
  const user = c.get("user");
  const removed = await clearSandboxDemo();
  await logActivity({ actor: user, action: "talent.sandbox.clear", summary: `Removed sandbox sample data (${removed} sample accounts)`, entityType: "talent_sandbox", ip: ip(c) });
  return c.json({ ok: true, removed });
});
