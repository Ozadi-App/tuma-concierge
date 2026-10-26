import { db } from "../db/client.js";
import { signToken } from "../auth/jwt.js";
import type { Answer } from "./demo-customers.js";

/**
 * What demo workers do on Peebee Hire, through the real API signed in as that worker so every rule applies to them: they
 * answer invitations, apply to jobs practising customers post, and hand in work once they have been hired. The one demo
 * worker a person can sign in as (the Work/Hire persona) is left alone: that person does these things themselves.
 * Must run inside runInPractice. Returns how many steps were taken.
 */
const DEMO_WORKER = "(w.user_id LIKE 'prac\\_wk\\_%' ESCAPE '\\' OR w.user_id LIKE 'talent\\_demo\\_%' ESCAPE '\\')";
/** Jobs the seed made are for people to browse; only jobs a practising person posted get answered. */
const POSTED_BY_PRACTICE = "(j.employer_id LIKE 'prac\\_cust\\_%' ESCAPE '\\' AND j.id NOT LIKE 'prac\\_tj\\_%' ESCAPE '\\')";

async function actAsWorker(id: string) {
  const { default: app } = await import("../app.js");
  const token = await signToken({ sub: id, role: "customer", phone: null, practice: true });
  return async (method: string, path: string, body?: unknown): Promise<Answer> => {
    const res = await app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> };
  };
}

async function personaWorker(): Promise<string> {
  const found = await db.execute("SELECT user_id FROM talent_profiles WHERE user_id LIKE 'talent\\_demo\\_%' ESCAPE '\\' ORDER BY user_id LIMIT 1");
  return String(found.rows[0]?.user_id ?? "");
}

const bidFor = (job: Record<string, any>): number => {
  if (job.type === "hiring") return 0;
  const min = Number(job.budget_min_ugx ?? 0), max = Number(job.budget_max_ugx ?? 0);
  return job.type === "gig" ? max : max || min;
};

export async function runDemoWorkerAutopilot(limit = 12): Promise<number> {
  const persona = await personaWorker();
  let steps = 0;
  const step = async (worker: string, method: string, path: string, body: unknown, what: string) => {
    try {
      const answer = await (await actAsWorker(worker))(method, path, body);
      if (answer.status < 300) steps++;
      else if (answer.status !== 409) console.error(`Practice demo worker ${what} refused:`, answer.status, JSON.stringify(answer.body).slice(0, 200));
    } catch (err) {
      console.error(`Practice demo worker ${what} failed:`, err);
    }
  };

  // Invited workers say yes (a worker the customer picked by hand always answers), and up to two matching workers volunteer for any other open job.
  const invited = await db.execute({
    sql: `SELECT j.id AS job_id, j.type, j.budget_min_ugx, j.budget_max_ugx, j.title, i.worker_id
          FROM talent_invites i JOIN talent_jobs j ON j.id = i.job_id JOIN talent_profiles w ON w.user_id = i.worker_id
          WHERE ${POSTED_BY_PRACTICE} AND j.status = 'open' AND ${DEMO_WORKER} AND i.worker_id <> ?
            AND NOT EXISTS (SELECT 1 FROM talent_applications a WHERE a.job_id = j.id AND a.worker_id = i.worker_id) LIMIT ?`,
    args: [persona, limit],
  });
  for (const r of invited.rows) {
    await step(String(r.worker_id), "POST", `/talent/jobs/${String(r.job_id)}/apply`, { message: `Thank you for the invitation to "${String(r.title)}". I am available and can start this week.`, bidUgx: bidFor(r) }, "apply (invited)");
  }
  const open = await db.execute({
    sql: `SELECT j.id, j.type, j.budget_min_ugx, j.budget_max_ugx, j.title, j.category_id FROM talent_jobs j
          WHERE ${POSTED_BY_PRACTICE} AND j.status = 'open' AND (SELECT COUNT(*) FROM talent_applications a WHERE a.job_id = j.id) = 0 ORDER BY j.created_at LIMIT ?`,
    args: [limit],
  });
  for (const job of open.rows) {
    const matching = await db.execute({
      sql: `SELECT w.user_id FROM talent_profiles w JOIN talent_profile_categories pc ON pc.user_id = w.user_id
            WHERE pc.category_id = ? AND w.status = 'approved' AND w.availability = 'available' AND ${DEMO_WORKER} AND w.user_id <> ?
            ORDER BY w.rating_count DESC, w.user_id LIMIT 2`,
      args: [job.category_id, persona],
    });
    for (const w of matching.rows) {
      await step(String(w.user_id), "POST", `/talent/jobs/${String(job.id)}/apply`, { message: `I can do "${String(job.title)}" and have done similar work nearby. Happy to answer questions.`, bidUgx: bidFor(job) }, "apply");
    }
  }

  // Hired workers get on with it: the next step of the work is handed in for the customer to check and pay.
  const working = await db.execute({
    sql: `SELECT c.id AS contract_id, c.worker_id, m.id AS milestone_id, m.title FROM talent_contracts c
          JOIN talent_jobs j ON j.id = c.job_id
          JOIN talent_milestones m ON m.contract_id = c.id AND m.status = 'pending'
          JOIN talent_profiles w ON w.user_id = c.worker_id
          WHERE ${POSTED_BY_PRACTICE} AND c.status = 'active' AND ${DEMO_WORKER} AND c.worker_id <> ?
            AND m.position = (SELECT MIN(position) FROM talent_milestones WHERE contract_id = c.id AND status <> 'released')
          LIMIT ?`,
    args: [persona, limit],
  });
  for (const r of working.rows) {
    await step(String(r.worker_id), "POST", `/talent/contracts/${String(r.contract_id)}/milestones/${String(r.milestone_id)}/submit`, { note: `Done: ${String(r.title)}. Please have a look.` }, "submit");
  }
  return steps;
}

/**
 * What demo service providers do on Peebee Work for jobs a practising customer books: take or offer on a job, quote when a
 * quote is asked for, then start and finish the work. The provider a person can sign in as is left alone.
 */
export async function runDemoProviderAutopilot(limit = 12): Promise<number> {
  const providers = (await db.execute("SELECT id, user_id FROM work_providers WHERE id LIKE 'wpr\\_demo\\_%' ESCAPE '\\' ORDER BY id")).rows.map((r) => ({ id: String(r.id), userId: String(r.user_id) }));
  const [, ...demo] = providers;
  if (!demo.length) return 0;
  let steps = 0;
  const as = new Map<string, Awaited<ReturnType<typeof actAsWorker>>>();
  const call = async (userId: string, path: string, body?: unknown): Promise<Answer> => {
    if (!as.has(userId)) as.set(userId, await actAsWorker(userId));
    return as.get(userId)!("POST", path, body);
  };
  const jobs = await db.execute({
    sql: `SELECT id, status, matching_mode, pricing_mode, callout_fee_ugx, price_ugx, provider_id FROM work_jobs
          WHERE customer_id LIKE 'prac\\_cust\\_%' ESCAPE '\\' AND id NOT LIKE 'prac\\_%' ESCAPE '\\' AND status IN ('open', 'assigned', 'quoted', 'booked', 'in_progress') ORDER BY created_at LIMIT ?`,
    args: [limit],
  });
  for (const job of jobs.rows) {
    const id = String(job.id);
    const status = String(job.status);
    try {
      if (status === "open") {
        const offers = job.matching_mode === "customer_picks";
        let taken = 0;
        for (const p of demo) {
          if (taken >= (offers ? 2 : 1)) break;
          const quote = Math.max(Number(job.callout_fee_ugx ?? 0), 1) * 3;
          const answer = await call(p.userId, `/work/provider/jobs/${id}/${offers ? "offer" : "accept"}`, offers ? { priceUgx: job.pricing_mode === "quote" ? quote : undefined, etaMinutes: 45, message: "I can come today." } : undefined);
          if (answer.status < 300) { taken++; steps++; }
        }
      } else if (job.provider_id && ["assigned", "quoted", "booked", "in_progress"].includes(status)) {
        const owner = providers.find((p) => p.id === String(job.provider_id));
        if (!owner || owner === providers[0]) continue;
        if (status === "assigned" && job.pricing_mode === "quote") {
          if ((await call(owner.userId, `/work/provider/jobs/${id}/quote`, { priceUgx: Math.max(Number(job.callout_fee_ugx ?? 0), 1) * 3 })).status < 300) steps++;
        } else if (status === "booked") {
          // Like the phone would: share where they are (at the address), say they have arrived, then start.
          const where = (await db.execute({ sql: "SELECT lat, lng FROM work_jobs WHERE id = ?", args: [id] })).rows[0];
          if (where?.lat != null && where?.lng != null) {
            await call(owner.userId, `/work/provider/jobs/${id}/location`, { lat: Number(where.lat), lng: Number(where.lng), accuracy: 12 });
            await call(owner.userId, `/work/provider/jobs/${id}/arrived`, {});
          }
          if ((await call(owner.userId, `/work/provider/jobs/${id}/start`, {})).status < 300) steps++;
        } else if (status === "in_progress") {
          if ((await call(owner.userId, `/work/provider/jobs/${id}/complete`, {})).status < 300) steps++;
        }
      }
    } catch (err) {
      console.error("Practice demo provider step failed:", err);
    }
  }
  return steps;
}
