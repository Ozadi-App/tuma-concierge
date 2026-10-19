import { db, executeBatch, type DbStatement } from "../db/client.js";
import { newId } from "../lib/ids.js";
import type { PlatformEnvironment } from "../lib/settings.js";
import { allocate, contractFees, overDueLimit } from "./monetization.js";
import { holdFromEmployer, logEvent, tell, ugx, type Row } from "./service.js";
import type { TalentSettings } from "./settings.js";

export type NewContract =
  | { ok: true; contractId: string; priceUgx: number; heldUgx: number; paymentMode: "escrow" | "direct"; employerFeeUgx: number; workerFeeUgx: number }
  | { ok: false; status: 400 | 402 | 403 | 409; error: string; message: string; needed?: number };

const fail = (status: 400 | 402 | 403 | 409, error: string, message: string, needed?: number): NewContract => ({ ok: false, status, error, message, needed });

/**
 * Turns an application into a contract: checks the job and worker, fixes the price and
 * fees, and (for escrow) holds the employer's money in the SAME atomic step that creates
 * the contract. Used when an employer accepts an applicant and by recurring jobs.
 */
export async function createContract(input: {
  app: Row;
  job: Row;
  employerName: string;
  milestones?: { title: string; amountUgx: number }[];
  settings: TalentSettings;
  env: PlatformEnvironment;
  /** Why this contract exists, shown in the activity trail. */
  action?: string;
}): Promise<NewContract> {
  const { app, job, settings: s, env } = input;
  const employerId = String(job.employer_id);
  if (job.type === "hiring") return fail(400, "use_hire", "Use 'hire' for hiring posts.");
  if (job.status !== "open") return fail(409, "not_open", "This job isn't open.");
  if (!["applied", "shortlisted"].includes(String(app.status))) return fail(409, "not_acceptable", "This application can't be accepted now.");

  const taken = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM talent_contracts WHERE job_id = ? AND status NOT IN ('cancelled', 'refunded')", args: [job.id] })).rows[0] as Row).n);
  if (taken >= Number(job.workers_needed)) return fail(409, "job_full", "You already have everyone you asked for.");

  const worker = (await db.execute({ sql: "SELECT p.status, p.activated_at, u.status AS user_status FROM talent_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?", args: [app.worker_id] })).rows[0] as Row | undefined;
  if (!worker || worker.status !== "approved" || !worker.activated_at || worker.user_status !== "active") return fail(409, "worker_unavailable", "This worker isn't available any more.");
  if (await overDueLimit(employerId, s)) return fail(403, "fees_owed", "Settle the fees you owe before hiring.");
  if (await overDueLimit(String(app.worker_id), s)) return fail(409, "worker_unavailable", "This worker can't take new work right now.");

  const price = Number(app.bid_ugx) > 0 ? Number(app.bid_ugx) : Number(job.budget_max_ugx);
  if (price < s.minJobUgx || price > s.maxJobUgx) return fail(400, "price_out_of_range", `A contract must be between ${ugx(s.minJobUgx)} and ${ugx(s.maxJobUgx)}.`);
  if (job.type === "gig" && price > Number(job.budget_max_ugx)) return fail(400, "over_budget", "That's more than the job pays.");

  const parts = input.milestones?.length ? input.milestones : [{ title: String(job.title), amountUgx: price }];
  if (parts.length > s.maxMilestones) return fail(400, "too_many_milestones", `Use up to ${s.maxMilestones} milestones.`);
  if (parts.reduce((t, m) => t + m.amountUgx, 0) !== price) return fail(400, "milestones_mismatch", `The milestones must add up to ${ugx(price)}.`);
  const mode = String(job.payment_mode) === "direct" ? "direct" : "escrow";

  const fees = await contractFees({ employerId, workerId: String(app.worker_id), jobType: String(job.type), price, settings: s });
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
      args: [contractId, job.id, app.id, employerId, app.worker_id, job.title, price, mode, held, employerFee, workerFee, env, ...gateArgs],
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
      const { held: ok } = await holdFromEmployer({ moneyId, contractId, employerId, amount: held, environment: env, note: `Peebee Hire escrow — ${String(job.title)}`, guard: open, then: stmts });
      if (!ok) return fail(402, "insufficient_funds", `Your wallet needs ${ugx(held)} to hold for this job. Top up and try again.`, held);
    } else {
      await executeBatch(stmts);
    }
  } catch (err) {
    console.error("[talent] accept failed:", err);
    return fail(409, "conflict", "That application was just changed. Refresh and try again.");
  }
  const made = (await db.execute({ sql: "SELECT id FROM talent_contracts WHERE id = ?", args: [contractId] })).rows.length;
  if (!made) return fail(409, "conflict", "That application was just changed. Refresh and try again.");

  tell(String(app.worker_id), "You got the job!", `${input.employerName} accepted you for "${String(job.title)}" at ${ugx(price)}.`, `/services/hire/contracts/${contractId}`);
  await logEvent({ jobId: String(job.id), contractId, actorId: employerId, kind: "employer", action: input.action ?? "accepted", detail: { price, mode, held } });
  return { ok: true, contractId, priceUgx: price, heldUgx: held, paymentMode: mode, employerFeeUgx: employerFee, workerFeeUgx: workerFee };
}
