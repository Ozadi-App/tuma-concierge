import type { Context, Next } from "hono";
import { verifyToken } from "../auth/jwt.js";
import { practiceAvailable } from "../db/client.js";
import { runInPractice } from "../db/practice-context.js";

/**
 * Sends a request made with a practice session token to the practice database. Mounted before every route, so the
 * routes themselves do not know the difference. A practice token with no practice database behind it is refused here:
 * it must never be answered from the live one.
 */
export async function practiceScope(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return next();
  let practice = false;
  try {
    practice = (await verifyToken(header.slice(7))).practice === true;
  } catch {
    return next(); // Not a valid token: requireAuth will say so.
  }
  if (!practice) return next();
  if (!practiceAvailable()) return c.json({ error: "practice_unavailable", message: "Practice is not available right now." }, 503);
  return runInPractice(next);
}
