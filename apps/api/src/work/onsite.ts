import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { haversineKm } from "../lib/geo.js";
import { notifyUser } from "../lib/webpush.js";
import type { WorkSettings } from "./settings.js";
import { fromDb, logEvent, workOnsiteReady, type ActorKind, type Row } from "./service.js";

/**
 * On-site checks. While a job is on, the provider's phone reports where it is and each report is kept as a trail
 * point. When a job is cancelled after the provider had been at the customer's address for the time admin set, it is
 * flagged for review (and the provider can be suspended until someone has looked). This is evidence for a human, not
 * proof: GPS can be wrong, switched off, or faked, and a provider may have a good reason to be there.
 */

/** Two pings further apart than this don't count as time spent on site (the page was closed, the phone locked). A structural cap, not a policy. */
export const MAX_GAP_SECONDS = 300;

export type TrailPoint = { lat: number; lng: number; accuracyM: number | null; at: string };
export type Dwell = { points: number; usable: number; onsiteMinutes: number; closestM: number | null; firstOnsiteAt: string | null; lastOnsiteAt: string | null };

const distanceM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;

/**
 * How long the provider spent within `radiusM` of the address. Time counts between two consecutive pings that are both
 * inside the radius. A ping less accurate than the radius itself can't say whether anyone was inside it, so it is ignored.
 * Pure, so it can be tested without a database.
 */
export function dwellAt(points: TrailPoint[], target: { lat: number; lng: number }, radiusM: number): Dwell {
  const usable = points.filter((p) => p.accuracyM == null || p.accuracyM <= radiusM).sort((a, b) => a.at.localeCompare(b.at));
  let seconds = 0;
  let closest: number | null = null;
  let first: string | null = null;
  let last: string | null = null;
  let prev: { inside: boolean; at: number } | null = null;
  for (const p of usable) {
    const d = distanceM(p, target);
    closest = closest == null ? d : Math.min(closest, d);
    const inside = d <= radiusM;
    const at = fromDb(p.at).getTime();
    if (inside) {
      first ??= p.at;
      last = p.at;
      if (prev?.inside) seconds += Math.min(Math.max(0, (at - prev.at) / 1000), MAX_GAP_SECONDS);
    }
    prev = { inside, at };
  }
  return { points: points.length, usable: usable.length, onsiteMinutes: Math.floor(seconds / 60), closestM: closest == null ? null : Math.round(closest), firstOnsiteAt: first, lastOnsiteAt: last };
}

export async function recordTrailPoint(jobId: string, providerId: string, lat: number, lng: number, accuracyM: number | null) {
  await db.execute({ sql: "INSERT INTO work_job_locations (job_id, provider_id, lat, lng, accuracy_m) VALUES (?, ?, ?, ?, ?)", args: [jobId, providerId, lat, lng, accuracyM] });
}

export async function trailFor(jobId: string, providerId: string): Promise<TrailPoint[]> {
  const rows = (await db.execute({ sql: "SELECT lat, lng, accuracy_m, recorded_at FROM work_job_locations WHERE job_id = ? AND provider_id = ? ORDER BY id LIMIT 5000", args: [jobId, providerId] })).rows as Row[];
  return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), accuracyM: r.accuracy_m == null ? null : Number(r.accuracy_m), at: String(r.recorded_at) }));
}

/** Suspends a provider pending review. Returns whether anything changed. */
export async function suspendForReview(providerId: string, note: string): Promise<boolean> {
  const res = await db.execute({
    sql: "UPDATE work_providers SET status = 'suspended', status_note = ?, online = 0, updated_at = datetime('now') WHERE id = ? AND status IN ('approved', 'pending')",
    args: [note.slice(0, 300), providerId],
  });
  if ((res.rowsAffected ?? 0) !== 1) return false;
  const owner = (await db.execute({ sql: "SELECT user_id FROM work_providers WHERE id = ?", args: [providerId] })).rows[0] as Row | undefined;
  if (owner) notifyUser(String(owner.user_id), { title: "Your Peebee Work account is under review", body: "You can't take jobs until Peebee has looked at a recent cancellation.", url: "/account", tag: "work-review" }).catch(() => {});
  return true;
}

/**
 * Called after a job is cancelled by the customer or the provider. Never throws and never changes how the
 * cancellation itself went: a failure here only means nothing was flagged.
 */
export async function checkCancellation(job: Row, by: ActorKind, settings: WorkSettings): Promise<void> {
  try {
    if (!settings.onsiteCheckEnabled || (by !== "customer" && by !== "provider") || !job.provider_id) return;
    if (!(await workOnsiteReady())) return;
    if (job.lat == null || job.lng == null) return; // no address position to compare against
    const providerId = String(job.provider_id);
    const trail = await trailFor(String(job.id), providerId);
    const dwell = dwellAt(trail, { lat: Number(job.lat), lng: Number(job.lng) }, settings.onsiteRadiusM);

    let kind: "cancel_after_onsite" | "cancel_no_location" | null = null;
    if (dwell.onsiteMinutes >= settings.onsiteMinMinutes) kind = "cancel_after_onsite";
    else if (settings.onsiteFlagNoLocation && trail.length === 0 && job.assigned_at && (Date.now() - fromDb(String(job.assigned_at)).getTime()) / 60_000 >= settings.onsiteMinMinutes) kind = "cancel_no_location";
    if (!kind) return;

    const id = newId("wfl");
    const created = await db.execute({
      sql: `INSERT OR IGNORE INTO work_flags (id, job_id, provider_id, customer_id, kind, cancelled_by, onsite_minutes, closest_m, points, first_onsite_at, last_onsite_at, radius_m, min_minutes, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, job.id, providerId, job.customer_id, kind, by, dwell.onsiteMinutes, dwell.closestM, dwell.points, dwell.firstOnsiteAt, dwell.lastOnsiteAt, settings.onsiteRadiusM, settings.onsiteMinMinutes,
        job.environment === "sandbox" ? "sandbox" : "live"],
    });
    if ((created.rowsAffected ?? 0) !== 1) return;
    await logEvent(String(job.id), null, "system", "flagged", { kind, onsiteMinutes: dwell.onsiteMinutes, cancelledBy: by });

    let suspend = settings.onsiteAction === "suspend";
    let why = "Cancelled after a long stay at the customer's address";
    if (!suspend && settings.onsiteSuspendAfterFlags > 0) {
      const n = Number(
        ((await db.execute({
          sql: `SELECT COUNT(*) AS n FROM work_flags WHERE provider_id = ? AND status IN ('open', 'warned', 'suspended') AND created_at >= datetime('now', ?)`,
          args: [providerId, `-${settings.onsiteWindowDays} days`],
        })).rows[0] as Row).n,
      );
      if (n >= settings.onsiteSuspendAfterFlags) {
        suspend = true;
        why = `${n} flagged cancellations in ${settings.onsiteWindowDays} days`;
      }
    }
    if (suspend && (await suspendForReview(providerId, `Under review: ${why}`))) {
      await db.execute({ sql: "UPDATE work_flags SET status = 'suspended', review_note = ? WHERE id = ? AND status = 'open'", args: [`Suspended automatically: ${why}`, id] });
    }
  } catch (err) {
    console.error("Work on-site check failed:", err);
  }
}

/** Deletes old location trails, except those that are evidence for a flag nobody has reviewed yet. */
export async function purgeTrails(settings: WorkSettings): Promise<number> {
  if (!(await workOnsiteReady())) return 0;
  const res = await db.execute({
    sql: `DELETE FROM work_job_locations WHERE recorded_at < datetime('now', ?) AND job_id NOT IN (SELECT job_id FROM work_flags WHERE status = 'open')`,
    args: [`-${settings.locationRetentionDays} days`],
  });
  return res.rowsAffected ?? 0;
}
