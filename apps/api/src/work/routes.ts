import { Hono } from "hono";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { adminRoutes } from "./admin.js";
import { customerRoutes } from "./customer.js";
import { extrasRoutes } from "./extras.js";
import { providerRoutes } from "./provider.js";
import { workReady } from "./service.js";
import { getWorkSettings } from "./settings.js";

/**
 * Peebee Work — the jobs engine behind Clean, Fix and Laundry.
 * Mounted at /v1/work. Customers, providers and staff all sign in with an
 * ordinary Peebee account; what they can do depends on their role here.
 */
export const workRoutes = new Hono();
workRoutes.use("*", requireAuth);

// Until migration 0098 is applied everything answers "upgrade pending"; staff can still read settings elsewhere.
workRoutes.use("*", async (c, next) => {
  if (!(await workReady())) {
    return c.json({ error: "work_upgrade_pending", message: "Peebee Work is being set up. Try again shortly." }, 503);
  }
  // The master switch closes the customer and provider side; staff keep access so they can finish open jobs.
  if (!c.req.path.includes("/admin/") && !(await getWorkSettings()).enabled) {
    return c.json({ error: "service_disabled", message: "This service is switched off right now." }, 503);
  }
  await next();
});

workRoutes.use("/admin/*", requireRole("admin"));

workRoutes.route("/", extrasRoutes);
workRoutes.route("/", customerRoutes);
workRoutes.route("/", providerRoutes);
workRoutes.route("/", adminRoutes);
