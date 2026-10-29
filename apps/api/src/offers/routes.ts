import { INCENTIVE_INFO, INCENTIVE_KINDS, OFFER_KIND_INFO } from "@peebee/shared";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasTable } from "../lib/schema.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { debitWallet } from "../wallet/service.js";
import { getCreditConfig, getDiscountWalletConfig, getIncentiveConfig, getOffersConfig } from "./config.js";
import { creditAvailable, getCreditBalance } from "./credit.js";
import { clearIfDue, discountBalance, discountWalletAvailable } from "./discount-wallet.js";
import { holderOf, incentivesAvailable } from "./incentives.js";
import { customerProfile, getOffer, listOffers, offersAvailable, resolveOrderOffer } from "./service.js";

type Row = Record<string, unknown>;

/** Customer and rider sides of offers, credit, referrals, the discount wallet and incentives. */
export const offersRoutes = new Hono();

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

function describe(o: { discountType: "percent" | "flat"; value: number; maxDiscount: number; kind: string }): string {
  if (o.kind === "free_ride") return o.maxDiscount > 0 ? `Free ride up to ${ugx(o.maxDiscount)}` : "Free ride";
  const base = o.discountType === "percent" ? `${o.value}% ${o.kind === "cashback" ? "cashback" : "off"}` : `${ugx(o.value)} ${o.kind === "cashback" ? "cashback" : "off"}`;
  return o.maxDiscount > 0 && o.discountType === "percent" ? `${base} (up to ${ugx(o.maxDiscount)})` : base;
}

/** What a customer can see: the offers they could get, what they hold, their credit and their referral code. */
offersRoutes.get("/offers/mine", requireAuth, async (c) => {
  const user = c.get("user");
  const env = await getPlatformEnvironment();
  const cfg = await getOffersConfig();
  const [all, profile, credit] = await Promise.all([listOffers({ status: "active" }), offersAvailable().then((ok) => (ok ? customerProfile(user.sub, env, cfg) : null)), getCreditBalance(user.sub, env)]);
  const now = Date.now();
  const visible = cfg.enabled
    ? all.filter((o) => (!o.endsAt || new Date(o.endsAt).getTime() > now) && o.kind !== "promo_code" && (o.autoApply || (profile?.grants[o.id] ?? 0) > 0)).filter((o) => o.services.length === 0 || o.services.some((s) => cfg.services[s]))
    : [];
  return c.json({
    enabled: cfg.enabled,
    allowCodeEntry: cfg.allowCodeEntry,
    offers: visible.map((o) => ({ id: o.id, name: o.name, description: o.description, kind: o.kind, kindLabel: OFFER_KIND_INFO[o.kind].label, summary: describe(o), services: o.services, endsAt: o.endsAt, remaining: profile?.grants[o.id] ?? null })),
    credit,
    referral: cfg.referral.enabled ? { creditForFriend: cfg.referral.referrerCreditUgx } : null,
  });
});

/** The price of this order with offers applied. The customer's screen calls this with the code they typed (if any). */
offersRoutes.post("/orders/:id/offer/preview", requireAuth, async (c) => {
  const user = c.get("user");
  const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [c.req.param("id") as string] })).rows[0] as Row | undefined;
  if (!order) return c.json({ error: "not_found" }, 404);
  if (order.customer_id !== user.sub) return c.json({ error: "forbidden" }, 403);
  const parsed = z.object({ code: z.string().trim().max(30).nullable().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const resolved = await resolveOrderOffer(order, parsed.data.code ?? null);
  const code = (parsed.data.code ?? "").trim();
  const codeProblem = code ? resolved.considered.find((r) => !r.eligible && r.reason && r.kind === "promo_code")?.reason : undefined;
  return c.json({
    enabled: resolved.enabled,
    fare: resolved.fare,
    discount: resolved.discount,
    cashback: resolved.cashback,
    payable: resolved.payable,
    applied: resolved.applied.map((a) => ({ offerId: a.offerId, name: a.name, discount: a.discount, cashback: a.cashback })),
    codeAccepted: code ? resolved.applied.some((a) => a.kind === "promo_code") : null,
    codeMessage: code && !resolved.applied.some((a) => a.kind === "promo_code") ? (codeProblem ?? "That code is not valid for this ride.") : null,
  });
});

/** Buy a ride pack with wallet cash. */
offersRoutes.post("/offers/packs/:id/buy", requireAuth, requireRole("customer"), async (c) => {
  const user = c.get("user");
  if (!(await offersAvailable()) || !(await hasTable("offer_grants"))) return c.json({ error: "migration_pending" }, 503);
  const cfg = await getOffersConfig();
  if (!cfg.enabled || !cfg.packsPurchasable) return c.json({ error: "not_available", message: "Ride packs aren't on sale right now." }, 409);
  const offer = await getOffer(c.req.param("id") as string);
  if (!offer || offer.kind !== "bundle" || offer.status !== "active" || !offer.conditions.packRides || !offer.conditions.packPrice) {
    return c.json({ error: "not_found", message: "That pack isn't on sale." }, 404);
  }
  if (offer.endsAt && new Date(offer.endsAt).getTime() < Date.now()) return c.json({ error: "ended", message: "That pack is no longer on sale." }, 409);
  const env = await getPlatformEnvironment();
  const balance = await debitWallet(user.sub, offer.conditions.packPrice, { type: "order_payment", environment: env, note: `Ride pack: ${offer.name}` });
  if (balance === null) return c.json({ error: "insufficient_wallet_balance" }, 409);
  await db.execute({ sql: "INSERT INTO offer_grants (id, offer_id, user_id, uses_left, source) VALUES (?, ?, ?, ?, 'purchase')", args: [newId("grt"), offer.id, user.sub, offer.conditions.packRides] });
  return c.json({ ok: true, rides: offer.conditions.packRides, balance });
});

/** Packs available to buy. */
offersRoutes.get("/offers/packs", requireAuth, async (c) => {
  const cfg = await getOffersConfig();
  if (!cfg.enabled || !cfg.packsPurchasable) return c.json({ packs: [] });
  const packs = (await listOffers({ status: "active" })).filter((o) => o.kind === "bundle" && o.conditions.packRides && o.conditions.packPrice);
  return c.json({ packs: packs.map((o) => ({ id: o.id, name: o.name, description: o.description, rides: o.conditions.packRides, price: o.conditions.packPrice, summary: describe(o) })) });
});

// --- referrals (customers and riders) ---------------------------------------------------

function newReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

offersRoutes.get("/offers/referral", requireAuth, async (c) => {
  const user = c.get("user");
  const cfg = await getOffersConfig();
  if (!cfg.enabled || !cfg.referral.enabled || !(await hasTable("customer_offer_profiles"))) return c.json({ enabled: false, code: null });
  let row = (await db.execute({ sql: "SELECT referral_code FROM customer_offer_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (!row?.referral_code) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.execute({
          sql: `INSERT INTO customer_offer_profiles (user_id, referral_code) VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET referral_code = COALESCE(customer_offer_profiles.referral_code, excluded.referral_code), updated_at = datetime('now')`,
          args: [user.sub, newReferralCode()],
        });
        break;
      } catch (err) {
        if (!String(err).includes("UNIQUE")) throw err;
      }
    }
    row = (await db.execute({ sql: "SELECT referral_code FROM customer_offer_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  }
  const invited = await db.execute({ sql: "SELECT COUNT(*) AS n FROM customer_offer_profiles WHERE referred_by = ?", args: [user.sub] });
  return c.json({ enabled: true, code: row?.referral_code ?? null, invited: Number((invited.rows[0] as Row).n), creditForFriend: cfg.referral.referrerCreditUgx });
});

offersRoutes.post("/offers/referral/apply", requireAuth, async (c) => {
  const user = c.get("user");
  const cfg = await getOffersConfig();
  if (!cfg.enabled || !cfg.referral.enabled || !(await hasTable("customer_offer_profiles"))) return c.json({ error: "not_available" }, 409);
  const parsed = z.object({ code: z.string().trim().min(4).max(12) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const owner = (await db.execute({ sql: "SELECT user_id FROM customer_offer_profiles WHERE referral_code = ?", args: [parsed.data.code.toUpperCase()] })).rows[0] as Row | undefined;
  if (!owner) return c.json({ error: "invalid_code", message: "That invitation code isn't valid." }, 404);
  if (owner.user_id === user.sub) return c.json({ error: "own_code", message: "You can't use your own code." }, 400);
  const mine = (await db.execute({ sql: "SELECT referred_by FROM customer_offer_profiles WHERE user_id = ?", args: [user.sub] })).rows[0] as Row | undefined;
  if (mine?.referred_by) return c.json({ error: "already_invited", message: "You already joined with an invitation." }, 409);
  // An invitation only counts for someone who has not ridden or worked yet.
  const done = await db.execute({ sql: "SELECT 1 FROM orders WHERE (customer_id = ? OR rider_id = ?) AND stage = 'Settle' LIMIT 1", args: [user.sub, user.sub] });
  if (done.rows.length > 0) return c.json({ error: "too_late", message: "Invitations are for new members." }, 409);
  await db.execute({
    sql: `INSERT INTO customer_offer_profiles (user_id, referred_by) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET referred_by = excluded.referred_by, updated_at = datetime('now')`,
    args: [user.sub, String(owner.user_id)],
  });
  return c.json({ ok: true });
});

// --- customer credit -------------------------------------------------------------------

offersRoutes.get("/credit", requireAuth, async (c) => {
  const user = c.get("user");
  const env = await getPlatformEnvironment();
  const cfg = await getCreditConfig();
  if (!(await creditAvailable())) return c.json({ enabled: false, balance: 0, lots: [], ledger: [] });
  const [balance, lots, ledger] = await Promise.all([
    getCreditBalance(user.sub, env),
    db.execute({ sql: "SELECT id, remaining, source, partner_id, expires_at FROM credit_lots WHERE user_id = ? AND environment = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY (expires_at IS NULL), expires_at LIMIT 20", args: [user.sub, env] }),
    db.execute({ sql: "SELECT type, amount, balance_after, note, created_at FROM credit_ledger WHERE user_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 30", args: [user.sub, env] }),
  ]);
  return c.json({
    enabled: cfg.enabled,
    balance,
    lots: lots.rows,
    ledger: ledger.rows,
    spendableOn: Object.entries(cfg.spendableModules).filter(([, on]) => on).map(([m]) => m),
    expiryDays: cfg.expiryDays,
  });
});

// --- riders ---------------------------------------------------------------------------

offersRoutes.get("/riders/me/discount-wallet", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const env = await getPlatformEnvironment();
  const cfg = await getDiscountWalletConfig();
  if (!(await discountWalletAvailable())) return c.json({ enabled: false, balance: 0, ledger: [] });
  const holder = await holderOf(user.sub);
  const [balance, ledger, pending] = await Promise.all([
    discountBalance(holder, user.sub, env),
    db.execute({ sql: "SELECT type, amount, balance_after, note, created_at FROM rider_discount_ledger WHERE rider_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 30", args: [user.sub, env] }),
    db.execute({ sql: "SELECT 1 FROM rider_discount_requests WHERE rider_id = ? AND environment = ? AND status = 'pending'", args: [user.sub, env] }),
  ]);
  return c.json({
    enabled: cfg.enabled,
    balance,
    ledger: ledger.rows,
    offsetsCommission: cfg.offsetCommission,
    payoutMethod: cfg.payoutMethod,
    canRequest: cfg.riderCanRequest && cfg.payoutMethod !== "none" && balance >= cfg.minPayout,
    minPayout: cfg.minPayout,
    requestPending: pending.rows.length > 0,
  });
});

offersRoutes.post("/riders/me/discount-wallet/request", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const env = await getPlatformEnvironment();
  const cfg = await getDiscountWalletConfig();
  if (!(await discountWalletAvailable()) || !cfg.enabled) return c.json({ error: "not_available" }, 409);
  if (!cfg.riderCanRequest) return c.json({ error: "not_allowed", message: "Payouts are made automatically." }, 403);
  const holder = await holderOf(user.sub);
  const result = await clearIfDue({ holder, id: user.sub, env, requested: true, cfg });
  if (result.paid === 0 && result.queued === 0) return c.json({ error: "nothing_to_pay", message: `You need at least ${ugx(cfg.minPayout)} to ask for a payout.` }, 409);
  return c.json(result);
});

/** What a rider can earn: only the incentives an admin has switched on, in plain words, with this month's earnings. */
offersRoutes.get("/riders/me/incentives", requireAuth, requireRole("rider"), async (c) => {
  const user = c.get("user");
  const env = await getPlatformEnvironment();
  const cfg = await getIncentiveConfig();
  if (!cfg.enabled) return c.json({ enabled: false, active: [], earnedThisMonth: 0, recent: [] });
  const k = cfg.kinds;
  const detail: Record<string, string> = {
    trip_streak: `Complete ${k.trip_streak.rides} rides in a day${k.trip_streak.noCancelRequired ? " without cancelling" : ""} for ${ugx(k.trip_streak.bonus)}.`,
    weekly_ladder: k.weekly_ladder.tiers.map((t) => `${t.rides}+ rides in a week: ${ugx(t.bonus)}`).join(" · "),
    peak_boost: `${k.peak_boost.rule.type === "flat" ? ugx(k.peak_boost.rule.value) : `${k.peak_boost.rule.value}%`} extra per ride in rush hours.`,
    zone_boost: `${k.zone_boost.rule.type === "flat" ? ugx(k.zone_boost.rule.value) : `${k.zone_boost.rule.value}%`} extra for pickups in boosted areas.`,
    reliability_bonus: `${ugx(k.reliability_bonus.bonus)} a month for finishing ${k.reliability_bonus.minCompletionPercent}% of rides with few cancellations (at least ${k.reliability_bonus.minRides} rides).`,
    rating_bonus: `${ugx(k.rating_bonus.bonus)} a week for a rating of ${k.rating_bonus.minRating} or more.`,
    rider_referral: `${ugx(k.rider_referral.bonus)} when a rider you recruited finishes ${k.rider_referral.afterRides} rides.`,
    commission_holiday: `${k.commission_holiday.waivePercent}% off commission${k.commission_holiday.firstDays ? ` for your first ${k.commission_holiday.firstDays} days` : ""}${k.commission_holiday.firstRides ? ` and first ${k.commission_holiday.firstRides} rides` : ""}.`,
    commission_tiers: k.commission_tiers.tiers.map((t) => `${t.ridesPerMonth}+ rides a month: ${t.percent}% commission`).join(" · "),
    online_hours: `${ugx(k.online_hours.bonus)} a week for ${k.online_hours.hoursPerWeek}+ hours online at busy times.`,
    long_pickup: `${ugx(k.long_pickup.perKm)} per km when you travel more than ${k.long_pickup.thresholdKm} km to a pickup (up to ${ugx(k.long_pickup.maxAmount)}).`,
    night_bonus: `${k.night_bonus.rule.type === "flat" ? ugx(k.night_bonus.rule.value) : `${k.night_bonus.rule.value}%`} extra per ride on night shifts.`,
    fuel_support: `${ugx(k.fuel_support.credit)} fuel support for ${k.fuel_support.weeklyRides}+ rides a week.`,
    milestones: k.milestones.milestones.map((m) => `${m.rides} rides: ${ugx(m.bonus)}`).join(" · "),
    leaderboard: `Top ${k.leaderboard.prizes.length} riders each ${k.leaderboard.period} win ${k.leaderboard.prizes.map(ugx).join(", ")}.`,
    welcome_back: `${ugx(k.welcome_back.bonus)} when you come back after ${k.welcome_back.inactiveDays} days and finish ${k.welcome_back.afterRides} rides.`,
  };
  const active = INCENTIVE_KINDS.filter((kind) => k[kind].enabled).map((kind) => ({ kind, label: INCENTIVE_INFO[kind].label, detail: detail[kind] }));
  let earned = 0;
  let recent: Row[] = [];
  if (await incentivesAvailable()) {
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 19).replace("T", " ");
    const [sum, list] = await Promise.all([
      db.execute({ sql: "SELECT COALESCE(SUM(amount), 0) AS s FROM rider_incentive_awards WHERE rider_id = ? AND environment = ? AND created_at >= ?", args: [user.sub, env, monthStart] }),
      db.execute({ sql: "SELECT kind, amount, note, created_at FROM rider_incentive_awards WHERE rider_id = ? AND environment = ? ORDER BY created_at DESC LIMIT 20", args: [user.sub, env] }),
    ]);
    earned = Number((sum.rows[0] as Row).s);
    recent = list.rows as Row[];
  }
  return c.json({ enabled: true, active, earnedThisMonth: earned, recent });
});
