import { Hono } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { signToken } from "../auth/jwt.js";
import { db, practiceAvailable } from "../db/client.js";
import { inPractice, runInPractice } from "../db/practice-context.js";
import { clientIp } from "../lib/ratelimit.js";
import { getSetting } from "../lib/settings.js";
import { topUpDemoOrders } from "./demo-customers.js";
import { PRACTICE_PERSONA_FOR_ROLE } from "./personas.js";
import { isPracticeSeeded, practiceCounts, resetPracticeWorld, seedPracticeWorld } from "./seed.js";

export const practiceRoutes = new Hono();

async function modeOn(): Promise<boolean> {
  return (await getSetting("user_practice_mode_enabled")) === "1";
}

/** Can this device practise against the shared practice world, or must the app fall back to its built-in local sample? */
practiceRoutes.get("/practice/world", requireAuth, async (c) => {
  const available = practiceAvailable() && (await modeOn());
  return c.json({ available, shared: available && !inPractice() });
});

const sessionSchema = z.object({ role: z.enum(["customer", "rider", "merchant", "restaurant"]) });

/**
 * Starts a practice session: signs the caller in as the practice persona for their app. The caller's own account is not
 * used or changed. The first session lays the practice world down if an admin has not already.
 */
practiceRoutes.post("/practice/session", requireAuth, async (c) => {
  if (inPractice()) return c.json({ error: "already_practising", message: "You are already in practice." }, 409);
  if (!(await modeOn())) return c.json({ error: "practice_off", message: "Practice is switched off right now." }, 403);
  if (!practiceAvailable()) return c.json({ error: "practice_unavailable", message: "The shared practice world is not set up yet." }, 503);
  const parsed = sessionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const personaId = PRACTICE_PERSONA_FOR_ROLE[parsed.data.role];
  const persona = await runInPractice(async () => {
    if (!(await isPracticeSeeded())) await seedPracticeWorld();
    // Demo customers keep ordering, so there is always something to take, prepare or sell.
    await topUpDemoOrders(3).catch((err) => console.error("Practice top-up failed:", err));
    const res = await db.execute({ sql: "SELECT id, name, phone, role FROM users WHERE id = ?", args: [personaId] });
    return res.rows[0];
  });
  if (!persona) return c.json({ error: "practice_not_ready", message: "The practice world is missing its starting accounts." }, 503);
  const token = await signToken({ sub: personaId, role: persona.role as "customer" | "rider", phone: (persona.phone as string | null) ?? null, practice: true });
  return c.json({ token, role: parsed.data.role, user: { id: personaId, name: persona.name, role: persona.role, phone: persona.phone } });
});

const adminGuard = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;

practiceRoutes.get("/admin/practice", ...adminGuard, async (c) => {
  const available = practiceAvailable();
  if (!available) return c.json({ available, seeded: false, counts: null });
  return c.json(await runInPractice(async () => ({ available, seeded: await isPracticeSeeded(), counts: await practiceCounts() })));
});

practiceRoutes.post("/admin/practice/seed", ...adminGuard, async (c) => {
  if (!practiceAvailable()) return c.json({ error: "practice_unavailable", message: "Create the practice database and bind it as PRACTICE_DB first." }, 503);
  const counts = await runInPractice(seedPracticeWorld);
  await logActivity({ actor: c.get("user"), action: "practice.seed", entityType: "practice", summary: "Laid down the practice world", after: counts, ip: clientIp(c) });
  return c.json({ available: true, seeded: true, counts });
});

/** Ask the demo customers to place orders now (they also do it by themselves every couple of minutes). */
practiceRoutes.post("/admin/practice/orders", ...adminGuard, async (c) => {
  if (!practiceAvailable()) return c.json({ error: "practice_unavailable", message: "There is no practice database." }, 503);
  const placed = await runInPractice(() => topUpDemoOrders(6));
  return c.json({ placed });
});

/** Back to an empty practice database. Live data is never touched: the wipe runs inside the practice context only. */
practiceRoutes.post("/admin/practice/reset", ...adminGuard, async (c) => {
  if (!practiceAvailable()) return c.json({ error: "practice_unavailable", message: "There is no practice database to reset." }, 503);
  const counts = await runInPractice(async () => {
    await resetPracticeWorld();
    return seedPracticeWorld();
  });
  await logActivity({ actor: c.get("user"), action: "practice.reset", entityType: "practice", summary: "Reset the practice world to its starting state", after: counts, ip: clientIp(c) });
  return c.json({ available: true, seeded: true, counts });
});
