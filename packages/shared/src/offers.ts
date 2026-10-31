/**
 * Offers, rider incentives, the rider discount wallet and customer credit — the types, the recommended defaults
 * and the pure rules. Nothing here touches a database, so the API, the admin pages and the practice simulator all
 * apply exactly the same maths.
 *
 * Every option below is switchable in Admin → Offers. The defaults are Peebee's recommended set: the options marked
 * `recommended` are on out of the box, the rest are built and waiting for an admin to turn them on.
 */

import { floor500, roundNearest } from "./fare.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Stored values win; anything missing falls back to the default. Arrays are replaced whole, never merged. */
export function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return stored === undefined || stored === null ? defaults : (stored as T);
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    out[key] = key in defaults ? mergeDefaults((defaults as Record<string, unknown>)[key], value) : value;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// Services and shared helpers
// ---------------------------------------------------------------------------

export const OFFER_SERVICES = ["ride.boda", "ride.car", "delivery.parcel", "delivery.shopping"] as const;
export type OfferService = (typeof OFFER_SERVICES)[number];
export const OFFER_SERVICE_LABEL: Record<OfferService, string> = {
  "ride.boda": "Boda rides",
  "ride.car": "Car rides",
  "delivery.parcel": "Parcel delivery",
  "delivery.shopping": "Shopping delivery",
};
export type CarTier = "convenient" | "comfort" | "xl";

export type GeoPoint = { lat: number; lng: number };
export type Zone = GeoPoint & { radiusKm: number; label: string };
export type TimeWindow = { days: number[]; from: string; to: string };

/** Uganda is UTC+3 all year. Used when an offer says "10:00–15:00" so it means Kampala time on any server. */
export const DEFAULT_TZ_OFFSET_MINUTES = 180;

const EARTH_KM = 6371;
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function inZone(point: GeoPoint | null | undefined, zones: Zone[] | undefined): boolean {
  if (!point || !zones?.length) return false;
  return zones.some((z) => distanceKm(point, z) <= z.radiusKm);
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Local clock for a UTC instant: weekday 0 (Sunday) – 6, minutes since midnight and "MM-DD". */
export function localClock(now: Date, tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES): { day: number; minutes: number; monthDay: string } {
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  return {
    day: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    monthDay: `${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`,
  };
}

/** True when `now` falls inside any window. A window may wrap midnight ("22:00"–"05:00"). Empty list = never. */
export function inWindows(now: Date, windows: TimeWindow[] | undefined, tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES): boolean {
  if (!windows?.length) return false;
  const { day, minutes } = localClock(now, tzOffsetMinutes);
  return windows.some((w) => {
    const from = minutesOfDay(w.from);
    const to = minutesOfDay(w.to);
    const days = w.days?.length ? w.days : [0, 1, 2, 3, 4, 5, 6];
    if (from <= to) return days.includes(day) && minutes >= from && minutes < to;
    // Wraps midnight: the early-morning part belongs to the previous day's window.
    return (days.includes(day) && minutes >= from) || (days.includes((day + 6) % 7) && minutes < to);
  });
}

// Every amount a customer or rider is given is a whole step, rounded to the nearest (see roundNearest in fare.ts).
const roundTo500 = (n: number) => roundNearest(n);

// ---------------------------------------------------------------------------
// Customer offers
// ---------------------------------------------------------------------------

export const OFFER_KINDS = [
  "promo_code", "first_ride", "nth_ride", "referral", "time_window", "route_zone", "vehicle_type", "loyalty_tier",
  "bundle", "flash", "cashback", "free_ride", "birthday_event", "winback", "group",
] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export const OFFER_KIND_INFO: Record<OfferKind, { label: string; description: string }> = {
  promo_code: { label: "Promo code", description: "A code the customer types. Percent or flat off, with expiry and usage limits." },
  first_ride: { label: "First ride", description: "Automatic for a customer's very first ride." },
  nth_ride: { label: "Every Nth ride", description: "Automatic on every Nth ride, such as the 5th." },
  referral: { label: "Referral", description: "A discount for a customer who joined through an invitation, on their first ride." },
  time_window: { label: "Off-peak / time window", description: "Automatic during chosen hours and days, such as weekdays 10:00–15:00." },
  route_zone: { label: "Route or zone", description: "Automatic when the pickup or drop-off is inside a zone, such as the airport or a campus." },
  vehicle_type: { label: "Vehicle type", description: "Automatic for one car type (Convenient, Comfort or XL)." },
  loyalty_tier: { label: "Loyalty tier", description: "A standing discount for customers who reached a loyalty tier." },
  bundle: { label: "Ride pack", description: "A pack of discounted rides a customer owns (bought or granted)." },
  flash: { label: "Flash / happy hour", description: "A short window with a limited number of uses." },
  cashback: { label: "Cashback", description: "No discount now; a share of the fare comes back as wallet credit after the ride." },
  free_ride: { label: "Free ride", description: "The ride is free up to a maximum value." },
  birthday_event: { label: "Birthday or event", description: "Automatic on a customer's birthday or on chosen dates." },
  winback: { label: "Win-back", description: "Automatic for a customer who has not ridden for a number of days." },
  group: { label: "Corporate or student", description: "Automatic for customers in a verified group." },
};

export type OfferFunder = "platform" | "rider";
export type OfferStatus = "active" | "paused" | "draft";

export type OfferConditions = {
  windows?: TimeWindow[];
  zones?: Zone[];
  /** Which end of the trip must be inside a zone. */
  zoneMatch?: "pickup" | "dropoff" | "either";
  nth?: number;
  carTiers?: CarTier[];
  loyaltyTiers?: string[];
  groups?: string[];
  inactiveDays?: number;
  /** "MM-DD" dates for an event; with `birthday` true the customer's own birthday counts too. */
  dates?: string[];
  birthday?: boolean;
  /** Ride packs: how many rides a pack holds and what it costs (0 = granted only). */
  packRides?: number;
  packPrice?: number;
};

export type Offer = {
  id: string;
  name: string;
  description: string;
  code: string | null;
  kind: OfferKind;
  discountType: "percent" | "flat";
  value: number;
  /** 0 = no cap. */
  maxDiscount: number;
  /** The fare must be at least this for the offer to apply. */
  minFare: number;
  /** Empty = every service. */
  services: OfferService[];
  funder: OfferFunder;
  /** Applies without a code when the customer qualifies. Promo codes always need the code. */
  autoApply: boolean;
  /** May be combined with other offers on one ride (when the platform allows stacking). */
  stackable: boolean;
  status: OfferStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** 0 = unlimited. */
  usageLimitTotal: number;
  usageLimitPerUser: number;
  /** Platform money this offer may spend in total. 0 = unlimited. */
  budgetTotal: number;
  budgetSpent: number;
  redemptions: number;
  priority: number;
  conditions: OfferConditions;
};

export type CustomerOfferProfile = {
  rideCount: number;
  lastRideAt: Date | null;
  loyaltyTier: string | null;
  groups: string[];
  /** "MM-DD" */
  birthday: string | null;
  referredBy: string | null;
  /** Times this customer already used each offer. */
  usedByOffer: Record<string, number>;
  /** Rides left in each pack / voucher the customer holds, by offer id. */
  grants: Record<string, number>;
};

export type OfferContext = {
  service: OfferService;
  carTier?: CarTier | null;
  fare: number;
  now: Date;
  code?: string | null;
  pickup?: GeoPoint | null;
  dropoff?: GeoPoint | null;
  customer: CustomerOfferProfile;
  tzOffsetMinutes?: number;
};

export type OfferResult = {
  offerId: string;
  name: string;
  kind: OfferKind;
  funder: OfferFunder;
  eligible: boolean;
  reason?: string;
  /** Taken off the fare now. */
  discount: number;
  /** Returned to the customer's wallet credit after the ride. */
  cashback: number;
  usesGrant: boolean;
};

const no = (offer: Offer, reason: string): OfferResult => ({
  offerId: offer.id, name: offer.name, kind: offer.kind, funder: offer.funder, eligible: false, reason, discount: 0, cashback: 0, usesGrant: false,
});

function amountFor(offer: Offer, fare: number): number {
  if (offer.kind === "free_ride") {
    const cap = offer.maxDiscount > 0 ? offer.maxDiscount : fare;
    return Math.min(fare, cap);
  }
  const raw = offer.discountType === "percent" ? (fare * offer.value) / 100 : offer.value;
  // Nearest 500, but never above the cap or the fare themselves.
  const ceiling = Math.min(fare, offer.maxDiscount > 0 ? offer.maxDiscount : fare);
  return Math.min(roundTo500(raw), floor500(ceiling));
}

export function normaliseCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Whether one offer applies to one ride, and what it is worth. */
export function evaluateOffer(offer: Offer, ctx: OfferContext): OfferResult {
  const tz = ctx.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
  const c = offer.conditions ?? {};
  const profile = ctx.customer;
  const holdsGrant = (profile.grants[offer.id] ?? 0) > 0;

  if (offer.status !== "active") return no(offer, "This offer is not active.");
  if (offer.startsAt && ctx.now.getTime() < new Date(offer.startsAt).getTime()) return no(offer, "This offer has not started yet.");
  if (offer.endsAt && ctx.now.getTime() > new Date(offer.endsAt).getTime()) return no(offer, "This offer has ended.");
  if (offer.services.length > 0 && !offer.services.includes(ctx.service)) return no(offer, "Not available for this service.");
  if (ctx.fare < offer.minFare) return no(offer, `Needs a fare of at least UGX ${offer.minFare.toLocaleString("en-UG")}.`);
  if (offer.usageLimitTotal > 0 && offer.redemptions >= offer.usageLimitTotal) return no(offer, "This offer has been fully used.");
  if (offer.budgetTotal > 0 && offer.budgetSpent >= offer.budgetTotal) return no(offer, "This offer's budget is used up.");
  if (offer.usageLimitPerUser > 0 && (profile.usedByOffer[offer.id] ?? 0) >= offer.usageLimitPerUser) return no(offer, "You have already used this offer.");

  const codeGiven = normaliseCode(ctx.code);
  const codeMatches = !!offer.code && codeGiven === normaliseCode(offer.code);
  if (offer.kind === "promo_code" && !codeMatches) return no(offer, codeGiven ? "That code is not valid for this ride." : "Needs a promo code.");
  // Any offer with a code can also be claimed by typing it; otherwise it must be automatic or held as a grant.
  if (offer.kind !== "promo_code" && !offer.autoApply && !codeMatches && !holdsGrant) return no(offer, "Needs a code.");

  switch (offer.kind) {
    case "first_ride":
      if (profile.rideCount > 0) return no(offer, "Only for a first ride.");
      break;
    case "nth_ride": {
      const n = Math.max(2, c.nth ?? 5);
      if ((profile.rideCount + 1) % n !== 0) return no(offer, `Applies on every ${n}th ride.`);
      break;
    }
    case "referral":
      if (!profile.referredBy || profile.rideCount > 0) return no(offer, "Only for a first ride after joining by invitation.");
      break;
    case "time_window":
    case "flash":
      if (!inWindows(ctx.now, c.windows, tz)) return no(offer, "Not valid at this time.");
      break;
    case "route_zone": {
      const where = c.zoneMatch ?? "either";
      const ok = where === "pickup" ? inZone(ctx.pickup, c.zones) : where === "dropoff" ? inZone(ctx.dropoff, c.zones) : inZone(ctx.pickup, c.zones) || inZone(ctx.dropoff, c.zones);
      if (!ok) return no(offer, "This route is outside the offer area.");
      break;
    }
    case "vehicle_type":
      if (!ctx.carTier || !(c.carTiers ?? []).includes(ctx.carTier)) return no(offer, "Not valid for this vehicle type.");
      break;
    case "loyalty_tier":
      if (!profile.loyaltyTier || !(c.loyaltyTiers ?? []).includes(profile.loyaltyTier)) return no(offer, "Needs a higher loyalty tier.");
      break;
    case "bundle":
      if (!holdsGrant) return no(offer, "You have no rides left in this pack.");
      break;
    case "birthday_event": {
      const today = localClock(ctx.now, tz).monthDay;
      const event = (c.dates ?? []).includes(today);
      const birthday = !!c.birthday && !!profile.birthday && profile.birthday === today;
      if (!event && !birthday) return no(offer, "Not valid today.");
      break;
    }
    case "winback": {
      if (!profile.lastRideAt) return no(offer, "For customers coming back after a break.");
      const days = (ctx.now.getTime() - profile.lastRideAt.getTime()) / 86_400_000;
      if (days < Math.max(1, c.inactiveDays ?? 30)) return no(offer, "You have ridden recently.");
      break;
    }
    case "group":
      if (!(c.groups ?? []).some((g) => profile.groups.includes(g))) return no(offer, "Only for verified members of this group.");
      break;
    case "promo_code":
    case "cashback":
    case "free_ride":
      break;
  }

  const amount = amountFor(offer, ctx.fare);
  if (amount <= 0) return no(offer, "No saving on this fare.");
  const remainingBudget = offer.budgetTotal > 0 ? Math.max(0, offer.budgetTotal - offer.budgetSpent) : Infinity;
  const worth = Math.min(amount, remainingBudget);
  if (worth <= 0) return no(offer, "This offer's budget is used up.");
  const isCashback = offer.kind === "cashback";
  return {
    offerId: offer.id, name: offer.name, kind: offer.kind, funder: offer.funder, eligible: true,
    discount: isCashback ? 0 : worth, cashback: isCashback ? worth : 0, usesGrant: holdsGrant && offer.kind === "bundle",
  };
}

export type StackingPolicy = {
  /** "best_one": only the single best offer applies. "stack": offers marked stackable add up. */
  mode: "best_one" | "stack";
  /** Together, discounts can never take more than this % of the fare (1–100). */
  maxDiscountPercent: number;
};

export type AppliedOffers = { applied: OfferResult[]; discount: number; cashback: number; considered: OfferResult[] };

/** Picks the offers that apply to a ride under the stacking rules. */
export function pickOffers(offers: Offer[], ctx: OfferContext, policy: StackingPolicy): AppliedOffers {
  const considered = offers.map((o) => evaluateOffer(o, ctx));
  const eligible = considered.filter((r) => r.eligible);
  const byId = new Map(offers.map((o) => [o.id, o]));
  const worth = (r: OfferResult) => r.discount + r.cashback;
  eligible.sort((a, b) => worth(b) - worth(a) || (byId.get(b.offerId)?.priority ?? 0) - (byId.get(a.offerId)?.priority ?? 0));

  const applied: OfferResult[] = [];
  if (policy.mode === "best_one") {
    if (eligible[0]) applied.push(eligible[0]);
  } else {
    for (const r of eligible) {
      if (applied.length === 0) applied.push(r);
      else if (byId.get(r.offerId)?.stackable && applied.every((a) => byId.get(a.offerId)?.stackable)) applied.push(r);
    }
  }
  const cap = Math.floor((ctx.fare * Math.min(100, Math.max(1, policy.maxDiscountPercent))) / 100);
  let left = cap;
  const trimmed = applied.map((r) => {
    const discount = Math.min(r.discount, left);
    left -= discount;
    return { ...r, discount };
  }).filter((r) => r.discount > 0 || r.cashback > 0);
  return {
    applied: trimmed,
    discount: trimmed.reduce((s, r) => s + r.discount, 0),
    cashback: trimmed.reduce((s, r) => s + r.cashback, 0),
    considered,
  };
}

export type LoyaltyTier = { id: string; label: string; minRides: number };

export function loyaltyTierFor(rideCount: number, tiers: LoyaltyTier[]): string | null {
  const sorted = [...tiers].sort((a, b) => b.minRides - a.minRides);
  return sorted.find((t) => rideCount >= t.minRides)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Offers settings (Admin → Offers → Customer offers)
// ---------------------------------------------------------------------------

export type OffersConfig = {
  /** Master switch for customer offers. */
  enabled: boolean;
  stacking: StackingPolicy;
  /** Which services accept offers at all. */
  services: Record<OfferService, boolean>;
  /** Customers can type a code in the ride screen. */
  allowCodeEntry: boolean;
  /** Show the customer the saving before they pay. */
  showSavings: boolean;
  tzOffsetMinutes: number;
  loyaltyTiers: LoyaltyTier[];
  /** Ride packs can be bought from the wallet. */
  packsPurchasable: boolean;
  referral: {
    /** Invitations can be used at all. */
    enabled: boolean;
    /** Wallet credit the inviting customer receives when the invited customer completes their first ride. 0 = none. */
    referrerCreditUgx: number;
  };
};

export const DEFAULT_OFFERS_CONFIG: OffersConfig = {
  enabled: true,
  stacking: { mode: "best_one", maxDiscountPercent: 100 },
  services: { "ride.boda": true, "ride.car": true, "delivery.parcel": true, "delivery.shopping": false },
  allowCodeEntry: true,
  showSavings: true,
  tzOffsetMinutes: DEFAULT_TZ_OFFSET_MINUTES,
  loyaltyTiers: [
    { id: "bronze", label: "Bronze", minRides: 0 },
    { id: "silver", label: "Silver", minRides: 20 },
    { id: "gold", label: "Gold", minRides: 50 },
    { id: "platinum", label: "Platinum", minRides: 100 },
  ],
  packsPurchasable: true,
  referral: { enabled: true, referrerCreditUgx: 2_000 },
};

// ---------------------------------------------------------------------------
// Rider discount wallet
// ---------------------------------------------------------------------------

export type RiderVehicle = "boda" | "car" | "delivery";

/** How the rider is compensated when a customer's offer lowers what they pay. */
export type DiscountAccrual =
  /** The rider is guaranteed at least the service's minimum fare: only the part of the discount that takes the price below the minimum is credited. */
  | "below_minimum"
  /** Every shilling Peebee discounted is credited to the rider. */
  | "full_discount"
  /** Nothing is credited: the rider carries the offer (for admin-run rider-funded campaigns). */
  | "none";

export type DiscountPayoutMethod = "active_wallet" | "mobile_money" | "none";
export type DiscountPayoutTrigger = "daily" | "weekly" | "after_days" | "threshold" | "on_request";

export type DiscountWalletConfig = {
  enabled: boolean;
  /** Which riders' rides accumulate a discount wallet. */
  vehicles: Record<RiderVehicle, boolean>;
  accrual: DiscountAccrual;
  /** Peebee's commission on each later ride is settled from the discount wallet first. */
  offsetCommission: boolean;
  /** At most this % of each ride's commission may be settled from the discount wallet (1–100). */
  offsetMaxPercent: number;
  /** What is left in the discount wallet after commission has been offset. */
  payoutMethod: DiscountPayoutMethod;
  payoutTrigger: DiscountPayoutTrigger;
  /** weekly: 0 (Sunday) – 6. */
  payoutWeekday: number;
  /** after_days: pay out a balance that is this many days old. */
  payoutAfterDays: number;
  /** threshold: pay out once the balance reaches this. */
  payoutThreshold: number;
  /** Never pay out less than this in one go. */
  minPayout: number;
  /** Anything above this is paid out immediately. 0 = no ceiling. */
  maxBalance: number;
  /** Unused balance expires after this many days. 0 = never. */
  expiryDays: number;
  /** The rider can ask for their balance to be paid out from the app. */
  riderCanRequest: boolean;
};

export const DEFAULT_DISCOUNT_WALLET_CONFIG: DiscountWalletConfig = {
  enabled: true,
  vehicles: { boda: true, car: true, delivery: true },
  accrual: "below_minimum",
  offsetCommission: true,
  offsetMaxPercent: 100,
  payoutMethod: "active_wallet",
  payoutTrigger: "after_days",
  payoutWeekday: 1,
  payoutAfterDays: 7,
  payoutThreshold: 20_000,
  minPayout: 1_000,
  maxBalance: 0,
  expiryDays: 0,
  riderCanRequest: true,
};

/**
 * What the rider is credited when a customer rides with an offer.
 * `paid` is what the customer actually pays, `fullFare` before the offer, `minimumFare` the service's minimum.
 */
export function discountCompensation(cfg: DiscountWalletConfig, input: { vehicle: RiderVehicle; fullFare: number; paid: number; minimumFare: number; funder: OfferFunder }): number {
  if (!cfg.enabled || !cfg.vehicles[input.vehicle] || input.funder === "rider" || cfg.accrual === "none") return 0;
  const discount = Math.max(0, input.fullFare - input.paid);
  if (discount === 0) return 0;
  if (cfg.accrual === "full_discount") return discount;
  const floor = Math.min(input.fullFare, Math.max(0, input.minimumFare));
  return Math.min(discount, Math.max(0, floor - input.paid));
}

/** How much of this ride's commission the discount wallet settles. */
export function commissionOffset(cfg: DiscountWalletConfig, balance: number, commission: number): number {
  if (!cfg.enabled || !cfg.offsetCommission || balance <= 0 || commission <= 0) return 0;
  const allowed = Math.floor((commission * Math.min(100, Math.max(1, cfg.offsetMaxPercent))) / 100);
  return Math.max(0, Math.min(balance, allowed));
}

/** Whether a leftover discount balance is due to be paid out now. */
export function payoutDue(cfg: DiscountWalletConfig, input: { balance: number; oldestAccrualAt: Date | null; now: Date; requested?: boolean }): boolean {
  if (!cfg.enabled || cfg.payoutMethod === "none" || input.balance <= 0) return false;
  if (input.balance < cfg.minPayout && !(cfg.maxBalance > 0 && input.balance >= cfg.maxBalance)) return false;
  if (cfg.maxBalance > 0 && input.balance >= cfg.maxBalance) return true;
  if (input.requested && cfg.riderCanRequest) return true;
  switch (cfg.payoutTrigger) {
    case "threshold":
      return input.balance >= cfg.payoutThreshold;
    case "after_days":
      return !!input.oldestAccrualAt && (input.now.getTime() - input.oldestAccrualAt.getTime()) / 86_400_000 >= cfg.payoutAfterDays;
    case "daily":
      return true;
    case "weekly":
      return localClock(input.now).day === cfg.payoutWeekday;
    case "on_request":
      return false;
  }
}

// ---------------------------------------------------------------------------
// Rider incentives
// ---------------------------------------------------------------------------

export const INCENTIVE_KINDS = [
  "trip_streak", "weekly_ladder", "peak_boost", "zone_boost", "reliability_bonus", "rating_bonus", "rider_referral",
  "commission_holiday", "commission_tiers", "online_hours", "long_pickup", "night_bonus", "fuel_support", "milestones",
  "leaderboard", "welcome_back",
] as const;
export type IncentiveKind = (typeof INCENTIVE_KINDS)[number];

export const INCENTIVE_INFO: Record<IncentiveKind, { label: string; description: string; recommended: boolean; timing: "per_ride" | "period" }> = {
  trip_streak: { label: "Trip streak", description: "A bonus for completing N rides in a day without cancelling.", recommended: true, timing: "period" },
  weekly_ladder: { label: "Weekly target ladder", description: "Bigger weekly bonuses as a rider reaches higher ride counts.", recommended: true, timing: "period" },
  peak_boost: { label: "Peak-hour boost", description: "An extra amount on each ride during rush hours.", recommended: true, timing: "per_ride" },
  zone_boost: { label: "Zone boost", description: "An extra amount for pickups in under-served areas or at the airport.", recommended: false, timing: "per_ride" },
  reliability_bonus: { label: "Acceptance and completion bonus", description: "A monthly bonus for finishing most rides and cancelling few.", recommended: true, timing: "period" },
  rating_bonus: { label: "Rating bonus", description: "A weekly bonus for holding a high rating.", recommended: true, timing: "period" },
  rider_referral: { label: "Rider referral", description: "A payout when a rider you recruited completes enough rides.", recommended: false, timing: "period" },
  commission_holiday: { label: "Commission holiday", description: "No (or reduced) commission for a new rider's first days or rides.", recommended: true, timing: "per_ride" },
  commission_tiers: { label: "Commission tiers", description: "Commission steps down as a rider's monthly rides rise.", recommended: false, timing: "per_ride" },
  online_hours: { label: "Online-hours bonus", description: "A bonus for staying online through peak windows.", recommended: false, timing: "period" },
  long_pickup: { label: "Long-pickup compensation", description: "A top-up when the rider travelled far to reach the customer.", recommended: true, timing: "per_ride" },
  night_bonus: { label: "Night-shift bonus", description: "An extra amount for rides between set hours.", recommended: false, timing: "per_ride" },
  fuel_support: { label: "Fuel support", description: "A fuel credit for riders who pass a weekly ride count.", recommended: false, timing: "period" },
  milestones: { label: "Anniversary and milestones", description: "A reward at the 100th, 500th and 1,000th ride.", recommended: true, timing: "period" },
  leaderboard: { label: "Leaderboard prize", description: "Prizes for the top riders of the week or month.", recommended: false, timing: "period" },
  welcome_back: { label: "Welcome back", description: "A bonus for a rider returning after a break.", recommended: true, timing: "period" },
};

export type AmountRule = { type: "flat" | "percent"; value: number; maxPerRide: number };

export type IncentiveConfig = {
  enabled: boolean;
  /** Most Peebee will pay out in rider incentives per calendar month. 0 = no limit. */
  monthlyBudget: number;
  vehicles: Record<RiderVehicle, boolean>;
  tzOffsetMinutes: number;
  kinds: {
    trip_streak: { enabled: boolean; rides: number; bonus: number; noCancelRequired: boolean };
    weekly_ladder: { enabled: boolean; tiers: { rides: number; bonus: number }[] };
    peak_boost: { enabled: boolean; windows: TimeWindow[]; rule: AmountRule };
    zone_boost: { enabled: boolean; zones: Zone[]; rule: AmountRule };
    reliability_bonus: { enabled: boolean; minRides: number; minCompletionPercent: number; maxCancelPercent: number; bonus: number };
    rating_bonus: { enabled: boolean; minRating: number; minRatings: number; bonus: number };
    rider_referral: { enabled: boolean; afterRides: number; bonus: number };
    commission_holiday: { enabled: boolean; firstDays: number; firstRides: number; waivePercent: number };
    commission_tiers: { enabled: boolean; tiers: { ridesPerMonth: number; percent: number }[] };
    online_hours: { enabled: boolean; windows: TimeWindow[]; hoursPerWeek: number; bonus: number };
    long_pickup: { enabled: boolean; thresholdKm: number; perKm: number; maxAmount: number };
    night_bonus: { enabled: boolean; windows: TimeWindow[]; rule: AmountRule };
    fuel_support: { enabled: boolean; weeklyRides: number; credit: number };
    milestones: { enabled: boolean; milestones: { rides: number; bonus: number }[] };
    leaderboard: { enabled: boolean; period: "week" | "month"; minRides: number; prizes: number[] };
    welcome_back: { enabled: boolean; inactiveDays: number; afterRides: number; bonus: number };
  };
};

export const DEFAULT_INCENTIVE_CONFIG: IncentiveConfig = {
  enabled: true,
  monthlyBudget: 2_000_000,
  vehicles: { boda: true, car: true, delivery: true },
  tzOffsetMinutes: DEFAULT_TZ_OFFSET_MINUTES,
  kinds: {
    trip_streak: { enabled: true, rides: 8, bonus: 5_000, noCancelRequired: true },
    weekly_ladder: { enabled: true, tiers: [{ rides: 30, bonus: 15_000 }, { rides: 50, bonus: 35_000 }, { rides: 80, bonus: 70_000 }] },
    peak_boost: {
      enabled: true,
      windows: [{ days: [1, 2, 3, 4, 5], from: "07:00", to: "09:00" }, { days: [1, 2, 3, 4, 5], from: "17:00", to: "20:00" }],
      rule: { type: "flat", value: 500, maxPerRide: 2_000 },
    },
    zone_boost: { enabled: false, zones: [], rule: { type: "flat", value: 1_000, maxPerRide: 3_000 } },
    reliability_bonus: { enabled: true, minRides: 40, minCompletionPercent: 90, maxCancelPercent: 5, bonus: 20_000 },
    rating_bonus: { enabled: true, minRating: 4.8, minRatings: 10, bonus: 10_000 },
    rider_referral: { enabled: false, afterRides: 10, bonus: 10_000 },
    commission_holiday: { enabled: true, firstDays: 14, firstRides: 0, waivePercent: 100 },
    commission_tiers: { enabled: false, tiers: [{ ridesPerMonth: 0, percent: 15 }, { ridesPerMonth: 50, percent: 12 }, { ridesPerMonth: 100, percent: 10 }] },
    online_hours: { enabled: false, windows: [{ days: [1, 2, 3, 4, 5], from: "07:00", to: "20:00" }], hoursPerWeek: 20, bonus: 10_000 },
    long_pickup: { enabled: true, thresholdKm: 2, perKm: 500, maxAmount: 3_000 },
    night_bonus: { enabled: false, windows: [{ days: [], from: "22:00", to: "05:00" }], rule: { type: "flat", value: 1_000, maxPerRide: 3_000 } },
    fuel_support: { enabled: false, weeklyRides: 40, credit: 10_000 },
    milestones: { enabled: true, milestones: [{ rides: 100, bonus: 5_000 }, { rides: 500, bonus: 25_000 }, { rides: 1_000, bonus: 60_000 }] },
    leaderboard: { enabled: false, period: "week", minRides: 20, prizes: [20_000, 10_000, 5_000] },
    welcome_back: { enabled: true, inactiveDays: 14, afterRides: 3, bonus: 5_000 },
  },
};

function ruleAmount(rule: AmountRule, fare: number): number {
  const raw = rule.type === "percent" ? (fare * rule.value) / 100 : rule.value;
  const capped = rule.maxPerRide > 0 ? Math.min(raw, rule.maxPerRide) : raw;
  return roundTo500(capped);
}

export type RideIncentiveContext = {
  vehicle: RiderVehicle;
  fare: number;
  now: Date;
  pickup?: GeoPoint | null;
  /** How far the rider travelled to reach the pickup, when known. */
  pickupDistanceKm?: number | null;
  rider: { createdAt: Date; completedRides: number; ridesThisMonth: number };
};

export type IncentiveAward = { kind: IncentiveKind; amount: number; note: string };

/** Awards that attach to a single finished ride. */
export function perRideAwards(cfg: IncentiveConfig, ctx: RideIncentiveContext): IncentiveAward[] {
  if (!cfg.enabled || !cfg.vehicles[ctx.vehicle]) return [];
  const k = cfg.kinds;
  const out: IncentiveAward[] = [];
  const tz = cfg.tzOffsetMinutes;
  if (k.peak_boost.enabled && inWindows(ctx.now, k.peak_boost.windows, tz)) {
    const amount = ruleAmount(k.peak_boost.rule, ctx.fare);
    if (amount > 0) out.push({ kind: "peak_boost", amount, note: "Peak-hour boost" });
  }
  if (k.zone_boost.enabled && inZone(ctx.pickup, k.zone_boost.zones)) {
    const amount = ruleAmount(k.zone_boost.rule, ctx.fare);
    if (amount > 0) out.push({ kind: "zone_boost", amount, note: "Zone boost" });
  }
  if (k.night_bonus.enabled && inWindows(ctx.now, k.night_bonus.windows, tz)) {
    const amount = ruleAmount(k.night_bonus.rule, ctx.fare);
    if (amount > 0) out.push({ kind: "night_bonus", amount, note: "Night-shift bonus" });
  }
  if (k.long_pickup.enabled && ctx.pickupDistanceKm != null && ctx.pickupDistanceKm > k.long_pickup.thresholdKm) {
    const raw = (ctx.pickupDistanceKm - k.long_pickup.thresholdKm) * k.long_pickup.perKm;
    const amount = Math.min(roundTo500(raw), k.long_pickup.maxAmount > 0 ? floor500(k.long_pickup.maxAmount) : Infinity);
    if (amount > 0) out.push({ kind: "long_pickup", amount, note: `Long pickup (${ctx.pickupDistanceKm.toFixed(1)} km)` });
  }
  return out;
}

/** The share of Peebee's commission a rider is excused on a ride (0–100), from the commission holiday. */
export function commissionWaivePercent(cfg: IncentiveConfig, rider: { createdAt: Date; completedRides: number }, now: Date): number {
  if (!cfg.enabled) return 0;
  const h = cfg.kinds.commission_holiday;
  if (!h.enabled) return 0;
  const days = (now.getTime() - rider.createdAt.getTime()) / 86_400_000;
  const inDays = h.firstDays > 0 && days <= h.firstDays;
  const inRides = h.firstRides > 0 && rider.completedRides < h.firstRides;
  return inDays || inRides ? Math.min(100, Math.max(0, h.waivePercent)) : 0;
}

/** Commission percent for a rider this month from the tiered schedule, or null when tiers are off. */
export function tieredCommissionPercent(cfg: IncentiveConfig, ridesThisMonth: number): number | null {
  const t = cfg.kinds.commission_tiers;
  if (!cfg.enabled || !t.enabled || t.tiers.length === 0) return null;
  const sorted = [...t.tiers].sort((a, b) => b.ridesPerMonth - a.ridesPerMonth);
  return (sorted.find((x) => ridesThisMonth >= x.ridesPerMonth) ?? sorted[sorted.length - 1]).percent;
}

export type RiderPeriodStats = {
  ridesInPeriod: number;
  cancelledInPeriod: number;
  completedRides: number;
  ratingAverage: number | null;
  ratingCount: number;
  onlineHours: number;
  /** Rides in the period that began a day on which no ride was cancelled — for streak. */
  ridesToday: number;
  cancelledToday: number;
  daysSinceLastRide: number | null;
};

/** Awards that depend on a day / week / month of activity. `period` says which sweep is asking. */
export function periodAwards(cfg: IncentiveConfig, period: "day" | "week" | "month", s: RiderPeriodStats): IncentiveAward[] {
  if (!cfg.enabled) return [];
  const k = cfg.kinds;
  const out: IncentiveAward[] = [];
  if (period === "day" && k.trip_streak.enabled && s.ridesToday >= k.trip_streak.rides && (!k.trip_streak.noCancelRequired || s.cancelledToday === 0)) {
    out.push({ kind: "trip_streak", amount: k.trip_streak.bonus, note: `${k.trip_streak.rides} rides in a day` });
  }
  if (period === "week") {
    if (k.weekly_ladder.enabled) {
      const reached = [...k.weekly_ladder.tiers].sort((a, b) => b.rides - a.rides).find((t) => s.ridesInPeriod >= t.rides);
      if (reached) out.push({ kind: "weekly_ladder", amount: reached.bonus, note: `${reached.rides}+ rides this week` });
    }
    if (k.rating_bonus.enabled && s.ratingAverage != null && s.ratingAverage >= k.rating_bonus.minRating && s.ratingCount >= k.rating_bonus.minRatings) {
      out.push({ kind: "rating_bonus", amount: k.rating_bonus.bonus, note: `Rating ${s.ratingAverage.toFixed(2)}` });
    }
    if (k.fuel_support.enabled && s.ridesInPeriod >= k.fuel_support.weeklyRides) {
      out.push({ kind: "fuel_support", amount: k.fuel_support.credit, note: "Weekly fuel support" });
    }
    if (k.online_hours.enabled && s.onlineHours >= k.online_hours.hoursPerWeek) {
      out.push({ kind: "online_hours", amount: k.online_hours.bonus, note: `${k.online_hours.hoursPerWeek}+ hours online` });
    }
  }
  if (period === "month" && k.reliability_bonus.enabled && s.ridesInPeriod >= k.reliability_bonus.minRides) {
    const offered = s.ridesInPeriod + s.cancelledInPeriod;
    const completion = offered > 0 ? (s.ridesInPeriod / offered) * 100 : 0;
    const cancelRate = offered > 0 ? (s.cancelledInPeriod / offered) * 100 : 0;
    if (completion >= k.reliability_bonus.minCompletionPercent && cancelRate <= k.reliability_bonus.maxCancelPercent) {
      out.push({ kind: "reliability_bonus", amount: k.reliability_bonus.bonus, note: `Completion ${completion.toFixed(0)}%` });
    }
  }
  return out;
}

/** Milestone bonuses a rider has just crossed (a ride count moving from `before` to `after`). */
export function milestoneAwards(cfg: IncentiveConfig, before: number, after: number): IncentiveAward[] {
  const m = cfg.kinds.milestones;
  if (!cfg.enabled || !m.enabled) return [];
  return m.milestones.filter((x) => before < x.rides && after >= x.rides).map((x) => ({ kind: "milestones" as const, amount: x.bonus, note: `${x.rides} rides milestone` }));
}

/** Welcome-back bonus once a returning rider has finished enough rides after the break. */
export function welcomeBackDue(cfg: IncentiveConfig, input: { daysAwayBeforeReturn: number; ridesSinceReturn: number }): IncentiveAward | null {
  const w = cfg.kinds.welcome_back;
  if (!cfg.enabled || !w.enabled) return null;
  return input.daysAwayBeforeReturn >= w.inactiveDays && input.ridesSinceReturn >= w.afterRides ? { kind: "welcome_back", amount: w.bonus, note: `Back after ${Math.round(input.daysAwayBeforeReturn)} days` } : null;
}

/** Leaderboard prizes for the ranked riders (already filtered to those who met the minimum). */
export function leaderboardAwards(cfg: IncentiveConfig, ranked: { riderId: string; rides: number }[]): { riderId: string; award: IncentiveAward }[] {
  const l = cfg.kinds.leaderboard;
  if (!cfg.enabled || !l.enabled) return [];
  return ranked
    .filter((r) => r.rides >= l.minRides)
    .slice(0, l.prizes.length)
    .map((r, i) => ({ riderId: r.riderId, award: { kind: "leaderboard" as const, amount: l.prizes[i], note: `Leaderboard place ${i + 1}` } }));
}

/** How much of this month's incentive budget is left (Infinity when there is no cap). */
export function budgetLeft(cfg: IncentiveConfig, spentThisMonth: number): number {
  return cfg.monthlyBudget > 0 ? Math.max(0, cfg.monthlyBudget - spentThisMonth) : Infinity;
}

// ---------------------------------------------------------------------------
// Customer wallet credit (bonus money that stays on the platform)
// ---------------------------------------------------------------------------

export const CREDIT_MODULES = [
  "ride_boda", "ride_car", "delivery", "food", "marketplace", "pharmacy", "gas", "laundry", "services", "learn", "work", "talent", "taxipress",
] as const;
export type CreditModule = (typeof CREDIT_MODULES)[number];
export const CREDIT_MODULE_LABEL: Record<CreditModule, string> = {
  ride_boda: "Boda rides", ride_car: "Car rides", delivery: "Parcel & shopping delivery", food: "Restaurants & food", marketplace: "Marketplace",
  pharmacy: "Pharmacy", gas: "Gas", laundry: "Laundry & Work jobs", services: "Services", learn: "Learn", work: "Work", talent: "Hire", taxipress: "Taxipress",
};

export type CreditConfig = {
  enabled: boolean;
  /** Which balance is spent first when both can pay. */
  spendOrder: "credit_first" | "cash_first";
  /** Credit expires this many days after it is given. 0 = never. */
  expiryDays: number;
  /** Credit may pay for these modules. */
  spendableModules: Record<CreditModule, boolean>;
  /** At most this % of an order can be paid with credit (1–100). */
  maxSharePercent: number;
  /** Merchants, restaurants and providers where credit is accepted in addition to the modules above (sponsored deals). */
  partnerIds: string[];
  /** When true, credit tagged to a partner campaign can only be spent at that partner. */
  partnerCreditLocked: boolean;

  topup: {
    /** "customer_pays": the wallet gets the amount minus the gateway fee. "make_whole": the wallet shows the full amount; Peebee adds the fee as credit. */
    feeMode: "customer_pays" | "make_whole";
    makeWholeIncludesTax: boolean;
    makeWholeMinTopup: number;
    /** Most Peebee will spend covering top-up fees per customer per month. 0 = no cap. */
    makeWholeMonthlyCapPerCustomer: number;
    /** Most Peebee will spend covering top-up fees across all customers per month. 0 = no cap. */
    makeWholeMonthlyBudget: number;
    bonus: {
      enabled: boolean;
      type: "flat" | "percent";
      value: number;
      minDeposit: number;
      maxBonusPerDeposit: number;
      maxBonusPerMonth: number;
      firstDepositOnly: boolean;
      requireVerified: boolean;
      /** Deposits that earn a bonus per customer per day. */
      maxBonusDepositsPerDay: number;
      startsAt: string | null;
      endsAt: string | null;
    };
  };

  /** Cash-out of the customer's own deposited cash. The wallet is closed-loop unless an admin turns this on. */
  withdrawal: {
    enabled: boolean;
    /** Deposited cash cannot be withdrawn for this many days. */
    lockDays: number;
    /** A single request may take at most this % of the cash balance. */
    maxPercentPerRequest: number;
    minAmount: number;
    dailyLimit: number;
    /** Always keep at least this much cash in the wallet. */
    keepMinimum: number;
    /** One credited bonus per phone number / payment account. */
    oneBonusPerPhone: boolean;
    /** Hold a withdrawal for admin review when it follows a bonus deposit this closely. */
    reviewIfWithinDays: number;
    /** A reversed or charged-back deposit takes its bonus back. */
    clawbackOnReversal: boolean;
  };
};

export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  enabled: true,
  spendOrder: "credit_first",
  expiryDays: 90,
  spendableModules: {
    ride_boda: true, ride_car: true, delivery: true, food: false, marketplace: false, pharmacy: false, gas: false, laundry: false,
    services: false, learn: false, work: false, talent: false, taxipress: false,
  },
  maxSharePercent: 100,
  partnerIds: [],
  partnerCreditLocked: true,
  topup: {
    feeMode: "make_whole",
    makeWholeIncludesTax: false,
    makeWholeMinTopup: 0,
    makeWholeMonthlyCapPerCustomer: 0,
    makeWholeMonthlyBudget: 0,
    bonus: {
      enabled: true, type: "percent", value: 2, minDeposit: 10_000, maxBonusPerDeposit: 2_000, maxBonusPerMonth: 10_000,
      firstDepositOnly: false, requireVerified: true, maxBonusDepositsPerDay: 1, startsAt: null, endsAt: null,
    },
  },
  withdrawal: {
    enabled: false, lockDays: 3, maxPercentPerRequest: 80, minAmount: 5_000, dailyLimit: 500_000, keepMinimum: 0,
    oneBonusPerPhone: true, reviewIfWithinDays: 3, clawbackOnReversal: true,
  },
};

/** The bonus a deposit earns, before monthly and per-day limits (those need the database). */
export function depositBonus(cfg: CreditConfig, input: { amount: number; now: Date; verified: boolean; isFirstDeposit: boolean }): number {
  const b = cfg.topup.bonus;
  if (!cfg.enabled || !b.enabled) return 0;
  if (b.startsAt && input.now.getTime() < new Date(b.startsAt).getTime()) return 0;
  if (b.endsAt && input.now.getTime() > new Date(b.endsAt).getTime()) return 0;
  if (input.amount < b.minDeposit) return 0;
  if (b.requireVerified && !input.verified) return 0;
  if (b.firstDepositOnly && !input.isFirstDeposit) return 0;
  const raw = b.type === "percent" ? (input.amount * b.value) / 100 : b.value;
  const capped = b.maxBonusPerDeposit > 0 ? Math.min(raw, b.maxBonusPerDeposit) : raw;
  return Math.max(0, Math.floor(capped));
}

/** Where a payment is split between credit and cash. */
export function splitWalletPayment(input: { amount: number; cash: number; credit: number; creditAllowedAmount: number; order: "credit_first" | "cash_first" }): { credit: number; cash: number; shortfall: number } {
  const creditCap = Math.min(input.credit, Math.max(0, input.creditAllowedAmount), input.amount);
  let credit: number;
  let cash: number;
  if (input.order === "credit_first") {
    credit = creditCap;
    cash = input.amount - credit;
    if (cash > input.cash) return { credit, cash: input.cash, shortfall: cash - input.cash };
  } else {
    cash = Math.min(input.cash, input.amount);
    credit = Math.min(creditCap, input.amount - cash);
    const rest = input.amount - cash - credit;
    if (rest > 0) return { credit, cash, shortfall: rest };
  }
  return { credit, cash, shortfall: 0 };
}

/** Which part of an order credit may pay for. */
export function creditAllowedAmount(cfg: CreditConfig, input: { module: CreditModule; amount: number; partnerId?: string | null }): number {
  if (!cfg.enabled) return 0;
  const moduleOk = cfg.spendableModules[input.module];
  const partnerOk = !!input.partnerId && cfg.partnerIds.includes(input.partnerId);
  if (!moduleOk && !partnerOk) return 0;
  return Math.floor((input.amount * Math.min(100, Math.max(1, cfg.maxSharePercent))) / 100);
}

/** What a customer may withdraw right now from cash that has aged past the lock. */
export function withdrawableCash(cfg: CreditConfig, input: { cashBalance: number; lockedCash: number; withdrawnToday: number }): number {
  const w = cfg.withdrawal;
  if (!cfg.enabled || !w.enabled) return 0;
  const free = Math.max(0, Math.min(input.cashBalance - input.lockedCash, input.cashBalance - w.keepMinimum));
  const perRequest = Math.floor((input.cashBalance * Math.min(100, Math.max(1, w.maxPercentPerRequest))) / 100);
  const dayLeft = w.dailyLimit > 0 ? Math.max(0, w.dailyLimit - input.withdrawnToday) : Infinity;
  return Math.max(0, Math.min(free, perRequest, dayLeft));
}
