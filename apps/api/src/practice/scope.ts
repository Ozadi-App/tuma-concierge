import type { Context, Next } from "hono";
import { verifyToken } from "../auth/jwt.js";
import { runInPractice } from "../db/practice-context.js";

/** Runs a request made with a practice session token as the sandbox, for that request only. The routes do not know the difference. */
export async function practiceScope(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return next();
  let practice = false;
  try {
    practice = (await verifyToken(header.slice(7))).practice === true;
  } catch {
    return next(); // Not a valid token: requireAuth will say so.
  }
  return practice ? runInPractice(next) : next();
}
