import { db } from "../db/client.js";
import { actAs, where, type Scenario } from "./demo-customers.js";
import type { PracticeCustomer } from "./personas.js";

/**
 * Things demo customers do in the Ride cluster, through the real API as that customer: every kind of car, a scheduled
 * ride, a ride for someone else, a boda with its own fare, a Taxipress seat and a carpool seat. Each returns the order
 * id it made, or null when the platform refused (the reason is logged, so a rule change shows up in tests).
 */
type Call = Awaited<ReturnType<typeof actAs>>;

const entebbe = { pickupArea: "Entebbe Town", pickupAddress: "Entebbe Central Market", pickupLat: 0.0612, pickupLng: 32.4637 };
const away = (c: PracticeCustomer) => ({ ...where(c) });
const idOf = (body: Record<string, any>) => String(body.order?.id ?? body.orderId ?? body.id ?? "");

async function book(call: Call, name: string, path: string, body: unknown): Promise<string | null> {
  const res = await call("POST", path, body);
  if (res.status >= 300) {
    console.error(`Practice demo ${name} refused:`, res.status, JSON.stringify(res.body).slice(0, 200));
    return null;
  }
  return idOf(res.body) || "ok";
}

const carTrip = (c: PracticeCustomer, extra: Record<string, unknown>) => ({ ...entebbe, ...away(c), ...extra });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

export const carNow: Scenario = (c, call) => book(call, "car ride", "/car/bookings", carTrip(c, { serviceTier: "convenient", vehicleSize: "normal" }));
export const carComfortLarge: Scenario = (c, call) => book(call, "comfort minivan", "/car/bookings", carTrip(c, { serviceTier: "comfort", vehicleSize: "large" }));
export const carScheduled: Scenario = (c, call) => book(call, "scheduled car", "/car/bookings", carTrip(c, { serviceTier: "convenient", vehicleSize: "normal", scheduledFor: inHours(4) }));
export const luxuryHire: Scenario = (c, call) => book(call, "luxury hire", "/car/bookings", carTrip(c, { categoryId: "peebee-luxury-sedan", hireHours: 3, scheduledFor: inHours(6) }));
export const ambulance: Scenario = (c, call) => book(call, "ambulance", "/car/bookings", carTrip(c, { categoryId: "peebee-ambulance-basic" }));
export const cargoMove: Scenario = (c, call) => book(call, "cargo move", "/car/bookings", carTrip(c, { categoryId: "peebee-cargo-pickup", cargoDescription: "Sofa set and two mattresses" }));

export const bodaRide: Scenario = async (c, call) => {
  const listed = await call("POST", "/lists", { title: "Ride", items: [{ name: "Ride", quantity: 1 }] });
  return book(call, "boda ride", "/orders", { listId: listed.body.listId, ...entebbe, ...away(c), type: "parcel", isRide: true });
};
export const bodaOwnFare: Scenario = async (c, call) => {
  const quote = await call("GET", `/rides/quote?pickupLat=${entebbe.pickupLat}&pickupLng=${entebbe.pickupLng}&destinationLat=${c.lat}&destinationLng=${c.lng}`);
  const base = Number(quote.body.fare ?? quote.body.quote ?? 0);
  if (!base) return null;
  const listed = await call("POST", "/lists", { title: "Ride", items: [{ name: "Ride", quantity: 1 }] });
  return book(call, "own-fare boda", "/orders", { listId: listed.body.listId, ...entebbe, ...away(c), type: "parcel", isRide: true, fareOffer: Math.round((base * 0.85) / 500) * 500 });
};
export const rideForSomeone: Scenario = async (c, call) => {
  const listed = await call("POST", "/lists", { title: "Ride for my mother", items: [{ name: "Ride", quantity: 1 }] });
  return book(call, "ride for someone else", "/orders", { listId: listed.body.listId, ...entebbe, ...away(c), type: "parcel", isRide: true, passenger: { name: "Mama Nakato", phone: "0700000555" } });
};

export const taxipressSeat: Scenario = async (_c, call) => {
  const lines = await db.execute("SELECT id FROM taxipress_queue WHERE status IN ('in_line','boarding') AND id LIKE 'prac\\_q\\_%' ESCAPE '\\' ORDER BY joined_at LIMIT 1");
  const id = String(lines.rows[0]?.id ?? "");
  return id ? book(call, "taxipress seat", "/taxipress/bookings", { queueId: id, seats: 2, payment: "cash" }) : null;
};
export const carpoolSeat: Scenario = (_c, call) => book(call, "carpool seat", "/car/carpool/trips/prac_trip_2/seats", { seats: 1 });

/** One of each, so a fresh world has a finished-looking set of bookings across the cluster. */
export const RIDE_SCENARIOS: ReadonlyArray<readonly [string, Scenario]> = [
  ["car", carNow], ["car-comfort-large", carComfortLarge], ["car-scheduled", carScheduled], ["luxury", luxuryHire], ["ambulance", ambulance], ["cargo", cargoMove],
  ["boda", bodaRide], ["boda-own-fare", bodaOwnFare], ["ride-for-someone", rideForSomeone], ["taxipress", taxipressSeat], ["carpool", carpoolSeat],
];
