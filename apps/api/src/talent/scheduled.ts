import { db } from "../db/client.js";
import { releaseMilestone } from "./contracts.js";
import { renewOrExpireSubscriptions } from "./monetization.js";
import { runRecurrences } from "./recurrence.js";
import { applyPendingMoney, talentReady, tell, type Row } from "./service.js";

/**
 * Runs from the Worker's cron heartbeat. Every step is safe to repeat: each is a
 * conditional update, so two overlapping runs can't double-act.
 *  - submitted work the employer never answered is paid out by itself;
 *  - open jobs past their date expire;
 *  - lapsed plans end (and renew if the wallet can pay);
 *  - any refund or payout that didn't finish is applied.
 */
export async function sweepTalent(): Promise<{ autoReleased: number; expiredJobs: number; renewed: number; endedPlans: number; moneyApplied: number; recurring: { ran: number; failed: number; paused: number; ended: number } }> {
  const result = { autoReleased: 0, expiredJobs: 0, renewed: 0, endedPlans: 0, moneyApplied: 0, recurring: { ran: 0, failed: 0, paused: 0, ended: 0 } };
  if (!(await talentReady())) return result;

  const due = (
    await db.execute({
      sql: `SELECT m.id AS mid FROM talent_milestones m JOIN talent_contracts c ON c.id = m.contract_id
            WHERE m.status = 'submitted' AND m.confirm_by IS NOT NULL AND m.confirm_by <= datetime('now') AND c.status = 'active' LIMIT 100`,
      args: [],
    })
  ).rows as Row[];
  for (const r of due) {
    const m = (await db.execute({ sql: "SELECT * FROM talent_milestones WHERE id = ?", args: [r.mid] })).rows[0] as Row;
    const ct = (await db.execute({ sql: "SELECT * FROM talent_contracts WHERE id = ?", args: [m.contract_id] })).rows[0] as Row;
    const res = await releaseMilestone(ct, m, { id: null, kind: "system" }, "auto_released");
    if (res.released) result.autoReleased += 1;
  }

  const stale = (
    await db.execute({
      sql: `SELECT id, employer_id, title FROM talent_jobs WHERE status IN ('open', 'pending_review') AND expires_at IS NOT NULL AND expires_at <= datetime('now')
              AND NOT EXISTS (SELECT 1 FROM talent_contracts c WHERE c.job_id = talent_jobs.id AND c.status IN ('active', 'disputed')) LIMIT 200`,
      args: [],
    })
  ).rows as Row[];
  for (const j of stale) {
    const res = await db.execute({ sql: "UPDATE talent_jobs SET status = 'expired', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('open', 'pending_review')", args: [j.id] });
    if (res.rowsAffected) {
      await db.execute({ sql: "UPDATE talent_applications SET status = 'rejected', updated_at = datetime('now') WHERE job_id = ? AND status IN ('applied', 'shortlisted')", args: [j.id] });
      tell(String(j.employer_id), "Job expired", `"${String(j.title)}" ran out of time. Post it again to keep looking.`, `/services/hire/${j.id}`);
      result.expiredJobs += 1;
    }
  }

  result.recurring = await runRecurrences();

  const subs = await renewOrExpireSubscriptions();
  result.renewed = subs.renewed;
  result.endedPlans = subs.expired;
  result.moneyApplied = await applyPendingMoney();
  return result;
}
