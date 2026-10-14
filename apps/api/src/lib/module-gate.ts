import type { Context, MiddlewareHandler } from "hono";
import type { ModuleKey } from "@peebee/shared";
import { isModuleEnabled } from "./settings.js";

/** Refusal for a request to use a module an admin has hidden from the customer app. */
export function moduleHidden(c: Context, module: ModuleKey) {
  return c.json({ error: "module_unavailable", module, message: "This isn't available right now." }, 404);
}

/**
 * New customer actions that belong to a hidden module are refused, so a stale
 * app tab or a hand-made request can't use something the admin switched off.
 * Reading (browsing) is hidden in the apps; only the actions that create
 * something are blocked here. Orders already in flight are untouched.
 */
const RULES: Array<{ method: string; path: RegExp; module: ModuleKey }> = [
  { method: "POST", path: /^\/v1\/car\/bookings$/, module: "ride.car" },
  { method: "POST", path: /^\/v1\/car\/carpool\/trips\/[^/]+\/seats$/, module: "ride.rideshare" },
  { method: "POST", path: /^\/v1\/car\/rentals$/, module: "ride.selfdrive" },
  { method: "POST", path: /^\/v1\/marketplace\/checkout$/, module: "shopping" },
  { method: "POST", path: /^\/v1\/pharmacy\/prescriptions$/, module: "shopping.pharmacy" },
];

export const moduleGate: MiddlewareHandler = async (c, next) => {
  const hit = RULES.find((r) => r.method === c.req.method && r.path.test(c.req.path));
  if (hit && !(await isModuleEnabled(hit.module))) return moduleHidden(c, hit.module);
  await next();
};
