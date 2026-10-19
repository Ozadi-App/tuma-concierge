import { db } from "../db/client.js";
import { haversineKm } from "../lib/geo.js";
import { hasColumn } from "../lib/schema.js";

/**
 * Relay routes run both ways. A route is written like a flight ticket: its two
 * end stages each have a short code (stage A "KLA", stage B "EBB"), the route as
 * a whole is "KLA ⇄ EBB", and each trip along it is one direction, "KLA - EBB"
 * (A to B) or "EBB - KLA" (B to A). The stops between are the same both ways,
 * in reverse order going back.
 */

type Row = Record<string, unknown>;
export type RouteEnd = "a" | "b";
type Point = { lat: number; lng: number };

export const ROUTE_CODE_PATTERN = /^[A-Z]{2,4}$/;

/** Migration 0107 adds the stage codes. Until then every code comes from the stage name. */
export async function routeCodesReady(): Promise<boolean> {
  return (await hasColumn("relay_routes", "stage_a_code")) && (await hasColumn("relay_routes", "stage_b_code"));
}

/** A code from a stage's name when none is stored: the first word's first three letters ("Kampala Old Taxi Park" -> "KAM"). */
export function fallbackCode(name: unknown, end: RouteEnd): string {
  const word = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  const letters = word.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return letters.length >= 2 ? letters : end.toUpperCase();
}

function storedCode(value: unknown): string | null {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return ROUTE_CODE_PATTERN.test(code) ? code : null;
}

/** The short codes of a route's two ends: the stored codes, or ones made from the stage names. */
export function routeCodes(route: Row): { a: string; b: string } {
  return {
    a: storedCode(route.stage_a_code) ?? fallbackCode(route.stage_a_name, "a"),
    b: storedCode(route.stage_b_code) ?? fallbackCode(route.stage_b_name, "b"),
  };
}

/** The route both ways: "KLA ⇄ EBB". */
export function routeCodeLabel(route: Row): string {
  const { a, b } = routeCodes(route);
  return `${a} ⇄ ${b}`;
}

/** One direction along the route, from the given end: "KLA - EBB" from A, "EBB - KLA" from B. */
export function directionLabel(route: Row, fromEnd: RouteEnd): string {
  const { a, b } = routeCodes(route);
  return fromEnd === "a" ? `${a} - ${b}` : `${b} - ${a}`;
}

const kmTo = (from: Point, to: Point) => haversineKm(from.lat, from.lng, to.lat, to.lng);

/**
 * Which end a trip from `board` to `alight` starts from. With both positions known as
 * indexes into the route's stops (stage A first), the order decides: boarding before the
 * alighting point is A to B. Otherwise the point nearer stage A is the start.
 */
export function directionFrom(
  stageA: Point,
  board: Point & { index?: number | null },
  alight: Point & { index?: number | null },
): RouteEnd {
  if (board.index != null && alight.index != null && board.index >= 0 && alight.index >= 0 && board.index !== alight.index) {
    return board.index < alight.index ? "a" : "b";
  }
  return kmTo(board, stageA) <= kmTo(alight, stageA) ? "a" : "b";
}

function nearestIndex(stops: Point[], point: Point): number {
  let best = -1;
  let bestKm = Infinity;
  stops.forEach((stop, i) => {
    const km = kmTo(stop, point);
    if (km < bestKm) {
      best = i;
      bestKm = km;
    }
  });
  return best;
}

/**
 * The direction of a matatu leg already stored (from its from/to positions), against the
 * route's stops in order. Each end is placed at its nearest stop: the boarding stage is a
 * stop, and a drop station is a stop or sits beside one.
 */
export function legDirectionFrom(route: Row, stops: Point[], leg: Row): RouteEnd | null {
  if (leg.from_lat == null || leg.from_lng == null || leg.to_lat == null || leg.to_lng == null) return null;
  const from = { lat: Number(leg.from_lat), lng: Number(leg.from_lng) };
  const to = { lat: Number(leg.to_lat), lng: Number(leg.to_lng) };
  const stageA = { lat: Number(route.stage_a_lat), lng: Number(route.stage_a_lng) };
  return directionFrom(stageA, { ...from, index: nearestIndex(stops, from) }, { ...to, index: nearestIndex(stops, to) });
}

/** A route's stops in order (stage A, the stages between, stage B), as positions. */
async function routeStops(route: Row): Promise<Point[]> {
  const { routeStages } = await import("./service.js");
  return (await routeStages(route)).map((stage) => ({ lat: stage.lat, lng: stage.lng }));
}

/**
 * The direction label of each stored matatu leg ("KLA - EBB"), keyed by leg id. Legs need
 * id, route_id and from/to positions. Unknown routes or positions are left out.
 */
export async function legDirections(legs: Row[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const routeIds = [...new Set(legs.map((leg) => leg.route_id).filter(Boolean).map(String))];
  if (!routeIds.length) return out;
  const routes = (await db.execute({
    sql: `SELECT * FROM relay_routes WHERE id IN (${routeIds.map(() => "?").join(",")})`,
    args: routeIds,
  })).rows as Row[];
  const byId = new Map<string, { route: Row; stops: Point[] }>();
  for (const route of routes) byId.set(String(route.id), { route, stops: await routeStops(route) });
  for (const leg of legs) {
    const found = byId.get(String(leg.route_id));
    if (!found) continue;
    const end = legDirectionFrom(found.route, found.stops, leg);
    if (end) out.set(String(leg.id), directionLabel(found.route, end));
  }
  return out;
}
