import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { consume } from "../lib/ratelimit.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { blockedMessage, queueForReview, screenText } from "./moderation.js";
import { charge, hasFeature, myMembership, proRequired, publicFeeSchedule, startTrial, usersWithProPerk } from "./monetization.js";
import { logEvent, parseList, ratingOf, tell, toDb, ugx, type Row } from "./service.js";
import { getTalentSettings } from "./settings.js";

export const profileRoutes = new Hono();

// ---------------------------------------------------------------------------
// Config and categories (what the apps need to draw themselves)
// ---------------------------------------------------------------------------

export async function categoriesList() {
  const rows = (await db.execute({ sql: "SELECT id, parent_id, name, segment, icon FROM talent_categories WHERE active = 1 ORDER BY sort_order, name", args: [] })).rows as Row[];
  return rows.map((r) => ({ id: String(r.id), parentId: r.parent_id ? String(r.parent_id) : null, name: String(r.name), segment: String(r.segment), icon: r.icon ? String(r.icon) : null }));
}

profileRoutes.get("/config", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const s = await getTalentSettings();
  return c.json({
    enabled: s.enabled,
    jobTypes: s.jobTypes,
    workerSearchEnabled: s.workerSearchEnabled,
    paymentModes: s.paymentModes,
    defaultPaymentMode: s.defaultPaymentMode,
    ridersCanWork: s.ridersCanWork,
    freeAccess: s.freeAccess,
    freeOnboarding: s.freeOnboarding,
    trialDays: s.trialDays,
    reviewsEnabled: s.reviewsEnabled,
    chatEnabled: s.chatEnabled,
    limits: {
      minJobUgx: s.minJobUgx, maxJobUgx: s.maxJobUgx, maxMilestones: s.maxMilestones, maxWorkersPerJob: s.maxWorkersPerJob, maxSkills: s.maxSkills,
      searchRadiusKm: s.searchRadiusKm, boostDays: s.boostDays, autoConfirmHours: s.autoConfirmHours, jobExpiryDays: s.jobExpiryDays,
    },
    recurring: { enabled: s.recurringEnabled, frequencies: s.recurringFrequencies, maxRuns: s.recurringMaxRuns, maxActive: s.recurringMaxActive },
    // Late-cancel fees only show while charging is on.
    cancellation: { freeMinutes: s.cancelFreeMinutes, mode: s.lateCancelFeeMode, feeUgx: s.freeAccess ? 0 : s.lateCancelFeeUgx, feePercent: s.freeAccess ? 0 : s.lateCancelFeePercent, partySharePercent: s.lateCancelPartySharePercent },
    categories: await categoriesList(),
    fees: await publicFeeSchedule(s),
  });
});

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

export function workerView(p: Row, opts: { distanceKm?: number | null; phone?: string | null; categories?: string[] } = {}) {
  return {
    id: String(p.user_id),
    name: String(p.name ?? ""),
    headline: String(p.headline ?? ""),
    bio: String(p.bio ?? ""),
    skills: parseList(p.skills),
    languages: parseList(p.languages),
    categories: opts.categories ?? [],
    area: p.area ? String(p.area) : null,
    remote: Number(p.remote) === 1,
    radiusKm: Number(p.radius_km ?? 0),
    rateType: String(p.rate_type),
    rateUgx: Number(p.rate_ugx ?? 0),
    experienceYears: Number(p.experience_years ?? 0),
    portfolio: parseList(p.portfolio),
    availability: String(p.availability),
    verified: Number(p.id_verified) === 1,
    featured: Boolean(p.featured_until && String(p.featured_until) > toDb()),
    rating: ratingOf(p.rating_sum, p.rating_count),
    ratingCount: Number(p.rating_count ?? 0),
    jobsCompleted: Number(p.jobs_completed ?? 0),
    distanceKm: opts.distanceKm ?? null,
    phone: opts.phone ?? null,
    isRider: p.role === "rider",
  };
}

async function categoryIdsOf(userId: string): Promise<string[]> {
  return ((await db.execute({ sql: "SELECT category_id FROM talent_profile_categories WHERE user_id = ?", args: [userId] })).rows as Row[]).map((r) => String(r.category_id));
}

profileRoutes.get("/me", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const profile = (await db.execute({ sql: "SELECT p.*, u.name, u.role FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  const employer = (await db.execute({ sql: "SELECT * FROM talent_employers WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  const counts = (await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM talent_jobs WHERE employer_id = ? AND status IN ('open', 'in_progress', 'pending_review')) AS open_jobs,
            (SELECT COUNT(*) FROM talent_applications WHERE worker_id = ? AND status IN ('applied', 'shortlisted')) AS pending_applications,
            (SELECT COUNT(*) FROM talent_contracts WHERE worker_id = ? AND status IN ('active', 'disputed')) AS work_in_progress,
            (SELECT COUNT(*) FROM talent_contracts WHERE employer_id = ? AND status IN ('active', 'disputed')) AS hiring_in_progress,
            (SELECT COUNT(*) FROM talent_invites i JOIN talent_jobs j ON j.id = i.job_id WHERE i.worker_id = ? AND j.status = 'open') AS invites`,
    args: [user.sub, user.sub, user.sub, user.sub, user.sub],
  })).rows[0] as Row;
  return c.json({
    profile: profile
      ? {
          ...workerView(profile, { categories: await categoryIdsOf(user.sub) }),
          status: String(profile.status),
          statusNote: profile.status_note ? String(profile.status_note) : null,
          visible: Number(profile.visible) === 1,
          activated: Boolean(profile.activated_at),
          lat: profile.lat == null ? null : Number(profile.lat),
          lng: profile.lng == null ? null : Number(profile.lng),
        }
      : null,
    employer: employer
      ? { businessName: employer.business_name ? String(employer.business_name) : null, about: String(employer.about ?? ""), verified: Number(employer.verified) === 1, status: String(employer.status), rating: ratingOf(employer.rating_sum, employer.rating_count), ratingCount: Number(employer.rating_count) }
      : null,
    counts: {
      openJobs: Number(counts.open_jobs), pendingApplications: Number(counts.pending_applications), workInProgress: Number(counts.work_in_progress),
      hiringInProgress: Number(counts.hiring_in_progress), invites: Number(counts.invites),
    },
    membership: await myMembership(user.sub, s),
    canWork: user.role !== "admin" && (user.role !== "rider" || s.ridersCanWork),
  });
});

// ---------------------------------------------------------------------------
// The worker profile
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  headline: z.string().trim().min(3).max(120),
  bio: z.string().trim().max(2000).default(""),
  skills: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  languages: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  categoryIds: z.array(z.string().min(1).max(80)).min(1, "Choose at least one kind of work.").max(10),
  area: z.string().trim().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().int().min(1).max(500).default(10),
  remote: z.boolean().default(false),
  rateType: z.enum(["hour", "day", "job", "negotiable"]).default("negotiable"),
  rateUgx: z.number().int().min(0).max(1_000_000_000).default(0),
  experienceYears: z.number().int().min(0).max(70).default(0),
  portfolio: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  availability: z.enum(["available", "busy", "offline"]).default("available"),
});

profileRoutes.put("/profile", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  if (user.role === "admin") return c.json({ error: "forbidden", message: "Staff accounts can't offer work." }, 403);
  if (user.role === "rider" && !s.ridersCanWork) return c.json({ error: "riders_not_allowed", message: "Riders can't offer other work right now." }, 403);
  const parsed = profileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  if (d.skills.length > s.maxSkills) return c.json({ error: "too_many_skills", message: `List up to ${s.maxSkills} skills.` }, 400);

  const known = (await db.execute({ sql: `SELECT id FROM talent_categories WHERE active = 1 AND id IN (${d.categoryIds.map(() => "?").join(", ")})`, args: d.categoryIds })).rows.length;
  if (known !== new Set(d.categoryIds).size) return c.json({ error: "unknown_category", message: "One of those kinds of work isn't available." }, 400);

  const screen = await screenText(d.headline, d.bio, d.skills.join(" "), d.portfolio.join(" "));
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);

  const existing = (await db.execute({ sql: "SELECT * FROM talent_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (existing && existing.status === "suspended") return c.json({ error: "suspended", message: "Your profile is suspended. Contact support." }, 403);
  const env = await getPlatformEnvironment();
  const needsReview = screen.state === "review";
  // A profile that was live stays live unless the edit trips the screening.
  let status = existing ? String(existing.status) : "pending";
  if (needsReview) status = "pending";
  if (existing && existing.status === "rejected") status = "pending";

  await db.execute({
    sql: `INSERT INTO talent_profiles (user_id, headline, bio, skills, languages, area, lat, lng, radius_km, remote, rate_type, rate_ugx, experience_years, portfolio, availability, status, environment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET headline = excluded.headline, bio = excluded.bio, skills = excluded.skills, languages = excluded.languages,
            area = excluded.area, lat = excluded.lat, lng = excluded.lng, radius_km = excluded.radius_km, remote = excluded.remote, rate_type = excluded.rate_type,
            rate_ugx = excluded.rate_ugx, experience_years = excluded.experience_years, portfolio = excluded.portfolio, availability = excluded.availability,
            status = ?, updated_at = datetime('now')`,
    args: [
      user.sub, d.headline, d.bio, JSON.stringify(d.skills), JSON.stringify(d.languages), d.area ?? null, d.lat ?? null, d.lng ?? null, d.radiusKm, d.remote ? 1 : 0,
      d.rateType, d.rateUgx, d.experienceYears, JSON.stringify(d.portfolio), d.availability, status, env, status,
    ],
  });
  await db.execute({ sql: "DELETE FROM talent_profile_categories WHERE user_id = ?", args: [user.sub] });
  for (const id of new Set(d.categoryIds)) await db.execute({ sql: "INSERT INTO talent_profile_categories (user_id, category_id) VALUES (?, ?)", args: [user.sub, id] });
  if (needsReview) await queueForReview("profile", user.sub, screen);

  // Activation: free (or free onboarding) activates straight away, otherwise the person pays via /profile/activate.
  let activation: { required: boolean; amountUgx: number } = { required: false, amountUgx: 0 };
  if (!existing?.activated_at) {
    const result = await activateProfile(user.sub, env);
    activation = result.ok ? { required: false, amountUgx: 0 } : { required: true, amountUgx: result.needed };
  }
  await logEvent({ actorId: user.sub, kind: "worker", action: existing ? "profile_updated" : "profile_created" });
  return c.json({ ok: true, activation, status: await profileStatus(user.sub) });
});

async function profileStatus(userId: string) {
  const p = (await db.execute({ sql: "SELECT status, activated_at FROM talent_profiles WHERE user_id = ?", args: [userId] })).rows[0] as Row | undefined;
  return p ? { status: String(p.status), activated: Boolean(p.activated_at) } : null;
}

/** Charges the onboarding fee (if any), starts the trial, and approves the profile if admin allows auto-approval. */
async function activateProfile(userId: string, env: "live" | "sandbox"): Promise<{ ok: true } | { ok: false; needed: number }> {
  const s = await getTalentSettings();
  const paid = await charge({ userId, audience: "worker", kind: "worker_onboarding", idempotencyKey: `onboard:worker:${userId}`, environment: env, settings: s });
  if (!paid.ok) return { ok: false, needed: paid.needed };
  const approved = s.workerApproval === "auto";
  await db.execute({
    sql: `UPDATE talent_profiles SET activated_at = COALESCE(activated_at, datetime('now')),
            status = CASE WHEN status = 'pending' AND ? = 1 AND NOT EXISTS (SELECT 1 FROM talent_reports r WHERE r.target_type = 'profile' AND r.target_id = ? AND r.status = 'open') THEN 'approved' ELSE status END,
            updated_at = datetime('now') WHERE user_id = ?`,
    args: [approved ? 1 : 0, userId, userId],
  });
  await startTrial(userId, "worker", env, s);
  return { ok: true };
}

profileRoutes.post("/profile/activate", async (c) => {
  const user = c.get("user");
  const p = (await db.execute({ sql: "SELECT activated_at FROM talent_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (!p) return c.json({ error: "no_profile", message: "Create your worker profile first." }, 404);
  if (p.activated_at) return c.json({ ok: true, activated: true });
  const result = await activateProfile(user.sub, await getPlatformEnvironment());
  if (!result.ok) return c.json({ error: "insufficient_funds", needed: result.needed, message: `Activating your profile costs ${ugx(result.needed)}. Top up your wallet and try again.` }, 402);
  return c.json({ ok: true, activated: true, status: await profileStatus(user.sub) });
});

profileRoutes.patch("/profile/availability", async (c) => {
  const user = c.get("user");
  const parsed = z.object({ availability: z.enum(["available", "busy", "offline"]).optional(), visible: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const res = await db.execute({
    sql: "UPDATE talent_profiles SET availability = COALESCE(?, availability), visible = COALESCE(?, visible), updated_at = datetime('now') WHERE user_id = ?",
    args: [parsed.data.availability ?? null, parsed.data.visible == null ? null : parsed.data.visible ? 1 : 0, user.sub],
  });
  if (!res.rowsAffected) return c.json({ error: "no_profile", message: "Create your worker profile first." }, 404);
  return c.json({ ok: true });
});

/** Pay to be shown higher in search for the boost period. */
profileRoutes.post("/profile/boost", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const p = (await db.execute({ sql: "SELECT * FROM talent_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (!p || p.status !== "approved" || !p.activated_at) return c.json({ error: "not_live", message: "Your profile must be approved before you can boost it." }, 409);
  const result = await charge({ userId: user.sub, audience: "worker", kind: "boost", idempotencyKey: `boost:profile:${user.sub}:${toDb().slice(0, 13)}`, environment: await getPlatformEnvironment(), settings: s });
  if (!result.ok) return c.json({ error: result.error, needed: result.needed, message: result.message }, 402);
  const from = p.featured_until && String(p.featured_until) > toDb() ? String(p.featured_until) : toDb();
  const until = toDb(new Date(new Date(`${from.replace(" ", "T")}Z`).getTime() + s.boostDays * 86_400_000));
  await db.execute({ sql: "UPDATE talent_profiles SET featured_until = ?, updated_at = datetime('now') WHERE user_id = ?", args: [until, user.sub] });
  return c.json({ ok: true, featuredUntil: until, charged: result.amount });
});

const employerSchema = z.object({ businessName: z.string().trim().max(120).optional(), about: z.string().trim().max(1000).default("") });
profileRoutes.put("/employer", async (c) => {
  const user = c.get("user");
  const parsed = employerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const screen = await screenText(parsed.data.businessName, parsed.data.about);
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);
  await db.execute({
    sql: `INSERT INTO talent_employers (user_id, business_name, about) VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET business_name = excluded.business_name, about = excluded.about, updated_at = datetime('now')`,
    args: [user.sub, parsed.data.businessName ?? null, parsed.data.about],
  });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Find workers
// ---------------------------------------------------------------------------

const searchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().max(80).optional(),
  segment: z.enum(["informal", "professional"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().int().min(1).max(500).optional(),
  remote: z.enum(["1", "0"]).optional(),
  sort: z.enum(["best", "rating", "nearest", "rate_low", "newest"]).default("best"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  // Advanced filters (a Pro feature when admin makes it one).
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRate: z.coerce.number().int().min(0).optional(),
  verifiedOnly: z.enum(["1", "0"]).optional(),
  availableNow: z.enum(["1", "0"]).optional(),
});

profileRoutes.get("/workers", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  if (!s.workerSearchEnabled) return c.json({ error: "search_disabled", message: "Finding workers isn't available right now." }, 403);
  const parsed = searchSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "invalid_query", issues: parsed.error.issues }, 400);
  const q = parsed.data;
  const advanced = q.minRating != null || q.maxRate != null || q.verifiedOnly === "1" || q.availableNow === "1";
  if (advanced && !(await hasFeature(user.sub, "advanced_worker_search"))) return c.json(proRequired("advanced_worker_search"), 402);

  const where: string[] = ["p.status = 'approved'", "p.activated_at IS NOT NULL", "p.visible = 1", "p.availability != 'offline'", "u.status = 'active'", "p.user_id != ?", "p.environment = ?"];
  const args: unknown[] = [user.sub, await getPlatformEnvironment()];
  if (q.category) { where.push("EXISTS (SELECT 1 FROM talent_profile_categories pc WHERE pc.user_id = p.user_id AND pc.category_id = ?)"); args.push(q.category); }
  if (q.segment) { where.push("EXISTS (SELECT 1 FROM talent_profile_categories pc JOIN talent_categories tc ON tc.id = pc.category_id WHERE pc.user_id = p.user_id AND tc.segment IN (?, 'both'))"); args.push(q.segment); }
  if (q.q) {
    where.push("(p.headline LIKE ? OR p.bio LIKE ? OR p.skills LIKE ? OR u.name LIKE ? OR EXISTS (SELECT 1 FROM talent_profile_categories pc JOIN talent_categories tc ON tc.id = pc.category_id WHERE pc.user_id = p.user_id AND tc.name LIKE ?))");
    const like = `%${q.q.replace(/[%_]/g, "")}%`;
    args.push(like, like, like, like, like);
  }
  if (q.remote === "1") where.push("p.remote = 1");
  if (q.minRating != null) { where.push("p.rating_count > 0 AND (p.rating_sum * 1.0 / p.rating_count) >= ?"); args.push(q.minRating); }
  if (q.maxRate != null) { where.push("(p.rate_ugx = 0 OR p.rate_ugx <= ?)"); args.push(q.maxRate); }
  if (q.verifiedOnly === "1") where.push("p.id_verified = 1");
  if (q.availableNow === "1") where.push("p.availability = 'available'");

  const rows = (
    await db.execute({
      sql: `SELECT p.*, u.name, u.role FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE ${where.join(" AND ")} LIMIT 600`,
      args: args as never,
    })
  ).rows as Row[];

  const radius = q.radiusKm ?? s.searchRadiusKm;
  const located = q.lat != null && q.lng != null;
  let list = rows.map((p) => {
    const km = located && p.lat != null && p.lng != null ? haversineKm(q.lat!, q.lng!, Number(p.lat), Number(p.lng)) : null;
    return { p, km };
  });
  if (located) {
    // Remote workers are always in; others must be within the search radius or their own travel radius.
    list = list.filter(({ p, km }) => Number(p.remote) === 1 || km === null || km <= Math.max(radius, 0) || km <= Number(p.radius_km));
  }
  const proFeatured = s.freeAccess ? new Set<string>() : await usersWithProPerk("featured_profile");
  const featured = (p: Row) => (p.featured_until && String(p.featured_until) > toDb() ? 1 : proFeatured.has(String(p.user_id)) ? 1 : 0);
  const score = (p: Row) => (Number(p.rating_count) ? Number(p.rating_sum) / Number(p.rating_count) : 3) * 10 + Math.min(Number(p.jobs_completed), 50) * 0.2 + (Number(p.id_verified) ? 3 : 0);
  list.sort((a, b) => {
    if (q.sort === "nearest") return (a.km ?? 1e9) - (b.km ?? 1e9);
    if (q.sort === "rating") return score(b.p) - score(a.p);
    if (q.sort === "rate_low") return (Number(a.p.rate_ugx) || 1e12) - (Number(b.p.rate_ugx) || 1e12);
    if (q.sort === "newest") return String(b.p.created_at).localeCompare(String(a.p.created_at));
    return featured(b.p) - featured(a.p) || score(b.p) - score(a.p) || (a.km ?? 1e9) - (b.km ?? 1e9);
  });
  const total = list.length;
  const page = list.slice(q.offset, q.offset + q.limit);
  const cats = await categoryNames(page.map(({ p }) => String(p.user_id)));
  return c.json({
    total,
    workers: page.map(({ p, km }) => workerView(p, { distanceKm: km == null ? null : Math.round(km * 10) / 10, categories: cats.get(String(p.user_id)) ?? [] })),
  });
});

async function categoryNames(userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!userIds.length) return out;
  const rows = (
    await db.execute({
      sql: `SELECT pc.user_id, tc.name FROM talent_profile_categories pc JOIN talent_categories tc ON tc.id = pc.category_id WHERE pc.user_id IN (${userIds.map(() => "?").join(", ")})`,
      args: userIds,
    })
  ).rows as Row[];
  for (const r of rows) out.set(String(r.user_id), [...(out.get(String(r.user_id)) ?? []), String(r.name)]);
  return out;
}

async function unlockedPhone(employerId: string, workerId: string): Promise<boolean> {
  if ((await db.execute({ sql: "SELECT 1 FROM talent_contact_unlocks WHERE employer_id = ? AND worker_id = ?", args: [employerId, workerId] })).rows.length) return true;
  // Hired or on a contract together.
  return (await db.execute({ sql: "SELECT 1 FROM talent_contracts WHERE employer_id = ? AND worker_id = ? LIMIT 1", args: [employerId, workerId] })).rows.length > 0 ||
    (await db.execute({ sql: "SELECT 1 FROM talent_applications a JOIN talent_jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.worker_id = ? AND a.status = 'hired' LIMIT 1", args: [employerId, workerId] })).rows.length > 0;
}

profileRoutes.get("/workers/:id", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const id = c.req.param("id");
  const p = (await db.execute({ sql: "SELECT p.*, u.name, u.role, u.phone FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?", args: [id] })).rows[0] as Row | undefined;
  const mine = id === user.sub;
  if (!p || (!mine && (p.status !== "approved" || !p.activated_at || Number(p.visible) !== 1 || String(p.environment) !== (await getPlatformEnvironment())))) return c.json({ error: "not_found", message: "That worker isn't available." }, 404);
  const showPhone = mine || !s.hideContacts || (await unlockedPhone(user.sub, id));
  const reviews = (
    await db.execute({
      sql: `SELECT r.rating, r.comment, r.created_at, u.name AS from_name FROM talent_reviews r JOIN users u ON u.id = r.from_user
            WHERE r.to_user = ? AND r.direction = 'employer_to_worker' ORDER BY r.created_at DESC LIMIT 10`,
      args: [id],
    })
  ).rows as Row[];
  const cats = await categoryNames([id]);
  return c.json({
    worker: workerView(p, { categories: cats.get(id) ?? [], phone: showPhone ? String(p.phone) : null }),
    phoneLocked: !showPhone,
    reviews: reviews.map((r) => ({ rating: Number(r.rating), comment: String(r.comment), createdAt: String(r.created_at), from: String(r.from_name).split(" ")[0] })),
  });
});

/** Pay (or be a Pro member) to see a worker's phone number without hiring through Peebee. */
profileRoutes.post("/workers/:id/unlock-contact", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const p = (await db.execute({ sql: "SELECT p.*, u.phone FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? AND p.status = 'approved' AND p.activated_at IS NOT NULL", args: [id] })).rows[0] as Row | undefined;
  if (!p || id === user.sub) return c.json({ error: "not_found" }, 404);
  if (await unlockedPhone(user.sub, id)) return c.json({ ok: true, phone: String(p.phone), charged: 0 });
  if (!(await hasFeature(user.sub, "contact_unlock"))) return c.json(proRequired("contact_unlock"), 402);
  const s = await getTalentSettings();
  const result = await charge({ userId: user.sub, audience: "employer", kind: "contact_unlock", idempotencyKey: `unlock:${user.sub}:${id}`, environment: await getPlatformEnvironment(), settings: s });
  if (!result.ok) return c.json({ error: result.error, needed: result.needed, message: result.message }, 402);
  await db.execute({ sql: "INSERT OR IGNORE INTO talent_contact_unlocks (employer_id, worker_id) VALUES (?, ?)", args: [user.sub, id] });
  return c.json({ ok: true, phone: String(p.phone), charged: result.amount });
});

profileRoutes.post("/report", async (c) => {
  const user = c.get("user");
  const parsed = z.object({ targetType: z.enum(["job", "profile", "contract", "user"]), targetId: z.string().min(1).max(80), reason: z.string().trim().min(3).max(500) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  if (!(await consume(`talent-report:${user.sub}`, 10, 3600)).allowed) return c.json({ error: "rate_limited", message: "You've sent a lot of reports. Try again later." }, 429);
  await db.execute({
    sql: "INSERT INTO talent_reports (id, reporter_id, target_type, target_id, reason, source) VALUES (?, ?, ?, ?, ?, 'user')",
    args: [`trp_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, user.sub, parsed.data.targetType, parsed.data.targetId, parsed.data.reason],
  });
  tell(user.sub, "Report received", "Thanks. Our team will review it.", "/services/jobs");
  return c.json({ ok: true });
});

