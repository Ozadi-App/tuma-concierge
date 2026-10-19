import { Hono } from "hono";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { adminRoutes } from "./admin.js";
import { contractRoutes } from "./contracts.js";
import { jobRoutes } from "./jobs.js";
import { membershipRoutes } from "./membership.js";
import { profileRoutes } from "./profiles.js";
import { recurrenceRoutes } from "./recurrence.js";
import { talentReady } from "./service.js";
import { getTalentSettings } from "./settings.js";

/**
 * Peebee Jobs — a marketplace where anyone can find workers and any worker can
 * find work: quick gigs, projects and hiring posts. Mounted at /v1/talent.
 * Everyone signs in with an ordinary Peebee account; what they can do depends on
 * whether they offer work, hire, or are staff.
 */
export const talentRoutes = new Hono();
talentRoutes.use("*", requireAuth);

// Until migration 0110 is applied everything answers "upgrade pending".
talentRoutes.use("*", async (c, next) => {
  if (!(await talentReady())) return c.json({ error: "talent_upgrade_pending", message: "Peebee Jobs is being set up. Try again shortly." }, 503);
  // The master switch closes the member side; staff keep access so they can finish open work.
  if (!c.req.path.includes("/admin/") && !c.req.path.endsWith("/config") && !(await getTalentSettings()).enabled) {
    return c.json({ error: "service_disabled", message: "Peebee Jobs isn't available right now." }, 503);
  }
  await next();
});

talentRoutes.use("/admin/*", requireRole("admin"));

talentRoutes.route("/", profileRoutes);
talentRoutes.route("/", jobRoutes);
talentRoutes.route("/", contractRoutes);
talentRoutes.route("/", membershipRoutes);
talentRoutes.route("/", recurrenceRoutes);
talentRoutes.route("/", adminRoutes);
