import { roundFare } from "@peebee/shared";
import { db, executeBatch } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { newId } from "../lib/ids.js";
import { riderPayout } from "../lib/monetization.js";
import { randomInt } from "../lib/random.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getDeliverySettings } from "../lib/settings.js";
import { notifyUser } from "../lib/webpush.js";
import { creditWallet } from "../wallet/service.js";
import { getRelaySettings } from "./settings.js";

/**
 * Relay delivery: a parcel too far for one boda goes boda -> matatu -> boda.
 *
 *  leg 1  first rider: pickup -> boarding stage, hands the parcel to the matatu
 *  leg 2  matatu operator: boarding stage -> drop stage
 *  leg 3  last rider: drop stage -> customer, who gives the usual 4-digit PIN
 *
 * Each handoff is confirmed by the receiver entering (or scanning) the giver's
 * code, which stamps the time and who took it. Each leg is priced at its own
 * normal rate and the customer pays the sum. The order's rider_id always names
 * whoever is carrying it on a boda; while it rides the matatu it is NULL.
 */

type Row = Record<string, unknown>;

export type RelayLegPlan = {
  leg: 1 | 2 | 3;
  kind: "boda" | "matatu";
  fromName: string;
  fromLat: number;
  fromLng: number;
  toName: string;
  toLat: number;
  toLng: number;
  distanceKm: number;
  fee: number;
};

export type RelayPlan = { routeId: string; routeName: string; legs: RelayLegPlan[]; total: number };

type Point = { lat: number; lng: number; name?: string | null };

export async function relayReady(): Promise<boolean> {
  return (await hasTable("order_relay_legs")) && (await hasTable("relay_routes")) && (await hasTable("relay_operators"));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The cheapest relay for a parcel, or null when it should go on one boda as usual. */
export async function planRelay(pickup: Point, destination: Point): Promise<RelayPlan | null> {
  const settings = await getRelaySettings();
  if (!settings.enabled || !(await relayReady())) return null;
  const directKm = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);
  if (directKm < settings.minDistanceKm) return null;

  const routes = (await db.execute("SELECT * FROM relay_routes WHERE active = 1")).rows as Row[];
  const { deliveryRatePerKm, minimumDeliveryFee } = await getDeliverySettings();
  let best: RelayPlan | null = null;
  for (const route of routes) {
    const a = { name: String(route.stage_a_name), lat: Number(route.stage_a_lat), lng: Number(route.stage_a_lng) };
    const b = { name: String(route.stage_b_name), lat: Number(route.stage_b_lat), lng: Number(route.stage_b_lng) };
    // A route runs both ways.
    for (const [board, alight] of [[a, b], [b, a]]) {
      const firstKm = haversineKm(pickup.lat, pickup.lng, board.lat, board.lng);
      const lastKm = haversineKm(alight.lat, alight.lng, destination.lat, destination.lng);
      if (firstKm > settings.maxAccessKm || lastKm > settings.maxAccessKm) continue;
      // The matatu has to actually carry it most of the way.
      if (firstKm + lastKm >= directKm) continue;
      const legs: RelayLegPlan[] = [
        {
          leg: 1, kind: "boda", fromName: pickup.name || "Pickup", fromLat: pickup.lat, fromLng: pickup.lng,
          toName: board.name, toLat: board.lat, toLng: board.lng, distanceKm: round1(firstKm),
          fee: roundFare(firstKm * deliveryRatePerKm, minimumDeliveryFee),
        },
        {
          leg: 2, kind: "matatu", fromName: board.name, fromLat: board.lat, fromLng: board.lng,
          toName: alight.name, toLat: alight.lat, toLng: alight.lng,
          distanceKm: round1(haversineKm(board.lat, board.lng, alight.lat, alight.lng)),
          fee: Math.max(0, Math.round(Number(route.parcel_fare) || 0)),
        },
        {
          leg: 3, kind: "boda", fromName: alight.name, fromLat: alight.lat, fromLng: alight.lng,
          toName: destination.name || "Destination", toLat: destination.lat, toLng: destination.lng, distanceKm: round1(lastKm),
          fee: roundFare(lastKm * deliveryRatePerKm, minimumDeliveryFee),
        },
      ];
      const total = legs.reduce((sum, leg) => sum + leg.fee, 0);
      if (!best || total < best.total) best = { routeId: String(route.id), routeName: String(route.name), legs, total };
    }
  }
  return best;
}

function newHandoffCode(): string {
  return String(100000 + randomInt(900000));
}

export async function insertRelayLegs(orderId: string, plan: RelayPlan): Promise<void> {
  await executeBatch(plan.legs.map((leg) => ({
    sql: `INSERT INTO order_relay_legs (id, order_id, leg, kind, route_id, from_name, from_lat, from_lng, to_name, to_lat, to_lng, distance_km, fee, status, handoff_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
    args: [
      newId("rleg"), orderId, leg.leg, leg.kind, plan.routeId, leg.fromName, leg.fromLat, leg.fromLng,
      leg.toName, leg.toLat, leg.toLng, leg.distanceKm, leg.fee, leg.leg === 3 ? null : newHandoffCode(),
    ],
  })));
}

export async function relayLegs(orderId: string): Promise<Row[]> {
  if (!(await hasTable("order_relay_legs"))) return [];
  return (await db.execute({ sql: "SELECT * FROM order_relay_legs WHERE order_id = ? ORDER BY leg", args: [orderId] })).rows as Row[];
}

/** Whether the order's current boda rider may act as the final rider (arrive, take the PIN). */
export async function relayBlocksFinalSteps(orderId: string): Promise<boolean> {
  const legs = await relayLegs(orderId);
  if (!legs.length) return false;
  const last = legs.find((leg) => Number(leg.leg) === 3);
  return !last || !["in_transit", "done"].includes(String(last.status));
}

/** The last rider has taken the leg but not yet collected the parcel from the matatu. */
export async function relayAwaitingCollection(orderId: string): Promise<boolean> {
  const legs = await relayLegs(orderId);
  return legs.some((leg) => Number(leg.leg) === 3 && leg.status === "assigned");
}

/** What the order page shows about the relay. Handoff codes only go to whoever is handing over. */
export async function relayView(order: Row, viewerId: string): Promise<Row | null> {
  const legs = await relayLegs(String(order.id));
  if (!legs.length) return null;
  const route = (await db.execute({ sql: "SELECT name FROM relay_routes WHERE id = ?", args: [String(legs[0].route_id)] })).rows[0] as Row | undefined;
  const providers = legs.map((leg) => leg.provider_id).filter(Boolean) as string[];
  const names = new Map<string, Row>();
  if (providers.length) {
    const res = await db.execute({
      sql: `SELECT u.id, u.name, ro.vehicle_plate FROM users u LEFT JOIN relay_operators ro ON ro.user_id = u.id
            WHERE u.id IN (${providers.map(() => "?").join(",")})`,
      args: providers,
    });
    for (const row of res.rows as Row[]) names.set(String(row.id), row);
  }
  return {
    routeName: route?.name ?? null,
    legs: legs.map((leg) => {
      const provider = leg.provider_id ? names.get(String(leg.provider_id)) : undefined;
      const showCode = Number(leg.leg) === 1 && leg.status !== "done" && order.rider_id === viewerId;
      return {
        id: leg.id,
        leg: Number(leg.leg),
        kind: leg.kind,
        fromName: leg.from_name,
        fromLat: leg.from_lat,
        fromLng: leg.from_lng,
        toName: leg.to_name,
        toLat: leg.to_lat,
        toLng: leg.to_lng,
        distanceKm: leg.distance_km,
        fee: leg.fee,
        status: leg.status,
        providerName: provider?.name ?? null,
        vehiclePlate: leg.kind === "matatu" ? provider?.vehicle_plate ?? null : null,
        startedAt: leg.started_at,
        handedOverAt: leg.handed_over_at,
        handoffCode: showCode ? leg.handoff_code : undefined,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/** What the riders and operator share between them: the same amount a single
 * rider would get for this order (escrow collected, less the platform fees
 * locked in at Fund). */
export async function relayPayoutPool(orderId: string): Promise<number> {
  const collected = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) AS collected FROM payments WHERE order_id = ? AND type = 'collection' AND status = 'successful'",
    args: [orderId],
  });
  const released = Number((collected.rows[0] as Row)?.collected ?? 0);
  const fees = (await db.execute({ sql: "SELECT * FROM order_fees WHERE order_id = ?", args: [orderId] })).rows[0] as Row | undefined;
  if (!fees) return released;
  const serviceFee = Number(fees.service_fee) || 0;
  const processingFeeCustomer = Number(fees.processing_fee_customer) || 0;
  return riderPayout(released, {
    serviceFee,
    processingFeeCustomer,
    processingFeeRider: Number(fees.processing_fee_rider) || 0,
    deliveryCommission: Number(fees.delivery_commission) || 0,
    totalSurcharge: serviceFee + processingFeeCustomer,
  });
}

function shareOf(pool: number, legs: Row[], leg: number): number {
  const total = legs.reduce((sum, row) => sum + Number(row.fee), 0);
  const row = legs.find((r) => Number(r.leg) === leg);
  if (!row || total <= 0) return 0;
  return Math.floor((pool * Number(row.fee)) / total);
}

/** Pays one leg once. A boda leg goes to the rider's wallet, the matatu leg to the operator's. */
async function payLeg(order: Row, leg: Row, amount: number, actorId: string): Promise<number> {
  const marked = await db.execute({
    sql: "UPDATE order_relay_legs SET paid_amount = ?, paid_at = datetime('now') WHERE id = ? AND paid_at IS NULL",
    args: [amount, String(leg.id)],
  });
  if (!marked.rowsAffected || amount <= 0 || !leg.provider_id) return marked.rowsAffected ? amount : 0;
  const environment = order.environment === "sandbox" ? "sandbox" : "live";
  if (leg.kind === "boda") {
    const column = environment === "sandbox" ? "wallet_balance_sandbox" : "wallet_balance";
    await db.execute({
      sql: `UPDATE riders SET ${column} = ${column} + ?, updated_at = datetime('now') WHERE user_id = ?`,
      args: [amount, String(leg.provider_id)],
    });
  } else {
    await creditWallet(String(leg.provider_id), amount, {
      type: "adjustment",
      environment,
      orderId: String(order.id),
      note: "Relay parcel carried by matatu",
      actorId,
    });
  }
  return amount;
}

async function payLegAtHandoff(order: Row, legNumber: number, actorId: string): Promise<void> {
  if (order.payment_rail !== "escrow" || !(await getRelaySettings()).releasePerLeg) return;
  const legs = await relayLegs(String(order.id));
  const leg = legs.find((row) => Number(row.leg) === legNumber);
  if (!leg) return;
  await payLeg(order, leg, shareOf(await relayPayoutPool(String(order.id)), legs, legNumber), actorId);
}

/** At settle: pays any leg not paid at its handoff, then the last rider the rest of the pool. */
export async function settleRelayPayouts(order: Row, pool: number, actorId: string): Promise<boolean> {
  const legs = await relayLegs(String(order.id));
  if (!legs.length) return false;
  let paid = 0;
  for (const leg of legs.filter((row) => Number(row.leg) < 3)) {
    paid += leg.paid_at ? Number(leg.paid_amount ?? 0) : await payLeg(order, leg, shareOf(pool, legs, Number(leg.leg)), actorId);
  }
  const last = legs.find((row) => Number(row.leg) === 3);
  if (last) {
    await payLeg(order, { ...last, provider_id: last.provider_id ?? order.rider_id }, Math.max(0, pool - paid), actorId);
    await db.execute({ sql: "UPDATE order_relay_legs SET status = 'done', handed_over_at = datetime('now') WHERE id = ?", args: [String(last.id)] });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Handoffs
// ---------------------------------------------------------------------------

export class RelayError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, public code: string, message: string) {
    super(message);
  }
}

async function logOrderEvent(orderId: string, note: string, actorId: string) {
  await db.execute({
    sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, 'Deliver', ?, ?)",
    args: [newId("evt"), orderId, note, actorId],
  });
}

export async function approvedOperator(userId: string): Promise<Row | null> {
  if (!(await relayReady())) return null;
  const row = (await db.execute({ sql: "SELECT * FROM relay_operators WHERE user_id = ? AND status = 'approved'", args: [userId] })).rows[0] as Row | undefined;
  return row ?? null;
}

/** Handoff 1: the matatu operator enters the first rider's code and takes the parcel. */
export async function receiveAtMatatu(operatorId: string, code: string): Promise<{ orderId: string }> {
  const operator = await approvedOperator(operatorId);
  if (!operator) throw new RelayError(403, "not_operator", "Only an approved matatu operator can receive relay parcels.");
  const leg1 = (await db.execute({
    sql: `SELECT l.*, o.rider_id, o.stage, o.customer_id, o.environment, o.payment_rail
          FROM order_relay_legs l JOIN orders o ON o.id = l.order_id
          WHERE l.leg = 1 AND l.status != 'done' AND l.handoff_code = ? AND l.route_id = ?`,
    args: [code.trim(), String(operator.route_id)],
  })).rows[0] as Row | undefined;
  if (!leg1) throw new RelayError(404, "code_not_found", "That code doesn't match a parcel for your route.");
  if (leg1.stage !== "Deliver" || !leg1.rider_id) {
    throw new RelayError(409, "not_on_the_way", "The rider hasn't set off with this parcel yet.");
  }
  const orderId = String(leg1.order_id);
  const firstRider = String(leg1.rider_id);
  const clearLocation = (await hasColumn("orders", "rider_location_updated_at"))
    ? ", rider_lat = NULL, rider_lng = NULL, rider_location_updated_at = NULL" : "";
  const changes = await executeBatch([
    {
      sql: `UPDATE order_relay_legs SET status = 'done', provider_id = ?, handed_over_at = datetime('now'), handed_over_to = ?
            WHERE id = ? AND status != 'done'`,
      args: [firstRider, operatorId, String(leg1.id)],
    },
    {
      sql: `UPDATE order_relay_legs SET status = 'in_transit', provider_id = ?, started_at = datetime('now')
            WHERE order_id = ? AND leg = 2 AND EXISTS (SELECT 1 FROM order_relay_legs WHERE id = ? AND handed_over_to = ?)`,
      args: [operatorId, orderId, String(leg1.id), operatorId],
    },
    {
      sql: "UPDATE order_relay_legs SET status = 'open' WHERE order_id = ? AND leg = 3 AND status = 'waiting'",
      args: [orderId],
    },
    {
      sql: `UPDATE orders SET rider_id = NULL${clearLocation}, updated_at = datetime('now') WHERE id = ? AND rider_id = ?`,
      args: [orderId, firstRider],
    },
  ]);
  if (!changes[0]) throw new RelayError(409, "already_received", "This parcel has already been handed over.");
  await logOrderEvent(orderId, `Parcel handed to matatu ${operator.vehicle_plate} at ${leg1.to_name}`, operatorId);
  await payLegAtHandoff({ ...leg1, id: orderId }, 1, operatorId);

  const notes: Promise<unknown>[] = [
    notifyUser(firstRider, { title: "Handoff confirmed", body: `The matatu took the parcel at ${leg1.to_name}. You're free for your next job.`, url: "/", tag: `relay-${orderId}` }),
  ];
  if (leg1.customer_id) {
    notes.push(notifyUser(String(leg1.customer_id), {
      title: "Your parcel is on the matatu",
      body: `It left ${leg1.to_name}. A rider will bring it to your door.`,
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    }));
  }
  await Promise.allSettled([...notes, notifyRidersOfLastMile(orderId)]);
  return { orderId };
}

/** Riders near the drop stage hear about the last-mile leg as soon as the parcel is on the matatu. */
async function notifyRidersOfLastMile(orderId: string): Promise<void> {
  const leg3 = (await db.execute({
    sql: "SELECT l.*, o.environment FROM order_relay_legs l JOIN orders o ON o.id = l.order_id WHERE l.order_id = ? AND l.leg = 3",
    args: [orderId],
  })).rows[0] as Row | undefined;
  if (!leg3) return;
  const { lastMileRadiusKm } = await getRelaySettings();
  const riders = (await db.execute("SELECT user_id, stage_lat, stage_lng FROM riders WHERE verified = 1 AND is_online = 1 AND stage_lat IS NOT NULL AND stage_lng IS NOT NULL")).rows as Row[];
  const near = riders
    .filter((r) => haversineKm(Number(r.stage_lat), Number(r.stage_lng), Number(leg3.from_lat), Number(leg3.from_lng)) <= lastMileRadiusKm)
    .slice(0, 25);
  await Promise.allSettled(near.map((r) => notifyUser(String(r.user_id), {
    title: "Relay pickup near you",
    body: `Meet a matatu at ${leg3.from_name} and deliver ${leg3.distance_km} km.`,
    url: "/",
    tag: `relay-open-${orderId}`,
  })));
}

/** A rider takes the last-mile leg. They become the order's rider straight away
 * but can't arrive or take the PIN until they've collected the parcel. */
export async function claimLastMile(riderId: string, legId: string): Promise<{ orderId: string }> {
  const leg = (await db.execute({
    sql: "SELECT l.*, o.environment FROM order_relay_legs l JOIN orders o ON o.id = l.order_id WHERE l.id = ? AND l.leg = 3",
    args: [legId],
  })).rows[0] as Row | undefined;
  if (!leg) throw new RelayError(404, "not_found", "This relay pickup no longer exists.");
  if (leg.status !== "open") throw new RelayError(409, "already_claimed", "Another rider already took this pickup.");
  const rider = (await db.execute({ sql: "SELECT verified, is_online FROM riders WHERE user_id = ?", args: [riderId] })).rows[0] as Row | undefined;
  if (!rider?.verified) throw new RelayError(403, "not_verified", "Only verified riders can take relay pickups.");
  if (!rider.is_online) throw new RelayError(409, "not_online", "Go online to take jobs.");
  const orderId = String(leg.order_id);
  const environment = String(leg.environment);
  const changes = await executeBatch([
    {
      sql: `UPDATE orders SET rider_id = ?, updated_at = datetime('now')
            WHERE id = ? AND rider_id IS NULL AND stage = 'Deliver'
            AND NOT EXISTS (SELECT 1 FROM orders busy WHERE busy.rider_id = ? AND busy.environment = ? AND busy.stage NOT IN ('Settle', 'Cancelled'))`,
      args: [riderId, orderId, riderId, environment],
    },
    {
      sql: `UPDATE order_relay_legs SET status = 'assigned', provider_id = ?
            WHERE id = ? AND status = 'open' AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND rider_id = ?)`,
      args: [riderId, legId, orderId, riderId],
    },
  ]);
  if (!changes[0] || !changes[1]) {
    throw new RelayError(409, "rider_unavailable", "This pickup is gone, or you already have an active job.");
  }
  await logOrderEvent(orderId, `Last-mile rider assigned to meet the matatu at ${leg.from_name}`, riderId);
  const operatorLeg = (await db.execute({ sql: "SELECT provider_id FROM order_relay_legs WHERE order_id = ? AND leg = 2", args: [orderId] })).rows[0] as Row | undefined;
  if (operatorLeg?.provider_id) {
    await notifyUser(String(operatorLeg.provider_id), {
      title: "Rider coming for a parcel",
      body: `A rider will meet you at ${leg.from_name} to collect it.`,
      url: "/relay",
      tag: `relay-${orderId}`,
    }).catch(() => {});
  }
  return { orderId };
}

/** Handoff 2: the last rider enters the operator's code and takes the parcel. */
export async function collectFromMatatu(riderId: string, legId: string, code: string): Promise<{ orderId: string }> {
  const leg3 = (await db.execute({ sql: "SELECT * FROM order_relay_legs WHERE id = ? AND leg = 3", args: [legId] })).rows[0] as Row | undefined;
  if (!leg3) throw new RelayError(404, "not_found", "This relay pickup no longer exists.");
  if (leg3.provider_id !== riderId || leg3.status !== "assigned") {
    throw new RelayError(403, "not_your_pickup", "This pickup isn't assigned to you.");
  }
  const orderId = String(leg3.order_id);
  const leg2 = (await db.execute({ sql: "SELECT * FROM order_relay_legs WHERE order_id = ? AND leg = 2", args: [orderId] })).rows[0] as Row | undefined;
  if (!leg2 || !["in_transit", "arrived"].includes(String(leg2.status))) {
    throw new RelayError(409, "not_on_matatu", "The parcel isn't on the matatu yet.");
  }
  if (String(leg2.handoff_code) !== code.trim()) throw new RelayError(400, "code_mismatch", "That code doesn't match. Ask the matatu operator for theirs.");
  const changes = await executeBatch([
    {
      sql: `UPDATE order_relay_legs SET status = 'done', handed_over_at = datetime('now'), handed_over_to = ?
            WHERE id = ? AND status IN ('in_transit', 'arrived')`,
      args: [riderId, String(leg2.id)],
    },
    {
      sql: "UPDATE order_relay_legs SET status = 'in_transit', started_at = datetime('now') WHERE id = ? AND status = 'assigned' AND provider_id = ?",
      args: [legId, riderId],
    },
  ]);
  if (!changes[0]) throw new RelayError(409, "already_collected", "This parcel was already collected.");
  await logOrderEvent(orderId, `Last-mile rider collected the parcel from the matatu at ${leg3.from_name}`, riderId);
  const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [orderId] })).rows[0] as Row;
  await payLegAtHandoff({ ...leg2, ...order, id: orderId }, 2, riderId);
  if (order.customer_id) {
    await notifyUser(String(order.customer_id), {
      title: "Your parcel is on the last stretch",
      body: "A rider collected it from the matatu and is bringing it to you.",
      url: `/orders/${orderId}`,
      tag: `order-${orderId}`,
    }).catch(() => {});
  }
  return { orderId };
}
