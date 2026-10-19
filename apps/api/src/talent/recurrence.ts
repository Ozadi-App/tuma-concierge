import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getPlatformEnvironment, type PlatformEnvironment } from "../lib/settings.js";
import { createContract } from "./engine.js";
import { alertMatchingWorkers } from "./jobs.js";
import { blockedMessage, screenText } from "./moderation.js";
import { charge, hasFeature, overDueLimit, proRequired } from "./monetization.js";
import { inDays, logEvent, tell, toDb, ugx, type Row } from "./service.js";
import { getTalentSettings, TALENT_FREQUENCIES, type TalentFrequency, type TalentSettings } from "./settings.js";

/**
 * Recurring jobs. An employer repeats a gig on a schedule, in one of two ways:
 *  - "rehire": the same worker is booked again each period (a new contract, with the
 *    money held when the period starts);
 *  - "repost": a fresh open job is put up each period for workers to apply to.
 * Each run is safe to repeat: a run is claimed by moving the schedule forward first, so
 * two sweeps can never book the same period twice. A run that fails (not enough money,
 * worker unavailable) is skipped, and the schedule pauses itself after admin's limit.
 */

export const recurrenceRoutes = new Hono();

export function addPeriod(iso: string, freq: TalentFrequency): string {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (freq === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return toDb(d);
}

/** The first scheduled time after `now`, so a long gap never causes a burst of catch-up runs. */
export function nextAfter(iso: string, freq: TalentFrequency, now = toDb()): string {
  let next = addPeriod(iso, freq);
  for (let i = 0; i < 400 && next <= now; i += 1) next = addPeriod(next, freq);
  return next;
}

const employerLabel = (r: Row) => String(r.business_name ?? r.employer_name ?? "Your employer").split(" ")[0];

async function employerRow(userId: string): Promise<Row> {
  return (await db.execute({ sql: "SELECT u.name AS employer_name, e.business_name FROM users u LEFT JOIN talent_employers e ON e.user_id = u.id WHERE u.id = ?", args: [userId] })).rows[0] as Row;
}

// ---------------------------------------------------------------------------
// Creating and managing schedules
// ---------------------------------------------------------------------------

const repeatSchema = z.object({
  frequency: z.enum(TALENT_FREQUENCIES),
  /** When the first repeat should happen. Defaults to one period from now. */
  startsAt: z.string().max(40).optional(),
  maxRuns: z.number().int().min(1).max(520).optional(),
  endsAt: z.string().max(40).optional(),
});

async function checkCanCreate(userId: string, s: TalentSettings, freq: TalentFrequency, body: z.infer<typeof repeatSchema>) {
  if (!s.recurringEnabled) return { status: 403 as const, body: { error: "recurring_disabled", message: "Repeating jobs aren't available right now." } };
  if (!s.recurringFrequencies.includes(freq)) return { status: 400 as const, body: { error: "frequency_unavailable", message: "That repeat interval isn't available." } };
  if (!(await hasFeature(userId, "recurring_jobs"))) return { status: 402 as const, body: proRequired("recurring_jobs") };
  const active = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_recurrences WHERE employer_id = ? AND status IN ('active', 'paused')", args: [userId] })).rows[0] as Row).n);
  if (active >= s.recurringMaxActive) return { status: 409 as const, body: { error: "too_many_recurring", message: `You can have ${s.recurringMaxActive} repeating jobs. End one first.` } };
  let startsAt: string | null = null;
  if (body.startsAt) {
    const t = new Date(body.startsAt);
    if (Number.isNaN(t.getTime())) return { status: 400 as const, body: { error: "invalid_date", message: "That date isn't valid." } };
    startsAt = toDb(t);
  }
  let endsAt: string | null = null;
  if (body.endsAt) {
    const t = new Date(body.endsAt);
    if (Number.isNaN(t.getTime())) return { status: 400 as const, body: { error: "invalid_date", message: "That date isn't valid." } };
    endsAt = toDb(t);
  }
  return { status: 200 as const, startsAt, endsAt };
}

/** Repeat a gig with the same worker. */
recurrenceRoutes.post("/contracts/:id/repeat", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const parsed = repeatSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const ct = (await db.execute({ sql: "SELECT ct.*, j.type AS job_type FROM talent_contracts ct JOIN talent_jobs j ON j.id = ct.job_id WHERE ct.id = ?", args: [c.req.param("id") as string] })).rows[0] as Row | undefined;
  if (!ct || String(ct.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  if (ct.job_type !== "gig") return c.json({ error: "not_a_gig", message: "Only quick gigs can be repeated with the same worker." }, 400);
  if (!["active", "settled"].includes(String(ct.status))) return c.json({ error: "not_repeatable", message: "This job can't be repeated." }, 409);
  const check = await checkCanCreate(user.sub, s, parsed.data.frequency, parsed.data);
  if (check.status !== 200) return c.json(check.body, check.status);
  const dup = (await db.execute({ sql: "SELECT 1 FROM talent_recurrences WHERE source_job_id = ? AND worker_id = ? AND kind = 'rehire' AND status IN ('active', 'paused')", args: [ct.job_id, ct.worker_id] })).rows.length;
  if (dup) return c.json({ error: "already_repeating", message: "This job is already repeating." }, 409);
  const id = newId("trc");
  await db.execute({
    sql: `INSERT INTO talent_recurrences (id, employer_id, kind, source_job_id, worker_id, title, price_ugx, frequency, next_run_at, ends_at, max_runs, environment)
          VALUES (?, ?, 'rehire', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, user.sub, ct.job_id, ct.worker_id, ct.title, ct.price_ugx, parsed.data.frequency, check.startsAt ?? addPeriod(toDb(), parsed.data.frequency), check.endsAt, Math.min(parsed.data.maxRuns ?? s.recurringMaxRuns, s.recurringMaxRuns), ct.environment],
  });
  tell(String(ct.worker_id), "This job will repeat", `${String(ct.title)} will be booked with you ${parsed.data.frequency}.`, `/services/hire/contracts/${ct.id}`);
  await logEvent({ jobId: String(ct.job_id), contractId: String(ct.id), actorId: user.sub, kind: "employer", action: "repeat_set", detail: { frequency: parsed.data.frequency } });
  return c.json({ id }, 201);
});

/** Put a fresh open job up every period. */
recurrenceRoutes.post("/jobs/:id/repeat", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  const parsed = repeatSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const job = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [c.req.param("id") as string] })).rows[0] as Row | undefined;
  if (!job || String(job.employer_id) !== user.sub) return c.json({ error: "not_found" }, 404);
  if (job.type !== "gig" && job.type !== "project") return c.json({ error: "not_repeatable", message: "Hiring posts can't be repeated." }, 400);
  if (["rejected", "pending_review"].includes(String(job.status))) return c.json({ error: "not_repeatable", message: "This job can't be repeated." }, 409);
  const check = await checkCanCreate(user.sub, s, parsed.data.frequency, parsed.data);
  if (check.status !== 200) return c.json(check.body, check.status);
  const id = newId("trc");
  await db.execute({
    sql: `INSERT INTO talent_recurrences (id, employer_id, kind, source_job_id, worker_id, title, price_ugx, frequency, next_run_at, ends_at, max_runs, environment)
          VALUES (?, ?, 'repost', ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, user.sub, job.id, job.title, Math.max(1, Number(job.budget_max_ugx)), parsed.data.frequency, check.startsAt ?? addPeriod(toDb(), parsed.data.frequency), check.endsAt, Math.min(parsed.data.maxRuns ?? s.recurringMaxRuns, s.recurringMaxRuns), job.environment],
  });
  await logEvent({ jobId: String(job.id), actorId: user.sub, kind: "employer", action: "repeat_set", detail: { frequency: parsed.data.frequency, kind: "repost" } });
  return c.json({ id }, 201);
});

function view(r: Row) {
  return {
    id: String(r.id), kind: String(r.kind), title: String(r.title), priceUgx: Number(r.price_ugx), frequency: String(r.frequency), nextRunAt: String(r.next_run_at),
    endsAt: r.ends_at ? String(r.ends_at) : null, maxRuns: Number(r.max_runs), runsDone: Number(r.runs_done), status: String(r.status), lastError: r.last_error ? String(r.last_error) : null,
    sourceJobId: String(r.source_job_id), worker: r.worker_id ? { id: String(r.worker_id), name: String(r.worker_name ?? "") } : null, role: String(r.role ?? "employer"),
  };
}

recurrenceRoutes.get("/recurrences", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const rows = (
    await db.execute({
      sql: `SELECT r.*, u.name AS worker_name, CASE WHEN r.employer_id = ? THEN 'employer' ELSE 'worker' END AS role
            FROM talent_recurrences r LEFT JOIN users u ON u.id = r.worker_id
            WHERE (r.employer_id = ? OR (r.worker_id = ? AND r.kind = 'rehire')) AND r.status != 'ended' ORDER BY r.created_at DESC LIMIT 100`,
      args: [user.sub, user.sub, user.sub],
    })
  ).rows as Row[];
  const s = await getTalentSettings();
  return c.json({ recurrences: rows.map(view), enabled: s.recurringEnabled, frequencies: s.recurringFrequencies });
});

for (const action of ["pause", "resume", "end"] as const) {
  recurrenceRoutes.post(`/recurrences/:id/${action}`, async (c) => {
    const user = c.get("user");
    const r = (await db.execute({ sql: "SELECT * FROM talent_recurrences WHERE id = ?", args: [c.req.param("id") as string] })).rows[0] as Row | undefined;
    const mine = r && (String(r.employer_id) === user.sub || (r.kind === "rehire" && String(r.worker_id) === user.sub && action === "end"));
    if (!r || !mine) return c.json({ error: "not_found" }, 404);
    if (r.status === "ended") return c.json({ error: "ended", message: "This has already ended." }, 409);
    if (action === "pause") await db.execute({ sql: "UPDATE talent_recurrences SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND status = 'active'", args: [r.id] });
    else if (action === "resume") {
      const s = await getTalentSettings();
      if (!s.recurringEnabled) return c.json({ error: "recurring_disabled", message: "Repeating jobs aren't available right now." }, 403);
      await db.execute({ sql: "UPDATE talent_recurrences SET status = 'active', fail_count = 0, last_error = NULL, next_run_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'paused'", args: [nextAfter(String(r.next_run_at), r.frequency as TalentFrequency), r.id] });
    } else {
      await db.execute({ sql: "UPDATE talent_recurrences SET status = 'ended', updated_at = datetime('now') WHERE id = ? AND status != 'ended'", args: [r.id] });
      const other = String(r.employer_id) === user.sub ? r.worker_id : r.employer_id;
      if (other) tell(String(other), "A repeating job was ended", `"${String(r.title)}" won't repeat any more.`, "/services/hire");
    }
    return c.json({ ok: true });
  });
}

// ---------------------------------------------------------------------------
// Running the schedule (from the sweep)
// ---------------------------------------------------------------------------

type RunResult = { ok: true } | { ok: false; message: string };

/** A fresh open copy of the source job, one cycle later. */
async function copyJob(source: Row, r: Row, s: TalentSettings, env: PlatformEnvironment): Promise<string> {
  const id = newId("tjb");
  const mode = source.payment_mode === "direct" && s.paymentModes.includes("direct") ? "direct" : s.paymentModes.includes("escrow") ? "escrow" : s.paymentModes[0];
  await db.execute({
    sql: `INSERT INTO talent_jobs (id, employer_id, type, category_id, title, description, status, area, address, lat, lng, remote, skills, budget_min_ugx, budget_max_ugx, payment_mode,
            workers_needed, moderation_state, recurrence_id, expires_at, published_at, environment)
          VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'clear', ?, ?, datetime('now'), ?)`,
    args: [id, r.employer_id, source.type, source.category_id, source.title, source.description, source.area, source.address, source.lat, source.lng, source.remote, source.skills,
      source.type === "gig" ? r.price_ugx : source.budget_min_ugx, r.price_ugx, mode, r.id, inDays(s.jobExpiryDays), env],
  });
  return id;
}

async function runRehire(r: Row, s: TalentSettings, env: PlatformEnvironment): Promise<RunResult> {
  const source = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [r.source_job_id] })).rows[0] as Row | undefined;
  if (!source) return { ok: false, message: "The original job is gone." };
  const jobId = await copyJob(source, r, s, env);
  const appId = newId("tap");
  await db.execute({ sql: "INSERT INTO talent_applications (id, job_id, worker_id, message, bid_ugx) VALUES (?, ?, ?, 'Repeating job', ?)", args: [appId, jobId, r.worker_id, r.price_ugx] });
  const job = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [jobId] })).rows[0] as Row;
  const app = (await db.execute({ sql: "SELECT * FROM talent_applications WHERE id = ?", args: [appId] })).rows[0] as Row;
  const result = await createContract({ app, job, employerName: employerLabel(await employerRow(String(r.employer_id))), settings: s, env, action: "recurring_started" });
  if (!result.ok) {
    // Nothing was charged or created: tidy away the unused job.
    await db.execute({ sql: "DELETE FROM talent_applications WHERE id = ?", args: [appId] });
    await db.execute({ sql: "DELETE FROM talent_jobs WHERE id = ?", args: [jobId] });
    return { ok: false, message: result.message };
  }
  await db.execute({ sql: "UPDATE talent_jobs SET application_count = 1 WHERE id = ?", args: [jobId] });
  tell(String(r.employer_id), "Repeating job booked", `"${String(r.title)}" is booked again for ${ugx(Number(r.price_ugx))}.`, `/services/hire/contracts/${result.contractId}`);
  return { ok: true };
}

async function runRepost(r: Row, s: TalentSettings, env: PlatformEnvironment): Promise<RunResult> {
  const source = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [r.source_job_id] })).rows[0] as Row | undefined;
  if (!source) return { ok: false, message: "The original job is gone." };
  const employerId = String(r.employer_id);
  if (await overDueLimit(employerId, s)) return { ok: false, message: "You owe fees. Settle them to keep posting." };
  const open = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_jobs WHERE employer_id = ? AND status IN ('open', 'pending_review', 'in_progress')", args: [employerId] })).rows[0] as Row).n);
  if (open >= s.maxOpenJobs) return { ok: false, message: "You already have too many open jobs." };
  const screen = await screenText(String(source.title), String(source.description));
  if (screen.state === "blocked") return { ok: false, message: blockedMessage(screen) };
  const jobId = await copyJob(source, r, s, env);
  if (s.jobReview || screen.state === "review") await db.execute({ sql: "UPDATE talent_jobs SET status = 'pending_review', published_at = NULL WHERE id = ?", args: [jobId] });
  const fee = await charge({ userId: employerId, audience: "employer", kind: "listing", jobType: String(source.type), base: Number(r.price_ugx), jobId, idempotencyKey: `listing:${jobId}`, environment: env, settings: s });
  if (!fee.ok) {
    await db.execute({ sql: "DELETE FROM talent_jobs WHERE id = ?", args: [jobId] });
    return { ok: false, message: fee.message };
  }
  await db.execute({ sql: "UPDATE talent_jobs SET listing_fee_ugx = ? WHERE id = ?", args: [fee.amount, jobId] });
  const fresh = (await db.execute({ sql: "SELECT * FROM talent_jobs WHERE id = ?", args: [jobId] })).rows[0] as Row;
  if (fresh.status === "open") void alertMatchingWorkers(fresh, s);
  tell(employerId, "Repeating job posted", `"${String(r.title)}" is open again for applications.`, `/services/hire/${jobId}`);
  return { ok: true };
}

export async function runRecurrences(): Promise<{ ran: number; failed: number; paused: number; ended: number }> {
  const out = { ran: 0, failed: 0, paused: 0, ended: 0 };
  const s = await getTalentSettings();
  if (!s.recurringEnabled) return out;
  const due = (await db.execute({ sql: "SELECT * FROM talent_recurrences WHERE status = 'active' AND next_run_at <= datetime('now') ORDER BY next_run_at LIMIT 50", args: [] })).rows as Row[];
  for (const r of due) {
    const freq = r.frequency as TalentFrequency;
    // Claim this period by moving the schedule on first; if another sweep got there first, skip.
    const claim = await db.execute({
      sql: "UPDATE talent_recurrences SET next_run_at = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active' AND next_run_at = ?",
      args: [nextAfter(String(r.next_run_at), freq), r.id, r.next_run_at],
    });
    if (claim.rowsAffected !== 1) continue;
    const pastEnd = r.ends_at && String(r.next_run_at) > String(r.ends_at);
    if (pastEnd || Number(r.runs_done) >= Number(r.max_runs)) {
      await db.execute({ sql: "UPDATE talent_recurrences SET status = 'ended' WHERE id = ?", args: [r.id] });
      out.ended += 1;
      continue;
    }
    const env: PlatformEnvironment = r.environment === "sandbox" ? "sandbox" : (await getPlatformEnvironment());
    let result: RunResult;
    try {
      result = r.kind === "rehire" ? await runRehire(r, s, env) : await runRepost(r, s, env);
    } catch (err) {
      console.error("[talent] recurring run failed:", err);
      result = { ok: false, message: "Something went wrong. We'll try again next time." };
    }
    if (result.ok) {
      out.ran += 1;
      const done = Number(r.runs_done) + 1;
      await db.execute({ sql: "UPDATE talent_recurrences SET runs_done = ?, fail_count = 0, last_error = NULL, status = CASE WHEN ? >= max_runs THEN 'ended' ELSE status END WHERE id = ?", args: [done, done, r.id] });
      if (done >= Number(r.max_runs)) out.ended += 1;
    } else {
      out.failed += 1;
      const fails = Number(r.fail_count) + 1;
      const pause = fails >= s.recurringMaxFailures;
      await db.execute({ sql: "UPDATE talent_recurrences SET fail_count = ?, last_error = ?, status = CASE WHEN ? = 1 THEN 'paused' ELSE status END WHERE id = ?", args: [fails, result.message, pause ? 1 : 0, r.id] });
      tell(String(r.employer_id), pause ? "Repeating job paused" : "A repeat was skipped", `"${String(r.title)}": ${result.message}${pause ? " It is paused until you resume it." : ""}`, "/services/hire/mine");
      if (pause) out.paused += 1;
    }
  }
  return out;
}
