import { TALENT_DEMO } from "@peebee/shared";
import { db } from "../db/client.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { inDays, toDb, type Row } from "./service.js";

/**
 * Sample workers, employers and jobs so staff can see Jobs working in SANDBOX. Everything
 * is stamped environment = 'sandbox', so it is invisible while the platform is live, and the
 * demo people are accounts nobody can sign in to. Safe to add and remove any time.
 */

const PREFIX = "talent_demo_";
const demoId = (id: string) => `${PREFIX}${id.replace(/^p[we]_/, "").replace(/^pw_|^pj_/, "")}`;

export async function seedSandboxDemo(): Promise<{ ok: true; workers: number; employers: number; jobs: number } | { ok: false; message: string }> {
  if ((await getPlatformEnvironment()) !== "sandbox") return { ok: false, message: "Switch the platform to sandbox first. Sample data is only for sandbox." };
  let n = 0;
  const addUser = async (id: string, name: string, role: "customer" | "rider" = "customer") => {
    n += 1;
    await db.execute({
      sql: "INSERT OR IGNORE INTO users (id, phone, name, role, password_hash, phone_verified_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      // An unusable hash: these accounts exist only to own sample data.
      args: [id, `+2569900${String(n).padStart(5, "0")}`, name, role, "!demo-account-no-login"],
    });
  };
  await clearSandboxDemo();
  for (const e of TALENT_DEMO.employers) {
    const id = demoId(String(e.id));
    await addUser(id, String(e.name));
    await db.execute({ sql: "INSERT OR REPLACE INTO talent_employers (user_id, business_name, about, verified, rating_sum, rating_count, activated_at) VALUES (?, ?, 'Sample employer for sandbox', ?, ?, ?, datetime('now'))", args: [id, e.name, e.verified ? 1 : 0, Math.round((e.rating ?? 0) * e.count), e.count] });
  }
  for (const w of TALENT_DEMO.workers) {
    const id = demoId(String(w.id));
    await addUser(id, String(w.name), w.rider ? "rider" : "customer");
    await db.execute({
      sql: `INSERT OR REPLACE INTO talent_profiles (user_id, headline, bio, skills, languages, area, lat, lng, radius_km, remote, rate_type, rate_ugx, experience_years, availability, visible, status, id_verified,
              activated_at, rating_sum, rating_count, jobs_completed, environment)
            VALUES (?, ?, ?, ?, '["English","Luganda"]', ?, ?, ?, 20, ?, ?, ?, ?, 'available', 1, 'approved', ?, datetime('now'), ?, ?, ?, 'sandbox')`,
      args: [id, w.headline, w.bio, JSON.stringify(w.skills), w.area, w.lat, w.lng, w.remote ? 1 : 0, w.rateType, w.rateUgx, w.years, w.verified ? 1 : 0, Math.round((w.rating ?? 0) * w.count), w.count, w.done],
    });
    for (const c of w.categories as string[]) await db.execute({ sql: "INSERT OR IGNORE INTO talent_profile_categories (user_id, category_id) VALUES (?, ?)", args: [id, c] });
  }
  for (const j of TALENT_DEMO.jobs) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO talent_jobs (id, employer_id, type, category_id, title, description, status, area, lat, lng, remote, skills, budget_min_ugx, budget_max_ugx, payment_mode, workers_needed,
              employment_type, moderation_state, expires_at, published_at, created_at, environment)
            VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'clear', ?, datetime('now'), ?, 'sandbox')`,
      args: [demoId(j.id), demoId(j.employer), j.type, j.category, j.title, j.description, j.area, j.lat ?? null, j.lng ?? null, j.remote ? 1 : 0, JSON.stringify(j.skills ?? []), j.min, j.max, j.mode, j.need ?? 1,
        j.employment ?? null, inDays(25), toDb(new Date(Date.now() - j.ageH * 3_600_000))],
    });
  }
  return { ok: true, workers: TALENT_DEMO.workers.length, employers: TALENT_DEMO.employers.length, jobs: TALENT_DEMO.jobs.length };
}

/** Removes the sample data (and anything attached to it). Real sandbox testers' data is never touched. */
export async function clearSandboxDemo(): Promise<number> {
  const demo = (await db.execute({ sql: "SELECT id FROM users WHERE id LIKE ?", args: [`${PREFIX}%`] })).rows as Row[];
  if (demo.length === 0) return 0;
  const ids = demo.map((r) => String(r.id));
  const marks = ids.map(() => "?").join(", ");
  const jobs = ((await db.execute({ sql: `SELECT id FROM talent_jobs WHERE employer_id IN (${marks})`, args: ids })).rows as Row[]).map((r) => String(r.id));
  if (jobs.length) {
    const jm = jobs.map(() => "?").join(", ");
    const apps = ((await db.execute({ sql: `SELECT id FROM talent_applications WHERE job_id IN (${jm})`, args: jobs })).rows as Row[]).map((r) => String(r.id));
    if (apps.length) {
      const am = apps.map(() => "?").join(", ");
      await db.execute({ sql: `DELETE FROM talent_messages WHERE application_id IN (${am})`, args: apps });
      const cts = ((await db.execute({ sql: `SELECT id FROM talent_contracts WHERE application_id IN (${am})`, args: apps })).rows as Row[]).map((r) => String(r.id));
      if (cts.length) {
        const cm = cts.map(() => "?").join(", ");
        for (const t of ["talent_milestones", "talent_money", "talent_events", "talent_reviews"]) await db.execute({ sql: `DELETE FROM ${t} WHERE contract_id IN (${cm})`, args: cts });
        await db.execute({ sql: `DELETE FROM talent_contracts WHERE id IN (${cm})`, args: cts });
      }
      await db.execute({ sql: `DELETE FROM talent_applications WHERE id IN (${am})`, args: apps });
    }
    await db.execute({ sql: `DELETE FROM talent_events WHERE job_id IN (${jm})`, args: jobs });
    await db.execute({ sql: `DELETE FROM talent_invites WHERE job_id IN (${jm})`, args: jobs });
    await db.execute({ sql: `DELETE FROM talent_jobs WHERE id IN (${jm})`, args: jobs });
  }
  await db.execute({ sql: `DELETE FROM talent_profile_categories WHERE user_id IN (${marks})`, args: ids });
  await db.execute({ sql: `DELETE FROM talent_profiles WHERE user_id IN (${marks})`, args: ids });
  await db.execute({ sql: `DELETE FROM talent_employers WHERE user_id IN (${marks})`, args: ids });
  await db.execute({ sql: `DELETE FROM users WHERE id IN (${marks})`, args: ids });
  return ids.length;
}
