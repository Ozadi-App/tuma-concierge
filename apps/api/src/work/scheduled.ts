import { db } from "../db/client.js";
import { settleJob } from "./jobs.js";
import { applyPendingMoney, transition, workReady, type Row } from "./service.js";
import { purgeTrails } from "./onsite.js";
import { getWorkSettings } from "./settings.js";

/**
 * Runs from the Worker's cron heartbeat. Everything here is safe to repeat:
 * each step is a conditional update, so two overlapping runs can't double-act.
 *  - jobs nobody took in time expire and the customer is refunded;
 *  - quotes the customer ignored lapse (the provider keeps the call-out fee);
 *  - finished jobs the customer never answered pay out by themselves;
 *  - bookings that never got paid are cleared away;
 *  - any refund or payout that didn't finish is applied.
 */
export async function sweepWork(): Promise<{ expired: number; lapsedQuotes: number; autoConfirmed: number; cleared: number; moneyApplied: number }> {
  const result = { expired: 0, lapsedQuotes: 0, autoConfirmed: 0, cleared: 0, moneyApplied: 0 };
  if (!(await workReady())) return result;
  const settings = await getWorkSettings();

  const open = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE status = 'open' AND expires_at IS NOT NULL AND expires_at <= datetime('now') LIMIT 100", args: [] })).rows as Row[];
  for (const job of open) {
    const held = Number(job.held_ugx);
    const ok = await transition({
      jobId: String(job.id), from: ["open"], to: "expired", set: { cancelled_at: new Date().toISOString().slice(0, 19).replace("T", " "), cancelled_by: "system", cancel_reason: "No provider accepted in time" },
      money: [{ kind: "refund", userId: String(job.customer_id), amount: held, note: `Peebee Work refund — ${job.service_name}` }],
      environment: job.environment === "sandbox" ? "sandbox" : "live", actor: { id: null, kind: "system" }, action: "expired",
    });
    if (ok) result.expired += 1;
  }

  const quotes = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE status = 'quoted' AND quote_expires_at IS NOT NULL AND quote_expires_at <= datetime('now') LIMIT 100", args: [] })).rows as Row[];
  for (const job of quotes) {
    const done = await settleJob(job, { from: ["quoted"], to: "settled", refundUgx: 0, actor: { id: null, kind: "system" }, action: "quote_lapsed" });
    if (done.ok) result.lapsedQuotes += 1;
  }

  const finished = (await db.execute({ sql: "SELECT * FROM work_jobs WHERE status = 'completed' AND confirm_by IS NOT NULL AND confirm_by <= datetime('now') LIMIT 100", args: [] })).rows as Row[];
  for (const job of finished) {
    const done = await settleJob(job, { from: ["completed"], to: "settled", refundUgx: 0, actor: { id: null, kind: "system" }, action: "auto_confirmed" });
    if (done.ok) result.autoConfirmed += 1;
  }

  await db.execute({
    sql: `DELETE FROM work_money WHERE kind = 'hold' AND status = 'pending' AND job_id IN (SELECT id FROM work_jobs WHERE status = 'pending_payment' AND created_at <= datetime('now', '-15 minutes'))`,
    args: [],
  });
  const cleared = await db.execute({
    sql: `DELETE FROM work_jobs WHERE status = 'pending_payment' AND created_at <= datetime('now', '-15 minutes') AND NOT EXISTS (SELECT 1 FROM work_money WHERE job_id = work_jobs.id)`,
    args: [],
  });
  result.cleared = cleared.rowsAffected ?? 0;

  await purgeTrails(settings).catch((err) => console.error("Work trail purge failed:", err));

  result.moneyApplied = await applyPendingMoney();
  return result;
}
