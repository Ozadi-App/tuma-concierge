import { Hono } from "hono";
import { z } from "zod";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getPlatformEnvironment, type PlatformEnvironment } from "../lib/settings.js";
import { blockedMessage, screenText } from "./moderation.js";
import { chargeFixed, payDue } from "./monetization.js";
import { applyPendingMoney, inHours, percentOf, tell, ugx, type ActorKind, type Row } from "./service.js";
import { getTalentSettings, type TalentSettings } from "./settings.js";

export const contractRoutes = new Hono();

type Actor = { id: string | null; kind: ActorKind };

// ---------------------------------------------------------------------------
// Releasing money for a milestone. One atomic batch; each statement only acts if
// the previous one did, so a repeat (retry, double tap, the sweep racing a person)
// changes nothing the second time.
// ---------------------------------------------------------------------------

export async function releaseMilestone(contract: Row, milestone: Row, actor: Actor, action: string): Promise<{ released: boolean; settled: boolean }> {
  const escrow = contract.payment_mode === "escrow";
  const amount = Number(milestone.amount_ugx);
  const empFee = Number(milestone.employer_fee_ugx);
  const wrkFee = Number(milestone.worker_fee_ugx);
  const payout = amount - wrkFee;
  const env: PlatformEnvironment = contract.environment === "sandbox" ? "sandbox" : "live";
  const moneyId = `payout:${milestone.id}`;
  const stmts: DbStatement[] = [
    {
      sql: `UPDATE talent_milestones SET status = 'released', released_at = datetime('now')
            WHERE id = ? AND status IN ('pending', 'submitted') AND EXISTS (SELECT 1 FROM talent_contracts WHERE id = ? AND status = 'active')`,
      args: [milestone.id, contract.id],
    },
    {
      sql: `UPDATE talent_contracts SET held_ugx = held_ugx - ?, paid_to_worker_ugx = paid_to_worker_ugx + ?, commission_ugx = commission_ugx + ?, updated_at = datetime('now')
            WHERE id = ? AND changes() > 0`,
      args: [escrow ? amount + empFee : 0, payout, empFee + wrkFee, contract.id],
    },
    {
      sql: `INSERT INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
      args: [newId("tev"), contract.job_id, contract.id, actor.id, actor.kind, action, JSON.stringify({ milestoneId: milestone.id, amount, payout })],
    },
  ];
  if (escrow) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment) SELECT ?, ?, ?, 'payout', ?, 'pending', ?, ? WHERE changes() > 0`,
      args: [moneyId, contract.id, contract.worker_id, payout, `Peebee Jobs payment — ${String(contract.title)}`, env],
    });
  }
  stmts.push(
    {
      sql: `UPDATE talent_contracts SET status = 'settled', settled_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ? AND status = 'active' AND NOT EXISTS (SELECT 1 FROM talent_milestones WHERE contract_id = ? AND status != 'released')
              AND EXISTS (SELECT 1 FROM talent_milestones WHERE id = ? AND status = 'released')`,
      args: [contract.id, contract.id, milestone.id],
    },
    { sql: "UPDATE talent_profiles SET jobs_completed = jobs_completed + 1, updated_at = datetime('now') WHERE user_id = ? AND changes() > 0", args: [contract.worker_id] },
  );
  const changes = await executeBatch(stmts);
  if (changes[0] !== 1) return { released: false, settled: false };
  const settled = changes[changes.length - 2] === 1;

  if (escrow) {
    // Peebee's share was already kept out of the held money; record it as revenue.
    const record = async (userId: string, kind: "employer_commission" | "worker_commission", amt: number, key: string) => {
      if (amt <= 0) return;
      await db.execute({
        sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment) VALUES (?, ?, ?, ?, ?, ?, 'paid', 'escrow', ?, ?)`,
        args: [newId("tch"), userId, kind, contract.job_id, contract.id, amt, key, env],
      });
    };
    await record(String(contract.employer_id), "employer_commission", empFee, `comm:${milestone.id}:emp`);
    await record(String(contract.worker_id), "worker_commission", wrkFee, `comm:${milestone.id}:wrk`);
    await applyPendingMoney(String(contract.id));
  } else {
    // Direct payment: the two sides settled between themselves, so Peebee's fees are collected from each wallet (or recorded as owed).
    await chargeFixed({ userId: String(contract.employer_id), kind: "employer_commission", amount: empFee, jobId: String(contract.job_id), contractId: String(contract.id), idempotencyKey: `comm:${milestone.id}:emp`, environment: env, allowDue: true });
    await chargeFixed({ userId: String(contract.worker_id), kind: "worker_commission", amount: wrkFee, jobId: String(contract.job_id), contractId: String(contract.id), idempotencyKey: `comm:${milestone.id}:wrk`, environment: env, allowDue: true });
  }
  await afterContractChange(contract);
  tell(String(contract.worker_id), "Payment released", `${ugx(payout)} for "${String(contract.title)}".`, `/services/jobs/contracts/${contract.id}`);
  if (settled) {
    tell(String(contract.employer_id), "Job complete", `"${String(contract.title)}" is finished. Leave a rating.`, `/services/jobs/contracts/${contract.id}`);
    tell(String(contract.worker_id), "Job complete", `"${String(contract.title)}" is finished. Leave a rating.`, `/services/jobs/contracts/${contract.id}`);
  }
  return { released: true, settled };
}

/** Moves the job along once its contracts change: completed when none are running, open again if a place was freed. */
async function afterContractChange(contract: Row) {
  await db.execute({
    sql: `UPDATE talent_jobs SET status = 'completed', closed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status = 'in_progress' AND NOT EXISTS (SELECT 1 FROM talent_contracts WHERE job_id = ? AND status IN ('active', 'disputed'))
            AND EXISTS (SELECT 1 FROM talent_contracts WHERE job_id = ? AND status = 'settled')`,
    args: [contract.job_id, contract.job_id, contract.job_id],
  });
  await db.execute({
    sql: `UPDATE talent_jobs SET status = 'open', updated_at = datetime('now')
          WHERE id = ? AND status = 'in_progress' AND (SELECT COUNT(*) FROM talent_contracts WHERE job_id = ? AND status NOT IN ('cancelled', 'refunded')) < workers_needed
            AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    args: [contract.job_id, contract.job_id],
  });
}

// ---------------------------------------------------------------------------
// Cancelling and refunding
// ---------------------------------------------------------------------------

export type CancelQuote = { feeUgx: number; compensationUgx: number; baseUgx: number; free: boolean; percent: number; freeUntil: string | null };

/**
 * What it costs to walk away now. Free during the admin's grace window after the contract
 * starts (and always while charging is off); after that a percentage of the work not yet
 * paid for. Part of the fee goes to the person who was cancelled on.
 */
export function lateCancelQuote(contract: Row, milestones: Row[], settings: TalentSettings, who: "employer" | "worker", now = Date.now()): CancelQuote {
  const started = new Date(`${String(contract.created_at).replace(" ", "T")}Z`).getTime();
  const freeUntilMs = started + settings.cancelFreeMinutes * 60_000;
  const freeUntil = new Date(freeUntilMs).toISOString().slice(0, 19).replace("T", " ");
  const base = milestones.filter((m) => m.status !== "released").reduce((t, m) => t + Number(m.amount_ugx), 0);
  const none: CancelQuote = { feeUgx: 0, compensationUgx: 0, baseUgx: base, free: true, percent: settings.lateCancelFeePercent, freeUntil };
  if (settings.freeAccess || settings.lateCancelFeePercent <= 0 || now <= freeUntilMs || base <= 1) return none;
  let fee = Math.min(percentOf(base, settings.lateCancelFeePercent), base - 1);
  // An employer's fee comes out of the money held, so it can never be more than is held.
  if (who === "employer" && contract.payment_mode === "escrow") fee = Math.min(fee, Math.max(0, Number(contract.held_ugx) - 1));
  if (fee <= 0) return none;
  return { ...none, feeUgx: fee, compensationUgx: percentOf(fee, settings.lateCancelPartySharePercent), free: false };
}

/** Ends a contract and gives back whatever escrow is still held (less a late-cancel fee, if one applies). Refused once work has been submitted (that goes to a dispute). */
export async function cancelContract(contract: Row, actor: Actor, reason: string, opts: { force?: boolean; to?: "cancelled" | "refunded"; fee?: { feeUgx: number; compensationUgx: number } } = {}): Promise<boolean> {
  const env: PlatformEnvironment = contract.environment === "sandbox" ? "sandbox" : "live";
  const status = opts.to ?? "cancelled";
  const from = opts.force ? "('active', 'disputed')" : "('active')";
  const fee = opts.fee?.feeUgx ?? 0;
  const comp = opts.fee?.compensationUgx ?? 0;
  const stmts: DbStatement[] = [
    {
      sql: `UPDATE talent_contracts SET status = ?, cancelled_at = datetime('now'), cancelled_by = ?, cancel_reason = ?,
              refunded_ugx = refunded_ugx + held_ugx - ?, paid_to_worker_ugx = paid_to_worker_ugx + ?, commission_ugx = commission_ugx + ?,
              cancel_fee_ugx = ?, cancel_compensation_ugx = ?, held_ugx = 0, updated_at = datetime('now')
            WHERE id = ? AND status IN ${from} ${opts.force ? "" : "AND NOT EXISTS (SELECT 1 FROM talent_milestones WHERE contract_id = ? AND status = 'submitted')"}`,
      args: [status, actor.id ?? actor.kind, reason, fee, comp, fee - comp, fee, comp, contract.id, ...(opts.force ? [] : [contract.id])],
    },
    {
      sql: `INSERT INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
      args: [newId("tev"), contract.job_id, contract.id, actor.id, actor.kind, status === "refunded" ? "refunded" : "cancelled", JSON.stringify({ reason, lateFee: fee })],
    },
    {
      sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment)
            SELECT ?, id, employer_id, 'refund', refunded_ugx, 'pending', ?, ? FROM talent_contracts WHERE id = ? AND status = ? AND refunded_ugx > 0 AND payment_mode = 'escrow' AND changes() > 0`,
      args: [`refund:${contract.id}`, `Peebee Jobs refund — ${String(contract.title)}`, env, contract.id, status],
    },
  ];
  if (comp > 0) {
    stmts.push({
      sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment)
            SELECT ?, id, worker_id, 'payout', cancel_compensation_ugx, 'pending', ?, ? FROM talent_contracts WHERE id = ? AND status = ? AND cancel_compensation_ugx > 0 AND payment_mode = 'escrow'`,
      args: [`comp:${contract.id}`, `Peebee Jobs cancellation payment — ${String(contract.title)}`, env, contract.id, status],
    });
  }
  const changes = await executeBatch(stmts);
  if (changes[0] !== 1) return false;
  if (fee - comp > 0 && contract.payment_mode === "escrow" && opts.fee) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment) VALUES (?, ?, 'late_cancel_fee', ?, ?, ?, 'paid', 'escrow', ?, ?)`,
      args: [newId("tch"), contract.employer_id, contract.job_id, contract.id, fee - comp, `cancelfee:${contract.id}`, env],
    });
  }
  await applyPendingMoney(String(contract.id));
  await afterContractChange(contract);
  return true;
}

/**
 * When the canceller's own wallet pays the fee (a worker cancelling, or any cancel of a
 * directly-paid job): takes it, and pays the other side their share. Owed if the wallet can't cover it.
 */
async function collectCancelFee(contract: Row, canceller: "employer" | "worker", quote: CancelQuote): Promise<{ status: "paid" | "due" | "none" }> {
  if (quote.feeUgx <= 0) return { status: "none" };
  const env: PlatformEnvironment = contract.environment === "sandbox" ? "sandbox" : "live";
  const payer = String(canceller === "worker" ? contract.worker_id : contract.employer_id);
  const other = String(canceller === "worker" ? contract.employer_id : contract.worker_id);
  const peebeePart = quote.feeUgx - quote.compensationUgx;
  const base = { jobId: String(contract.job_id), contractId: String(contract.id), environment: env, allowDue: true };
  const own = await chargeFixed({ ...base, userId: payer, kind: "late_cancel_fee", amount: peebeePart, idempotencyKey: `cancelfee:${contract.id}` });
  let compStatus: "paid" | "due" | "none" = "none";
  if (quote.compensationUgx > 0) {
    compStatus = (await chargeFixed({ ...base, userId: payer, kind: "cancel_compensation", amount: quote.compensationUgx, idempotencyKey: `cancelcomp:${contract.id}` })).status;
    if (compStatus === "paid") {
      await db.execute({
        sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment) VALUES (?, ?, ?, 'payout', ?, 'pending', ?, ?)`,
        args: [`comp:${contract.id}`, contract.id, other, quote.compensationUgx, `Peebee Jobs cancellation payment — ${String(contract.title)}`, env],
      });
      await applyPendingMoney(String(contract.id));
    }
  }
  await db.execute({ sql: "UPDATE talent_contracts SET cancel_fee_ugx = ?, cancel_compensation_ugx = ? WHERE id = ?", args: [quote.feeUgx, compStatus === "paid" ? quote.compensationUgx : 0, contract.id] });
  return { status: own.status === "none" ? compStatus : own.status };
}

// ---------------------------------------------------------------------------
// Resolving a dispute (staff)
// ---------------------------------------------------------------------------

export type DisputeOutcome = { outcome: "release" } | { outcome: "refund" } | { outcome: "split"; refundUgx: number };

export async function resolveDispute(contract: Row, outcome: DisputeOutcome, staffId: string, note: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (contract.status !== "disputed") return { ok: false, message: "This contract isn't in dispute." };
  const actor: Actor = { id: staffId, kind: "admin" };
  const env: PlatformEnvironment = contract.environment === "sandbox" ? "sandbox" : "live";
  // Reopen it so the normal release / cancel paths apply, remembering how it was resolved.
  const reopened = await db.execute({
    sql: "UPDATE talent_contracts SET status = 'active', resolution_note = ?, resolved_by = ?, updated_at = datetime('now') WHERE id = ? AND status = 'disputed'",
    args: [note, staffId, contract.id],
  });
  if (!reopened.rowsAffected) return { ok: false, message: "This dispute was just resolved by someone else." };
  const fresh = (await db.execute({ sql: "SELECT * FROM talent_contracts WHERE id = ?", args: [contract.id] })).rows[0] as Row;

  if (outcome.outcome === "refund") {
    await cancelContract(fresh, actor, note || "Resolved by Peebee: refunded", { to: "refunded", force: true });
    return { ok: true };
  }
  const milestones = (await db.execute({ sql: "SELECT * FROM talent_milestones WHERE contract_id = ? AND status != 'released' ORDER BY position", args: [contract.id] })).rows as Row[];
  if (outcome.outcome === "release") {
    for (const m of milestones) await releaseMilestone((await db.execute({ sql: "SELECT * FROM talent_contracts WHERE id = ?", args: [contract.id] })).rows[0] as Row, m, actor, "dispute_released");
    return { ok: true };
  }
  // Split: refund part of what's still held, pay the worker the rest less Peebee's share of it.
  if (fresh.payment_mode !== "escrow") {
    await db.execute({ sql: "UPDATE talent_contracts SET status = 'disputed' WHERE id = ?", args: [contract.id] });
    return { ok: false, message: "Only escrow contracts can be split. Release or refund this one." };
  }
  const held = Number(fresh.held_ugx);
  const refund = Math.max(0, Math.min(held, Math.round(outcome.refundUgx)));
  if (refund <= 0 || refund >= held) {
    await db.execute({ sql: "UPDATE talent_contracts SET status = 'disputed' WHERE id = ?", args: [contract.id] });
    return { ok: false, message: `Choose a refund between UGX 1 and ${ugx(held - 1)}, or use release / refund.` };
  }
  const rate = (milestones.reduce((t, m) => t + Number(m.employer_fee_ugx) + Number(m.worker_fee_ugx), 0)) / Math.max(1, held);
  const workerSide = held - refund;
  const keep = Math.min(workerSide - 1, percentOf(workerSide, rate * 100));
  const payout = workerSide - keep;
  const changes = await executeBatch([
    {
      sql: `UPDATE talent_contracts SET status = 'settled', settled_at = datetime('now'), held_ugx = 0, refunded_ugx = refunded_ugx + ?, paid_to_worker_ugx = paid_to_worker_ugx + ?, commission_ugx = commission_ugx + ?, updated_at = datetime('now')
            WHERE id = ? AND status = 'active' AND held_ugx = ?`,
      args: [refund, payout, keep, contract.id, held],
    },
    { sql: "UPDATE talent_milestones SET status = 'released', released_at = datetime('now') WHERE contract_id = ? AND status != 'released' AND changes() > 0", args: [contract.id] },
    {
      sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment) SELECT ?, ?, ?, 'refund', ?, 'pending', ?, ? WHERE EXISTS (SELECT 1 FROM talent_contracts WHERE id = ? AND status = 'settled')`,
      args: [`refund:${contract.id}`, contract.id, contract.employer_id, refund, `Peebee Jobs partial refund — ${String(contract.title)}`, env, contract.id],
    },
    {
      sql: `INSERT OR IGNORE INTO talent_money (id, contract_id, user_id, kind, amount_ugx, status, note, environment) SELECT ?, ?, ?, 'payout', ?, 'pending', ?, ? WHERE EXISTS (SELECT 1 FROM talent_contracts WHERE id = ? AND status = 'settled')`,
      args: [`payout:${contract.id}:dispute`, contract.id, contract.worker_id, payout, `Peebee Jobs payment — ${String(contract.title)}`, env, contract.id],
    },
    {
      sql: `INSERT INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) SELECT ?, ?, ?, ?, 'admin', 'dispute_split', ? WHERE EXISTS (SELECT 1 FROM talent_contracts WHERE id = ? AND status = 'settled')`,
      args: [newId("tev"), contract.job_id, contract.id, staffId, JSON.stringify({ refund, payout, keep, note }), contract.id],
    },
  ]);
  if (changes[0] !== 1) return { ok: false, message: "The held amount changed while resolving. Try again." };
  if (keep > 0) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO talent_charges (id, user_id, kind, job_id, contract_id, amount_ugx, status, reason, idempotency_key, environment) VALUES (?, ?, 'worker_commission', ?, ?, ?, 'paid', 'dispute', ?, ?)`,
      args: [newId("tch"), contract.worker_id, contract.job_id, contract.id, keep, `comm:${contract.id}:dispute`, env],
    });
  }
  await db.execute({ sql: "UPDATE talent_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = ?", args: [contract.worker_id] });
  await applyPendingMoney(String(contract.id));
  await afterContractChange(fresh);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

async function loadContract(id: string): Promise<Row | undefined> {
  return (
    await db.execute({
      sql: `SELECT ct.*, j.type AS job_type, j.status AS job_status, ue.name AS employer_name, ue.phone AS employer_phone, uw.name AS worker_name, uw.phone AS worker_phone,
                   e.business_name
            FROM talent_contracts ct JOIN talent_jobs j ON j.id = ct.job_id JOIN users ue ON ue.id = ct.employer_id JOIN users uw ON uw.id = ct.worker_id
            LEFT JOIN talent_employers e ON e.user_id = ct.employer_id WHERE ct.id = ?`,
      args: [id],
    })
  ).rows[0] as Row | undefined;
}

async function milestonesOf(contractId: string): Promise<Row[]> {
  return (await db.execute({ sql: "SELECT * FROM talent_milestones WHERE contract_id = ? ORDER BY position", args: [contractId] })).rows as Row[];
}

function contractSummary(ct: Row, viewer: string) {
  const asWorker = String(ct.worker_id) === viewer;
  return {
    id: String(ct.id), jobId: String(ct.job_id), applicationId: String(ct.application_id), title: String(ct.title), status: String(ct.status),
    paymentMode: String(ct.payment_mode), priceUgx: Number(ct.price_ugx), heldUgx: Number(ct.held_ugx), paidToWorkerUgx: Number(ct.paid_to_worker_ugx), refundedUgx: Number(ct.refunded_ugx),
    // Each side sees only its own fee.
    feeUgx: asWorker ? Number(ct.worker_fee_ugx) : Number(ct.employer_fee_ugx),
    role: asWorker ? "worker" : "employer",
    otherParty: asWorker
      ? { id: String(ct.employer_id), name: ct.business_name ? String(ct.business_name) : String(ct.employer_name), phone: String(ct.employer_phone) }
      : { id: String(ct.worker_id), name: String(ct.worker_name), phone: String(ct.worker_phone) },
    createdAt: String(ct.created_at), settledAt: ct.settled_at ? String(ct.settled_at) : null,
  };
}

contractRoutes.get("/contracts", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const role = c.req.query("role");
  const where = role === "worker" ? "ct.worker_id = ?" : role === "employer" ? "ct.employer_id = ?" : "(ct.worker_id = ? OR ct.employer_id = ?)";
  const args = role === "worker" || role === "employer" ? [user.sub] : [user.sub, user.sub];
  const rows = (
    await db.execute({
      sql: `SELECT ct.*, j.type AS job_type, j.status AS job_status, ue.name AS employer_name, ue.phone AS employer_phone, uw.name AS worker_name, uw.phone AS worker_phone, e.business_name
            FROM talent_contracts ct JOIN talent_jobs j ON j.id = ct.job_id JOIN users ue ON ue.id = ct.employer_id JOIN users uw ON uw.id = ct.worker_id
            LEFT JOIN talent_employers e ON e.user_id = ct.employer_id WHERE ${where} ORDER BY ct.created_at DESC LIMIT 200`,
      args,
    })
  ).rows as Row[];
  return c.json({ contracts: rows.map((r) => contractSummary(r, user.sub)) });
});

contractRoutes.get("/contracts/:id", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const ct = await loadContract(c.req.param("id"));
  if (!ct || (String(ct.worker_id) !== user.sub && String(ct.employer_id) !== user.sub)) return c.json({ error: "not_found" }, 404);
  const asWorker = String(ct.worker_id) === user.sub;
  const ms = await milestonesOf(String(ct.id));
  const active = ct.status === "active";
  const anySubmitted = ms.some((m) => m.status === "submitted");
  const reviewed = (await db.execute({ sql: "SELECT 1 FROM talent_reviews WHERE contract_id = ? AND from_user = ?", args: [ct.id, user.sub] })).rows.length > 0;
  const s = await getTalentSettings();
  const cancelQuote = lateCancelQuote(ct, ms, s, asWorker ? "worker" : "employer");
  const repeat = (await db.execute({ sql: "SELECT id, frequency, status, next_run_at FROM talent_recurrences WHERE source_job_id = ? AND worker_id = ? AND kind = 'rehire' AND status IN ('active', 'paused') LIMIT 1", args: [ct.job_id, ct.worker_id] })).rows[0] as Row | undefined;
  const events = (await db.execute({ sql: "SELECT action, actor_kind, created_at FROM talent_events WHERE contract_id = ? ORDER BY created_at, rowid", args: [ct.id] })).rows as Row[];
  const theirReview = (await db.execute({ sql: "SELECT rating, comment FROM talent_reviews WHERE contract_id = ? AND to_user = ?", args: [ct.id, user.sub] })).rows[0] as Row | undefined;
  return c.json({
    contract: contractSummary(ct, user.sub),
    job: { id: String(ct.job_id), type: String(ct.job_type) },
    milestones: ms.map((m) => ({
      id: String(m.id), position: Number(m.position), title: String(m.title), amountUgx: Number(m.amount_ugx), status: String(m.status), note: m.note ? String(m.note) : null,
      submittedAt: m.submitted_at ? String(m.submitted_at) : null, confirmBy: m.confirm_by ? String(m.confirm_by) : null, releasedAt: m.released_at ? String(m.released_at) : null,
      // The worker's pay for this step, after their fee.
      payoutUgx: Number(m.amount_ugx) - Number(m.worker_fee_ugx),
    })),
    actions: {
      submit: asWorker && active,
      release: !asWorker && active,
      cancel: active && !anySubmitted,
      dispute: active,
      review: s.reviewsEnabled && ct.status === "settled" && !reviewed,
    },
    cancelQuote,
    recurring: {
      canRepeat: !asWorker && s.recurringEnabled && ct.job_type === "gig" && ["active", "settled"].includes(String(ct.status)) && !repeat,
      frequencies: s.recurringFrequencies,
      existing: repeat ? { id: String(repeat.id), frequency: String(repeat.frequency), status: String(repeat.status), nextRunAt: String(repeat.next_run_at) } : null,
    },
    cancelFeeUgx: Number(ct.cancel_fee_ugx ?? 0),
    disputeReason: ct.dispute_reason ? String(ct.dispute_reason) : null,
    resolutionNote: ct.resolution_note ? String(ct.resolution_note) : null,
    reviewReceived: theirReview ? { rating: Number(theirReview.rating), comment: String(theirReview.comment) } : null,
    timeline: events.map((e) => ({ action: String(e.action), by: String(e.actor_kind), at: String(e.created_at) })),
  });
});

// ---------------------------------------------------------------------------
// Doing the work
// ---------------------------------------------------------------------------

async function mine(c: { req: { param: (k: string) => string } }, userId: string, who: "worker" | "employer") {
  const ct = await loadContract(c.req.param("id"));
  if (!ct || String(ct[who === "worker" ? "worker_id" : "employer_id"]) !== userId) return null;
  return ct;
}

/** The milestone a request means: the one named, else the only one left. */
async function pickMilestone(contractId: string, wanted: string | undefined, statuses: string[]): Promise<Row | { error: string }> {
  const rows = (await db.execute({ sql: "SELECT * FROM talent_milestones WHERE contract_id = ? AND status != 'released' ORDER BY position", args: [contractId] })).rows as Row[];
  if (wanted) {
    const m = rows.find((r) => String(r.id) === wanted);
    return m && statuses.includes(String(m.status)) ? m : { error: "milestone_not_available" };
  }
  const usable = rows.filter((r) => statuses.includes(String(r.status)));
  return usable.length === 1 ? usable[0] : { error: "choose_milestone" };
}

const MS_ERRORS: Record<string, string> = { milestone_not_available: "That step can't be changed now.", choose_milestone: "Choose which step you mean." };

async function submitHandler(c: any, wantedMilestone?: string) {
  const user = c.get("user");
  const ct = await mine(c, user.sub, "worker");
  if (!ct) return c.json({ error: "not_found" }, 404);
  if (ct.status !== "active") return c.json({ error: "not_active", message: "This job isn't running." }, 409);
  const parsed = z.object({ note: z.string().trim().max(1000).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  if (parsed.data.note) {
    const screen = await screenText(parsed.data.note);
    if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);
  }
  const m = await pickMilestone(String(ct.id), wantedMilestone, ["pending"]);
  if ("error" in m) return c.json({ error: m.error, message: MS_ERRORS[m.error] }, 400);
  const s = await getTalentSettings();
  const res = await db.execute({
    sql: `UPDATE talent_milestones SET status = 'submitted', submitted_at = datetime('now'), confirm_by = ?, note = ?
          WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM talent_contracts WHERE id = ? AND status = 'active')`,
    args: [inHours(s.autoConfirmHours), parsed.data.note ?? null, m.id, ct.id],
  });
  if (!res.rowsAffected) return c.json({ error: "conflict", message: "That step was just changed. Refresh and try again." }, 409);
  await db.execute({ sql: "INSERT INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) VALUES (?, ?, ?, ?, 'worker', 'submitted', ?)", args: [newId("tev"), ct.job_id, ct.id, user.sub, JSON.stringify({ milestoneId: m.id })] });
  tell(String(ct.employer_id), "Work submitted", `${String(ct.worker_name).split(" ")[0]} finished "${String(m.title)}". Check it and release payment.`, `/services/jobs/contracts/${ct.id}`);
  return c.json({ ok: true, autoReleaseAt: inHours(s.autoConfirmHours) });
}
contractRoutes.post("/contracts/:id/submit", (c) => submitHandler(c));
contractRoutes.post("/contracts/:id/milestones/:mid/submit", (c) => submitHandler(c, c.req.param("mid")));

async function releaseHandler(c: any, wantedMilestone?: string) {
  const user = c.get("user");
  const ct = await mine(c, user.sub, "employer");
  if (!ct) return c.json({ error: "not_found" }, 404);
  if (ct.status !== "active") return c.json({ error: "not_active", message: "This job isn't running." }, 409);
  const m = await pickMilestone(String(ct.id), wantedMilestone, ["pending", "submitted"]);
  if ("error" in m) return c.json({ error: m.error, message: MS_ERRORS[m.error] }, 400);
  const result = await releaseMilestone(ct, m, { id: user.sub, kind: "employer" }, "released");
  if (!result.released) return c.json({ error: "conflict", message: "That step was just changed. Refresh and try again." }, 409);
  return c.json({ ok: true, settled: result.settled });
}
contractRoutes.post("/contracts/:id/release", (c) => releaseHandler(c));
contractRoutes.post("/contracts/:id/milestones/:mid/release", (c) => releaseHandler(c, c.req.param("mid")));

contractRoutes.post("/contracts/:id/cancel", async (c) => {
  const user = c.get("user");
  const ct = await loadContract(c.req.param("id"));
  if (!ct || (String(ct.worker_id) !== user.sub && String(ct.employer_id) !== user.sub)) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ reason: z.string().trim().min(3).max(500).default("Cancelled"), acceptFee: z.boolean().default(false) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const byWorker = String(ct.worker_id) === user.sub;
  const who = byWorker ? "worker" : "employer";
  const s = await getTalentSettings();
  const quote = lateCancelQuote(ct, await milestonesOf(String(ct.id)), s, who);
  const feeFromHeld = who === "employer" && ct.payment_mode === "escrow";
  if (quote.feeUgx > 0 && !parsed.data.acceptFee) return c.json({ error: "late_cancel_fee", message: `Cancelling now costs ${ugx(quote.feeUgx)}. Confirm to go ahead.`, feeUgx: quote.feeUgx, compensationUgx: quote.compensationUgx }, 409);
  const ok = await cancelContract(ct, { id: user.sub, kind: who }, parsed.data.reason, feeFromHeld && quote.feeUgx > 0 ? { fee: quote } : {});
  if (!ok) return c.json({ error: "not_cancellable", message: "This can't be cancelled now. If work was submitted, release payment or raise a problem." }, 409);
  let feeStatus: "paid" | "due" | "none" = feeFromHeld && quote.feeUgx > 0 ? "paid" : "none";
  if (!feeFromHeld && quote.feeUgx > 0) feeStatus = (await collectCancelFee(ct, who, quote)).status;
  // The application is closed so the same person can't be accepted twice into the same job.
  await db.execute({ sql: "UPDATE talent_applications SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [byWorker ? "withdrawn" : "rejected", ct.application_id] });
  tell(byWorker ? String(ct.employer_id) : String(ct.worker_id), "Job cancelled", `"${String(ct.title)}" was cancelled.${!byWorker ? "" : " Your money is back in your wallet."}`, `/services/jobs/contracts/${ct.id}`);
  return c.json({ ok: true, lateFeeUgx: quote.feeUgx, lateFeeStatus: feeStatus });
});

contractRoutes.get("/contracts/:id/cancel-quote", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const ct = await loadContract(c.req.param("id"));
  if (!ct || (String(ct.worker_id) !== user.sub && String(ct.employer_id) !== user.sub)) return c.json({ error: "not_found" }, 404);
  const who = String(ct.worker_id) === user.sub ? "worker" : "employer";
  return c.json(lateCancelQuote(ct, await milestonesOf(String(ct.id)), await getTalentSettings(), who));
});

contractRoutes.post("/contracts/:id/dispute", async (c) => {
  const user = c.get("user");
  const ct = await loadContract(c.req.param("id"));
  if (!ct || (String(ct.worker_id) !== user.sub && String(ct.employer_id) !== user.sub)) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ reason: z.string().trim().min(5).max(1000) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues, message: "Tell us what went wrong." }, 400);
  const res = await db.execute({
    sql: "UPDATE talent_contracts SET status = 'disputed', dispute_reason = ?, disputed_by = ?, disputed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'active'",
    args: [parsed.data.reason, user.sub, ct.id],
  });
  if (!res.rowsAffected) return c.json({ error: "not_disputable", message: "A problem can only be raised on a running job." }, 409);
  await db.execute({ sql: "INSERT INTO talent_events (id, job_id, contract_id, actor_id, actor_kind, action, detail) VALUES (?, ?, ?, ?, ?, 'disputed', ?)", args: [newId("tev"), ct.job_id, ct.id, user.sub, String(ct.worker_id) === user.sub ? "worker" : "employer", JSON.stringify({ reason: parsed.data.reason })] });
  tell(String(ct.worker_id) === user.sub ? String(ct.employer_id) : String(ct.worker_id), "A problem was raised", `Peebee will review "${String(ct.title)}". Payment is paused until then.`, `/services/jobs/contracts/${ct.id}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

contractRoutes.post("/contracts/:id/review", async (c) => {
  const user = c.get("user");
  const s = await getTalentSettings();
  if (!s.reviewsEnabled) return c.json({ error: "reviews_disabled", message: "Ratings are switched off." }, 403);
  const ct = await loadContract(c.req.param("id"));
  if (!ct || (String(ct.worker_id) !== user.sub && String(ct.employer_id) !== user.sub)) return c.json({ error: "not_found" }, 404);
  if (ct.status !== "settled") return c.json({ error: "not_finished", message: "You can rate once the job is finished." }, 409);
  const parsed = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).default("") }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const screen = await screenText(parsed.data.comment);
  if (screen.state === "blocked") return c.json({ error: "prohibited_work", message: blockedMessage(screen) }, 422);
  const byEmployer = String(ct.employer_id) === user.sub;
  const to = byEmployer ? String(ct.worker_id) : String(ct.employer_id);
  const changes = await executeBatch([
    {
      sql: `INSERT OR IGNORE INTO talent_reviews (id, contract_id, from_user, to_user, direction, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [newId("trv"), ct.id, user.sub, to, byEmployer ? "employer_to_worker" : "worker_to_employer", parsed.data.rating, parsed.data.comment],
    },
    byEmployer
      ? { sql: "UPDATE talent_profiles SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ? AND changes() > 0", args: [parsed.data.rating, to] }
      : { sql: "UPDATE talent_employers SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ? AND changes() > 0", args: [parsed.data.rating, to] },
  ]);
  if (changes[0] !== 1) return c.json({ error: "already_reviewed", message: "You've already rated this job." }, 409);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Money: what I've earned, and fees I owe
// ---------------------------------------------------------------------------

contractRoutes.get("/earnings", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const w = (await db.execute({
    sql: `SELECT COALESCE(SUM(paid_to_worker_ugx), 0) AS paid,
                 COALESCE(SUM(CASE WHEN status IN ('active', 'disputed') THEN price_ugx - (SELECT COALESCE(SUM(m.amount_ugx - m.worker_fee_ugx), 0) FROM talent_milestones m WHERE m.contract_id = talent_contracts.id AND m.status = 'released') ELSE 0 END), 0) AS upcoming,
                 COUNT(*) AS contracts
          FROM talent_contracts WHERE worker_id = ?`,
    args: [user.sub],
  })).rows[0] as Row;
  const e = (await db.execute({
    sql: `SELECT COALESCE(SUM(held_ugx), 0) AS held, COUNT(*) AS contracts FROM talent_contracts WHERE employer_id = ? AND status != 'cancelled'`,
    args: [user.sub],
  })).rows[0] as Row;
  const owed = Number(((await db.execute({ sql: "SELECT COALESCE(SUM(amount_ugx), 0) AS n FROM talent_charges WHERE user_id = ? AND status = 'due'", args: [user.sub] })).rows[0] as Row).n);
  return c.json({
    worker: { paidUgx: Number(w.paid), upcomingUgx: Number(w.upcoming), contracts: Number(w.contracts) },
    employer: { heldInEscrowUgx: Number(e.held), contracts: Number(e.contracts) },
    owedUgx: owed,
  });
});

contractRoutes.post("/pay-due", async (c) => {
  const user = c.get("user");
  const result = await payDue(user.sub, await getPlatformEnvironment());
  if (result.paid === 0 && result.stillOwed > 0) return c.json({ error: "insufficient_funds", needed: result.stillOwed, message: `You owe ${ugx(result.stillOwed)}. Top up your wallet and try again.` }, 402);
  return c.json({ ok: true, ...result });
});

