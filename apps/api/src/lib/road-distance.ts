import { haversineKm } from "./geo.js";
import { getSetting } from "./settings.js";

export type Point = { lat: number; lng: number };

/**
 * Road distances for delivery prices. Admin can point the app at a routing
 * server that speaks the OSRM API (self-hosted, or a provider's); its road
 * distances are used when it answers. Otherwise, or when it is slow or down,
 * each straight line is stretched by the admin's road factor (roads wind:
 * about 1.3 times the straight line in town).
 */
export async function getRoadSettings(): Promise<{ factor: number; routingServerUrl: string | null }> {
  const [factor, url] = await Promise.all([getSetting("road_distance_factor"), getSetting("routing_server_url")]);
  const n = Number(factor);
  return {
    factor: Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1.3,
    routingServerUrl: url && /^https?:\/\//i.test(url.trim()) ? url.trim().replace(/\/$/, "") : null,
  };
}

const ROUTING_TIMEOUT_MS = 2500;

async function osrmLegsKm(baseUrl: string, points: Point[]): Promise<number[] | null> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/route/v1/driving/${coords}?overview=false&steps=false`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: string; routes?: Array<{ legs?: Array<{ distance?: number }> }> };
    const legs = body.code === "Ok" ? body.routes?.[0]?.legs : undefined;
    if (!legs || legs.length !== points.length - 1 || legs.some((leg) => typeof leg.distance !== "number")) return null;
    return legs.map((leg) => leg.distance! / 1000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The road distance of each leg of a trip through these points, in km (one entry per consecutive pair). */
export async function roadLegsKm(points: Point[]): Promise<number[]> {
  if (points.length < 2) return [];
  const { factor, routingServerUrl } = await getRoadSettings();
  if (routingServerUrl) {
    const legs = await osrmLegsKm(routingServerUrl, points);
    if (legs) return legs;
  }
  return points.slice(1).map((point, i) => haversineKm(points[i].lat, points[i].lng, point.lat, point.lng) * factor);
}

export async function roadKm(from: Point, to: Point): Promise<number> {
  return (await roadLegsKm([from, to]))[0];
}

/**
 * The order to visit pickups so the whole trip, ending at the customer, is
 * shortest: every order for a few stops, nearest-first beyond that.
 */
export function shortestPickupOrder<T extends Point>(pickups: T[], destination: Point): T[] {
  const km = (a: Point, b: Point) => haversineKm(a.lat, a.lng, b.lat, b.lng);
  const length = (route: T[]) => route.reduce((sum, stop, i) => sum + (i ? km(route[i - 1], stop) : 0), 0) + km(route[route.length - 1], destination);
  if (pickups.length <= 1) return [...pickups];
  if (pickups.length <= 6) {
    let best: T[] = pickups;
    let bestKm = Infinity;
    const permute = (done: T[], rest: T[]) => {
      if (!rest.length) {
        const total = length(done);
        if (total < bestKm) { bestKm = total; best = done; }
        return;
      }
      rest.forEach((stop, i) => permute([...done, stop], [...rest.slice(0, i), ...rest.slice(i + 1)]));
    };
    permute([], pickups);
    return best;
  }
  // Many stops: start furthest from the customer, then always the nearest next.
  const rest = [...pickups].sort((a, b) => km(b, destination) - km(a, destination));
  const route = [rest.shift()!];
  while (rest.length) {
    const here = route[route.length - 1];
    rest.sort((a, b) => km(here, a) - km(here, b));
    route.push(rest.shift()!);
  }
  return route;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
