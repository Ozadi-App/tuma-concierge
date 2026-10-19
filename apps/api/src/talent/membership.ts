import { Hono } from "hono";
import { db } from "../db/client.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { cancelSubscription, entitlementFor, myMembership, subscribe } from "./monetization.js";
import { parseList, type Row } from "./service.js";
import { getTalentSettings } from "./settings.js";

export const membershipRoutes = new Hono();

/** Plans a person can choose, with what each unlocks. */
membershipRoutes.get("/plans", async (c) => {
  c.header("Cache-Control", "private, no-store");
  const user = c.get("user");
  const s = await getTalentSettings();
  const plans = (await db.execute({ sql: "SELECT * FROM talent_plans WHERE active = 1 ORDER BY sort_order, price_ugx", args: [] })).rows as Row[];
  const features = new Map(((await db.execute({ sql: "SELECT key, label, description, pro FROM talent_features", args: [] })).rows as Row[]).map((f) => [String(f.key), f]));
  const [worker, employer] = await Promise.all([entitlementFor(user.sub, "worker"), entitlementFor(user.sub, "employer")]);
  const ownedPlanIds = new Set([...worker.plans, ...employer.plans].map((p) => String(p.id)));
  const usedTrials = new Set(((await db.execute({ sql: "SELECT plan_id FROM talent_subscriptions WHERE user_id = ? AND plan_id IS NOT NULL AND status = 'trial' OR (user_id = ? AND plan_id IS NOT NULL AND status IN ('expired', 'cancelled') AND price_paid_ugx = 0)", args: [user.sub, user.sub] })).rows as Row[]).map((r) => String(r.plan_id)));
  return c.json({
    freeAccess: s.freeAccess,
    plans: plans.map((p) => ({
      id: String(p.id), code: String(p.code), audience: String(p.audience), name: String(p.name), description: String(p.description),
      priceUgx: s.freeAccess ? 0 : Number(p.price_ugx), listPriceUgx: Number(p.price_ugx), periodDays: Number(p.period_days), trialDays: Number(p.trial_days),
      features: parseList(p.features).map((k) => ({ key: k, label: String(features.get(k)?.label ?? k), description: String(features.get(k)?.description ?? ""), pro: Number(features.get(k)?.pro ?? 0) === 1 })),
      waivedKinds: parseList(p.waived_kinds),
      workerCommissionPercent: p.worker_commission_percent == null ? null : Number(p.worker_commission_percent),
      employerCommissionPercent: p.employer_commission_percent == null ? null : Number(p.employer_commission_percent),
      subscribed: ownedPlanIds.has(String(p.id)),
      trialAvailable: Number(p.trial_days) > 0 && !usedTrials.has(String(p.id)),
    })),
  });
});

membershipRoutes.get("/membership", async (c) => {
  c.header("Cache-Control", "private, no-store");
  return c.json(await myMembership(c.get("user").sub, await getTalentSettings()));
});

membershipRoutes.post("/plans/:id/subscribe", async (c) => {
  const user = c.get("user");
  const result = await subscribe(user.sub, c.req.param("id"), await getPlatformEnvironment());
  if (!result.ok) return c.json({ error: result.error, needed: result.needed, message: result.message }, result.error === "insufficient_funds" ? 402 : result.error === "plan_not_found" ? 404 : 409);
  return c.json({ ok: true, trial: result.trial, expiresAt: String(result.subscription.expires_at) }, 201);
});

membershipRoutes.post("/subscriptions/:id/cancel", async (c) => {
  const ok = await cancelSubscription(c.get("user").sub, c.req.param("id"));
  if (!ok) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
