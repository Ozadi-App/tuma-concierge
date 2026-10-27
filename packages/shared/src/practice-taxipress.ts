/**
 * Taxipress in practice mode: a browser-local stand-in for /v1/taxipress. The Kampala ⇄ Entebbe line is
 * simulated (taxis, drivers and the other passengers are made up); the passenger is the only real person.
 * A booking pays from the practice wallet, and the taxi then boards, leaves and arrives by itself so a
 * whole trip can be followed. Nothing here books a real taxi, holds real money or contacts anyone.
 */
import { practiceWalletBalance, practiceWalletRefund, practiceWalletSpend } from "./practice-wallet.js";

type Json = Record<string, any>;
const KEY = "peebee_practice_taxipress_v1";
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const err = (status: number, error: string, message: string) => ok({ error, message }, status);
const iso = (at = Date.now()) => new Date(at).toISOString();

const FARE = 8_000;
const MAX_SEATS = 4;

/** The options staff set in admin, as the app last read them. Bookings here are priced and checked by the same rules the app showed. */
let staffOptions: Record<string, any> = {};
export function rememberPracticeTaxipressOptions(config: Record<string, unknown>) { staffOptions = config; }
const LUGGAGE_DEFAULT: Record<string, number | null> = { personal: 0, standard: 2000, large: 4000, excess: 6000, fragile: 7000, commercial: null };

type PracticeRoute = { id: string; fromName: string; toName: string; directionLabel: string; routeCode: string; fare?: number };
/** Entebbe first: practice starts where the customer is. */
const ROUTES: PracticeRoute[] = [
  { id: "practice-tp-route-ek", fromName: "Entebbe Stage", toName: "Kampala Stage", directionLabel: "Entebbe → Kampala", routeCode: "EK" },
  { id: "practice-tp-route-ke", fromName: "Kampala Stage", toName: "Entebbe Stage", directionLabel: "Kampala → Entebbe", routeCode: "KE" },
  { id: "practice-tp-route-km", fromName: "Kampala Old Taxi Park", toName: "Mukono Taxi Park", directionLabel: "Kampala → Mukono", routeCode: "KM", fare: 5_000 },
  { id: "practice-tp-route-kn", fromName: "Kampala Old Taxi Park", toName: "Ntinda Stage", directionLabel: "Kampala → Ntinda", routeCode: "KN", fare: 3_000 },
  { id: "practice-tp-route-ka", fromName: "Kampala Old Taxi Park", toName: "Naalya Stage", directionLabel: "Kampala → Naalya", routeCode: "KA", fare: 4_000 },
  { id: "practice-tp-route-bn", fromName: "Busega Roundabout", toName: "Naalya Stage", directionLabel: "Busega → Naalya", routeCode: "BN", fare: 5_000 },
];
const fareOf = (routeId: string): number => ROUTES.find((r) => r.id === routeId)?.fare ?? FARE;

type PracticeTaxi = { id: string; routeId: string; plate: string; layout: "14" | "18"; driver: string; others: number };
const TAXIS: PracticeTaxi[] = [
  { id: "practice-tp-q-ek1", routeId: ROUTES[0]!.id, plate: "UBA 114K", layout: "14", driver: "Moses Ssebuliba", others: 9 },
  { id: "practice-tp-q-ek2", routeId: ROUTES[0]!.id, plate: "UAZ 872M", layout: "18", driver: "Ronald Kato", others: 4 },
  { id: "practice-tp-q-ek3", routeId: ROUTES[0]!.id, plate: "UBF 305D", layout: "14", driver: "Patrick Mugisha", others: 0 },
  { id: "practice-tp-q-ke1", routeId: ROUTES[1]!.id, plate: "UBC 641P", layout: "18", driver: "Joseph Ouma", others: 11 },
  { id: "practice-tp-q-ke2", routeId: ROUTES[1]!.id, plate: "UAX 220T", layout: "14", driver: "Sarah Namatovu", others: 6 },
  { id: "practice-tp-q-ke3", routeId: ROUTES[1]!.id, plate: "UBD 958H", layout: "14", driver: "Isaac Lubega", others: 1 },
  { id: "practice-tp-q-km1", routeId: ROUTES[2]!.id, plate: "UBR 115T", layout: "14", driver: "Tom Ssentamu", others: 8 },
  { id: "practice-tp-q-km2", routeId: ROUTES[2]!.id, plate: "UBR 116T", layout: "14", driver: "Emmanuel Byaruhanga", others: 2 },
  { id: "practice-tp-q-kn1", routeId: ROUTES[3]!.id, plate: "UBR 117T", layout: "18", driver: "Gerald Mbabazi", others: 10 },
  { id: "practice-tp-q-kn2", routeId: ROUTES[3]!.id, plate: "UBR 118T", layout: "14", driver: "Hakim Lutalo", others: 3 },
  { id: "practice-tp-q-ka1", routeId: ROUTES[4]!.id, plate: "UBR 119T", layout: "14", driver: "Vicky Nabukenya", others: 7 },
  { id: "practice-tp-q-ka2", routeId: ROUTES[4]!.id, plate: "UBR 120T", layout: "18", driver: "Dennis Opolot", others: 1 },
  { id: "practice-tp-q-bn1", routeId: ROUTES[5]!.id, plate: "UBR 121T", layout: "14", driver: "Yusuf Kasule", others: 9 },
  { id: "practice-tp-q-bn2", routeId: ROUTES[5]!.id, plate: "UBR 122T", layout: "14", driver: "Martin Kawooya", others: 0 },
];

type Details = { adults: number; children: number; childSeats: number; luggage: Record<string, number>; luggageAmount: number; assistance: string | null; language: string | null; forSomeoneElse: boolean; travellerName: string | null; travellerPhone: string | null; emergencyPhone: string | null };
type Booking = { id: string; queueId: string; seats: number; amount: number; method: "app" | "cash"; paid: boolean; code: string; at: number; open?: boolean; details?: Details; cancelled?: { refunded: number; fee: number } };
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
const mine = (s: State, taxiId: string) => s.bookings.filter((b) => b.queueId === taxiId && !b.cancelled && ACTIVE.includes(phase(b)));
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

/** Same rules as live with its defaults: a seat can be cancelled until it boards; inside the free window (10 minutes) the whole fare comes back. */
function cancelTerms(b: Booking) {
  const p = phase(b);
  if (b.open && !b.cancelled && p !== "boarded") return { allowed: true, reason: null, free: true, fee: 0, refund: b.paid ? b.amount : 0 };
  if (b.cancelled || p === "boarded" || p === "on_road" || p === "arrived") return { allowed: false, reason: b.cancelled ? "This booking was already cancelled." : "This seat can't be cancelled now.", free: false, fee: 0, refund: 0 };
  return { allowed: true, reason: null, free: true, fee: 0, refund: b.paid ? b.amount : 0 };
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
    status: b.cancelled ? "cancelled" : p === "arrived" ? "completed" : p === "boarded" || p === "on_road" ? "boarded" : "booked",
    seats: b.seats, farePerSeat: fareOf(route.id), amount: b.amount, paymentMethod: b.method, details: b.details ?? null,
    paymentStatus: b.cancelled ? "cancelled" : b.paid ? "paid" : b.method === "cash" ? "pay_driver" : "unpaid",
    ticketCode: b.code, createdAt: iso(b.at), payBy: null, openTicket: b.open ? { validUntil: null, expired: false } : null,
    cancel: cancelTerms(b),
    outcome: b.cancelled ? { kind: "cancelled", refunded: b.cancelled.refunded, fee: b.cancelled.fee } : null,
    receiptRef: !b.cancelled && (p === "boarded" || p === "on_road" || p === "arrived") ? `practice-tps-${b.id}` : null,
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
      routes: ROUTES.map((r) => ({ id: r.id, directionLabel: r.directionLabel, routeCode: r.routeCode, fromName: r.fromName, toName: r.toName, farePerSeat: r.fare ?? FARE })),
      cashEnabled: true, openTicketsEnabled: true, seatChoiceFeeUgx: 0, returnDiscountPercent: 0, maxSeatsPerBooking: MAX_SEATS, payWithinMinutes: 10,
      parcelFitText: "If it fits on a seat or under it, it can go.", parcelNotAllowed: ["Fuel", "Live animals"],
    });
  }

  const queue = /^\/v1\/taxipress\/routes\/([^/]+)\/queue$/.exec(path);
  if (method === "GET" && queue) {
    const route = ROUTES.find((r) => r.id === decodeURIComponent(queue[1]!));
    if (!route) return ok({ line: [], onRoad: [], route: null });
    return ok({ ...lineFor(s, route.id), route: { id: route.id, fromName: route.fromName, toName: route.toName, directionLabel: route.directionLabel, farePerSeat: route.fare ?? FARE } });
  }

  if (method === "GET" && path === "/v1/taxipress/bookings/mine") return ok({ bookings: [...s.bookings].reverse().map((b) => view(s, b)) });

  // A ticket code opens the ticket's details for anyone who has it (no sign-in).
  const byCode = /^\/v1\/taxipress-ticket\/([^/]+)$/.exec(path);
  if (method === "GET" && byCode) {
    const compact = decodeURIComponent(byCode[1]!).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const code = `TXP-${compact.startsWith("TXP") ? compact.slice(3) : compact}`;
    const b = s.bookings.find((x) => x.code === code || `TXP-${x.code}` === code);
    if (!b) return err(404, "not_found", "No ticket has that code. Check it and try again.");
    const v = view(s, b);
    const d = v.details as Json | null;
    return ok({ ticket: {
      code: v.ticketCode, status: v.status, paymentStatus: v.paymentStatus, amountDue: v.paymentStatus === "pay_driver" ? v.amount : null,
      seats: v.seats, adults: d?.adults ?? v.seats, children: d?.children ?? 0,
      bags: d ? Object.values((d.luggage ?? {}) as Record<string, number>).reduce((n, q) => n + Number(q || 0), 0) : 0,
      assistance: d?.assistance && d.assistance !== "none" ? d.assistance : null, language: d?.language ?? null,
      travellerName: d?.forSomeoneElse ? d.travellerName : "You", bookedBy: d?.forSomeoneElse ? "You" : null,
      route: { fromName: v.route.fromName, toName: v.route.toName, directionLabel: v.route.directionLabel },
      taxi: { plate: v.taxi.plate, seatLayout: v.taxi.seatLayout, driverName: String(v.taxi.driverName ?? "").split(" ")[0] || null, status: v.taxi.status, position: v.taxi.position },
    } });
  }

  // Send the ticket on: in practice nobody is really notified, but the buyer gets the code to pass on.
  const send = /^\/v1\/taxipress\/bookings\/([^/]+)\/send$/.exec(path);
  if (method === "POST" && send) {
    const b = s.bookings.find((x) => x.id === decodeURIComponent(send[1]!));
    if (!b) return err(404, "not_found", "That ticket wasn't found.");
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    if (name.length < 2 || phone.replace(/\D/g, "").length < 7) return err(400, "invalid_body", "Add the person's name and phone number.");
    b.details = { ...(b.details ?? {}), forSomeoneElse: true, travellerName: name, travellerPhone: phone } as any;
    save(s);
    return ok({ ok: true, code: b.code, onPeebee: false, travellerName: name, travellerPhone: phone });
  }

  const one = /^\/v1\/taxipress\/bookings\/([^/]+)$/.exec(path);
  if (method === "GET" && one) {
    const b = s.bookings.find((x) => x.id === decodeURIComponent(one[1]!));
    return b ? ok({ booking: view(s, b) }) : err(404, "not_found", "That ticket wasn't found.");
  }

  if (method === "POST" && path === "/v1/taxipress/bookings") {
    const taxi = taxiById(String(body.queueId));
    // Newer apps send who travels (adults, children) and what they bring; older ones send a seat count.
    const adults = Math.floor(Number(body.adults ?? body.seats));
    const children = body.adults != null ? Math.max(0, Math.floor(Number(body.children ?? 0)) || 0) : 0;
    const lap = Number.isFinite(Number(staffOptions.maxLapChildren)) ? Number(staffOptions.maxLapChildren) : 2;
    const childSeats = Math.max(0, children - lap);
    const seats = adults + childSeats;
    const maxSeats = Number.isFinite(Number(staffOptions.maxSeatsPerBooking)) && Number(staffOptions.maxSeatsPerBooking) > 0 ? Number(staffOptions.maxSeatsPerBooking) : MAX_SEATS;
    const method_ = body.payment === "cash" || body.openTicket ? (body.openTicket ? "app" : "cash") : "app";
    if (!taxi || taxiStatus(s, taxi) === "on_road") return err(409, "not_available", "That taxi isn't taking seats any more. Choose another.");
    if (!Number.isFinite(adults) || adults < 1) return err(400, "invalid_passengers", "At least one adult travels on a booking.");
    if (seats > maxSeats) return err(400, "too_many_seats", `You can book up to ${maxSeats} seat${maxSeats === 1 ? "" : "s"} at a time. This booking needs ${seats}.`);
    if (seats > Number(taxi.layout) - taken(s, taxi)) return err(409, "not_available", "There aren't that many seats left on this taxi.");
    const fare = fareOf(taxi.routeId);
    const childFare = Math.round((fare * (Number.isFinite(Number(staffOptions.childSeatFarePercent)) ? Number(staffOptions.childSeatFarePercent) : 100)) / 100);
    const offered: string[] = Array.isArray(staffOptions.luggageTypes) ? staffOptions.luggageTypes : Object.keys(LUGGAGE_DEFAULT);
    const prices: Record<string, number | null> = { ...LUGGAGE_DEFAULT, ...(staffOptions.luggagePrices ?? {}) };
    const luggage: Record<string, number> = {};
    let luggageAmount = 0;
    if (staffOptions.luggageEnabled !== false && body.luggage && typeof body.luggage === "object") {
      for (const [type, qty] of Object.entries(body.luggage as Record<string, unknown>)) {
        const n = Math.max(0, Math.min(10, Math.floor(Number(qty)) || 0));
        if (!n || !offered.includes(type)) continue;
        luggage[type] = n;
        luggageAmount += (prices[type] ?? 0) * n;
      }
    }
    const amount = fare * adults + childFare * childSeats + luggageAmount;
    if (method_ === "app" && !practiceWalletSpend(amount, `Taxipress ${routeOf(taxi.routeId).directionLabel} · ${taxi.plate} · ${seats} seat${seats === 1 ? "" : "s"}`)) {
      return err(409, "insufficient_funds", `Your practice wallet has UGX ${practiceWalletBalance().toLocaleString("en-UG")}. This booking needs UGX ${amount.toLocaleString("en-UG")}.`);
    }
    const b: Booking = { id: `practice-tp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, queueId: taxi.id, seats, amount, method: method_, paid: method_ === "app", code: newCode(), at: Date.now(), open: body.openTicket === true ? true : undefined,
      details: body.adults != null ? {
        adults, children, childSeats, luggage, luggageAmount, assistance: typeof body.assistance === "string" ? body.assistance : null, language: typeof body.language === "string" ? body.language : null,
        forSomeoneElse: body.forSomeoneElse === true, travellerName: typeof body.travellerName === "string" ? body.travellerName : null,
        travellerPhone: typeof body.travellerPhone === "string" ? body.travellerPhone : null, emergencyPhone: typeof body.emergencyPhone === "string" ? body.emergencyPhone : null,
      } : undefined };
    s.bookings.push(b);
    save(s);
    return ok({ booking: view(s, b), order: { id: `practice-tp-order-${b.id}` } }, 201);
  }

  // The receipt link a boarded passenger's QR holds, checked here so practice stays inside the browser.
  const receipt = /^\/v1\/public\/receipts\/practice-tps-([^/]+)$/.exec(path);
  if (method === "GET" && receipt) {
    const b = s.bookings.find((x) => x.id === decodeURIComponent(receipt[1]!));
    if (!b || b.cancelled || phase(b) === "waiting" || phase(b) === "boarding") return err(404, "not_found", "No Peebee receipt has this reference.");
    const t = taxiById(b.queueId)!;
    const route = routeOf(t.routeId);
    return ok({
      valid: true, kind: "taxipress", title: "Taxipress receipt",
      lines: [
        { label: "Reference", value: `practice-tps-${b.id}` }, { label: "Trip", value: `${route.fromName} → ${route.toName}` },
        { label: "Seats", value: String(b.seats) }, { label: "Paid", value: b.method === "cash" ? "In cash to the driver" : "In the app" },
      ],
      amountUgx: b.amount, issuedAt: iso(b.at + BOARDED_AT), demo: true,
    });
  }

  const cancel = /^\/v1\/taxipress\/bookings\/([^/]+)\/cancel$/.exec(path);
  if (method === "POST" && cancel) {
    const b = s.bookings.find((x) => x.id === decodeURIComponent(cancel[1]!));
    if (!b) return err(404, "not_found", "That booking wasn't found.");
    const terms = cancelTerms(b);
    if (!terms.allowed) return err(409, "not_cancellable", terms.reason ?? "This seat can't be cancelled now.");
    b.cancelled = { refunded: terms.refund, fee: terms.fee };
    if (terms.refund > 0) practiceWalletRefund(terms.refund, "Taxipress seat cancelled");
    save(s);
    return ok({ outcome: { kind: "cancelled", refunded: terms.refund, fee: terms.fee } });
  }

  // Cash is confirmed on the order straight away; the passenger pays the driver at boarding.
  const fund = /^\/v1\/orders\/practice-tp-order-([^/]+)\/fund$/.exec(path);
  if (method === "POST" && fund) return ok({ ok: true });

  return err(400, "practice_unsupported", "That action is outside this practice scenario. Your live account was not changed.");
}

export function resetPracticeTaxipress() {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
