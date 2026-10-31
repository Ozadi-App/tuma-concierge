import { visibleInWorld } from "../practice/people.js";
import { computeFare, DEFAULT_PRICING_CONFIG, roundFare, type FareService, type GeoPoint } from "@peebee/shared";
import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { hasColumn } from "../lib/schema.js";
import { getCarServicePricing, getPlatformEnvironment } from "../lib/settings.js";

export type CarServiceTier = "convenient" | "comfort" | "xl";
export type CarVehicleSize = "normal" | "large";
export type TierVehicle = { service_class: unknown; accepts_convenient: unknown; seat_capacity: unknown; lat: unknown; lng: unknown };

/**
 * Luxury and Ambulance categories carry people too, but they are not ordinary taxis: they must never be matched to, or
 * counted for, a Convenient / Comfort ride. Empty until migration 0101 adds the column.
 */
export async function standardCategoryOnly(alias: string): Promise<string> {
  return (await hasColumn("vehicle_categories", "service_group")) ? ` AND ${alias}.service_group = 'standard'` : "";
}

/** A category's kind for the driver side: its service group when it is Luxury or Ambulance, otherwise 'passenger' or 'cargo'. */
export async function effectiveKindSql(alias: string): Promise<string> {
  return (await hasColumn("vehicle_categories", "service_group")) ? `CASE WHEN ${alias}.service_group <> 'standard' THEN ${alias}.service_group ELSE ${alias}.kind END` : `${alias}.kind`;
}

export function acceptsTier(vehicle: TierVehicle, tier: CarServiceTier, xlMinSeats: number, size?: CarVehicleSize): boolean {
  const seats = Number(vehicle.seat_capacity);
  if (size === "large" && seats < 5) return false;
  if (size === "normal" && seats >= 5) return false;
  // Legacy XL bookings are retained as large, convenient rides.
  if (tier === "xl") return seats >= xlMinSeats;
  if (tier === "comfort") return vehicle.service_class === "comfort";
  return vehicle.service_class !== "comfort" || Number(vehicle.accepts_convenient) === 1;
}

export type TierFareContext = { now?: Date; pickup?: GeoPoint | null; dropoff?: GeoPoint | null; demandRatio?: number | null; scheduled?: boolean };

/**
 * A car fare. The distance, minimum and any tapering, fuel adjustment, peak/night/zone markup and fees come from the fare
 * engine (Admin → Pricing); the Comfort and large-car premiums are applied on top as before.
 */
export function tierFare(distanceKm: number, tier: CarServiceTier, pricing: Awaited<ReturnType<typeof getCarServicePricing>>, size?: CarVehicleSize, ctx: TierFareContext = {}): number {
  return tierFareDetail(distanceKm, tier, pricing, size, ctx).fare;
}

/** A car fare, and what it was before rounding when rounding changed it (for the "rounded up from…" note). */
export function tierFareDetail(distanceKm: number, tier: CarServiceTier, pricing: Awaited<ReturnType<typeof getCarServicePricing>>, size?: CarVehicleSize, ctx: TierFareContext = {}): { fare: number; roundedFrom: number | null } {
  const service: FareService = size === "large" || tier === "xl" ? "car_xl" : tier === "comfort" ? "car_comfort" : "car_convenient";
  const breakdown = computeFare(pricing.engine ?? DEFAULT_PRICING_CONFIG, {
    service, rates: { ratePerKm: pricing.ratePerKm, minimumFare: pricing.minimumFare }, distanceKm, now: ctx.now ?? new Date(),
    pickup: ctx.pickup, dropoff: ctx.dropoff, demandRatio: ctx.demandRatio, scheduled: ctx.scheduled,
  });
  const base = breakdown.total;
  const comfortPremium = tier === "comfort" ? pricing.comfortPremiumPercent : 0;
  const sizePremium = size === "large" || tier === "xl" ? pricing.xlPremiumPercent : 0;
  const factor = (1 + comfortPremium / 100) * (1 + sizePremium / 100);
  const fare = roundFare(base * factor, 0);
  // Before rounding: the engine's own figure, unless a minimum or highest fare decided the price.
  const exact = breakdown.minimumApplied || breakdown.maximumApplied ? base * factor : breakdown.subtotal * factor;
  return { fare, roundedFrom: Math.round(exact) !== fare ? Math.round(exact) : null };
}

/** Online, free drivers with a pickup location in the customer's radius. */
export async function nearbyTierCounts(lat: number, lng: number, radiusKm: number, xlMinSeats: number): Promise<Record<CarVehicleSize, Record<Exclude<CarServiceTier, "xl">, number>>> {
  const environment = await getPlatformEnvironment();
  const standardOnly = await standardCategoryOnly("cat");
  const result = await db.execute({
    sql: `SELECT s.lat, s.lng, v.service_class, v.accepts_convenient, v.seat_capacity
          FROM car_driver_state s
          JOIN car_partners p ON p.user_id = s.driver_id AND p.driver_status = 'approved'
          JOIN vehicles v ON v.id = s.vehicle_id AND v.status = 'approved'
          JOIN vehicle_categories cat ON cat.id = v.category_id AND cat.kind = 'passenger'${standardOnly}
          JOIN vehicle_assignments a ON a.vehicle_id = v.id AND a.driver_id = s.driver_id AND a.status = 'active'
          WHERE s.online = 1 AND s.lat IS NOT NULL AND s.lng IS NOT NULL AND ${visibleInWorld(environment, "s.driver_id")}
            AND s.driver_id NOT IN (SELECT rider_id FROM orders WHERE rider_id IS NOT NULL AND environment = ? AND stage NOT IN ('Settle', 'Cancelled'))`,
    args: [environment],
  });
  const counts: Record<CarVehicleSize, Record<Exclude<CarServiceTier, "xl">, number>> = {
    normal: { convenient: 0, comfort: 0 }, large: { convenient: 0, comfort: 0 },
  };
  for (const row of result.rows) {
    const vehicle = row as unknown as TierVehicle;
    if (haversineKm(lat, lng, Number(vehicle.lat), Number(vehicle.lng)) > radiusKm) continue;
    for (const size of ["normal", "large"] as const) for (const tier of ["convenient", "comfort"] as const) {
      if (acceptsTier(vehicle, tier, xlMinSeats, size)) counts[size][tier]++;
    }
  }
  return counts;
}
