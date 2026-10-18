import { db } from "../db/client.js";
import { hasTable } from "../lib/schema.js";
import { legDirections } from "../relay/direction.js";
import { relayLegs, relayRow, stationDisplayName } from "../relay/service.js";

type Row = Record<string, unknown>;

export type CheckoutItem = {
  orderId: string;
  /** The store or restaurant the item comes from. */
  storeName: string | null;
  name: string;
  quantity: number;
  /** The line's amount (quantity × unit price), as the order total uses it; null when the order's lines don't make up its items amount. */
  price: number | null;
  note: string | null;
};

export type CheckoutDeliveryLeg = {
  leg: number;
  kind: "boda" | "matatu";
  fromName: string | null;
  toName: string | null;
  distanceKm: number | null;
  fee: number;
  /** Matatu legs: the way along the route, "KLA - EBB". */
  direction?: string | null;
};

export type CheckoutDelivery = {
  /** What is charged for delivery: the orders' delivery fees together. */
  total: number;
  mode: "relay" | "rider";
  /** Every place the rider collects from, first pickup first. */
  pickups: string[];
  /** Relay only: the legs the customer pays for. */
  legs?: CheckoutDeliveryLeg[];
  /** Relay only: brought to the door, or collected at a petrol station / stage. */
  lastMile?: "door" | "collect";
  station?: string | null;
};

export type CheckoutBreakdown = { items: CheckoutItem[]; itemsSubtotal: number; delivery: CheckoutDelivery };

const amount = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** The pickup's name as the customer knows it: the restaurant, the store, or the pickup area. */
function pickupName(order: Row): string | null {
  for (const key of ["restaurant_name", "store_name", "pickup_area"]) {
    const value = order[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Each order's total split into items and delivery, the way checkout charges it.
 * A parcel or ride has no items: its whole total is the delivery (or fare).
 */
function split(order: Row): { base: number; items: number; delivery: number } {
  const base = amount(order.final_total ?? order.estimated_total);
  if (order.type === "parcel") return { base, items: 0, delivery: base };
  const delivery = Math.min(Math.max(0, amount(order.delivery_fee)), Math.max(0, base));
  return { base, items: base - delivery, delivery };
}

async function itemsOf(orders: Row[]): Promise<CheckoutItem[]> {
  const shopping = orders.filter((order) => order.type !== "parcel" && order.list_id);
  if (!shopping.length) return [];
  const listIds = [...new Set(shopping.map((order) => String(order.list_id)))];
  const rows = (await db.execute({
    sql: `SELECT list_id, name, quantity, unit_price, note FROM list_items WHERE list_id IN (${listIds.map(() => "?").join(",")}) ORDER BY created_at, id`,
    args: listIds,
  })).rows as Row[];
  const out: CheckoutItem[] = [];
  for (const order of shopping) {
    const lines = rows.filter((row) => String(row.list_id) === String(order.list_id));
    const priced = lines.map((row) => (row.unit_price == null ? null : amount(row.unit_price) * amount(row.quantity)));
    // Show line amounts only when they are exactly what the order charges for its items
    // (a substitution or an agreed change can move the total away from the list).
    const exact = priced.every((price) => price != null) && priced.reduce<number>((sum, price) => sum + (price ?? 0), 0) === split(order).items;
    lines.forEach((row, i) => out.push({
      orderId: String(order.id),
      storeName: pickupName(order),
      name: String(row.name ?? ""),
      quantity: amount(row.quantity),
      price: exact ? priced[i] : null,
      note: (row.note as string | null) ?? null,
    }));
  }
  return out;
}

/** The relay legs the delivery is made of, from the first pickup; null when it isn't relayed (or the relay tables are missing). */
async function relayDelivery(lead: Row): Promise<Pick<CheckoutDelivery, "legs" | "lastMile" | "station"> | null> {
  const legs = await relayLegs(String(lead.id));
  if (!legs.length) return null;
  const relay = await relayRow(String(lead.id)).catch(() => null);
  const toDoor = !relay || relay.last_mile === "door";
  // The last boda leg is only bought when it goes to the door.
  const bought = toDoor ? legs : legs.filter((leg) => Number(leg.leg) < 3);
  const matatu = bought.filter((leg) => leg.kind === "matatu");
  const directions = matatu.length ? await legDirections(matatu).catch(() => new Map<string, string>()) : new Map<string, string>();
  let station: string | null = null;
  if (!toDoor) {
    station = (relay?.meet_stage_name as string | null) ?? null;
    if (!station && relay?.outlet_id && (await hasTable("fuel_station_outlets")) && (await hasTable("fuel_stations"))) {
      const row = (await db.execute({
        sql: "SELECT o.name, s.brand_name FROM fuel_station_outlets o JOIN fuel_stations s ON s.id = o.station_id WHERE o.id = ?",
        args: [String(relay.outlet_id)],
      })).rows[0] as Row | undefined;
      station = row ? stationDisplayName(row.brand_name, row.name) || null : null;
    }
  }
  return {
    legs: bought.map((leg) => ({
      leg: Number(leg.leg),
      kind: leg.kind === "matatu" ? "matatu" : "boda",
      fromName: (leg.from_name as string | null) ?? null,
      toName: (leg.to_name as string | null) ?? null,
      distanceKm: leg.distance_km == null ? null : Number(leg.distance_km),
      fee: amount(leg.fee),
      ...(leg.kind === "matatu" ? { direction: directions.get(String(leg.id)) ?? null } : {}),
    })),
    lastMile: toDoor ? "door" : "collect",
    station,
  };
}

/**
 * What the customer pays for, line by line, for one order or every order of a
 * combined delivery (first pickup first): the items, their subtotal, and the
 * delivery with its legs. itemsSubtotal + delivery.total is exactly the orders'
 * totals, so adding the payment fees gives what is charged. Never throws for
 * missing relay data: the delivery is then shown without its legs.
 */
export async function checkoutBreakdown(orders: Row[]): Promise<CheckoutBreakdown> {
  const parts = orders.map(split);
  const itemsSubtotal = parts.reduce((sum, part) => sum + part.items, 0);
  const total = parts.reduce((sum, part) => sum + part.delivery, 0);
  const pickups = [...new Set(orders.map(pickupName).filter((name): name is string => !!name))];
  const items = await itemsOf(orders).catch((error) => {
    console.error("Could not load the checkout items", error);
    return [] as CheckoutItem[];
  });
  let relay: Awaited<ReturnType<typeof relayDelivery>> = null;
  if (orders[0]) {
    relay = await relayDelivery(orders[0]).catch((error) => {
      console.error("Could not load the relay legs for checkout", error);
      return null;
    });
  }
  return {
    items,
    itemsSubtotal,
    delivery: relay ? { total, mode: "relay", pickups, ...relay } : { total, mode: "rider", pickups },
  };
}

/** Every live order sharing `order`'s delivery, first pickup first; just the order when it isn't combined. */
export async function deliveryOrders(order: Row): Promise<Row[]> {
  if (!order.delivery_bundle_id) return [order];
  const res = await db.execute({
    sql: `SELECT o.*, COALESCE(r.name, o.pickup_area) AS restaurant_name FROM orders o LEFT JOIN restaurants r ON r.id = o.restaurant_id
          WHERE o.delivery_bundle_id = ? AND o.customer_id = ? AND o.stage != 'Cancelled'
          ORDER BY CASE WHEN o.id = o.delivery_bundle_id THEN 0 ELSE 1 END, o.created_at, o.id`,
    args: [String(order.delivery_bundle_id), String(order.customer_id)],
  });
  const rows = res.rows as Row[];
  return rows.length ? rows : [order];
}
