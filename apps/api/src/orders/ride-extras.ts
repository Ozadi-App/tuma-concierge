/**
 * Name your fare + multi-stop boda rides — the pure pricing/validation rules
 * and the small DB helpers shared by the order routes, the rider feed and the
 * share link. See migrations/0104_ride_fare_offers_and_stops.sql.
 *
 * Pricing rule (multi-stop): the boda ride rate × the straight-line distance
 * pickup → stop 1 → … → stop N → destination (the same haversine measure a
 * single ride uses), rounded with the ride minimum, plus a flat fee per stop
 * (setting `ride_stop_fee`, default UGX 1,000).
 *
 * Offer band (Name your fare): a customer may offer between
 * `fare_offer_min_percent` (default 70%) and `fare_offer_max_percent`
 * (default 150%) of that quote, both rounded to the nearest UGX 500.
 */
import { roundFare } from "@peebee/shared";
import { z } from "zod";
import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { newId } from "../lib/ids.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import type { RideExtrasSettings } from "../lib/settings.js";

type Row = Record<string, unknown>;
export type Point = { lat: number; lng: number };

export const rideStopSchema = z.object({
  area: z.string().trim().max(120).optional(),
  address: z.string().trim().max(240).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type RideStopInput = z.infer<typeof rideStopSchema>;

/** Never more than this many stops, whatever the setting says. */
export const MAX_STOPS_HARD = 5;
/** Two consecutive points closer than this are the same place. */
const SAME_PLACE_KM = 0.05;

export function routeDistanceKm(points: Point[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  return km;
}

export function stopFeeTotal(stops: number, stopFee: number): number {
  return stops > 0 && stopFee > 0 ? stops * roundFare(stopFee) : 0;
}

export function rideQuote(
  route: { pickup: Point; destination: Point; stops: Point[] },
  pricing: { ratePerKm: number; minimumFare: number; stopFee: number },
): { distanceKm: number; base: number; stopFees: number; total: number } {
  const distanceKm = routeDistanceKm([route.pickup, ...route.stops, route.destination]);
  const base = roundFare(distanceKm * pricing.ratePerKm, pricing.minimumFare);
  const stopFees = stopFeeTotal(route.stops.length, pricing.stopFee);
  return { distanceKm, base, stopFees, total: base + stopFees };
}

export type FareBand = { min: number; max: number };

export function fareBand(quote: number, s: Pick<RideExtrasSettings, "offerMinPercent" | "offerMaxPercent">): FareBand {
  const min = Math.min(quote, roundFare((quote * s.offerMinPercent) / 100));
  const max = Math.max(quote, roundFare((quote * s.offerMaxPercent) / 100));
  return { min, max };
}

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

/** Rounds an offer to the nearest UGX 500 and checks it against the band. */
export function validateOffer(amount: number, band: FareBand): { amount: number } | { error: string } {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a fare." };
  const rounded = roundFare(amount);
  if (rounded < band.min || rounded > band.max) {
    return { error: `Your offer must be between ${ugx(band.min)} and ${ugx(band.max)}.` };
  }
  return { amount: rounded };
}

/** Checks a stop list against the route. Returns an error message, or null when it's fine. */
export function validateStops(stops: Point[], maxStops: number, pickup: Point | null, destination: Point | null): string | null {
  if (stops.length === 0) return null;
  const cap = Math.min(maxStops, MAX_STOPS_HARD);
  if (cap <= 0) return "Stops aren't available right now.";
  if (stops.length > cap) return `A ride can have at most ${cap} stop${cap === 1 ? "" : "s"}.`;
  if (!pickup || !destination) return "Pin the pickup and destination on the map to add stops.";
  const points = [pickup, ...stops, destination];
  for (let i = 1; i < points.length; i++) {
    if (haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng) < SAME_PLACE_KM) {
      return i === points.length - 1 ? "Your last stop is the same place as the destination." : `Stop ${i} is the same place as the point before it.`;
    }
  }
  return null;
}

/** Whether migration 0104 is applied, per feature. */
export async function rideExtrasAvailable(): Promise<{ offers: boolean; stops: boolean }> {
  const [offerCol, kindCol, counterCol, stopsTable, stopCount] = await Promise.all([
    hasColumn("orders", "fare_offer"),
    hasColumn("fee_proposals", "kind"),
    hasColumn("fee_proposals", "closed_reason"),
    hasTable("order_stops"),
    hasColumn("orders", "stop_count"),
  ]);
  return { offers: offerCol && kindCol && counterCol, stops: stopsTable && stopCount };
}

export async function insertStops(orderId: string, stops: RideStopInput[]): Promise<void> {
  for (const [index, stop] of stops.entries()) {
    await db.execute({
      sql: "INSERT INTO order_stops (id, order_id, position, area, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [newId("stp"), orderId, index + 1, stop.area || null, stop.address || null, stop.lat, stop.lng],
    });
  }
  await db.execute({ sql: "UPDATE orders SET stop_count = ? WHERE id = ?", args: [stops.length, orderId] });
}

export type OrderStop = {
  position: number;
  area: string | null;
  address: string | null;
  lat: number;
  lng: number;
  status: "pending" | "arrived" | "done";
  arrivedAt: string | null;
  departedAt: string | null;
};

export async function loadStops(orderId: string): Promise<OrderStop[]> {
  if (!(await hasTable("order_stops"))) return [];
  const res = await db.execute({
    sql: "SELECT position, area, address, lat, lng, status, arrived_at, departed_at FROM order_stops WHERE order_id = ? ORDER BY position ASC",
    args: [orderId],
  });
  return (res.rows as Row[]).map((r) => ({
    position: Number(r.position),
    area: (r.area as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    status: (r.status as OrderStop["status"]) ?? "pending",
    arrivedAt: (r.arrived_at as string | null) ?? null,
    departedAt: (r.departed_at as string | null) ?? null,
  }));
}

/** SQLite `datetime('now')` / ISO → epoch ms. */
export function timestampMs(value: unknown): number {
  if (typeof value !== "string" || !value) return NaN;
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).getTime();
}

/** What a customer's live offer looks like to riders and to the customer. */
export function offerSummary(order: Row, s: Pick<RideExtrasSettings, "offerMinPercent" | "offerMaxPercent" | "maxRaises">, nowMs = Date.now()) {
  const amount = order.fare_offer == null ? null : Number(order.fare_offer);
  const quote = order.fare_offer_quote == null ? null : Number(order.fare_offer_quote);
  if (amount == null || quote == null) return null;
  const band = fareBand(quote, s);
  const expiresAt = (order.fare_offer_expires_at as string | null) ?? null;
  const expired = expiresAt != null && timestampMs(expiresAt) <= nowMs;
  const raises = Number(order.fare_offer_raises ?? 0);
  return { amount, quote, min: band.min, max: band.max, expiresAt, expired, raises, raisesLeft: Math.max(0, s.maxRaises - raises) };
}

/** Idempotency-Key replay for the offer/counter endpoints. Keys are per user. */
export async function replayIdempotent(userId: string, key: string | undefined): Promise<{ status: number; body: unknown } | null> {
  if (!key || !(await hasTable("fare_offer_requests"))) return null;
  const res = await db.execute({
    sql: "SELECT status, response FROM fare_offer_requests WHERE user_id = ? AND idempotency_key = ?",
    args: [userId, key.slice(0, 120)],
  });
  const row = res.rows[0] as Row | undefined;
  if (!row) return null;
  try {
    return { status: Number(row.status), body: JSON.parse(String(row.response)) };
  } catch {
    return null;
  }
}

export async function rememberIdempotent(userId: string, key: string | undefined, orderId: string, status: number, body: unknown): Promise<void> {
  if (!key || !(await hasTable("fare_offer_requests"))) return;
  await db.execute({
    sql: `INSERT OR IGNORE INTO fare_offer_requests (user_id, idempotency_key, order_id, status, response) VALUES (?, ?, ?, ?, ?)`,
    args: [userId, key.slice(0, 120), orderId, status, JSON.stringify(body)],
  });
}
