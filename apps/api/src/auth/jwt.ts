import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env.local (or set the Worker var/secret).");
  }
  return encoder.encode(secret);
}

/** Pinned on both sign and verify so a token minted for something else that
 * happens to share our signing secret can't be replayed against this API. */
const ISSUER = "peebee-api";
const AUDIENCE = "peebee-app";

/** Seven days, not thirty. The token lives in localStorage on all three
 * frontends, so its lifetime is the blast radius of any future XSS or a
 * borrowed device — short enough to matter, long enough that a rider isn't
 * logged out mid-week. Revocation (see requireAuth) covers the rest. */
export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type AuthTokenPayload = {
  sub: string;
  role: "customer" | "rider" | "admin";
  phone: string | null;
  /** Unique per token, so a single sign-out can kill one session. */
  jti: string;
  /** Seconds since the epoch, compared against users.sessions_valid_from. */
  iat: number;
  /** Set on a guest-checkout token: it only works on that one order (see GUEST_ALLOWED in middleware). */
  guestOrderId?: string;
  /** Set on a practice-session token: every request it makes runs against the practice database. */
  practice?: boolean;
};

/** A practice session is a day: it is a training account, and a fresh one is one tap away. */
export const PRACTICE_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export async function signToken(payload: {
  sub: string;
  role: AuthTokenPayload["role"];
  phone?: string | null;
  guestOrderId?: string;
  practice?: boolean;
}): Promise<string> {
  return new SignJWT({ role: payload.role, phone: payload.phone ?? null, ...(payload.guestOrderId ? { gst: payload.guestOrderId } : {}), ...(payload.practice ? { prc: 1 } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(crypto.randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${payload.practice ? PRACTICE_TOKEN_TTL_SECONDS : TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return {
    sub: payload.sub as string,
    role: payload.role as AuthTokenPayload["role"],
    phone: (payload.phone as string | null | undefined) ?? null,
    jti: (payload.jti as string | undefined) ?? "",
    iat: (payload.iat as number | undefined) ?? 0,
    ...(typeof payload.gst === "string" ? { guestOrderId: payload.gst } : {}),
    ...(payload.prc === 1 ? { practice: true } : {}),
  };
}
