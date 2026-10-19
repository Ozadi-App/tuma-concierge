import { Hono } from "hono";
import { z } from "zod";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { getPlatformEnvironment, type PlatformEnvironment } from "../lib/settings.js";
import { blockedMessage, queueForReview, screenText } from "./moderation.js";
import { charge, contractFees, allocate, hasFeature, hasProPerk, overDueLimit, proRequired, startTrial } from "./monetization.js";
import { holdFromEmployer, inDays, logEvent, parseList, ratingOf, tell, toDb, ugx, type Row } from "./service.js";
import { getTalentSettings, type TalentSettings } from "./settings.js";
import { workerView } from "./profiles.js";

export const jobRoutes = new Hono();

const firstName = (n: unknown) => String(n ?? "").split(" ")[0];

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function employerName(r: Row) {
  return r.business_name ? String(r.business_name) : firstName(r.employer_name);
}

export function jobView(j: Row, extra: Record<string, unknown> = {}) {
  return {
    id: String(j.id),
    type: String(j.type),
    title: String(j.title),
    description: String(j.description),
    status: String(j.status),
    category: j.category_name ? { id: String(j.category_id), name: String(j.category_name) } : j.category_id ? { id: String(j.category_id), name: "" } : null,
    area: j.area ? String(j.area) : null,
    address: j.address ? String(j.address) : null,
    lat: j.lat == null ? null : Number(j.lat),
    lng: j.lng == null ? null : Number(j.lng),
    remote: Number(j.remote) === 1,
    skills: parseList(j.skills),
    startsAt: j.starts_at ? String(j.starts_at) : null,
    deadline: j.deadline ? String(j.deadline) : null,
    budgetMinUgx: Number(j.budget_min_ugx),
    budgetMaxUgx: Number(j.budget_max_ugx),
    paymentMode: String(j.payment_mode),
    workersNeeded: Number(j.workers_needed),
    employmentType: j.employment_type ? String(j.employment_type) : null,
    boosted: Boolean(j.boosted_until && String(j.boosted_until) > toDb()),
    applicationCount: Number(j.application_count),
    expiresAt: j.expires_at ? String(j.expires_at) : null,
    createdAt: String(j.created_at),
    employer: {
      id: String(j.employer_id),
      name: employerName(j),
      verified: Number(j.employer_verified ?? 0) === 1,
      rating: ratingOf(j.employer_rating_sum, j.employer_rating_count),
      ratingCount: Number(j.employer_rating_count ?? 0),
    },
    ...extra,
  };
}

const JOB_SELECT = `SELECT j.*, c.name AS category_name, u.name AS employer_name, e.business_name, e.verified AS employer_verified,
                           e.rating_sum AS employer_rating_sum, e.rating_count AS employer_rating_count
                    FROM talent_jobs j
                    LEFT JOIN talent_categories c ON c.id = j.category_id
                    JOIN users u ON u.id = j.employer_id
                    LEFT JOIN talent_employers e ON e.user_id = j.employer_id`;

async function loadJob(id: string): Promise<Row | undefined> {
  return (await db.execute({ sql: `${JOB_SELECT} WHERE j.id = ?`, args: [id] })).rows[0] as Row | undefined;
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

const postSchema = z.object({
  type: z.enum(["gig", "project", "hiring"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  categoryId: z.string().min(1).max(80),
  area: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  remote: z.boolean().default(false),
  skills: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  startsAt: z.string().max(40).optional(),
  deadline: z.string().max(40).optional(),
  budgetMinUgx: z.number().int().min(0).max(10_000_000_000).default(0),
  budgetMaxUgx: z.number().int().min(0).max(10_000_000_000).default(0),
  paymentMode: z.enum(["escrow", "direct"]).optional(),
  workersNeeded: z.number().int().min(1).max(500).default(1),
  employmentType: z.enum(["full_time", "part_time", "contract", "casual", "internship"]).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
  /** The employer confirms the work is lawful. Required. */
  acceptRules: z.literal(true, { errorMap: () => ({ message: "Confirm that this work is lawful." }) }),
});

const isoOrNull = (v?: string) => {
  if (!v) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? "invalid" : toDb(t);
};

jobRoutes.post("/jobs", async (c) => {
  const user = c.get("user");
  if (user.role === "admin") return c.json({ error: "forbidden", message: "Staff accounts can't post jobs." }, 403);
  const parsed = postSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  const s = await getTalentSettings();
  const env = await getPlatformEnvironment();

  if (!s.jobTypes.includes(d.type)) return c.json({ error: "type_closed", message: "That kind of job can't be posted right now." }, 403);
  if (d.idempotencyKey) {
    const dup = (await db.execute({ sql: "SELECT id FROM talent_jobs WHERE employer_id = ? AND idempotency_key = ?", args: [user.sub, d.idempotencyKey] })).rows[0] as Row | undefined;
    if (dup) return c.json({ job: jobView((await loadJob(String(dup.id)))!), repeated: true });
  }
  if (!(await consume(`talent-post:${user.sub}`, s.postsPerHour, 3600)).allowed) return c.json({ error: "too_many_requests", message: "You've posted several jobs already. Try again later." }, 429);
  if (await overDueLimit(user.sub, s)) return c.json({ error: "fees_owed", message: "Settle the fees you owe before posting new work." }, 403);

  const cat = (await db.execute({ sql: "SELECT id FROM talent_categories WHERE id = ? AND active = 1", args: [d.categoryId] })).rows[0];
  if (!cat) return c.json({ error: "unknown_category", message: "Choose a kind of work from the list." }, 400);
  if (!d.remote && !d.area) return c.json({ error: "location_required", message: "Say where the work is, or mark it as remote." }, 400);

  const startsAt = isoOrNull(d.startsAt);
  const deadline = isoOrNull(d.deadline);
  if (startsAt === "invalid" || deadline === "invalid") return c.json({ error: "invalid_date", message: "That date isn't valid." }, 400);

  // Money rules by kind of job.
  let budgetMin = d.budgetMinUgx;
  let budgetMax = d.budgetMaxUgx;
  let paymentMode: "escrow" | "direct" | "none" = "none";
  if (d.type === "hiring") {
    if (!d.employmentType) return c.json({ error: "employment_type_required", message: "Say whether the role is full time, part time, contract…" }, 400);
  } else {
    if (d.type === "gig") budgetMin = budgetMax;
    if (budgetMax <= 0 || budgetMin > budgetMax) return c.json({ error: "invalid_budget", message: "Enter what you'll pay." }, 400);
    if (budgetMax < s.minJobUgx || budgetMax > s.maxJobUgx) return c.json({ error: "budget_out_of_range", message: `A job must be between ${ugx(s.minJobUgx)} and ${ugx(s.maxJobUgx)}.` }, 400);
    paymentMode = d.paymentMode ?? s.defaultPaymentMode;
    if (!s.paymentModes.includes(paymentMode)) return c.json({ error: "payment_mode_unavailable", message: "That way of paying isn't available." }, 400);
  }
  if (budgetMax > s.maxJobUgx) return c.json({ error: "budget_out_of_range", message: `The most a post can offer is ${ugx(s.maxJobUgx)}.` }, 400);
  if (d.workersNeeded > s.maxWorkersPerJob) return c.json({ error: "too_many_workers", message: `You can ask for up to ${s.maxWorkersPerJob} people.` }, 400);

  const open = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_jobs WHERE employer_id = ? AND status IN ('open', 'pending_review', 'in_progress')", args: [user.sub] })).rows[0] as Row).n);
  if (open >= s.maxOpenJobs) return c.json({ error: "too_many_open_jobs", message: `You can have ${s.maxOpenJobs} jobs open at once. Close one first.` }, 409);

  const screen = await screenText(d.title, d.description, d.skills.join(" "), d.address);
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);

  // Employer record + onboarding (once). A first-time employer gets the platform trial.
  await db.execute({ sql: "INSERT OR IGNORE INTO talent_employers (user_id) VALUES (?)", args: [user.sub] });
  const onboarding = await charge({ userId: user.sub, audience: "employer", kind: "employer_onboarding", idempotencyKey: `onboard:employer:${user.sub}`, environment: env, settings: s });
  if (!onboarding.ok) return c.json({ error: onboarding.error, needed: onboarding.needed, message: onboarding.message }, 402);
  await db.execute({ sql: "UPDATE talent_employers SET activated_at = COALESCE(activated_at, datetime('now')) WHERE user_id = ?", args: [user.sub] });
  await startTrial(user.sub, "employer", env, s);

  const needsReview = s.jobReview || screen.state === "review";
  const id = newId("tjb");
  const status = needsReview ? "pending_review" : "open";
  await db.execute({
    sql: `INSERT INTO talent_jobs (id, employer_id, type, category_id, title, description, status, area, address, lat, lng, remote, skills, starts_at, deadline,
            budget_min_ugx, budget_max_ugx, payment_mode, workers_needed, employment_type, moderation_state, idempotency_key, expires_at, published_at, environment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, user.sub, d.type, d.categoryId, d.title, d.description, status, d.area ?? null, d.address ?? null, d.lat ?? null, d.lng ?? null, d.remote ? 1 : 0, JSON.stringify(d.skills),
      startsAt, deadline, budgetMin, budgetMax, paymentMode, d.workersNeeded, d.employmentType ?? null, screen.state === "review" ? "review" : "clear",
      d.idempotencyKey ?? null, inDays(s.jobExpiryDays), needsReview ? null : toDb(), env,
    ],
  });

  // The listing fee. If the wallet can't cover it, the job is removed again (nothing was charged).
  const fee = await charge({ userId: user.sub, audience: "employer", kind: "listing", jobType: d.type, base: budgetMax, jobId: id, idempotencyKey: `listing:${id}`, environment: env, settings: s });
  if (!fee.ok) {
    await db.execute({ sql: "DELETE FROM talent_jobs WHERE id = ?", args: [id] });
    return c.json({ error: fee.error, needed: fee.needed, message: fee.message }, 402);
  }
  await db.execute({ sql: "UPDATE talent_jobs SET listing_fee_ugx = ? WHERE id = ?", args: [fee.amount, id] });
  await db.execute({ sql: "UPDATE talent_employers SET jobs_posted = jobs_posted + 1 WHERE user_id = ?", args: [user.sub] });
  if (screen.state === "review") await queueForReview("job", id, screen);
  await logEvent({ jobId: id, actorId: user.sub, kind: "employer", action: "posted", detail: { type: d.type, status } });
  const job = (await loadJob(id))!;
  if (status === "open") void alertMatchingWorkers(job, s);
  return c.json({ job: jobView(job), charged: fee.amount, needsReview }, 201);
});

/** Tells nearby workers in the job's category about it. Best effort; honours the "job alerts" Pro feature. */
export async function alertMatchingWorkers(job: Row, s: TalentSettings) {
  try {
    const rows = (
      await db.execute({
        sql: `SELECT p.user_id, p.lat, p.lng, p.radius_km, p.remote FROM talent_profiles p
              JOIN talent_profile_categories pc ON pc.user_id = p.user_id AND pc.category_id = ?
              WHERE p.status = 'approved' AND p.activated_at IS NOT NULL AND p.visible = 1 AND p.availability = 'available' AND p.user_id != ? LIMIT 300`,
        args: [job.category_id, job.employer_id],
      })
    ).rows as Row[];
    let sent = 0;
    for (const p of rows) {
      if (sent >= 50) break;
      const near = Number(job.remote) === 1 || Number(p.remote) === 1 || job.lat == null || p.lat == null || haversineKm(Number(p.lat), Number(p.lng), Number(job.lat), Number(job.lng)) <= Math.max(Number(p.radius_km), s.searchRadiusKm);
      if (!near) continue;
      if (!(await hasFeature(String(p.user_id), "job_alerts"))) continue;
      tell(String(p.user_id), `New ${String(job.type)}: ${String(job.title)}`, String(job.area ?? "Remote"), `/services/jobs/${job.id}`, `talent-job-${job.id}`);
      sent += 1;
    }
  } catch (err) {
    console.error("[talent] job alerts failed:", err);
  }
}

// ---------------------------------------------------------------------------
// The job feed (workers browsing work)
// ---------------------------------------------------------------------------

const feedSchema = z.object({
  type: z.enum(["gig", "project", "hiring"]).optional(),
  category: z.string().max(80).optional(),
  segment: z.enum(["informal", "professional"]).optional(),
  q: z.string().trim().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().int().min(1).max(500).optional(),
  remote: z.enum(["1", "0"]).optional(),
  minBudget: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["newest", "budget", "nearest"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

jobRoutes.get("/jobs", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const parsed = feedSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "invalid_query", issues: parsed.error.issues }, 400);
  const q = parsed.data;
  const where = ["j.status = 'open'", "(j.expires_at IS NULL OR j.expires_at > datetime('now'))", "j.employer_id != ?", "u.status = 'active'", "j.moderation_state != 'blocked'"];
  const args: unknown[] = [user.sub];
  where.push(`j.type IN (${s.jobTypes.map(() => "?").join(", ") || "''"})`);
  args.push(...s.jobTypes);
  if (q.type) { where.push("j.type = ?"); args.push(q.type); }
  if (q.category) { where.push("j.category_id = ?"); args.push(q.category); }
  if (q.segment) { where.push("EXISTS (SELECT 1 FROM talent_categories tc WHERE tc.id = j.category_id AND tc.segment IN (?, 'both'))"); args.push(q.segment); }
  if (q.q) {
    const like = `%${q.q.replace(/[%_]/g, "")}%`;
    where.push("(j.title LIKE ? OR j.description LIKE ? OR j.skills LIKE ?)");
    args.push(like, like, like);
  }
  if (q.remote === "1") where.push("j.remote = 1");
  if (q.minBudget != null) { where.push("j.budget_max_ugx >= ?"); args.push(q.minBudget); }
  const rows = (await db.execute({ sql: `${JOB_SELECT} WHERE ${where.join(" AND ")} ORDER BY j.created_at DESC LIMIT 600`, args: args as never })).rows as Row[];

  const mineApplied = new Map(
    ((await db.execute({ sql: "SELECT job_id, status FROM talent_applications WHERE worker_id = ?", args: [user.sub] })).rows as Row[]).map((r) => [String(r.job_id), String(r.status)]),
  );
  const invited = new Set(((await db.execute({ sql: "SELECT job_id FROM talent_invites WHERE worker_id = ?", args: [user.sub] })).rows as Row[]).map((r) => String(r.job_id)));

  const radius = q.radiusKm ?? s.searchRadiusKm;
  const located = q.lat != null && q.lng != null;
  let list = rows.map((j) => ({ j, km: located && j.lat != null && j.lng != null ? haversineKm(q.lat!, q.lng!, Number(j.lat), Number(j.lng)) : null }));
  if (located) list = list.filter(({ j, km }) => Number(j.remote) === 1 || km === null || km <= radius);
  const boosted = (j: Row) => (j.boosted_until && String(j.boosted_until) > toDb() ? 1 : 0);
  list.sort((a, b) => {
    if (q.sort === "budget") return Number(b.j.budget_max_ugx) - Number(a.j.budget_max_ugx);
    if (q.sort === "nearest") return (a.km ?? 1e9) - (b.km ?? 1e9);
    return boosted(b.j) - boosted(a.j) || String(b.j.created_at).localeCompare(String(a.j.created_at));
  });
  const page = list.slice(q.offset, q.offset + q.limit);
  return c.json({
    total: list.length,
    jobs: page.map(({ j, km }) => jobView(j, { distanceKm: km == null ? null : Math.round(km * 10) / 10, myApplication: mineApplied.get(String(j.id)) ?? null, invited: invited.has(String(j.id)) })),
  });
});

// ---------------------------------------------------------------------------
// Job detail, my jobs
// ---------------------------------------------------------------------------

jobRoutes.get("/jobs/mine", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const rows = (await db.execute({ sql: `${JOB_SELECT} WHERE j.employer_id = ? ORDER BY j.created_at DESC LIMIT 200`, args: [user.sub] })).rows as Row[];
  const pending = new Map(
    ((await db.execute({ sql: "SELECT job_id, COUNT(*) AS n FROM talent_applications WHERE status IN ('applied', 'shortlisted') AND job_id IN (SELECT id FROM talent_jobs WHERE employer_id = ?) GROUP BY job_id", args: [user.sub] })).rows as Row[]).map((r) => [String(r.job_id), Number(r.n)]),
  );
  return c.json({ jobs: rows.map((j) => jobView(j, { pendingApplications: pending.get(String(j.id)) ?? 0 })) });
});

jobRoutes.get("/jobs/:id", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const j = await loadJob(c.req.param("id"));
  if (!j) return c.json({ error: "not_found", message: "That job isn't available." }, 404);
  const mine = String(j.employer_id) === user.sub;
  const myApp = (await db.execute({ sql: "SELECT * FROM talent_applications WHERE job_id = ? AND worker_id = ?", args: [j.id, user.sub] })).rows[0] as Row | undefined;
  const visible = mine || j.status === "open" || j.status === "filled" || j.status === "in_progress" || Boolean(myApp) || user.role === "admin";
  if (!visible || (!mine && !myApp && (j.status === "pending_review" || j.status === "rejected"))) return c.json({ error: "not_found", message: "That job isn't available." }, 404);

  const contract = myApp ? ((await db.execute({ sql: "SELECT id, status FROM talent_contracts WHERE application_id = ?", args: [myApp.id] })).rows[0] as Row | undefined) : undefined;
  const invited = (await db.execute({ sql: "SELECT 1 FROM talent_invites WHERE job_id = ? AND worker_id = ?", args: [j.id, user.sub] })).rows.length > 0;
  return c.json({
    job: jobView(j, {
      isMine: mine,
      invited,
      myApplication: myApp ? { id: String(myApp.id), status: String(myApp.status), bidUgx: Number(myApp.bid_ugx), message: String(myApp.message), contractId: contract ? String(contract.id) : null, contractStatus: contract ? String(contract.status) : null } : null,
      boostable: mine && j.status === "open",
      freeAccess: s.freeAccess,
    }),
  });
});

jobRoutes.patch("/jobs/:id", async (c) => {
  const user = c.get("user");
  const j = await loadJob(c.req.param("id"));
  if (!j || String(j.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  if (!["open", "pending_review"].includes(String(j.status))) return c.json({ error: "not_editable", message: "This job can't be edited now." }, 409);
  const parsed = z.object({ title: z.string().trim().min(3).max(120).optional(), description: z.string().trim().min(10).max(5000).optional(), deadline: z.string().max(40).optional(), skills: z.array(z.string().trim().min(1).max(40)).max(30).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const screen = await screenText(d.title ?? j.title, d.description ?? j.description, (d.skills ?? parseList(j.skills)).join(" "));
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);
  const deadline = isoOrNull(d.deadline);
  if (deadline === "invalid") return c.json({ error: "invalid_date" }, 400);
  await db.execute({
    sql: `UPDATE talent_jobs SET title = COALESCE(?, title), description = COALESCE(?, description), deadline = COALESCE(?, deadline), skills = COALESCE(?, skills),
            status = CASE WHEN ? = 'review' THEN 'pending_review' ELSE status END, updated_at = datetime('now') WHERE id = ?`,
    args: [d.title ?? null, d.description ?? null, deadline, d.skills ? JSON.stringify(d.skills) : null, screen.state, j.id],
  });
  if (screen.state === "review") await queueForReview("job", String(j.id), screen);
  return c.json({ job: jobView((await loadJob(String(j.id)))!) });
});

jobRoutes.post("/jobs/:id/close", async (c) => {
  const user = c.get("user");
  const j = await loadJob(c.req.param("id"));
  if (!j || String(j.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  const res = await db.execute({
    sql: `UPDATE talent_jobs SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('open', 'pending_review')`,
    args: [j.id],
  });
  if (!res.rowsAffected) return c.json({ error: "not_closable", message: "This job can't be closed now." }, 409);
  const rejected = (await db.execute({ sql: "SELECT worker_id FROM talent_applications WHERE job_id = ? AND status IN ('applied', 'shortlisted')", args: [j.id] })).rows as Row[];
  await db.execute({ sql: "UPDATE talent_applications SET status = 'rejected', updated_at = datetime('now') WHERE job_id = ? AND status IN ('applied', 'shortlisted')", args: [j.id] });
  for (const r of rejected) tell(String(r.worker_id), "Job closed", `"${String(j.title)}" is no longer open.`, `/services/jobs/${j.id}`);
  await logEvent({ jobId: String(j.id), actorId: user.sub, kind: "employer", action: "closed" });
  return c.json({ ok: true });
});

jobRoutes.post("/jobs/:id/boost", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const j = await loadJob(c.req.param("id"));
  if (!j || String(j.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  if (j.status !== "open") return c.json({ error: "not_open", message: "Only open jobs can be boosted." }, 409);
  const result = await charge({ userId: user.sub, audience: "employer", kind: "boost", jobType: String(j.type), base: Number(j.budget_max_ugx), jobId: String(j.id), idempotencyKey: `boost:job:${j.id}:${toDb().slice(0, 13)}`, environment: await getPlatformEnvironment(), settings: s });
  if (!result.ok) return c.json({ error: result.error, needed: result.needed, message: result.message }, 402);
  const from = j.boosted_until && String(j.boosted_until) > toDb() ? String(j.boosted_until) : toDb();
  const until = toDb(new Date(new Date(`${from.replace(" ", "T")}Z`).getTime() + s.boostDays * 86_400_000));
  await db.execute({ sql: "UPDATE talent_jobs SET boosted_until = ?, updated_at = datetime('now') WHERE id = ?", args: [until, j.id] });
  return c.json({ ok: true, boostedUntil: until, charged: result.amount });
});

jobRoutes.post("/jobs/:id/invite", async (c) => {
  const user = c.get("user");
  const j = await loadJob(c.req.param("id"));
  if (!j || String(j.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  if (j.status !== "open") return c.json({ error: "not_open", message: "Only open jobs can invite people." }, 409);
  const parsed = z.object({ workerId: z.string().min(1).max(80) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const w = (await db.execute({ sql: "SELECT user_id FROM talent_profiles WHERE user_id = ? AND status = 'approved' AND activated_at IS NOT NULL", args: [parsed.data.workerId] })).rows[0];
  if (!w || parsed.data.workerId === user.sub) return c.json({ error: "worker_not_found", message: "That worker isn't available." }, 404);
  if (!(await consume(`talent-invite:${user.sub}`, 30, 3600)).allowed) return c.json({ error: "rate_limited" }, 429);
  await db.execute({ sql: "INSERT OR IGNORE INTO talent_invites (job_id, worker_id) VALUES (?, ?)", args: [j.id, parsed.data.workerId] });
  tell(parsed.data.workerId, "You've been invited to apply", `${employerName(j)} invited you to "${String(j.title)}".`, `/services/jobs/${j.id}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

const applySchema = z.object({ message: z.string().trim().max(1500).default(""), bidUgx: z.number().int().min(0).max(10_000_000_000).default(0) });

jobRoutes.post("/jobs/:id/apply", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const env = await getPlatformEnvironment();
  const parsed = applySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const j = await loadJob(c.req.param("id"));
  if (!j || j.status !== "open" || (j.expires_at && String(j.expires_at) <= toDb())) return c.json({ error: "not_open", message: "This job isn't taking applications." }, 409);
  if (String(j.employer_id) === user.sub) return c.json({ error: "own_job", message: "You can't apply to your own job." }, 400);

  const profile = (await db.execute({ sql: "SELECT * FROM talent_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (!profile) return c.json({ error: "profile_required", message: "Create your worker profile to apply." }, 403);
  if (profile.status !== "approved" || !profile.activated_at) {
    return c.json({ error: "profile_not_live", message: profile.status === "pending" ? "Your profile is waiting for approval." : "Your profile isn't active." }, 403);
  }
  if (user.role === "rider" && !s.ridersCanWork) return c.json({ error: "riders_not_allowed", message: "Riders can't take other work right now." }, 403);
  if (await overDueLimit(user.sub, s)) return c.json({ error: "fees_owed", message: "Settle the fees you owe before taking new work." }, 403);

  const d = parsed.data;
  const type = String(j.type);
  let bid = d.bidUgx;
  if (type === "project" && (bid <= 0 || bid > s.maxJobUgx)) return c.json({ error: "bid_required", message: "Enter your price for this project." }, 400);
  if (type === "gig") bid = bid > 0 ? bid : Number(j.budget_max_ugx);
  if (type === "hiring") bid = 0;
  if (bid > 0 && bid > s.maxJobUgx) return c.json({ error: "bid_too_high" }, 400);

  const screen = await screenText(d.message);
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);

  const prior = (await db.execute({ sql: "SELECT * FROM talent_applications WHERE job_id = ? AND worker_id = ?", args: [j.id, user.sub] })).rows[0] as Row | undefined;
  if (prior && prior.status !== "withdrawn") return c.json({ error: "already_applied", message: "You've already applied to this job." }, 409);

  if (!(await hasProPerk(user.sub, "unlimited_applications"))) {
    const today = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_applications WHERE worker_id = ? AND created_at >= datetime('now', '-1 day')", args: [user.sub] })).rows[0] as Row).n);
    if (today >= s.applicationsPerDay) return c.json({ ...proRequired("unlimited_applications"), message: `You can send ${s.applicationsPerDay} applications a day. Upgrade for unlimited applications.` }, 402);
  }

  const fee = await charge({ userId: user.sub, audience: "worker", kind: "application", jobType: type, base: bid, jobId: String(j.id), idempotencyKey: `apply:${j.id}:${user.sub}`, environment: env, settings: s });
  if (!fee.ok) return c.json({ error: fee.error, needed: fee.needed, message: fee.message }, 402);

  const id = prior ? String(prior.id) : newId("tap");
  if (prior) {
    await db.execute({ sql: "UPDATE talent_applications SET status = 'applied', message = ?, bid_ugx = ?, updated_at = datetime('now') WHERE id = ?", args: [d.message, bid, id] });
  } else {
    await db.execute({ sql: "INSERT INTO talent_applications (id, job_id, worker_id, message, bid_ugx) VALUES (?, ?, ?, ?, ?)", args: [id, j.id, user.sub, d.message, bid] });
  }
  await db.execute({ sql: "UPDATE talent_jobs SET application_count = application_count + 1, updated_at = datetime('now') WHERE id = ?", args: [j.id] });
  tell(String(j.employer_id), "New application", `${firstName(user.name)} applied to "${String(j.title)}".`, `/services/jobs/${j.id}`, `talent-app-${id}`);
  await logEvent({ jobId: String(j.id), actorId: user.sub, kind: "worker", action: "applied", detail: { bid } });
  return c.json({ application: { id, status: "applied", bidUgx: bid }, charged: fee.amount }, 201);
});

jobRoutes.get("/applications/mine", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const rows = (
    await db.execute({
      sql: `SELECT a.*, j.title, j.type, j.status AS job_status, j.area, j.budget_max_ugx, ct.id AS contract_id, ct.status AS contract_status
            FROM talent_applications a JOIN talent_jobs j ON j.id = a.job_id LEFT JOIN talent_contracts ct ON ct.application_id = a.id
            WHERE a.worker_id = ? ORDER BY a.updated_at DESC LIMIT 200`,
      args: [user.sub],
    })
  ).rows as Row[];
  return c.json({
    applications: rows.map((r) => ({
      id: String(r.id), jobId: String(r.job_id), jobTitle: String(r.title), jobType: String(r.type), jobStatus: String(r.job_status), area: r.area ? String(r.area) : null,
      status: String(r.status), bidUgx: Number(r.bid_ugx), budgetMaxUgx: Number(r.budget_max_ugx), message: String(r.message), createdAt: String(r.created_at),
      contractId: r.contract_id ? String(r.contract_id) : null, contractStatus: r.contract_status ? String(r.contract_status) : null,
    })),
  });
});

jobRoutes.post("/applications/:id/withdraw", async (c) => {
  const user = c.get("user");
  const res = await db.execute({
    sql: "UPDATE talent_applications SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ? AND worker_id = ? AND status IN ('applied', 'shortlisted')",
    args: [c.req.param("id"), user.sub],
  });
  if (!res.rowsAffected) return c.json({ error: "not_withdrawable", message: "This application can't be withdrawn now." }, 409);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// The employer's side: applicants
// ---------------------------------------------------------------------------

async function ownedApplication(appId: string, userId: string): Promise<{ app: Row; job: Row } | null> {
  const app = (await db.execute({ sql: "SELECT * FROM talent_applications WHERE id = ?", args: [appId] })).rows[0] as Row | undefined;
  if (!app) return null;
  const job = await loadJob(String(app.job_id));
  if (!job || String(job.employer_id) !== userId) return null;
  return { app, job };
}

jobRoutes.get("/jobs/:id/applications", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const j = await loadJob(c.req.param("id"));
  if (!j || String(j.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  const rows = (
    await db.execute({
      sql: `SELECT a.*, p.*, a.id AS app_id, a.status AS app_status, a.created_at AS applied_at, u.name, u.role, u.phone,
                   ct.id AS contract_id, ct.status AS contract_status
            FROM talent_applications a JOIN users u ON u.id = a.worker_id LEFT JOIN talent_profiles p ON p.user_id = a.worker_id
            LEFT JOIN talent_contracts ct ON ct.application_id = a.id
            WHERE a.job_id = ? AND a.status != 'withdrawn'
            ORDER BY CASE a.status WHEN 'accepted' THEN 0 WHEN 'hired' THEN 0 WHEN 'shortlisted' THEN 1 WHEN 'applied' THEN 2 ELSE 3 END, a.created_at DESC`,
      args: [j.id],
    })
  ).rows as Row[];
  const unlocked = new Set(((await db.execute({ sql: "SELECT worker_id FROM talent_contact_unlocks WHERE employer_id = ?", args: [user.sub] })).rows as Row[]).map((r) => String(r.worker_id)));
  const applicants = rows.map((r) => {
    const open = ["accepted", "hired"].includes(String(r.app_status)) || unlocked.has(String(r.worker_id)) || Number(r.contact_unlocked) === 1 || !s.hideContacts;
    return {
      id: String(r.app_id), status: String(r.app_status), message: String(r.message), bidUgx: Number(r.bid_ugx), appliedAt: String(r.applied_at),
      contractId: r.contract_id ? String(r.contract_id) : null, contractStatus: r.contract_status ? String(r.contract_status) : null,
      worker: workerView({ ...r, user_id: r.worker_id }, { phone: open ? String(r.phone) : null }),
      phoneLocked: !open,
    };
  });
  return c.json({ applicants });
});

jobRoutes.post("/applications/:id/shortlist", async (c) => {
  const user = c.get("user");
  const owned = await ownedApplication(c.req.param("id"), user.sub);
  if (!owned) return c.json({ error: "not_found" }, 404);
  if (owned.job.type === "hiring" && !(await hasFeature(user.sub, "hiring_pipeline"))) return c.json(proRequired("hiring_pipeline"), 402);
  const res = await db.execute({ sql: "UPDATE talent_applications SET status = 'shortlisted', updated_at = datetime('now') WHERE id = ? AND status = 'applied'", args: [owned.app.id] });
  if (!res.rowsAffected) return c.json({ error: "not_shortlistable", message: "This applicant can't be shortlisted." }, 409);
  tell(String(owned.app.worker_id), "You've been shortlisted", `For "${String(owned.job.title)}".`, `/services/jobs/${owned.job.id}`);
  return c.json({ ok: true });
});

jobRoutes.post("/applications/:id/reject", async (c) => {
  const user = c.get("user");
  const owned = await ownedApplication(c.req.param("id"), user.sub);
  if (!owned) return c.json({ error: "not_found" }, 404);
  const res = await db.execute({ sql: "UPDATE talent_applications SET status = 'rejected', updated_at = datetime('now') WHERE id = ? AND status IN ('applied', 'shortlisted')", args: [owned.app.id] });
  if (!res.rowsAffected) return c.json({ error: "not_rejectable", message: "This applicant can't be declined now." }, 409);
  tell(String(owned.app.worker_id), "Application update", `"${String(owned.job.title)}" went with someone else.`, `/services/jobs/${owned.job.id}`);
  return c.json({ ok: true });
});

/** Hiring posts: mark a candidate as hired. Charges the placement fee, if admin has one. */
jobRoutes.post("/applications/:id/hire", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const owned = await ownedApplication(c.req.param("id"), user.sub);
  if (!owned) return c.json({ error: "not_found" }, 404);
  if (owned.job.type !== "hiring") return c.json({ error: "not_hiring", message: "Use 'accept' for gigs and projects." }, 400);
  if (owned.job.status !== "open") return c.json({ error: "not_open", message: "This post is no longer open." }, 409);
  if (!["applied", "shortlisted"].includes(String(owned.app.status))) return c.json({ error: "not_hireable", message: "This candidate can't be hired now." }, 409);
  const fee = await charge({ userId: user.sub, audience: "employer", kind: "hire_fee", jobType: "hiring", base: Number(owned.job.budget_max_ugx), jobId: String(owned.job.id), idempotencyKey: `hire:${owned.app.id}`, environment: await getPlatformEnvironment(), settings: s });
  if (!fee.ok) return c.json({ error: fee.error, needed: fee.needed, message: fee.message }, 402);
  const stmts: DbStatement[] = [
    { sql: "UPDATE talent_applications SET status = 'hired', contact_unlocked = 1, updated_at = datetime('now') WHERE id = ? AND status IN ('applied', 'shortlisted')", args: [owned.app.id] },
    {
      sql: `UPDATE talent_jobs SET status = CASE WHEN (SELECT COUNT(*) FROM talent_applications WHERE job_id = ? AND status = 'hired') >= workers_needed THEN 'filled' ELSE status END,
              closed_at = CASE WHEN (SELECT COUNT(*) FROM talent_applications WHERE job_id = ? AND status = 'hired') >= workers_needed THEN datetime('now') ELSE closed_at END,
              updated_at = datetime('now') WHERE id = ? AND status = 'open'`,
      args: [owned.job.id, owned.job.id, owned.job.id],
    },
  ];
  await executeBatch(stmts);
  tell(String(owned.app.worker_id), "You're hired!", `${employerName(owned.job)} chose you for "${String(owned.job.title)}".`, `/services/jobs/${owned.job.id}`);
  await logEvent({ jobId: String(owned.job.id), actorId: user.sub, kind: "employer", action: "hired", detail: { workerId: owned.app.worker_id } });
  const phone = (await db.execute({ sql: "SELECT phone FROM users WHERE id = ?", args: [owned.app.worker_id] })).rows[0] as Row;
  return c.json({ ok: true, charged: fee.amount, workerPhone: String(phone.phone) });
});

// ---------------------------------------------------------------------------
// Accepting an application for a gig or project: creates the contract and, for
// escrow, holds the money in the same atomic step.
// ---------------------------------------------------------------------------

const acceptSchema = z.object({
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(100), amountUgx: z.number().int().min(1) })).max(50).optional(),
});

jobRoutes.post("/applications/:id/accept", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const env: PlatformEnvironment = await getPlatformEnvironment();
  const parsed = acceptSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const owned = await ownedApplication(c.req.param("id"), user.sub);
  if (!owned) return c.json({ error: "not_found" }, 404);
  const { app, job } = owned;
  if (job.type === "hiring") return c.json({ error: "use_hire", message: "Use 'hire' for hiring posts." }, 400);
  if (job.status !== "open") return c.json({ error: "not_open", message: "This job isn't open." }, 409);
  if (!["applied", "shortlisted"].includes(String(app.status))) return c.json({ error: "not_acceptable", message: "This application can't be accepted now." }, 409);

  const taken = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_contracts WHERE job_id = ? AND status NOT IN ('cancelled', 'refunded')", args: [job.id] })).rows[0] as Row).n);
  if (taken >= Number(job.workers_needed)) return c.json({ error: "job_full", message: "You already have everyone you asked for." }, 409);

  const worker = (await db.execute({ sql: "SELECT p.status, p.activated_at, u.status AS user_status FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?", args: [app.worker_id] })).rows[0] as Row | undefined;
  if (!worker || worker.status !== "approved" || !worker.activated_at || worker.user_status !== "active") return c.json({ error: "worker_unavailable", message: "This worker isn't available any more." }, 409);
  if (await overDueLimit(user.sub, s)) return c.json({ error: "fees_owed", message: "Settle the fees you owe before hiring." }, 403);
  if (await overDueLimit(String(app.worker_id), s)) return c.json({ error: "worker_unavailable", message: "This worker can't take new work right now." }, 409);

  const price = Number(app.bid_ugx) > 0 ? Number(app.bid_ugx) : Number(job.budget_max_ugx);
  if (price < s.minJobUgx || price > s.maxJobUgx) return c.json({ error: "price_out_of_range", message: `A contract must be between ${ugx(s.minJobUgx)} and ${ugx(s.maxJobUgx)}.` }, 400);
  if (job.type === "gig" && price !== Number(job.budget_max_ugx) && price > Number(job.budget_max_ugx)) return c.json({ error: "over_budget", message: "That's more than the job pays." }, 400);

  const parts = parsed.data.milestones?.length ? parsed.data.milestones : [{ title: String(job.title), amountUgx: price }];
  if (parts.length > s.maxMilestones) return c.json({ error: "too_many_milestones", message: `Use up to ${s.maxMilestones} milestones.` }, 400);
  if (parts.reduce((t, m) => t + m.amountUgx, 0) !== price) return c.json({ error: "milestones_mismatch", message: `The milestones must add up to ${ugx(price)}.` }, 400);
  const mode = String(job.payment_mode) === "direct" ? "direct" : "escrow";

  const fees = await contractFees({ employerId: user.sub, workerId: String(app.worker_id), jobType: String(job.type), price, settings: s });
  const weights = parts.map((m) => m.amountUgx);
  const empParts = allocate(fees.employerFee, weights);
  // No part of a milestone's pay can be eaten whole by the fee.
  const wrkParts = allocate(fees.workerFee, weights).map((f, i) => Math.min(f, parts[i].amountUgx - 1));
  const employerFee = empParts.reduce((a, b) => a + b, 0);
  const workerFee = wrkParts.reduce((a, b) => a + b, 0);
  const held = mode === "escrow" ? price + employerFee : 0;

  const contractId = newId("tct");
  const moneyId = `hold:${contractId}`;
  // The application must still be open and the job not yet full, checked in the same statement that creates the contract.
  const open = {
    sql: `EXISTS (SELECT 1 FROM talent_applications WHERE id = ? AND status IN ('applied', 'shortlisted'))
          AND (SELECT COUNT(*) FROM talent_contracts WHERE job_id = ? AND status NOT IN ('cancelled', 'refunded')) < (SELECT workers_needed FROM talent_jobs WHERE id = ?)`,
    args: [app.id, job.id, job.id],
  };
  const gate = mode === "escrow" ? `EXISTS (SELECT 1 FROM talent_money WHERE id = ? AND status = 'done') AND ${open.sql}` : open.sql;
  const gateArgs = mode === "escrow" ? [moneyId, ...open.args] : open.args;
  const stmts: DbStatement[] = [
    {
      sql: `INSERT INTO talent_contracts (id, job_id, application_id, employer_id, worker_id, title, price_ugx, payment_mode, held_ugx, employer_fee_ugx, worker_fee_ugx, environment)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gate}`,
      args: [contractId, job.id, app.id, user.sub, app.worker_id, job.title, price, mode, held, employerFee, workerFee, env, ...gateArgs],
    },
    ...parts.map((m, i): DbStatement => ({
      sql: `INSERT INTO talent_milestones (id, contract_id, position, title, amount_ugx, employer_fee_ugx, worker_fee_ugx)
            SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM talent_contracts WHERE id = ?)`,
      args: [newId("tms"), contractId, i, m.title, m.amountUgx, empParts[i], wrkParts[i], contractId],
    })),
    { sql: "UPDATE talent_applications SET status = 'accepted', updated_at = datetime('now') WHERE id = ? AND EXISTS (SELECT 1 FROM talent_contracts WHERE id = ?)", args: [app.id, contractId] },
    {
      sql: `UPDATE talent_jobs SET status = CASE WHEN (SELECT COUNT(*) FROM talent_contracts WHERE job_id = ? AND status NOT IN ('cancelled', 'refunded')) >= workers_needed THEN 'in_progress' ELSE status END,
              updated_at = datetime('now') WHERE id = ? AND status = 'open' AND EXISTS (SELECT 1 FROM talent_contracts WHERE id = ?)`,
      args: [job.id, job.id, contractId],
    },
  ];
  try {
    if (mode === "escrow") {
      const { held: ok } = await holdFromEmployer({ moneyId, contractId, employerId: user.sub, amount: held, environment: env, note: `Peebee Jobs escrow — ${String(job.title)}`, guard: open, then: stmts });
      if (!ok) return c.json({ error: "insufficient_funds", needed: held, message: `Your wallet needs ${ugx(held)} to hold for this job. Top up and try again.` }, 402);
    } else {
      await executeBatch(stmts);
    }
  } catch (err) {
    console.error("[talent] accept failed:", err);
    return c.json({ error: "conflict", message: "That application was just changed. Refresh and try again." }, 409);
  }
  const made = (await db.execute({ sql: "SELECT id FROM talent_contracts WHERE id = ?", args: [contractId] })).rows.length;
  if (!made) return c.json({ error: "conflict", message: "That application was just changed. Refresh and try again." }, 409);

  tell(String(app.worker_id), "You got the job!", `${employerName(job)} accepted you for "${String(job.title)}" at ${ugx(price)}.`, `/services/jobs/contracts/${contractId}`);
  await logEvent({ jobId: String(job.id), contractId, actorId: user.sub, kind: "employer", action: "accepted", detail: { price, mode, held } });
  return c.json({ contractId, priceUgx: price, heldUgx: held, paymentMode: mode, employerFeeUgx: employerFee, workerFeeUgx: workerFee }, 201);
});

// ---------------------------------------------------------------------------
// Chat between employer and applicant (pre-hire and during the work)
// ---------------------------------------------------------------------------

async function chatAccess(appId: string, userId: string): Promise<{ app: Row; job: Row; other: string } | null> {
  const app = (await db.execute({ sql: "SELECT * FROM talent_applications WHERE id = ?", args: [appId] })).rows[0] as Row | undefined;
  if (!app) return null;
  const job = await loadJob(String(app.job_id));
  if (!job) return null;
  if (String(app.worker_id) === userId) return { app, job, other: String(job.employer_id) };
  if (String(job.employer_id) === userId) return { app, job, other: String(app.worker_id) };
  return null;
}

jobRoutes.get("/applications/:id/messages", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  if (!s.chatEnabled) return c.json({ error: "chat_disabled", message: "Messaging is switched off." }, 403);
  const access = await chatAccess(c.req.param("id"), user.sub);
  if (!access) return c.json({ error: "not_found" }, 404);
  const rows = (await db.execute({ sql: "SELECT id, sender_id, body, created_at FROM talent_messages WHERE application_id = ? ORDER BY created_at, rowid LIMIT 300", args: [access.app.id] })).rows as Row[];
  return c.json({ messages: rows.map((m) => ({ id: String(m.id), mine: String(m.sender_id) === user.sub, body: String(m.body), createdAt: String(m.created_at) })) });
});

jobRoutes.post("/applications/:id/messages", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  if (!s.chatEnabled) return c.json({ error: "chat_disabled", message: "Messaging is switched off." }, 403);
  const access = await chatAccess(c.req.param("id"), user.sub);
  if (!access) return c.json({ error: "not_found" }, 404);
  if (["rejected", "withdrawn"].includes(String(access.app.status))) return c.json({ error: "closed", message: "This conversation is closed." }, 409);
  const parsed = z.object({ body: z.string().trim().min(1).max(1000) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  if (!(await consume(`talent-chat:${user.sub}`, 60, 600)).allowed) return c.json({ error: "rate_limited", message: "Slow down a little." }, 429);
  const screen = await screenText(parsed.data.body);
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);
  const id = newId("tmg");
  await db.execute({ sql: "INSERT INTO talent_messages (id, application_id, sender_id, body) VALUES (?, ?, ?, ?)", args: [id, access.app.id, user.sub, parsed.data.body] });
  tell(access.other, `New message about "${String(access.job.title)}"`, parsed.data.body.slice(0, 80), `/services/jobs/${access.job.id}`, `talent-msg-${access.app.id}`);
  return c.json({ message: { id, mine: true, body: parsed.data.body, createdAt: toDb() } }, 201);
});
