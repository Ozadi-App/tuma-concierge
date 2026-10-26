import type { Context } from "hono";
import { verifyToken } from "../auth/jwt.js";
import { clientIp, hashKey } from "../lib/ratelimit.js";

/**
 * Public pages are read by people who are not signed in. When a valid sign-in token is sent we use it
 * to personalise the page (am I following, am I a member); otherwise the visitor is anonymous and
 * told apart only by a hash of their network address and browser, for rate limits and view counting.
 */
export async function optionalUser(c: Context): Promise<{ id: string; role: string } | null> {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const p = await verifyToken(header.slice(7));
    return { id: p.sub, role: p.role };
  } catch {
    return null;
  }
}

export async function viewerKey(c: Context, user: { id: string } | null): Promise<string> {
  return user ? user.id : `anon_${await hashKey(`${clientIp(c)}|${c.req.header("user-agent") ?? ""}`)}`;
}

export const originOf = (c: Context) => new URL(c.req.url).origin;
