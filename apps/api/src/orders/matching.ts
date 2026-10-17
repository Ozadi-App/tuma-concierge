/**
 * Staged radius broadcast for unmatched orders: a freshly-created (or
 * reopened, after a rider cancels) order opens to the nearest riders first
 * — 1km, then 2km, then 3km — then widens to every verified/online rider
 * regardless of distance. That way a rider working alone in a far-away area
 * still eventually sees every order (nobody closer ever showed up), while a
 * nearby rider gets first crack at the ones actually near them. Shared by
 * the customer-triggered auto-match fallback (orders/routes.ts) and the
 * rider-facing job list + claim endpoints (riders/routes.ts) so neither can
 * jump the other's queue.
 */

import { db } from "../db/client.js";
import { hasColumn } from "../lib/schema.js";
import { getDeliverySettings } from "../lib/settings.js";

export const RADIUS_TIERS_KM = [1, 2, 3];
const TIER_WINDOW_SECONDS = 20;

export function parseDbTimestamp(ts: string): Date {
  // SQLite's `datetime('now')` is "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — normalize to ISO 8601 so this parses as UTC
  // everywhere, not as local time on non-UTC hosts.
  const iso = /Z|[+-]\d\d:\d\d$/.test(ts) ? ts : `${ts.replace(" ", "T")}Z`;
  return new Date(iso);
}

/** Null means fully open: visible to any eligible rider regardless of distance. */
export function currentVisibilityRadiusKm(becameAvailableAt: string): number | null {
  const elapsedSeconds = (Date.now() - parseDbTimestamp(becameAvailableAt).getTime()) / 1000;
  const tierIndex = Math.floor(elapsedSeconds / TIER_WINDOW_SECONDS);
  return tierIndex >= RADIUS_TIERS_KM.length ? null : RADIUS_TIERS_KM[tierIndex];
}

/** The point a rider's proximity is measured against. */
export function orderMatchPoint(order: Record<string, unknown>): { lat: number; lng: number } | null {
  // Riders are found near where the job starts: a parcel's pickup, or the store or restaurant
  // a shopping order is collected from; a free-form shopping list (no pickup) near the customer.
  const fromPickup = order.type === "parcel" || (order.pickup_lat != null && order.pickup_lng != null);
  const lat = (fromPickup ? order.pickup_lat : order.destination_lat) as number | null;
  const lng = (fromPickup ? order.pickup_lng : order.destination_lng) as number | null;
  return lat != null && lng != null ? { lat, lng } : null;
}

/** Furthest this rider can see or take an order, in km, or null for no limit:
 * their own range if staff set one, otherwise the admin-wide default. */
export async function riderRangeKm(riderId: string): Promise<number | null> {
  const { riderVisibilityRangeKm } = await getDeliverySettings();
  let km = riderVisibilityRangeKm;
  if (await hasColumn("riders", "visibility_range_km")) {
    const row = (await db.execute({ sql: "SELECT visibility_range_km FROM riders WHERE user_id = ?", args: [riderId] })).rows[0];
    km = ownRangeKm(row?.visibility_range_km, km);
  }
  return km > 0 ? km : null;
}

/** A rider's own range when set (0 = no limit), else the default. */
export function ownRangeKm(own: unknown, defaultKm: number): number {
  const n = Number(own);
  return own != null && own !== "" && Number.isFinite(n) && n >= 0 ? n : defaultKm;
}

/** True when a known distance is past the rider's range. */
export function beyondRiderRange(distanceKm: number | null, rangeKm: number | null): boolean {
  return distanceKm != null && rangeKm != null && rangeKm > 0 && distanceKm > rangeKm;
}
