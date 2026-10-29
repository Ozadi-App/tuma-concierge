import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { toAuthUser } from "../auth/serialize.js";
import { requireAuth } from "../auth/middleware.js";
import { createAndSendOtp, maskTarget } from "./service.js";
import { hashCode, timingSafeEqual } from "./otp.js";

export const verifyRoutes = new Hono();
verifyRoutes.use("*", requireAuth);

const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

type Row = Record<string, unknown>;

/** SQLite's `datetime('now')` yields "YYYY-MM-DD HH:MM:SS" (space-separated,
 * implicitly UTC, no "Z") — not directly parseable by `Date`. Timestamps
 * written from JS via `.toISOString()` (e.g. `expires_at`) are already
 * proper ISO strings and should be passed to `Date` as-is. */
function parseSqliteTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

const requestSchema = z.object({ channel: z.enum(["sms", "email"]) });

verifyRoutes.post("/verify/request", async (c) => {
  const user = c.get("user");
  const parsed = requestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { channel } = parsed.data;

  const userRes = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [user.sub] });
  const row = userRes.rows[0] as Row | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);

  const target = channel === "sms" ? (row.phone as string | null) : (row.email as string | null);
  if (!target) {
    return c.json({ error: channel === "email" ? "no_email_on_file" : "no_phone_on_file" }, 400);
  }

  const recent = await db.execute({
    sql: `SELECT created_at FROM otp_codes WHERE user_id = ? AND channel = ? AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1`,
    args: [user.sub, channel],
  });
  const lastCreatedAt = recent.rows[0]?.created_at as string | undefined;
  if (lastCreatedAt) {
    const elapsedMs = Date.now() - parseSqliteTimestamp(lastCreatedAt).getTime();
    const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    if (remainingMs > 0) {
      return c.json({ error: "too_soon", retryAfterSeconds: Math.ceil(remainingMs / 1000) }, 429);
    }
  }

  try {
    const { devCode, via } = await createAndSendOtp(user.sub, channel, target);
    return c.json({ sent: true, channel, ...(via ? { via } : {}), target: maskTarget(channel, target), ...(devCode ? { devCode } : {}) });
  } catch (err) {
    console.error(`Failed to send ${channel} verification code:`, err);
    return c.json({ error: "send_failed", message: `Couldn't send the code. Please try again.` }, 502);
  }
});

const confirmSchema = z.object({ channel: z.enum(["sms", "email"]), code: z.string().length(6) });

verifyRoutes.post("/verify/confirm", async (c) => {
  const user = c.get("user");
  const parsed = confirmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { channel, code } = parsed.data;

  const res = await db.execute({
    sql: `SELECT * FROM otp_codes WHERE user_id = ? AND channel = ? AND purpose = 'verify' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    args: [user.sub, channel],
  });
  const otp = res.rows[0] as Row | undefined;
  if (!otp) return c.json({ error: "no_pending_code" }, 400);

  if (new Date(otp.expires_at as string).getTime() < Date.now()) {
    return c.json({ error: "code_expired" }, 400);
  }
  if ((otp.attempts as number) >= MAX_ATTEMPTS) {
    return c.json({ error: "too_many_attempts" }, 429);
  }

  const codeHash = await hashCode(code);
  if (!timingSafeEqual(codeHash, otp.code_hash as string)) {
    await db.execute({
      sql: "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?",
      args: [otp.id as string],
    });
    return c.json({ error: "invalid_code" }, 400);
  }

  await db.execute({
    sql: "UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?",
    args: [otp.id as string],
  });
  const column = channel === "sms" ? "phone_verified_at" : "email_verified_at";
  await db.execute({
    sql: `UPDATE users SET ${column} = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    args: [user.sub],
  });

  const userRes = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [user.sub] });
  return c.json({ user: toAuthUser(userRes.rows[0] as Row) });
});
