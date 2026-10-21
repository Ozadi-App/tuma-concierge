import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";
import { directionLabel, routeCodeLabel } from "../relay/direction.js";

type Row = Record<string, unknown>;

export type TaxipressRoute = {
  id: string;
  relayRouteId: string;
  direction: "a_to_b" | "b_to_a";
  /** The way along the route, written like a ticket: "KLA - EBB". */
  directionLabel: string;
  /** The route both ways: "KLA ⇄ EBB". */
  routeCode: string;
  fromName: string;
  toName: string;
  farePerSeat: number;
  stopPricingEnabled: boolean;
  active: boolean;
  /** Whether the relay route underneath is itself on. A Taxipress route only runs while both are. */
  relayActive: boolean;
};

/** Until migration 0123 is applied (and relay migration 0102 before it) Taxipress offers nothing. */
export async function taxipressReady(): Promise<boolean> {
  return (await hasTable("taxipress_routes")) && (await hasTable("relay_routes"));
}

function toRoute(row: Row): TaxipressRoute {
  const aToB = row.direction === "a_to_b";
  return {
    id: String(row.tp_id),
    relayRouteId: String(row.relay_route_id),
    direction: aToB ? "a_to_b" : "b_to_a",
    directionLabel: directionLabel(row, aToB ? "a" : "b"),
    routeCode: routeCodeLabel(row),
    fromName: String(aToB ? row.stage_a_name : row.stage_b_name),
    toName: String(aToB ? row.stage_b_name : row.stage_a_name),
    farePerSeat: Number(row.fare_per_seat) || 0,
    stopPricingEnabled: Number(row.stop_pricing_enabled) === 1,
    active: Number(row.tp_active) === 1,
    // rr.* below brings the relay route's own id and active columns.
    relayActive: Number(row.active) === 1,
  };
}

// All of the relay route's columns come along (so its stage codes do once migration 0107 adds them); the
// Taxipress route's own id and active flag are aliased so they cannot be hidden by the relay route's.
const ROUTE_SQL = `SELECT t.id AS tp_id, t.active AS tp_active, t.relay_route_id, t.direction, t.fare_per_seat, t.stop_pricing_enabled, t.sort, rr.*
                   FROM taxipress_routes t JOIN relay_routes rr ON rr.id = t.relay_route_id`;

/** Every Taxipress route, on or off, for staff. */
export async function listTaxipressRoutes(): Promise<TaxipressRoute[]> {
  if (!(await taxipressReady())) return [];
  const rows = (await db.execute(`${ROUTE_SQL} ORDER BY t.active DESC, t.sort, rr.name, t.direction`)).rows as Row[];
  return rows.map(toRoute);
}

/** The routes customers can see: switched on, with the relay route underneath on too. */
export async function listActiveTaxipressRoutes(): Promise<TaxipressRoute[]> {
  return (await listTaxipressRoutes()).filter((route) => route.active && route.relayActive);
}

export async function getTaxipressRoute(id: string): Promise<TaxipressRoute | null> {
  if (!(await taxipressReady())) return null;
  const row = (await db.execute({ sql: `${ROUTE_SQL} WHERE t.id = ?`, args: [id] })).rows[0] as Row | undefined;
  return row ? toRoute(row) : null;
}
