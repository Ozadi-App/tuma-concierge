import { db } from "../db/client.js";
import { signToken } from "../auth/jwt.js";
import { PRACTICE_CUSTOMERS, type PracticeCustomer } from "./personas.js";

type Answer = { status: number; body: Record<string, any> };

/** What a demo customer does is done through the real API, signed in as that customer, so every rule applies to them as to anyone. */
async function actAs(customer: PracticeCustomer) {
  const { default: app } = await import("../app.js");
  const token = await signToken({ sub: customer.id, role: "customer", phone: customer.phone, practice: true });
  return async (method: string, path: string, body?: unknown): Promise<Answer> => {
    const res = await app.request(`/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> };
  };
}

type Scenario = (customer: PracticeCustomer, call: Awaited<ReturnType<typeof actAs>>) => Promise<string | null>;

const where = (c: PracticeCustomer) => ({ destinationArea: c.areaAddress.split(",")[0], destinationAddress: c.areaAddress, destinationLat: c.lat, destinationLng: c.lng });

const SHOPPING_LISTS: Array<{ title: string; total: number; items: Array<{ name: string; quantity: number }> }> = [
  { title: "Weekend groceries", total: 38_000, items: [{ name: "Rice 2kg", quantity: 1 }, { name: "Cooking oil 1L", quantity: 1 }, { name: "Tomatoes", quantity: 6 }, { name: "Onions", quantity: 4 }] },
  { title: "Breakfast things", total: 21_000, items: [{ name: "Bread", quantity: 2 }, { name: "Eggs (tray)", quantity: 1 }, { name: "Milk 500ml", quantity: 2 }] },
  { title: "School supplies", total: 26_000, items: [{ name: "Exercise books", quantity: 6 }, { name: "Pens", quantity: 4 }] },
];

/** Placing an order puts it at Create; asking to be matched is what lets riders see it. */
async function openToRiders(call: Awaited<ReturnType<typeof actAs>>, orderId: string): Promise<string | null> {
  const matched = await call("POST", `/orders/${orderId}/match`, {});
  // "No riders nearby yet" is normal: the order stays open and widens to every rider after a minute.
  if (matched.status >= 300 && matched.body.error !== "no_riders_available") console.error("Practice demo match failed:", matched.status, JSON.stringify(matched.body));
  // A new order opens to riders within a kilometre and widens over a minute. These have "been waiting", so any practice rider sees them.
  await db.execute({ sql: "UPDATE orders SET updated_at = datetime('now', '-90 seconds') WHERE id = ? AND rider_id IS NULL", args: [orderId] });
  return orderId;
}

const shopping: Scenario = async (customer, call) => {
  const list = SHOPPING_LISTS[Math.floor(Math.random() * SHOPPING_LISTS.length)]!;
  const made = await call("POST", "/lists", { title: list.title, items: list.items });
  if (made.status !== 201) return null;
  const order = await call("POST", "/orders", { listId: made.body.listId, type: "shopping", estimatedTotal: list.total, ...where(customer) });
  return order.status === 201 ? openToRiders(call, String(order.body.order?.id ?? order.body.id ?? "")) : null;
};

const parcel: Scenario = async (customer, call) => {
  const made = await call("POST", "/lists", { title: "Parcel to a friend", items: [{ name: "Small parcel", quantity: 1 }] });
  if (made.status !== 201) return null;
  const order = await call("POST", "/orders", {
    listId: made.body.listId, type: "parcel", pickupArea: "Entebbe Town", pickupAddress: "Entebbe Central Market", pickupLat: 0.0612, pickupLng: 32.4637, ...where(customer),
  });
  return order.status === 201 ? openToRiders(call, String(order.body.order?.id ?? order.body.id ?? "")) : null;
};

const food: Scenario = async (customer, call) => {
  const places = await call("GET", "/restaurants");
  const open = ((places.body.restaurants ?? []) as Array<{ id: string; is_open: number }>).filter((r) => r.is_open);
  const place = open[Math.floor(Math.random() * open.length)];
  if (!place) return null;
  const menu = await call("GET", `/restaurants/${place.id}/menu`);
  const items = ((menu.body.categories ?? []) as Array<{ items: Array<{ id: string; options?: unknown[] }> }>).flatMap((c) => c.items).filter((i) => !i.options?.length);
  const pick = items[Math.floor(Math.random() * items.length)];
  if (!pick) return null;
  const order = await call("POST", `/restaurants/${place.id}/order`, { items: [{ menuItemId: pick.id, quantity: 1 }], ...where(customer) });
  return order.status === 201 ? String(order.body.order?.id ?? order.body.id ?? "") : null;
};

/** Orders waiting for a rider, and food orders waiting for the restaurant to accept. */
async function waiting(): Promise<{ forRiders: number; forRestaurants: number }> {
  const res = await db.execute(`SELECT
      SUM(CASE WHEN restaurant_id IS NULL THEN 1 ELSE 0 END) AS riders,
      SUM(CASE WHEN restaurant_id IS NOT NULL THEN 1 ELSE 0 END) AS restaurants
    FROM orders WHERE rider_id IS NULL AND stage IN ('Create', 'Match') AND customer_id LIKE 'prac\\_%' ESCAPE '\\'`);
  return { forRiders: Number(res.rows[0]?.riders ?? 0), forRestaurants: Number(res.rows[0]?.restaurants ?? 0) };
}

/**
 * Keeps the practice world alive: demo customers place orders until `target` are waiting for a rider and a couple of food
 * orders are waiting for a restaurant, so a rider who opens practice always has something to take and a restaurant always
 * has something to accept. Must run inside runInPractice. Returns how many orders were placed.
 */
export async function topUpDemoOrders(target = 4, foodTarget = 2): Promise<number> {
  let placed = 0;
  for (let attempt = 0; attempt < (target + foodTarget) * 2; attempt++) {
    const { forRiders, forRestaurants } = await waiting();
    const scenario = forRiders < target ? (Math.random() < 0.6 ? shopping : parcel) : forRestaurants < foodTarget ? food : null;
    if (!scenario) break;
    const customer = PRACTICE_CUSTOMERS[Math.floor(Math.random() * PRACTICE_CUSTOMERS.length)]!;
    try {
      if (await scenario(customer, await actAs(customer))) placed++;
    } catch (err) {
      console.error("Practice demo order failed:", err);
    }
  }
  return placed;
}
