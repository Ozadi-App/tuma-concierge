import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Relay delivery (boda -> matatu -> boda) is controlled from Admin: whether it
 * runs at all, how long a delivery must be before it is relayed, how far the
 * pickup and drop-off may be from a matatu stage, and when each leg is paid.
 */
export type RelaySettings = {
  enabled: boolean;
  /** Straight-line pickup-to-destination distance from which a parcel is relayed. */
  minDistanceKm: number;
  /** Furthest the pickup may be from the boarding stage, and the destination from the drop stage. */
  maxAccessKm: number;
  /** Riders within this distance of the drop stage are told about the last-mile leg. */
  lastMileRadiusKm: number;
  /** Pay each leg at its handoff instead of all legs when the order settles. */
  releasePerLeg: boolean;
};

const num = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export async function getRelaySettings(): Promise<RelaySettings> {
  const [enabled, minKm, accessKm, radiusKm, perLeg] = await Promise.all([
    getSetting("relay_enabled"),
    getSetting("relay_min_distance_km"),
    getSetting("relay_max_access_km"),
    getSetting("relay_last_mile_radius_km"),
    getSetting("relay_release_per_leg"),
  ]);
  return {
    enabled: enabled === "1",
    minDistanceKm: num(minKm, 25),
    maxAccessKm: num(accessKm, 10),
    lastMileRadiusKm: num(radiusKm, 5),
    releasePerLeg: perLeg === "1",
  };
}

export async function setRelaySettings(next: Partial<RelaySettings>): Promise<void> {
  if (next.enabled != null) await setSetting("relay_enabled", next.enabled ? "1" : "0");
  if (next.minDistanceKm != null) await setSetting("relay_min_distance_km", String(next.minDistanceKm));
  if (next.maxAccessKm != null) await setSetting("relay_max_access_km", String(next.maxAccessKm));
  if (next.lastMileRadiusKm != null) await setSetting("relay_last_mile_radius_km", String(next.lastMileRadiusKm));
  if (next.releasePerLeg != null) await setSetting("relay_release_per_leg", next.releasePerLeg ? "1" : "0");
}
