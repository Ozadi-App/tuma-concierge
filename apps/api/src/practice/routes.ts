import { Hono, type Context } from "hono";
import { z } from "zod";
import { logActivity } from "../admin/activity.js";
import { requirePermission } from "../admin/permissions.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { signToken } from "../auth/jwt.js";
import { signGasToken } from "../gas/auth.js";
import { db } from "../db/client.js";
import { inPractice, runInPractice } from "../db/practice-context.js";
import { clientIp } from "../lib/ratelimit.js";
import { getPlatformEnvironment, getSetting } from "../lib/settings.js";
import { placeStarterOrders, topUpDemoOrders } from "./demo-customers.js";
import { moduleCoverage } from "./coverage.js";
import { PRACTICE_PERSONA_FOR_ROLE } from "./personas.js";
import { isPracticeSeeded, practiceCounts, resetPracticeWorld, seedPracticeWorld } from "./seed.js";

export const practiceRoutes = new Hono();

async function modeOn(): Promise<boolean> {
  return (await getSetting("user_practice_mode_enabled")) === "1";
}

/** Is the shared practice world on offer to this person right now? The apps fall back to their built-in sample when it is not. */
practiceRoutes.get("/practice/world", requireAuth, async (c) => {
  const available = await modeOn();
  return c.json({ available, seeded: available ? await isPracticeSeeded() : false });
});

const sessionSchema = z.object({ role: z.enum(["customer", "rider", "merchant", "restaurant", "pharmacy", "gas", "learner", "educator", "provider", "worker"]) });

/**
 * Starts a practice session: signs the caller in as the practice persona for their app. The caller's own account is not
 * used or changed. The first session lays the practice world down if an admin has not already.
 */
practiceRoutes.post("/practice/session", requireAuth, async (c) => {
  if (inPractice()) return c.json({ error: "already_practising", message: "You are already in practice." }, 409);
  if (!(await modeOn())) return c.json({ error: "practice_off", message: "Practice is switched off right now." }, 403);
  const parsed = sessionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  let personaId = PRACTICE_PERSONA_FOR_ROLE[parsed.data.role];
  if (!personaId) {
    // Providers and workers come from the Work and Hire demos, whose ids are set by those installers.
    personaId = await runInPractice(async () => {
      if (!(await isPracticeSeeded())) await seedPracticeWorld();
      const found = parsed.data.role === "provider"
        ? await db.execute("SELECT user_id AS id FROM work_providers WHERE id LIKE 'wpr\\_demo\\_%' ESCAPE '\\' ORDER BY id LIMIT 1")
        : await db.execute("SELECT user_id AS id FROM talent_profiles WHERE user_id LIKE 'talent\\_demo\\_%' ESCAPE '\\' ORDER BY user_id LIMIT 1");
      return String(found.rows[0]?.id ?? "");
    });
  }
  if (parsed.data.role === "gas") return gasSession(c, personaId);
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

/** The pump app signs in with its own kind of session: a practice attendant with a shift already open. */
async function gasSession(c: Context, attendantId: string) {
  const attendant = await runInPractice(async () => {
    if (!(await isPracticeSeeded())) await seedPracticeWorld();
    const found = (await db.execute({ sql: "SELECT id, outlet_id, full_name, attendant_code, phone, pump_lane, status FROM fuel_pump_attendants WHERE id = ?", args: [attendantId] })).rows[0];
    if (found) {
      const open = await db.execute({ sql: "SELECT id FROM fuel_attendant_shifts WHERE attendant_id = ? AND status = 'open' AND date(opened_at) = date('now') LIMIT 1", args: [attendantId] });
      if (!open.rows[0]) await db.execute({ sql: "INSERT INTO fuel_attendant_shifts (id, attendant_id, outlet_id, status) VALUES (?, ?, ?, 'open')", args: [`prac_shift_${Date.now()}`, attendantId, found.outlet_id] });
    }
    return found;
  });
  if (!attendant) return c.json({ error: "practice_not_ready", message: "The practice world is missing its pump attendant." }, 503);
  const token = await signGasToken({ kind: "attendant", id: attendantId, outletId: String(attendant.outlet_id), practice: true });
  return c.json({ token, role: "gas", attendant: { id: attendantId, code: attendant.attendant_code, name: attendant.full_name, phone: attendant.phone, pump_lane: attendant.pump_lane ?? "", on_duty: attendant.status === "on_duty", outletId: attendant.outlet_id } });
}

const adminGuard = [requireAuth, requireRole("admin"), requirePermission("settings.manage")] as const;

practiceRoutes.get("/admin/practice", ...adminGuard, async (c) =>
  c.json({ seeded: await isPracticeSeeded(), counts: await practiceCounts(), coverage: await runInPractice(moduleCoverage), platformEnvironment: await getPlatformEnvironment() }));

practiceRoutes.post("/admin/practice/seed", ...adminGuard, async (c) => {
  const counts = await runInPractice(async () => {
    await seedPracticeWorld();
    await placeStarterOrders();
    return practiceCounts();
  });
  await logActivity({ actor: c.get("user"), action: "practice.seed", entityType: "practice", summary: "Laid down the practice world", after: counts, ip: clientIp(c) });
  return c.json({ seeded: true, counts });
});

/** Ask the demo customers to place orders now (they also do it by themselves every couple of minutes). */
practiceRoutes.post("/admin/practice/orders", ...adminGuard, async (c) => {
  const placed = await runInPractice(() => topUpDemoOrders(6));
  return c.json({ placed });
});

/** Practice orders and the money they moved are cleared and the demo people are back to their starting balances. Live data is not touched. */
practiceRoutes.post("/admin/practice/reset", ...adminGuard, async (c) => {
  const counts = await runInPractice(async () => {
    await resetPracticeWorld();
    await seedPracticeWorld();
    await placeStarterOrders();
    return practiceCounts();
  });
  await logActivity({ actor: c.get("user"), action: "practice.reset", entityType: "practice", summary: "Reset the practice world to its starting state", after: counts, ip: clientIp(c) });
  return c.json({ seeded: true, counts });
});
