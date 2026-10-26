import { randomInt } from "./random.js";
import { normalizePhone } from "./validation.js";

/**
 * Proof that someone controls a phone number, without a database table.
 *
 * request  -> a 6-digit code is texted to the phone; the caller gets a signed *challenge* (not the code).
 * verify   -> challenge + code -> a signed *proof* for that phone and purpose, good for a short while.
 * A protected public form then sends the proof along with the request.
 *
 * Everything is signed with a server secret, so a client cannot mint a challenge or proof, and guessing a code needs
 * an online attempt per guess (which the routes rate limit per challenge).
 */

export type ProofPurpose = "service_booking" | "b2b_inquiry" | "digital_access" | "merchant_portal";

const CHALLENGE_SECONDS = 10 * 60;
const PROOF_SECONDS = 30 * 60;

function secret(): string {
  const base = process.env.OTP_PEPPER ?? process.env.JWT_SECRET;
  if (!base) throw new Error("Neither OTP_PEPPER nor JWT_SECRET is set — cannot sign phone proofs.");
  return `phone-proof:${base}`;
}

async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newCode(): string {
  return String(100000 + randomInt(900000));
}

export async function makeChallenge(phone: string, purpose: ProofPurpose, code: string): Promise<{ challenge: string; expiresInSeconds: number }> {
  const p = normalizePhone(phone);
  if (!p) throw new Error("invalid phone");
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_SECONDS;
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const mac = await hmac(`c|${p}|${purpose}|${exp}|${salt}|${code}`);
  return { challenge: b64(JSON.stringify({ p, u: purpose, e: exp, s: salt, m: mac })), expiresInSeconds: CHALLENGE_SECONDS };
}

/** Check a code against a challenge; on success returns a proof. */
export async function redeemChallenge(challenge: string, code: string): Promise<{ ok: true; proof: string; phone: string; expiresInSeconds: number } | { ok: false; reason: "invalid" | "expired" }> {
  let data: { p: string; u: ProofPurpose; e: number; s: string; m: string };
  try {
    data = JSON.parse(unb64(challenge));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!data?.p || !data.u || !data.e || !data.s || !data.m) return { ok: false, reason: "invalid" };
  if (data.e < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  const expected = await hmac(`c|${data.p}|${data.u}|${data.e}|${data.s}|${code}`);
  if (!equal(expected, data.m)) return { ok: false, reason: "invalid" };
  const exp = Math.floor(Date.now() / 1000) + PROOF_SECONDS;
  const mac = await hmac(`p|${data.p}|${data.u}|${exp}`);
  return { ok: true, proof: b64(JSON.stringify({ p: data.p, u: data.u, e: exp, m: mac })), phone: data.p, expiresInSeconds: PROOF_SECONDS };
}

/** Is this proof valid for exactly this phone and purpose right now? */
export async function proofIsValid(proof: string | undefined | null, phone: string, purpose: ProofPurpose): Promise<boolean> {
  if (!proof) return false;
  const p = normalizePhone(phone);
  if (!p) return false;
  try {
    const data = JSON.parse(unb64(proof)) as { p: string; u: string; e: number; m: string };
    if (data.p !== p || data.u !== purpose || data.e < Math.floor(Date.now() / 1000)) return false;
    return equal(await hmac(`p|${data.p}|${data.u}|${data.e}`), data.m);
  } catch {
    return false;
  }
}
