import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A served ad is tied to a signed token, so a beacon can only count events for an ad Peebee really
 * chose to show, on the video and creator it was shown on, once, and not long after the fact.
 */
export type ServeClaims = {
  serve: string;
  campaign: string;
  creative: string;
  asset: string | null;
  creator: string | null;
  viewer: string;
  slot: string;
  /** Unix seconds. */
  exp: number;
};

const b64 = (b: Buffer) => b.toString("base64url");

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return `ads-serve:${s}`;
}

export function signServe(claims: ServeClaims): string {
  const body = b64(Buffer.from(JSON.stringify(claims)));
  return `${body}.${b64(createHmac("sha256", secret()).update(body).digest())}`;
}

export function verifyServe(token: string, now = Math.floor(Date.now() / 1000)): ServeClaims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ServeClaims;
    return claims.exp > now ? claims : null;
  } catch {
    return null;
  }
}
