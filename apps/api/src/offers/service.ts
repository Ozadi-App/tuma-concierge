/**
 * Customer offers: loading them, working out which apply to an order, recording what was used, and releasing it again
 * if the order never gets paid. The rules themselves are pure and live in @peebee/shared (offers.ts).
 */
import {
  loyaltyTierFor, pickOffers, type AppliedOffers, type CarTier, type CustomerOfferProfile, type Offer, type OfferConditions, type OfferKind,
  type OfferService, type OfferStatus, type OffersConfig,
} from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getCarServicePricing, getDeliverySettings, type PlatformEnvironment } from "../lib/settings.js";
import { isCarOrder } from "../car/service.js";
import { getOffersConfig } from "./config.js";

type Row = Record<string, unknown>;

export async function offersAvailable(): Promise<boolean> {
  return (await hasTable("offers")) && (await hasTable("offer_redemptions"));
}

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    return raw ? (JSON.parse(String(raw)) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function rowToOffer(r: Row, used?: { redemptions: number; spent: number }): Offer {
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ""),
    code: r.code ? String(r.code) : null,
    kind: String(r.kind) as OfferKind,
    discountType: r.discount_type === "flat" ? "flat" : "percent",
    value: Number(r.value) || 0,
    maxDiscount: Number(r.max_discount) || 0,
    minFare: Number(r.min_fare) || 0,
    services: parseJson<OfferService[]>(r.services, []),
    funder: r.funder === "rider" ? "rider" : "platform",
    autoApply: Number(r.auto_apply) === 1,
    stackable: Number(r.stackable) === 1,
    status: String(r.status) as OfferStatus,
    startsAt: r.starts_at ? String(r.starts_at) : null,
    endsAt: r.ends_at ? String(r.ends_at) : null,
    usageLimitTotal: Number(r.usage_limit_total) || 0,
    usageLimitPerUser: Number(r.usage_limit_per_user) || 0,
    budgetTotal: Number(r.budget_total) || 0,
    budgetSpent: used?.spent ?? 0,
    redemptions: used?.redemptions ?? 0,
    priority: Number(r.priority) || 0,
    conditions: parseJson<OfferConditions>(r.conditions, {}),
  };
}

/** How many times each offer was used and how much it has spent. Pending counts: it is reserved for an order in flight. */
export async function usageByOffer(): Promise<Map<string, { redemptions: number; spent: number }>> {
  const res = await db.execute({
    sql: `SELECT offer_id, COUNT(*) AS n, COALESCE(SUM(discount + cashback), 0) AS spent FROM offer_redemptions WHERE status <> 'void' GROUP BY offer_id`,
    args: [],
  });
  return new Map((res.rows as Row[]).map((r) => [String(r.offer_id), { redemptions: Number(r.n), spent: Number(r.spent) }]));
}

export async function listOffers(filter: { status?: OfferStatus } = {}): Promise<Offer[]> {
  if (!(await offersAvailable())) return [];
  const [rows, usage] = await Promise.all([
    db.execute({ sql: `SELECT * FROM offers ${filter.status ? "WHERE status = ?" : ""} ORDER BY priority DESC, created_at DESC`, args: filter.status ? [filter.status] : [] }),
    usageByOffer(),
  ]);
  return (rows.rows as Row[]).map((r) => rowToOffer(r, usage.get(String(r.id))));
}

export async function getOffer(id: string): Promise<Offer | null> {
  if (!(await offersAvailable())) return null;
  const rows = await db.execute({ sql: "SELECT * FROM offers WHERE id = ?", args: [id] });
  const row = rows.rows[0] as Row | undefined;
  if (!row) return null;
  return rowToOffer(row, (await usageByOffer()).get(id));
}

export async function customerProfile(userId: string, env: PlatformEnvironment, cfg: OffersConfig): Promise<CustomerOfferProfile> {
  const [rides, extra, used, grants] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*) AS n, MAX(updated_at) AS last FROM orders WHERE customer_id = ? AND environment = ? AND stage = 'Settle'", args: [userId, env] }),
    hasTable("customer_offer_profiles").then((ok) => (ok ? db.execute({ sql: "SELECT * FROM customer_offer_profiles WHERE user_id = ?", args: [userId] }) : { rows: [] as Row[] })),
    db.execute({ sql: "SELECT offer_id, COUNT(*) AS n FROM offer_redemptions WHERE user_id = ? AND status <> 'void' GROUP BY offer_id", args: [userId] }),
    hasTable("offer_grants").then((ok) => (ok ? db.execute({ sql: "SELECT offer_id, SUM(uses_left) AS n FROM offer_grants WHERE user_id = ? AND uses_left > 0 AND (expires_at IS NULL OR expires_at > datetime('now')) GROUP BY offer_id", args: [userId] }) : { rows: [] as Row[] })),
  ]);
  const r = rides.rows[0] as Row;
  const e = (extra.rows as Row[])[0];
  const rideCount = Number(r?.n ?? 0);
  return {
    rideCount,
    lastRideAt: r?.last ? new Date(`${String(r.last).replace(" ", "T")}Z`) : null,
    loyaltyTier: (e?.loyalty_tier_override ? String(e.loyalty_tier_override) : null) ?? loyaltyTierFor(rideCount, cfg.loyaltyTiers),
    groups: parseJson<string[]>(e?.groups, []),
    birthday: e?.birthday ? String(e.birthday) : null,
    referredBy: e?.referred_by ? String(e.referred_by) : null,
    usedByOffer: Object.fromEntries((used.rows as Row[]).map((x) => [String(x.offer_id), Number(x.n)])),
    grants: Object.fromEntries((grants.rows as Row[]).map((x) => [String(x.offer_id), Number(x.n)])),
  };
}

export type OrderService = { service: OfferService; carTier: CarTier | null; minimumFare: number; vehicle: "boda" | "car" | "delivery" };

/** Which kind of trip an order is, and the minimum fare of that service. */
export async function serviceOfOrder(order: Row): Promise<OrderService> {
  const delivery = await getDeliverySettings();
  if (await isCarOrder(String(order.id))) {
    const tier = (await hasColumn("car_bookings", "service_tier"))
      ? ((await db.execute({ sql: "SELECT service_tier FROM car_bookings WHERE order_id = ?", args: [String(order.id)] })).rows[0] as Row | undefined)?.service_tier
      : null;
    const pricing = await getCarServicePricing();
    return { service: "ride.car", carTier: tier ? (String(tier) as CarTier) : null, minimumFare: pricing.minimumFare, vehicle: "car" };
  }
  if (Number(order.is_ride) === 1) return { service: "ride.boda", carTier: null, minimumFare: delivery.rideMinimumFare, vehicle: "boda" };
  return { service: order.type === "shopping" ? "delivery.shopping" : "delivery.parcel", carTier: null, minimumFare: delivery.minimumDeliveryFee, vehicle: "delivery" };
}

export type OrderOffer = AppliedOffers & { enabled: boolean; fare: number; payable: number; service: OfferService; minimumFare: number; vehicle: "boda" | "car" | "delivery" };

const NONE: AppliedOffers = { applied: [], discount: 0, cashback: 0, considered: [] };

/** The offers that apply to an order for its customer, and what they are worth. Never throws: offers must never block a payment. */
export async function resolveOrderOffer(order: Row, code?: string | null, now = new Date()): Promise<OrderOffer> {
  const fare = Math.max(0, Number(order.final_total ?? order.estimated_total ?? 0));
  const meta = await serviceOfOrder(order).catch(() => null);
  const base = { enabled: false, fare, payable: fare, service: (meta?.service ?? "delivery.parcel") as OfferService, minimumFare: meta?.minimumFare ?? 0, vehicle: meta?.vehicle ?? "delivery" } as const;
  try {
    if (!meta || !(await offersAvailable())) return { ...NONE, ...base };
    const cfg = await getOffersConfig();
    if (!cfg.enabled || !cfg.services[meta.service]) return { ...NONE, ...base };
    const env: PlatformEnvironment = order.environment === "sandbox" ? "sandbox" : "live";
    const [offers, customer] = await Promise.all([listOffers({ status: "active" }), customerProfile(String(order.customer_id), env, cfg)]);
    const result = pickOffers(
      offers,
      {
        service: meta.service, carTier: meta.carTier, fare, now, code: cfg.allowCodeEntry ? code : null,
        pickup: order.pickup_lat != null && order.pickup_lng != null ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) } : null,
        dropoff: order.destination_lat != null && order.destination_lng != null ? { lat: Number(order.destination_lat), lng: Number(order.destination_lng) } : null,
        customer, tzOffsetMinutes: cfg.tzOffsetMinutes,
      },
      cfg.stacking,
    );
    return { ...result, enabled: true, fare, payable: Math.max(0, fare - result.discount), service: meta.service, minimumFare: meta.minimumFare, vehicle: meta.vehicle };
  } catch (err) {
    console.error("Offer lookup failed; continuing without offers", err);
    return { ...NONE, ...base };
  }
}

/**
 * Reserves the offers an order is being paid with. Replaces any earlier reservation for the order (a retried payment),
 * and takes one use from a ride pack the customer holds.
 */
export async function reserveOffers(order: Row, resolved: OrderOffer): Promise<void> {
  if (resolved.applied.length === 0 || !(await offersAvailable())) return;
  const orderId = String(order.id);
  const userId = String(order.customer_id);
  await releaseOffers(orderId);
  const env = order.environment === "sandbox" ? "sandbox" : "live";
  for (const a of resolved.applied) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO offer_redemptions (id, offer_id, user_id, order_id, environment, full_fare, discount, cashback, funder, used_grant, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [newId("ore"), a.offerId, userId, orderId, env, resolved.fare, a.discount, a.cashback, a.funder, a.usesGrant ? 1 : 0],
    });
    if (a.usesGrant && (await hasTable("offer_grants"))) {
      await db.execute({
        sql: `UPDATE offer_grants SET uses_left = uses_left - 1 WHERE id = (SELECT id FROM offer_grants WHERE offer_id = ? AND user_id = ? AND uses_left > 0 AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY expires_at IS NULL, expires_at LIMIT 1)`,
        args: [a.offerId, userId],
      });
    }
  }
}

/** Gives back what a not-yet-settled order had reserved (payment failed, order cancelled, or the fund is being retried). */
export async function releaseOffers(orderId: string): Promise<void> {
  if (!(await offersAvailable())) return;
  const held = await db.execute({ sql: "SELECT offer_id, user_id, used_grant FROM offer_redemptions WHERE order_id = ? AND status = 'pending'", args: [orderId] });
  for (const r of held.rows as Row[]) {
    if (Number(r.used_grant) === 1 && (await hasTable("offer_grants"))) {
      await db.execute({
        sql: "UPDATE offer_grants SET uses_left = uses_left + 1 WHERE id = (SELECT id FROM offer_grants WHERE offer_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1)",
        args: [String(r.offer_id), String(r.user_id)],
      });
    }
  }
  await db.execute({ sql: "DELETE FROM offer_redemptions WHERE order_id = ? AND status = 'pending'", args: [orderId] });
}

/** Pending reservations whose order was cancelled, or was never paid within a few hours, are released. */
export async function sweepStaleReservations(): Promise<number> {
  if (!(await offersAvailable())) return 0;
  const stale = await db.execute({
    sql: `SELECT DISTINCT r.order_id FROM offer_redemptions r LEFT JOIN orders o ON o.id = r.order_id
          WHERE r.status = 'pending' AND (o.id IS NULL OR o.stage = 'Cancelled'
            OR (r.created_at < datetime('now', '-3 hours') AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = r.order_id AND p.type = 'collection' AND p.status IN ('pending', 'unknown', 'successful'))
                AND o.payment_rail IS NOT 'float'))
          LIMIT 100`,
    args: [],
  });
  for (const r of stale.rows as Row[]) await releaseOffers(String(r.order_id));
  return stale.rows.length;
}
