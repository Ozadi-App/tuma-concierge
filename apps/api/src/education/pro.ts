import { Hono, type Context } from "hono";
import type { LearnSettings } from "@peebee/shared";
import { db } from "../db/client.js";
import { consume, tooManyRequests } from "../lib/ratelimit.js";
import { hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { creditWallet, debitWallet } from "../wallet/service.js";
import { getLearnSettings } from "./settings.js";

/**
 * Peebee Learn Pro. Today it unlocks one thing, the TV classroom, and the TV classroom is free for everyone until
 * staff switch "TV is a Pro feature" on. So the gate is built and tested, and costs nobody anything at launch.
 *
 * An educator has Pro when a row in edu_educator_plans says so and it hasn't expired. Staff can grant it; an
 * educator can also buy a period of it from their wallet.
 */

type Row = Record<string, unknown>;

export interface ProStatus {
  active: boolean;
  expiresAt: string | null;
  source: string | null;
}

export interface TvAccess {
  /** TV is a Pro feature right now (staff have switched the requirement on). */
  required: boolean;
  /** This educator has Pro. */
  pro: boolean;
  /** This educator may use the TV classroom. */
  allowed: boolean;
  expiresAt: string | null;
}

const parse = (v: unknown): number | null => {
  if (!v) return null;
  const s = String(v);
  const t = Date.parse(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isFinite(t) ? t : null;
};

export async function proStatus(userId: string): Promise<ProStatus> {
  if (!(await hasTable("edu_educator_plans"))) return { active: false, expiresAt: null, source: null };
  const row = (await db.execute({ sql: "SELECT source, expires_at FROM edu_educator_plans WHERE user_id = ?", args: [userId] })).rows[0] as Row | undefined;
  if (!row) return { active: false, expiresAt: null, source: null };
  const ends = parse(row.expires_at);
  const active = ends === null || ends > Date.now();
  return { active, expiresAt: row.expires_at ? String(row.expires_at) : null, source: String(row.source) };
}

/** Whether this educator may use the TV classroom. Always true while TV is free. */
export async function tvAccess(userId: string, settings: LearnSettings): Promise<TvAccess> {
  if (!settings.tvProRequired) {
    const status = await proStatus(userId);
    return { required: false, pro: status.active, allowed: true, expiresAt: status.expiresAt };
  }
  const status = await proStatus(userId);
  return { required: true, pro: status.active, allowed: status.active, expiresAt: status.expiresAt };
}

/** The 402 an educator without Pro gets for a TV action, with what they need to know to fix it. */
export async function tvProRequired(c: Context, userId: string, settings: LearnSettings): Promise<Response | null> {
  const access = await tvAccess(userId, settings);
  if (access.allowed) return null;
  return c.json(
    {
      error: "pro_required",
      feature: "tv",
      message: "The TV classroom is a Learn Pro feature. Upgrade to Pro to connect a screen and show your class on it.",
      priceUgx: settings.proPriceUgx,
      days: settings.proDays,
    },
    402,
  );
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Gives an educator Pro for `days` more days (or with no end date when null). Used by staff. */
export async function grantPro(input: { userId: string; days: number | null; grantedBy: string; note?: string }): Promise<{ expiresAt: string | null }> {
  const expiresAt = input.days === null ? null : iso(Date.now() + input.days * 86_400_000);
  await db.execute({
    sql: `INSERT INTO edu_educator_plans (user_id, plan, source, price_paid_ugx, expires_at, granted_by, note)
          VALUES (?, 'pro', 'admin', 0, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET source = 'admin', expires_at = excluded.expires_at, granted_by = excluded.granted_by, note = excluded.note, updated_at = datetime('now')`,
    args: [input.userId, expiresAt, input.grantedBy, input.note ?? ""],
  });
  return { expiresAt };
}

export async function revokePro(userId: string): Promise<boolean> {
  const res = await db.execute({ sql: "DELETE FROM edu_educator_plans WHERE user_id = ?", args: [userId] });
  return (res.rowsAffected ?? 0) > 0;
}

export async function listPro(): Promise<{ userId: string; name: string; contact: string; source: string; expiresAt: string | null; active: boolean; pricePaidUgx: number; note: string }[]> {
  if (!(await hasTable("edu_educator_plans"))) return [];
  const rows = (
    await db.execute({
      sql: `SELECT p.user_id, p.source, p.expires_at, p.price_paid_ugx, p.note, u.name, COALESCE(u.email, u.phone) AS contact
            FROM edu_educator_plans p JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC LIMIT 200`,
      args: [],
    })
  ).rows as Row[];
  return rows.map((r) => {
    const ends = parse(r.expires_at);
    return {
      userId: String(r.user_id),
      name: String(r.name),
      contact: String(r.contact ?? ""),
      source: String(r.source),
      expiresAt: r.expires_at ? String(r.expires_at) : null,
      active: ends === null || ends > Date.now(),
      pricePaidUgx: Number(r.price_paid_ugx ?? 0),
      note: String(r.note ?? ""),
    };
  });
}

// ---------------------------------------------------------------------------
// The educator's side: see Pro, and buy it from the wallet
// ---------------------------------------------------------------------------

export const proRoutes = new Hono();

proRoutes.get("/", async (c) => {
  const settings = await getLearnSettings();
  const user = c.get("user");
  return c.json({ ok: true, tv: await tvAccess(user.sub, settings), priceUgx: settings.proPriceUgx, days: settings.proDays });
});

proRoutes.post("/subscribe", async (c) => {
  const user = c.get("user");
  const settings = await getLearnSettings();
  if (!settings.tvProRequired) {
    return c.json({ error: "not_needed", message: "The TV classroom is free for every educator right now, so there's nothing to buy." }, 409);
  }
  if (!(await hasTable("edu_educator_plans"))) return c.json({ error: "pro_upgrade_pending", message: "Learn Pro is being set up. Try again shortly." }, 503);
  const quota = await consume(`learn-pro:${user.sub}`, 10, 60 * 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "Too many tries. Wait a little and check your wallet.");

  const status = await proStatus(user.sub);
  if (status.active && status.expiresAt === null) {
    return c.json({ error: "already_pro", message: "You already have Pro with no end date." }, 409);
  }
  const price = settings.proPriceUgx;
  const environment = await getPlatformEnvironment();
  if (price > 0) {
    const balance = await debitWallet(user.sub, price, { type: "order_payment", environment, note: "Peebee Learn Pro" });
    if (balance === null) {
      return c.json({ error: "insufficient_wallet", message: `Add UGX ${price.toLocaleString("en-UG")} to your Peebee wallet to get Pro.` }, 402);
    }
  }
  // A renewal adds to what is left, so buying early never loses days.
  const base = status.active && status.expiresAt ? Math.max(Date.now(), parse(status.expiresAt) ?? 0) : Date.now();
  const expiresAt = iso(base + settings.proDays * 86_400_000);
  try {
    await db.execute({
      sql: `INSERT INTO edu_educator_plans (user_id, plan, source, price_paid_ugx, expires_at)
            VALUES (?, 'pro', 'purchase', ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET source = 'purchase', price_paid_ugx = price_paid_ugx + excluded.price_paid_ugx, expires_at = excluded.expires_at, updated_at = datetime('now')`,
      args: [user.sub, price, expiresAt],
    });
  } catch (err) {
    // The money was taken but Pro wasn't recorded: give it back rather than leave the educator out of pocket.
    if (price > 0) await creditWallet(user.sub, price, { type: "refund", environment, note: "Refund: Peebee Learn Pro" });
    throw err;
  }
  return c.json({ ok: true, expiresAt, priceUgx: price });
});
