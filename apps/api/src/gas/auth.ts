import bcrypt from "bcryptjs";
import type { Context, Next } from "hono";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db/client.js";
import { checkLockout, clearFailures, hashKey, recordFailure } from "../lib/ratelimit.js";
import { getGasSettings } from "../lib/settings.js";

/**
 * Sign-in for pump attendants and station managers.
 *
 * Their sessions are separate from rider/customer/admin sessions: the token's
 * audience is `peebee-gas`, so a rider token can't operate a pump and a pump
 * token can't touch the rest of the API. Every request re-reads the account
 * row, so suspending or removing someone ends their access immediately, and
 * the outlet comes from the token — never from a client-supplied outletId.
 */

export type GasActor = {
  kind: "attendant" | "manager";
  id: string;
  outletId: string;
  name: string;
};

declare module "hono" {
  interface ContextVariableMap {
    gasActor: GasActor;
  }
}

const ISSUER = "peebee-api";
const AUDIENCE = "peebee-gas";
const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  // Derived with a label so this signing key is not the rider-session key.
  return encoder.encode(`gas-session:${secret}`);
}

export async function signGasToken(actor: { kind: GasActor["kind"]; id: string; outletId: string }): Promise<string> {
  const { sessionHours } = await getGasSettings();
  return new SignJWT({ kind: actor.kind, outlet: actor.outletId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actor.id)
    .setJti(crypto.randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${sessionHours}h`)
    .sign(secretKey());
}

async function readToken(c: Context): Promise<{ kind: GasActor["kind"]; id: string; outletId: string } | null> {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), secretKey(), { issuer: ISSUER, audience: AUDIENCE });
    if ((payload.kind !== "attendant" && payload.kind !== "manager") || !payload.sub || typeof payload.outlet !== "string") return null;
    return { kind: payload.kind, id: payload.sub, outletId: payload.outlet };
  } catch {
    return null;
  }
}

const unauthorized = (c: Context) =>
  c.json({ error: "unauthorized", message: "Please sign in again." }, 401);

/** Attendant sessions only. Re-checks the account is still active and at the same outlet. */
export async function requireAttendant(c: Context, next: Next) {
  const token = await readToken(c);
  if (!token || token.kind !== "attendant") return unauthorized(c);
  const res = await db.execute({
    sql: `SELECT id, outlet_id, full_name, status, COALESCE(commission_status, 'approved') AS commission_status
          FROM fuel_pump_attendants WHERE id = ?`,
    args: [token.id],
  });
  const row = res.rows[0] as unknown as { id: string; outlet_id: string; full_name: string; status: string; commission_status: string } | undefined;
  if (!row || row.outlet_id !== token.outletId || row.status === "suspended" || row.commission_status !== "approved") {
    return unauthorized(c);
  }
  c.set("gasActor", { kind: "attendant", id: row.id, outletId: row.outlet_id, name: row.full_name });
  await next();
}

/** Station manager sessions only. */
export async function requireManager(c: Context, next: Next) {
  const token = await readToken(c);
  if (!token || token.kind !== "manager") return unauthorized(c);
  const res = await db.execute({
    sql: "SELECT id, outlet_id, full_name, status FROM fuel_station_managers WHERE id = ?",
    args: [token.id],
  });
  const row = res.rows[0] as unknown as { id: string; outlet_id: string; full_name: string; status: string } | undefined;
  if (!row || row.outlet_id !== token.outletId || row.status !== "active") return unauthorized(c);
  c.set("gasActor", { kind: "manager", id: row.id, outletId: row.outlet_id, name: row.full_name });
  await next();
}

/** Either an attendant or a station manager of the outlet in the token. */
export async function requireGasStaff(c: Context, next: Next) {
  const token = await readToken(c);
  if (!token) return unauthorized(c);
  return token.kind === "manager" ? requireManager(c, next) : requireAttendant(c, next);
}

// ---- PINs ------------------------------------------------------------------

const BCRYPT_ROUNDS = 10;
/** Values the old code shipped as defaults. They are never accepted as a PIN. */
const LEGACY_DEFAULT_PIN = "1234";
const WEAK_PINS = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "123456", "654321", "000000", "111111"]);

export function validatePinFormat(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "PIN must be 4 to 8 digits.";
  if (WEAK_PINS.has(pin)) return "That PIN is too easy to guess. Choose another.";
  return null;
}

export const hashPin = (pin: string) => bcrypt.hash(pin, BCRYPT_ROUNDS);

/** A random numeric PIN for a new account; shown once to whoever created it. */
export function generatePin(): string {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const pin = String(100000 + (buf[0] % 900000));
    if (!validatePinFormat(pin)) return pin;
  }
}

/**
 * True when `pin` matches what is stored. Accounts with no PIN, or still on
 * the old default, can never sign in: someone has to set a real PIN first.
 */
export async function pinMatches(stored: unknown, pin: string): Promise<boolean> {
  if (typeof stored !== "string" || !stored || stored === LEGACY_DEFAULT_PIN) return false;
  if (!stored.startsWith("$2")) return false; // unhashed legacy values are not trusted
  return bcrypt.compare(pin, stored);
}

/**
 * Throttles guessing per account and per source address. Returns a response
 * to send when locked out, otherwise a `fail`/`succeed` pair to call once the
 * PIN has been checked.
 */
export async function pinAttemptGuard(c: Context, scope: string, accountKey: string) {
  const { pinMaxAttempts } = await getGasSettings();
  const keys = [
    `gas-pin:${scope}:${await hashKey(accountKey)}`,
    `gas-pin-ip:${scope}:${await hashKey(c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? "local")}`,
  ];
  for (const key of keys) {
    const lock = await checkLockout(key);
    if (!lock.allowed) {
      return {
        blocked: c.json({ error: "too_many_attempts", message: "Too many wrong PINs. Try again later.", retryAfterSeconds: lock.retryAfterSeconds }, 429),
        fail: async () => {},
        succeed: async () => {},
      };
    }
  }
  return {
    blocked: null,
    fail: async () => {
      await recordFailureTimes(keys[0], pinMaxAttempts);
      // Several staff share one station network, so the per-address limit is looser than the per-account one.
      await recordFailureTimes(keys[1], pinMaxAttempts * 4);
    },
    succeed: async () => {
      await clearFailures(keys[0]);
    },
  };
}

/**
 * Records a failure and applies the admin's attempt limit: up to `maxAttempts`
 * wrong PINs are free, after that the lockout doubles each time (1, 2, 4 …
 * minutes, capped at an hour). Overrides the shared limiter's built-in
 * allowance so the setting is the single source of truth.
 */
async function recordFailureTimes(key: string, maxAttempts: number) {
  await recordFailure(key);
  const res = await db.execute({ sql: "SELECT count FROM rate_limits WHERE key = ?", args: [key] });
  const count = Number(res.rows[0]?.count ?? 1);
  if (count <= maxAttempts) {
    await db.execute({ sql: "UPDATE rate_limits SET locked_until = NULL WHERE key = ?", args: [key] });
    return;
  }
  const minutes = Math.min(60, 2 ** (count - maxAttempts - 1));
  await db.execute({ sql: "UPDATE rate_limits SET locked_until = datetime('now', ?) WHERE key = ?", args: [`+${minutes} minutes`, key] });
}

let dummyHash: Promise<string> | null = null;
/** Spends the same time as a real PIN check, so an unknown code can't be told apart by response time. */
export async function burnPinCheck(pin: string): Promise<void> {
  dummyHash ??= hashPin("no-such-account-pin");
  await bcrypt.compare(pin, await dummyHash);
}
