import { haversineKm } from "../lib/geo.js";

/** Nearby providers on the Hive map: counts by trade and coarse pins.
 * Privacy: a pin is never a provider's position. Providers are grouped into
 * ~550 m grid cells and each (cell, trade) gets one pin at the cell centre,
 * nudged by a jitter that is fixed per cell and day, so pins can't be averaged
 * back to a real spot and never carry an id, name or count of one person. */

export type NearbyTrade = "clean" | "laundry" | "fix";
export type NearbyRow = { providerId: string; type: string; lat: number; lng: number };
export type NearbyPin = { type: NearbyTrade; lat: number; lng: number };
export type NearbyResult = { radiusKm: number; total: number; counts: Record<NearbyTrade, number>; pins: NearbyPin[] };

export const CELL_DEG = 0.005; // ≈ 550 m at the equator
const JITTER_DEG = 0.0018;
const MAX_PINS = 24;
const TRADES: NearbyTrade[] = ["clean", "laundry", "fix"];

/** Small deterministic hash → [0, 1). */
function unit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export function emptyNearby(radiusKm: number): NearbyResult {
  return { radiusKm, total: 0, counts: { clean: 0, laundry: 0, fix: 0 }, pins: [] };
}

export function summariseNearby(
  rows: NearbyRow[],
  origin: { lat: number; lng: number },
  opts: { radiusKm: number; types: string[]; day: string },
): NearbyResult {
  const out = emptyNearby(opts.radiusKm);
  const byTrade = new Map<NearbyTrade, Set<string>>();
  const everyone = new Set<string>();
  const cells = new Map<string, NearbyPin>();
  for (const r of rows) {
    const type = r.type as NearbyTrade;
    if (!TRADES.includes(type) || !opts.types.includes(type)) continue;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    if (haversineKm(origin.lat, origin.lng, r.lat, r.lng) > opts.radiusKm) continue;
    if (!byTrade.has(type)) byTrade.set(type, new Set());
    byTrade.get(type)!.add(r.providerId);
    everyone.add(r.providerId);
    const cy = Math.floor(r.lat / CELL_DEG), cx = Math.floor(r.lng / CELL_DEG);
    const key = `${type}:${cy}:${cx}`;
    if (!cells.has(key)) {
      const seed = `${key}:${opts.day}`;
      cells.set(key, {
        type,
        lat: round((cy + 0.5) * CELL_DEG + (unit(`${seed}:y`) - 0.5) * 2 * JITTER_DEG),
        lng: round((cx + 0.5) * CELL_DEG + (unit(`${seed}:x`) - 0.5) * 2 * JITTER_DEG),
      });
    }
  }
  for (const t of TRADES) out.counts[t] = byTrade.get(t)?.size ?? 0;
  out.total = everyone.size;
  out.pins = [...cells.values()]
    .sort((a, b) => haversineKm(origin.lat, origin.lng, a.lat, a.lng) - haversineKm(origin.lat, origin.lng, b.lat, b.lng))
    .slice(0, MAX_PINS);
  return out;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
