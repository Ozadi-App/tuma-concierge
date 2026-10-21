/**
 * Taxipress in practice mode: a browser-local stand-in for /v1/taxipress. The Kampala ⇄ Entebbe line is
 * simulated (taxis, drivers and the other passengers are made up); the passenger is the only real person.
 * A booking pays from the practice wallet, and the taxi then boards, leaves and arrives by itself so a
 * whole trip can be followed. Nothing here books a real taxi, holds real money or contacts anyone.
 */
import { practiceWalletBalance, practiceWalletSpend } from "./practice-wallet.js";

type Json = Record<string, any>;
const KEY = "peebee_practice_taxipress_v1";
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const err = (status: number, error: string, message: string) => ok({ error, message }, status);
const iso = (at = Date.now()) => new Date(at).toISOString();

const FARE = 8_000;
const MAX_SEATS = 4;

type PracticeRoute = { id: string; fromName: string; toName: string; directionLabel: string; routeCode: string };
/** Entebbe first: practice starts where the customer is. */
const ROUTES: PracticeRoute[] = [
  { id: "practice-tp-route-ek", fromName: "Entebbe Stage", toName: "Kampala Stage", directionLabel: "Entebbe → Kampala", routeCode: "EK" },
  { id: "practice-tp-route-ke", fromName: "Kampala Stage", toName: "Entebbe Stage", directionLabel: "Kampala → Entebbe", routeCode: "KE" },
];

type PracticeTaxi = { id: string; routeId: string; plate: string; layout: "14" | "18"; driver: string; others: number };
const TAXIS: PracticeTaxi[] = [
  { id: "practice-tp-q-ek1", routeId: ROUTES[0]!.id, plate: "UBA 114K", layout: "14", driver: "Moses Ssebuliba", others: 9 },
  { id: "practice-tp-q-ek2", routeId: ROUTES[0]!.id, plate: "UAZ 872M", layout: "18", driver: "Ronald Kato", others: 4 },
  { id: "practice-tp-q-ek3", routeId: ROUTES[0]!.id, plate: "UBF 305D", layout: "14", driver: "Patrick Mugisha", others: 0 },
  { id: "practice-tp-q-ke1", routeId: ROUTES[1]!.id, plate: "UBC 641P", layout: "18", driver: "Joseph Ouma", others: 11 },
  { id: "practice-tp-q-ke2", routeId: ROUTES[1]!.id, plate: "UAX 220T", layout: "14", driver: "Sarah Namatovu", others: 6 },
  { id: "practice-tp-q-ke3", routeId: ROUTES[1]!.id, plate: "UBD 958H", layout: "14", driver: "Isaac Lubega", others: 1 },
];

type Booking = { id: string; queueId: string; seats: number; amount: number; method: "app" | "cash"; paid: boolean; code: string; at: number };
type State = { bookings: Booking[] };

function load(): State {
  try { const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as State | null; if (parsed && Array.isArray(parsed.bookings)) return parsed; } catch { /* disposable */ }
  return { bookings: [] };
}
function save(s: State) { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ } }

/** How far a booking has got, from the seconds since it was made. The taxi boards, leaves and arrives on its own. */
const BOARDING_AT = 20_000;
const BOARDED_AT = 40_000;
const ON_ROAD_AT = 70_000;
const ARRIVED_AT = 110_000;
type Phase = "waiting" | "boarding" | "boarded" | "on_road" | "arrived";
function phase(b: Booking): Phase {
  const age = Date.now() - b.at;
  return age >= ARRIVED_AT ? "arrived" : age >= ON_ROAD_AT ? "on_road" : age >= BOARDED_AT ? "boarded" : age >= BOARDING_AT ? "boarding" : "waiting";
}
const ACTIVE: Phase[] = ["waiting", "boarding", "boarded", "on_road"];

const taxiById = (id: string) => TAXIS.find((t) => t.id === id);
const routeOf = (id: string) => ROUTES.find((r) => r.id === id)!;
const mine = (s: State, taxiId: string) => s.bookings.filter((b) => b.queueId === taxiId && ACTIVE.includes(phase(b)));
const taken = (s: State, t: PracticeTaxi) => t.others + mine(s, t.id).reduce((n, b) => n + b.seats, 0);

/** The taxi the passenger is on decides whether it is still in the line, boarding, or on the road. */
function taxiStatus(s: State, t: PracticeTaxi): "in_line" | "boarding" | "on_road" {
  const phases = mine(s, t.id).map(phase);
  if (phases.includes("on_road")) return "on_road";
  if (phases.includes("boarding") || phases.includes("boarded")) return "boarding";
  return "in_line";
}

function entry(s: State, t: PracticeTaxi, position: number | null) {
  const total = Number(t.layout);
  const booked = taken(s, t);
  return {
    id: t.id, taxiId: `${t.id}-taxi`, driverId: `${t.id}-driver`, status: taxiStatus(s, t), position, plate: t.plate, seatLayout: t.layout, seatsTotal: total,
    seatsBooked: booked, walkUpSeats: 0, seatsTaken: booked, seatsLeft: total - booked, fullyBooked: booked >= total,
    joinedAt: iso(Date.now() - 600_000), boardingAt: null, departedAt: null, driverName: t.driver,
  };
}

function lineFor(s: State, routeId: string) {
  const waiting = TAXIS.filter((t) => t.routeId === routeId && taxiStatus(s, t) !== "on_road");
  // A taxi the passenger boarded goes to the front (boarding now); the rest keep their order.
  waiting.sort((a, b) => Number(taxiStatus(s, b) === "boarding") - Number(taxiStatus(s, a) === "boarding"));
  return {
    line: waiting.map((t, i) => entry(s, t, i + 1)),
    onRoad: TAXIS.filter((t) => t.routeId === routeId && taxiStatus(s, t) === "on_road").map((t) => entry(s, t, null)),
  };
}

function view(s: State, b: Booking) {
  const t = taxiById(b.queueId)!;
  const route = routeOf(t.routeId);
  const p = phase(b);
  const waiting = p === "waiting";
  const line = lineFor(s, t.routeId).line;
  const position = line.find((x) => x.id === t.id)?.position ?? null;
  return {
    id: b.id, orderId: `practice-tp-order-${b.id}`,
    status: p === "arrived" ? "completed" : p === "boarded" || p === "on_road" ? "boarded" : "booked",
    seats: b.seats, farePerSeat: FARE, amount: b.amount, paymentMethod: b.method,
    paymentStatus: b.paid ? "paid" : b.method === "cash" ? "pay_driver" : "unpaid",
    ticketCode: b.code, createdAt: iso(b.at), payBy: null,
    route: { id: route.id, fromName: route.fromName, toName: route.toName, directionLabel: route.directionLabel },
    taxi: {
      queueId: t.id, plate: t.plate, seatLayout: t.layout, driverName: t.driver, driverPhone: "0700000001",
      status: p === "on_road" ? "on_road" : p === "arrived" ? "arrived" : waiting ? "in_line" : "boarding",
      position: waiting ? position : null, seatsLeft: Number(t.layout) - taken(s, t),
    },
  };
}

const newCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export function practiceTaxipressRequest(path: string, method: string, body: Json): Response {
  const s = load();

  if (method === "GET" && path === "/v1/taxipress/config") {
    return ok({
      enabled: true,
      routes: ROUTES.map((r) => ({ id: r.id, directionLabel: r.directionLabel, routeCode: r.routeCode, fromName: r.fromName, toName: r.toName, farePerSeat: FARE })),
      cashEnabled: true, seatChoiceFeeUgx: 0, returnDiscountPercent: 0, maxSeatsPerBooking: MAX_SEATS, payWithinMinutes: 10,
      parcelFitText: "If it fits on a seat or under it, it can go.", parcelNotAllowed: ["Fuel", "Live animals"],
    });
  }

  const queue = /^\/v1\/taxipress\/routes\/([^/]+)\/queue$/.exec(path);
  if (method === "GET" && queue) {
    const route = ROUTES.find((r) => r.id === decodeURIComponent(queue[1]!));
    if (!route) return ok({ line: [], onRoad: [], route: null });
    return ok({ ...lineFor(s, route.id), route: { id: route.id, fromName: route.fromName, toName: route.toName, directionLabel: route.directionLabel, farePerSeat: FARE } });
  }

  if (method === "GET" && path === "/v1/taxipress/bookings/mine") return ok({ bookings: [...s.bookings].reverse().map((b) => view(s, b)) });

  const one = /^\/v1\/taxipress\/bookings\/([^/]+)$/.exec(path);
  if (method === "GET" && one) {
    const b = s.bookings.find((x) => x.id === decodeURIComponent(one[1]!));
    return b ? ok({ booking: view(s, b) }) : err(404, "not_found", "That ticket wasn't found.");
  }

  if (method === "POST" && path === "/v1/taxipress/bookings") {
    const taxi = taxiById(String(body.queueId));
    const seats = Math.floor(Number(body.seats));
    const method_ = body.payment === "cash" ? "cash" : "app";
    if (!taxi || taxiStatus(s, taxi) === "on_road") return err(409, "not_available", "That taxi isn't taking seats any more. Choose another.");
    if (!Number.isFinite(seats) || seats < 1 || seats > MAX_SEATS) return err(400, "invalid_seats", `You can book 1 to ${MAX_SEATS} seats at a time.`);
    if (seats > Number(taxi.layout) - taken(s, taxi)) return err(409, "not_available", "There aren't that many seats left on this taxi.");
    const amount = seats * FARE;
    if (method_ === "app" && !practiceWalletSpend(amount, `Taxipress ${routeOf(taxi.routeId).directionLabel} · ${taxi.plate} · ${seats} seat${seats === 1 ? "" : "s"}`)) {
      return err(409, "insufficient_funds", `Your practice wallet has UGX ${practiceWalletBalance().toLocaleString("en-UG")}. This booking needs UGX ${amount.toLocaleString("en-UG")}.`);
    }
    const b: Booking = { id: `practice-tp-${Date.now().toString(36)}`, queueId: taxi.id, seats, amount, method: method_, paid: method_ === "app", code: newCode(), at: Date.now() };
    s.bookings.push(b);
    save(s);
    return ok({ booking: view(s, b), order: { id: `practice-tp-order-${b.id}` } }, 201);
  }

  // Cash is confirmed on the order straight away; the passenger pays the driver at boarding.
  const fund = /^\/v1\/orders\/practice-tp-order-([^/]+)\/fund$/.exec(path);
  if (method === "POST" && fund) return ok({ ok: true });

  return err(400, "practice_unsupported", "That action is outside this practice scenario. Your live account was not changed.");
}

export function resetPracticeTaxipress() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
