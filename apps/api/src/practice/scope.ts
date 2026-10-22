import type { Context, Next } from "hono";
import { verifyToken } from "../auth/jwt.js";
import { runInPractice } from "../db/practice-context.js";
import { gasTokenIsPractice } from "../gas/auth.js";

/** Runs a request made with a practice session token as the sandbox, for that request only. The routes do not know the difference. */
export async function practiceScope(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return next();
  const token = header.slice(7);
  let practice = false;
  try {
    practice = (await verifyToken(token)).practice === true;
  } catch {
    // Not an app session. A pump attendant's or manager's session is a different kind of token.
    practice = await gasTokenIsPractice(token);
  }
  return practice ? runInPractice(next) : next();
}
