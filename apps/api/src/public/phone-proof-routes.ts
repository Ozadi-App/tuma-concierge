import { Hono } from "hono";
import { z } from "zod";
import { consume, hashKey } from "../lib/ratelimit.js";
import { publicRateLimit } from "../lib/guards.js";
import { newCode, makeChallenge, redeemChallenge } from "../lib/phone-proof.js";
import { sendSms, smsIsReal } from "../lib/sms-gateway.js";
import { normalizePhone } from "../lib/validation.js";

export const phoneProofRoutes = new Hono();

const requestSchema = z.object({ phone: z.string().min(6).max(30), purpose: z.enum(["service_booking", "b2b_inquiry"]) });

/** Text a code to a phone. Used by public forms whose admin protection is set to "phone code". */
phoneProofRoutes.post("/public/phone-proof/request", async (c) => {
  const parsed = requestSchema.safeParse(await c.req.json().catch(() => null));
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return c.json({ error: "invalid_body", message: "Enter a valid phone number." }, 400);
  const limited = await publicRateLimit(c, "phone-proof", phone, "rate_limit_public_inquiry_per_hour", 3600);
  if (limited) return limited;
  if (!(await smsIsReady())) return c.json({ error: "sms_not_configured", message: "Phone codes are not available right now." }, 503);

  const code = newCode();
  const sent = await sendSms(phone, `Your Peebee code is ${code}. It expires in 10 minutes. Don't share it.`);
  if (sent.status !== "sent") return c.json({ error: "sms_failed", message: "We couldn't send the code. Please try again." }, 502);
  return c.json(await makeChallenge(phone, parsed.data.purpose, code));
});

const verifySchema = z.object({ challenge: z.string().min(10).max(2000), code: z.string().regex(/^\d{6}$/) });

phoneProofRoutes.post("/public/phone-proof/verify", async (c) => {
  const parsed = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Enter the 6-digit code." }, 400);
  // A challenge allows a handful of guesses, however many addresses they come from.
  const attempts = await consume(`pub:proof-verify:${await hashKey(parsed.data.challenge)}`, 5, 600);
  if (!attempts.allowed) {
    c.header("Retry-After", String(attempts.retryAfterSeconds));
    return c.json({ error: "rate_limited", message: "Too many attempts. Request a new code." }, 429);
  }
  const result = await redeemChallenge(parsed.data.challenge, parsed.data.code);
  if (!result.ok) {
    return c.json({ error: result.reason === "expired" ? "code_expired" : "wrong_code", message: result.reason === "expired" ? "That code has expired. Request a new one." : "That code isn't right." }, 400);
  }
  return c.json({ proof: result.proof, phone: result.phone, expiresInSeconds: result.expiresInSeconds });
});

async function smsIsReady(): Promise<boolean> {
  return smsIsReal();
}
