import type { Context } from "hono";
import { db, executeBatch } from "../db/client.js";
import { logActivity } from "../admin/activity.js";
import { clientIp } from "../lib/ratelimit.js";
import { newId } from "../lib/ids.js";
import { enrollmentSchema } from "../onboarding/service.js";

/**
 * A practising agent registers a business and sees it appear in their list, but nothing real happens: no login is made,
 * no invitation is sent, and nobody's phone buzzes. The new account is a `prac_` demo account and the message is
 * "delivered" on the spot.
 */
export async function practiceEnroll(c: Context): Promise<Response> {
  const user = c.get("user");
  let data: unknown;
  if ((c.req.header("Content-Type") ?? "").includes("multipart/form-data")) {
    const raw = (await c.req.formData()).get("data");
    try { data = typeof raw === "string" ? JSON.parse(raw) : null; } catch { data = null; }
  } else data = await c.req.json().catch(() => null);
  const parsed = enrollmentSchema.safeParse(data);
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.issues.map((i) => i.message).join(" "), issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const again = await db.execute({ sql: "SELECT id FROM onboarding_accounts WHERE agent_id = ? AND request_id = ?", args: [user.sub, input.requestId] });
  if (again.rows[0]) return c.json({ id: String(again.rows[0].id), replayed: true }, 200);
  const id = newId("prac_onb");
  const userId = `${id}_user`;
  const channel = input.preferredChannel === "auto" ? (input.phone ? "sms" : "email") : input.preferredChannel;
  await executeBatch([
    { sql: "INSERT INTO users (id, name, email, phone, password_hash, role, status) VALUES (?, ?, NULL, ?, 'practice-account-no-password', 'customer', 'active')", args: [userId, input.name, `0000${Math.floor(100000 + Math.random() * 899999)}`] },
    { sql: "INSERT INTO onboarding_accounts (id, user_id, agent_id, account_type, request_id, consent_at, preferred_channel, last_invited_at) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))", args: [id, userId, user.sub, input.accountType, input.requestId, input.preferredChannel] },
    { sql: "INSERT INTO onboarding_deliveries (id, account_id, channel, status) VALUES (?, ?, ?, 'sent')", args: [`${id}_del`, id, channel] },
  ]);
  await logActivity({ actor: user, action: "onboarding.create", entityType: "onboarding", entityId: id, summary: `Registered ${input.accountType} ${input.name} (practice)`, ip: clientIp(c) });
  return c.json({ id, delivery: { sent: true, channel } }, 201);
}

/** "Send again" in practice: the message is shown as delivered. */
export async function practiceResend(c: Context, id: string): Promise<Response> {
  const found = await db.execute({ sql: "SELECT preferred_channel FROM onboarding_accounts WHERE id = ? AND account_type <> 'agent'", args: [id] });
  if (!found.rows[0]) return c.json({ error: "not_found" }, 404);
  const channel = found.rows[0].preferred_channel === "auto" ? "sms" : String(found.rows[0].preferred_channel);
  await db.execute({ sql: "INSERT INTO onboarding_deliveries (id, account_id, channel, status) VALUES (?, ?, ?, 'sent')", args: [newId("prac_onb_del"), id, channel] });
  return c.json({ delivery: { sent: true, channel } });
}
