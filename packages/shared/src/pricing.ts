/**
 * The costing mechanism: how a fare is built (distance bands, minimum, multipliers, fees) and how a payment is split
 * (gateway fee, tax, commission, maintenance, provider share). Pure functions only — the API, the admin calculators and
 * the practice simulator all run this same code, so a quote, a receipt and the books always agree.
 *
 * Every number is an admin setting. The defaults below reproduce today's behaviour unless a value is called out as new.
 */
import { inWindows, inZone, localClock, DEFAULT_TZ_OFFSET_MINUTES, type GeoPoint, type TimeWindow, type Zone } from "./offers.js";

// ---------------------------------------------------------------------------
// Fares
// ---------------------------------------------------------------------------

export const FARE_SERVICES = ["boda", "car_convenient", "car_comfort", "car_xl", "parcel", "shopping"] as const;
export type FareService = (typeof FARE_SERVICES)[number];
export const FARE_SERVICE_LABEL: Record<FareService, string> = {
  boda: "Boda ride", car_convenient: "Car — Convenient", car_comfort: "Car — Comfort", car_xl: "Car — XL / large", parcel: "Parcel delivery", shopping: "Shopping delivery",
};

/** Round up-ish to a step the admin chooses. 500 matches the existing fare rounding (see fare.ts). */
export type RoundingStep = 100 | 500 | 1000;

export function roundTo(amount: number, step: RoundingStep): number {
  if (step === 500) {
    // The same rule the whole app has always used: move up only when more than 350 into the interval.
    const lower = Math.floor(amount / 500) * 500;
    return amount - lower > 350 ? lower + 500 : lower;
  }
  return Math.round(amount / step) * step;
}

export type DistanceBand = {
  /** The band starts here (km). The first band always starts at 0. */
  fromKm: number;
  /** What the base rate is multiplied by in this band, in percent. 100 = the base rate. */
  ratePercent: number;
};

/** What a service charges before multipliers. `ratePerKm` and `minimumFare` live in the older settings so existing pages keep working. */
export type FareRates = {
  ratePerKm: number;
  minimumFare: number;
};

export type FareProfile = {
  /** Charged on every trip before distance. */
  baseFare: number;
  /** Tapering rate: beyond a distance the per-km rate falls. Empty = one flat rate. */
  bands: DistanceBand[];
  /** Added per minute of expected travel time. 0 = none. */
  perMinute: number;
  /** Used to estimate travel time from distance. */
  expectedSpeedKmh: number;
  /** Straight-line distance is multiplied by this to approximate road distance (1 = as measured). */
  distanceFactor: number;
  /** Highest fare, whatever the distance. 0 = no cap. */
  maximumFare: number;
  rounding: RoundingStep;
};

export type MultiplierKind = "fuel" | "peak" | "night" | "demand" | "traffic" | "weather" | "zone" | "holiday";
export const MULTIPLIER_INFO: Record<MultiplierKind, { label: string; description: string }> = {
  fuel: { label: "Fuel adjustment", description: "One percentage you raise or lower when fuel prices move. Can differ for each vehicle." },
  peak: { label: "Peak hours", description: "A percentage during chosen hours and days, such as the morning and evening rush." },
  night: { label: "Night", description: "A percentage during night hours." },
  demand: { label: "High demand", description: "A percentage when there are many more requests than riders nearby." },
  traffic: { label: "Heavy traffic", description: "A switch you turn on when traffic is heavy; adds a percentage while it is on." },
  weather: { label: "Rain / weather", description: "A switch you turn on in bad weather; adds a percentage while it is on." },
  zone: { label: "Zone", description: "A percentage when the pickup or drop-off is in a zone, such as the airport or a hilly area." },
  holiday: { label: "Holiday / event", description: "A percentage on dates you choose." },
};

export type MultiplierConfig = {
  fuel: { enabled: boolean; percent: number; perService: Partial<Record<FareService, number>> };
  peak: { enabled: boolean; percent: number; windows: TimeWindow[] };
  night: { enabled: boolean; percent: number; windows: TimeWindow[] };
  demand: { enabled: boolean; levels: { ratio: number; percent: number }[] };
  traffic: { enabled: boolean; active: boolean; percent: number };
  weather: { enabled: boolean; active: boolean; percent: number };
  zone: { enabled: boolean; zones: (Zone & { percent: number; match: "pickup" | "dropoff" | "either" })[] };
  holiday: { enabled: boolean; periods: { label: string; from: string; to: string; percent: number }[] };
  /** "add": percentages are added together (1 + sum). "multiply": each one multiplies the last. */
  combine: "add" | "multiply";
  /** The combined multiplier can never exceed this (2.5 = 250% of the fare). */
  maxMultiplier: number;
};

export type FeeConfig = {
  /** A flat fee on every booking — platform revenue. */
  bookingFee: { enabled: boolean; amount: number };
  /** Booking a ride for later. */
  scheduledFee: { enabled: boolean; amount: number };
  /** A flat fee per extra stop (kept in step with the older ride_stop_fee setting). */
  stopFee: number;
  /** Charged when the pickup or drop-off is in one of these zones (airport, toll road, ...). */
  zoneFees: { enabled: boolean; zones: (Zone & { amount: number; match: "pickup" | "dropoff" | "either" })[] };
  /** Discount on the return leg of a round trip. */
  returnTripDiscountPercent: number;
};

export type PricingConfig = {
  profiles: Record<FareService, FareProfile>;
  multipliers: MultiplierConfig;
  fees: FeeConfig;
  tzOffsetMinutes: number;
};

const FLAT: FareProfile = { baseFare: 0, bands: [], perMinute: 0, expectedSpeedKmh: 25, distanceFactor: 1, maximumFare: 0, rounding: 500 };

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  profiles: {
    boda: { ...FLAT },
    // Cars: the rate tapers on long trips. 5,000/km up to 20 km, then 90%, then 80% beyond 50 km.
    car_convenient: { ...FLAT, bands: [{ fromKm: 0, ratePercent: 100 }, { fromKm: 20, ratePercent: 90 }, { fromKm: 50, ratePercent: 80 }] },
    car_comfort: { ...FLAT, bands: [{ fromKm: 0, ratePercent: 100 }, { fromKm: 20, ratePercent: 90 }, { fromKm: 50, ratePercent: 80 }] },
    car_xl: { ...FLAT, bands: [{ fromKm: 0, ratePercent: 100 }, { fromKm: 20, ratePercent: 90 }, { fromKm: 50, ratePercent: 80 }] },
    parcel: { ...FLAT },
    shopping: { ...FLAT },
  },
  multipliers: {
    fuel: { enabled: true, percent: 0, perService: {} },
    peak: {
      enabled: false, percent: 15,
      windows: [{ days: [1, 2, 3, 4, 5], from: "07:00", to: "09:00" }, { days: [1, 2, 3, 4, 5], from: "17:00", to: "20:00" }],
    },
    night: { enabled: false, percent: 20, windows: [{ days: [], from: "22:00", to: "05:00" }] },
    demand: { enabled: false, levels: [{ ratio: 1.5, percent: 10 }, { ratio: 2, percent: 20 }, { ratio: 3, percent: 35 }] },
    traffic: { enabled: false, active: false, percent: 15 },
    weather: { enabled: false, active: false, percent: 15 },
    zone: { enabled: false, zones: [] },
    holiday: { enabled: false, periods: [{ label: "Christmas", from: "12-24", to: "12-26", percent: 20 }] },
    combine: "add",
    maxMultiplier: 2.5,
  },
  fees: {
    bookingFee: { enabled: false, amount: 500 },
    scheduledFee: { enabled: false, amount: 1_000 },
    stopFee: 1_000,
    zoneFees: { enabled: false, zones: [] },
    returnTripDiscountPercent: 0,
  },
  tzOffsetMinutes: DEFAULT_TZ_OFFSET_MINUTES,
};

export type FareInput = {
  service: FareService;
  rates: FareRates;
  /** Measured trip distance (km). */
  distanceKm: number;
  now: Date;
  stops?: number;
  scheduled?: boolean;
  returnTrip?: boolean;
  pickup?: GeoPoint | null;
  dropoff?: GeoPoint | null;
  /** Open requests divided by online riders nearby, when known. */
  demandRatio?: number | null;
  /** Tolls or parking the rider will pass on (UGX), shown on the receipt. */
  passThrough?: number;
  /** An amount already added by something else, such as a luxury hire's hourly charge. */
  extra?: number;
};

export type FareLine = { key: string; label: string; amount: number };
export type FareBreakdown = {
  service: FareService;
  distanceKm: number;
  lines: FareLine[];
  /** The multiplier applied to the distance and time charge (1 = none). */
  multiplier: number;
  multiplierParts: { kind: MultiplierKind; label: string; percent: number }[];
  /** Before the minimum and the cap. */
  subtotal: number;
  minimumApplied: boolean;
  maximumApplied: boolean;
  total: number;
};

/** Distance charge using tapering bands. Each km is charged at the rate of the band it falls in. */
export function distanceCharge(km: number, ratePerKm: number, bands: DistanceBand[]): { amount: number; parts: { fromKm: number; toKm: number; km: number; percent: number; amount: number }[] } {
  const sorted = bands.length > 0 ? [...bands].sort((a, b) => a.fromKm - b.fromKm) : [{ fromKm: 0, ratePercent: 100 }];
  if (sorted[0].fromKm > 0) sorted.unshift({ fromKm: 0, ratePercent: 100 });
  const parts: { fromKm: number; toKm: number; km: number; percent: number; amount: number }[] = [];
  let amount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].fromKm;
    const to = i + 1 < sorted.length ? sorted[i + 1].fromKm : Infinity;
    const inBand = Math.max(0, Math.min(km, to) - from);
    if (inBand <= 0) continue;
    const part = inBand * ratePerKm * (sorted[i].ratePercent / 100);
    amount += part;
    parts.push({ fromKm: from, toKm: to, km: inBand, percent: sorted[i].ratePercent, amount: part });
  }
  return { amount, parts };
}

function holidayPercent(periods: MultiplierConfig["holiday"]["periods"], monthDay: string): { label: string; percent: number } | null {
  for (const p of periods) {
    const inRange = p.from <= p.to ? monthDay >= p.from && monthDay <= p.to : monthDay >= p.from || monthDay <= p.to;
    if (inRange) return { label: p.label, percent: p.percent };
  }
  return null;
}

/** The multipliers that apply to a trip, and what they come to together. */
export function multipliersFor(cfg: PricingConfig, input: Pick<FareInput, "service" | "now" | "pickup" | "dropoff" | "demandRatio">): { multiplier: number; parts: FareBreakdown["multiplierParts"] } {
  const m = cfg.multipliers;
  const tz = cfg.tzOffsetMinutes;
  const parts: FareBreakdown["multiplierParts"] = [];
  const add = (kind: MultiplierKind, label: string, percent: number) => { if (percent !== 0) parts.push({ kind, label, percent }); };

  if (m.fuel.enabled) add("fuel", "Fuel adjustment", m.fuel.perService[input.service] ?? m.fuel.percent);
  if (m.peak.enabled && inWindows(input.now, m.peak.windows, tz)) add("peak", "Peak hours", m.peak.percent);
  if (m.night.enabled && inWindows(input.now, m.night.windows, tz)) add("night", "Night", m.night.percent);
  if (m.demand.enabled && input.demandRatio != null) {
    const level = [...m.demand.levels].sort((a, b) => b.ratio - a.ratio).find((l) => input.demandRatio! >= l.ratio);
    if (level) add("demand", "High demand", level.percent);
  }
  if (m.traffic.enabled && m.traffic.active) add("traffic", "Heavy traffic", m.traffic.percent);
  if (m.weather.enabled && m.weather.active) add("weather", "Weather", m.weather.percent);
  if (m.zone.enabled) {
    const hit = m.zone.zones
      .filter((z) => (z.match === "pickup" ? inZone(input.pickup, [z]) : z.match === "dropoff" ? inZone(input.dropoff, [z]) : inZone(input.pickup, [z]) || inZone(input.dropoff, [z])))
      .sort((a, b) => b.percent - a.percent)[0];
    if (hit) add("zone", hit.label || "Zone", hit.percent);
  }
  if (m.holiday.enabled) {
    const h = holidayPercent(m.holiday.periods, localClock(input.now, tz).monthDay);
    if (h) add("holiday", h.label || "Holiday", h.percent);
  }

  let multiplier = m.combine === "multiply" ? parts.reduce((acc, p) => acc * (1 + p.percent / 100), 1) : 1 + parts.reduce((acc, p) => acc + p.percent / 100, 0);
  multiplier = Math.max(0, Math.min(multiplier, Math.max(1, m.maxMultiplier)));
  return { multiplier, parts };
}

/** Builds one fare, showing every step. The order is fixed: distance bands → time → multipliers → fees → minimum → cap → rounding. */
export function computeFare(cfg: PricingConfig, input: FareInput): FareBreakdown {
  const profile = cfg.profiles[input.service];
  const lines: FareLine[] = [];
  const distance = Math.max(0, input.distanceKm) * Math.max(0, profile.distanceFactor || 1);

  if (profile.baseFare > 0) lines.push({ key: "base", label: "Base fare", amount: profile.baseFare });
  const dist = distanceCharge(distance, input.rates.ratePerKm, profile.bands);
  lines.push({ key: "distance", label: `Distance (${distance.toFixed(1)} km)`, amount: dist.amount });

  let timeCharge = 0;
  if (profile.perMinute > 0 && profile.expectedSpeedKmh > 0) {
    timeCharge = (distance / profile.expectedSpeedKmh) * 60 * profile.perMinute;
    lines.push({ key: "time", label: "Travel time", amount: timeCharge });
  }

  const travel = profile.baseFare + dist.amount + timeCharge;
  const { multiplier, parts } = multipliersFor(cfg, input);
  const multiplied = travel * multiplier;
  if (multiplier !== 1) lines.push({ key: "multiplier", label: parts.map((p) => `${p.label} ${p.percent > 0 ? "+" : ""}${p.percent}%`).join(", ") || "Adjustment", amount: multiplied - travel });

  let total = multiplied;
  const f = cfg.fees;
  if (f.bookingFee.enabled) { total += f.bookingFee.amount; lines.push({ key: "booking", label: "Booking fee", amount: f.bookingFee.amount }); }
  if (input.scheduled && f.scheduledFee.enabled) { total += f.scheduledFee.amount; lines.push({ key: "scheduled", label: "Scheduled ride fee", amount: f.scheduledFee.amount }); }
  if ((input.stops ?? 0) > 0 && f.stopFee > 0) { const a = input.stops! * f.stopFee; total += a; lines.push({ key: "stops", label: `${input.stops} extra stop${input.stops === 1 ? "" : "s"}`, amount: a }); }
  if (f.zoneFees.enabled) {
    const z = f.zoneFees.zones
      .filter((x) => (x.match === "pickup" ? inZone(input.pickup, [x]) : x.match === "dropoff" ? inZone(input.dropoff, [x]) : inZone(input.pickup, [x]) || inZone(input.dropoff, [x])))
      .sort((a, b) => b.amount - a.amount)[0];
    if (z) { total += z.amount; lines.push({ key: "zone_fee", label: z.label || "Area fee", amount: z.amount }); }
  }
  if ((input.passThrough ?? 0) > 0) { total += input.passThrough!; lines.push({ key: "pass_through", label: "Tolls and parking", amount: input.passThrough! }); }
  if ((input.extra ?? 0) > 0) { total += input.extra!; lines.push({ key: "extra", label: "Additional charge", amount: input.extra! }); }
  if (input.returnTrip && f.returnTripDiscountPercent > 0) {
    const off = total * (f.returnTripDiscountPercent / 100);
    total -= off;
    lines.push({ key: "return", label: `Return trip ${f.returnTripDiscountPercent}% off`, amount: -off });
  }

  const subtotal = total;
  let minimumApplied = false;
  let maximumApplied = false;
  const min = Math.max(0, input.rates.minimumFare);
  total = roundTo(total, profile.rounding);
  if (total < min) { total = min; minimumApplied = true; }
  if (profile.maximumFare > 0 && total > profile.maximumFare) { total = profile.maximumFare; maximumApplied = true; }
  total = Math.max(total, min && !maximumApplied ? min : 0);
  return { service: input.service, distanceKm: distance, lines, multiplier, multiplierParts: parts, subtotal, minimumApplied, maximumApplied, total };
}

// ---------------------------------------------------------------------------
// Money flow: who gets what from a payment
// ---------------------------------------------------------------------------

export const MONEY_MODULES = [
  "ride_boda", "ride_car", "delivery_parcel", "delivery_shopping", "food", "marketplace", "pharmacy", "gas", "laundry", "services", "learn", "work", "talent", "taxipress",
] as const;
export type MoneyModule = (typeof MONEY_MODULES)[number];
export const MONEY_MODULE_LABEL: Record<MoneyModule, string> = {
  ride_boda: "Boda rides", ride_car: "Car rides", delivery_parcel: "Parcel delivery", delivery_shopping: "Shopping delivery", food: "Restaurants & food", marketplace: "Marketplace",
  pharmacy: "Pharmacy", gas: "Gas", laundry: "Laundry & Work jobs", services: "Services", learn: "Learn", work: "Work", talent: "Hire", taxipress: "Taxipress",
};

export type Bearer = "customer" | "platform" | "provider" | "split";

export type CommissionRule = {
  type: "percent" | "flat" | "percent_min_max" | "tiered";
  percent: number;
  flat: number;
  /** percent_min_max: the percent commission is never below / above these. 0 = no limit. */
  min: number;
  max: number;
  /** tiered: higher monthly volume pays a lower percent. */
  tiers: { fromAmount: number; percent: number }[];
  /** What the percent is worked out on. */
  base: "gross" | "fare_only";
};

export type ModuleMoney = {
  commission: CommissionRule;
  /** Who pays the payment-gateway fee for this module. */
  gatewayFeeBearer: Bearer;
  /** For "split": the customer's share (0–100); the rest is shared between platform and provider by providerShareOfRemainder. */
  gatewayFeeCustomerPercent: number;
  /** Taxes apply to this module's payments. */
  taxed: boolean;
};

export type ProviderFeeRule = {
  id: string;
  provider: string;
  direction: "collection" | "disbursement";
  /** "any" matches every network. */
  network: "any" | "mtn" | "airtel" | "card";
  type: "percent" | "flat" | "percent_plus_flat";
  percent: number;
  flat: number;
  min: number;
  max: number;
  effectiveFrom: string;
  enabled: boolean;
};

export type TaxRule = {
  id: string;
  name: string;
  enabled: boolean;
  percent: number;
  /** What the tax is charged on. */
  appliesTo: "commission" | "gateway_fee" | "gross" | "provider_payout";
  /** "on_top": added to what the customer pays. "inclusive": already inside the amount, so it comes out of the party that bears it. */
  mode: "on_top" | "inclusive";
  /** Who bears an inclusive tax. */
  bearer: "platform" | "provider";
  modules: MoneyModule[];
  effectiveFrom: string;
};

export type MoneyFlowConfig = {
  modules: Record<MoneyModule, ModuleMoney>;
  providerFees: ProviderFeeRule[];
  taxes: TaxRule[];
  maintenance: {
    enabled: boolean;
    /** Kept aside from Peebee's net for running the platform. */
    percent: number;
    of: "platform_net" | "gross";
  };
};

const NO_COMMISSION: CommissionRule = { type: "percent", percent: 0, flat: 0, min: 0, max: 0, tiers: [], base: "gross" };
const moduleMoney = (over: Partial<ModuleMoney> = {}, commission: Partial<CommissionRule> = {}): ModuleMoney => ({
  commission: { ...NO_COMMISSION, ...commission },
  gatewayFeeBearer: "platform",
  gatewayFeeCustomerPercent: 50,
  taxed: true,
  ...over,
});

/** Placeholder gateway rates — set them to what each provider's contract says. They only affect reports and fee-cover credit. */
const PLACEHOLDER_FEE = { type: "percent" as const, percent: 2.5, flat: 0, min: 0, max: 0, effectiveFrom: "2026-01-01", enabled: true };

export const DEFAULT_MONEY_FLOW_CONFIG: MoneyFlowConfig = {
  modules: {
    // Rides: Peebee's cut is 0 for boda today and the platform share of the owner/driver split for cars (set under Peebee Car). Edit here to charge more.
    ride_boda: moduleMoney(),
    ride_car: moduleMoney(),
    delivery_parcel: moduleMoney(),
    delivery_shopping: moduleMoney(),
    food: moduleMoney({}, { percent: 10 }),
    marketplace: moduleMoney({}, { percent: 10 }),
    pharmacy: moduleMoney({}, { percent: 10 }),
    gas: moduleMoney(),
    laundry: moduleMoney({}, { percent: 15 }),
    services: moduleMoney({}, { percent: 5 }),
    learn: moduleMoney({}, { percent: 10 }),
    work: moduleMoney({}, { percent: 15 }),
    talent: moduleMoney({}, { percent: 10 }),
    taxipress: moduleMoney(),
  },
  providerFees: [
    { id: "yo-collection", provider: "yo", direction: "collection", network: "any", ...PLACEHOLDER_FEE },
    { id: "yo-disbursement", provider: "yo", direction: "disbursement", network: "any", ...PLACEHOLDER_FEE },
    { id: "flutterwave-collection", provider: "flutterwave", direction: "collection", network: "any", ...PLACEHOLDER_FEE },
    { id: "flutterwave-disbursement", provider: "flutterwave", direction: "disbursement", network: "any", ...PLACEHOLDER_FEE },
    { id: "mtn-collection", provider: "mtn", direction: "collection", network: "any", ...PLACEHOLDER_FEE },
    { id: "airtel-collection", provider: "airtel", direction: "collection", network: "any", ...PLACEHOLDER_FEE },
    { id: "pesapal-collection", provider: "pesapal", direction: "collection", network: "any", ...PLACEHOLDER_FEE, enabled: false },
  ],
  // Ships empty: tax rates and bases must come from your accountant.
  taxes: [],
  maintenance: { enabled: false, percent: 10, of: "platform_net" },
};

export function commissionAmount(rule: CommissionRule, input: { gross: number; fareOnly?: number; monthlyVolume?: number }): number {
  const base = rule.base === "fare_only" && input.fareOnly != null ? input.fareOnly : input.gross;
  if (base <= 0) return 0;
  switch (rule.type) {
    case "flat":
      return Math.min(rule.flat, base);
    case "percent":
      return Math.round((base * rule.percent) / 100);
    case "percent_min_max": {
      let c = Math.round((base * rule.percent) / 100);
      if (rule.min > 0) c = Math.max(c, rule.min);
      if (rule.max > 0) c = Math.min(c, rule.max);
      return Math.min(c, base);
    }
    case "tiered": {
      const tier = [...rule.tiers].sort((a, b) => b.fromAmount - a.fromAmount).find((t) => (input.monthlyVolume ?? 0) >= t.fromAmount);
      return Math.round((base * (tier?.percent ?? rule.percent)) / 100);
    }
  }
}

/** The fee a provider charges on one payment, from the newest rule in force on that day. */
export function gatewayFee(rules: ProviderFeeRule[], input: { provider: string; direction: "collection" | "disbursement"; network?: string | null; amount: number; on?: Date }): { fee: number; rule: ProviderFeeRule | null } {
  const day = (input.on ?? new Date()).toISOString().slice(0, 10);
  const candidates = rules
    .filter((r) => r.enabled && r.provider === input.provider && r.direction === input.direction && r.effectiveFrom <= day && (r.network === "any" || r.network === input.network))
    .sort((a, b) => (a.network === "any" ? 1 : 0) - (b.network === "any" ? 1 : 0) || (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  const rule = candidates[0] ?? null;
  if (!rule || input.amount <= 0) return { fee: 0, rule };
  let fee = rule.type === "flat" ? rule.flat : rule.type === "percent" ? (input.amount * rule.percent) / 100 : (input.amount * rule.percent) / 100 + rule.flat;
  if (rule.min > 0) fee = Math.max(fee, rule.min);
  if (rule.max > 0) fee = Math.min(fee, rule.max);
  return { fee: Math.round(fee), rule };
}

export type WaterfallInput = {
  /** The module's price: what the goods or ride cost, before any gateway fee or on-top tax. */
  gross: number;
  module: MoneyModule;
  /** Rail used. wallet and cash move no money through a gateway, so there is no gateway fee. */
  rail: "wallet" | "cash" | "mobile_money" | "card";
  provider?: string | null;
  network?: string | null;
  fareOnly?: number;
  monthlyVolume?: number;
  /** Commission the rider/merchant is excused (holiday, discount wallet): moves from Peebee to the provider. */
  commissionRelief?: number;
  /** Discount funded by Peebee: it lowers what the customer paid but not the provider's share. */
  platformFundedDiscount?: number;
  on?: Date;
};

export type WaterfallLine = { key: string; label: string; amount: number };
export type Waterfall = {
  /** What leaves the customer. */
  customerPays: number;
  /** Price of the goods or ride after any discount the customer got. */
  gross: number;
  gatewayFee: number;
  gatewayFeeRule: string | null;
  gatewayFeeSplit: { customer: number; platform: number; provider: number };
  taxes: { id: string; name: string; amount: number; bearer: "customer" | "platform" | "provider" }[];
  taxTotal: number;
  commission: number;
  commissionRelief: number;
  maintenance: number;
  /** What the rider / merchant / driver receives. */
  providerShare: number;
  /** What Peebee keeps after its share of gateway fees and taxes, before the maintenance reserve. */
  platformNet: number;
  /** What Peebee can spend: platformNet less the maintenance reserve. */
  platformAvailable: number;
  /** Peebee-funded discount that came out of Peebee's pocket. */
  promoCost: number;
  lines: WaterfallLine[];
};

function splitGateway(bearer: Bearer, fee: number, customerPercent: number): { customer: number; platform: number; provider: number } {
  switch (bearer) {
    case "customer": return { customer: fee, platform: 0, provider: 0 };
    case "provider": return { customer: 0, platform: 0, provider: fee };
    case "platform": return { customer: 0, platform: fee, provider: 0 };
    case "split": {
      const customer = Math.round((fee * Math.min(100, Math.max(0, customerPercent))) / 100);
      // The rest is shared equally: any odd shilling stays with the platform.
      const provider = Math.floor((fee - customer) / 2);
      return { customer, platform: fee - customer - provider, provider };
    }
  }
}

/**
 * Splits one payment. The invariant, which the tests check on every case:
 *   customerPays = providerShare + platformNet + gatewayFee + taxTotal − platformFundedDiscount's effect
 * i.e. nothing is created or lost. A discount funded by Peebee is paid out of Peebee's pocket: the customer pays less
 * than `gross`, the provider still gets their full share, and the gap shows up as `promoCost` against platformNet.
 */
export function computeWaterfall(cfg: MoneyFlowConfig, input: WaterfallInput): Waterfall {
  const mod = cfg.modules[input.module];
  const gross = Math.max(0, Math.round(input.gross));
  const lines: WaterfallLine[] = [];
  const external = input.rail === "mobile_money" || input.rail === "card";

  const baseCommission = commissionAmount(mod.commission, { gross, fareOnly: input.fareOnly, monthlyVolume: input.monthlyVolume });
  const relief = Math.min(baseCommission, Math.max(0, input.commissionRelief ?? 0));
  const commission = baseCommission - relief;

  const fee = external && input.provider ? gatewayFee(cfg.providerFees, { provider: input.provider, direction: "collection", network: input.network, amount: gross, on: input.on }) : { fee: 0, rule: null };
  const bearer = splitGateway(mod.gatewayFeeBearer, fee.fee, mod.gatewayFeeCustomerPercent);

  const taxes: Waterfall["taxes"] = [];
  const day = (input.on ?? new Date()).toISOString().slice(0, 10);
  for (const t of mod.taxed ? cfg.taxes : []) {
    if (!t.enabled || t.effectiveFrom > day || (t.modules.length > 0 && !t.modules.includes(input.module))) continue;
    const base = t.appliesTo === "commission" ? commission : t.appliesTo === "gateway_fee" ? fee.fee : t.appliesTo === "provider_payout" ? Math.max(0, gross - baseCommission) : gross;
    const amount = t.mode === "inclusive" ? Math.round(base - base / (1 + t.percent / 100)) : Math.round((base * t.percent) / 100);
    if (amount <= 0) continue;
    taxes.push({ id: t.id, name: t.name, amount, bearer: t.mode === "on_top" ? "customer" : t.bearer });
  }
  const taxTotal = taxes.reduce((s, t) => s + t.amount, 0);
  const taxBy = (who: "customer" | "platform" | "provider") => taxes.filter((t) => t.bearer === who).reduce((s, t) => s + t.amount, 0);

  const providerShare = Math.max(0, gross - baseCommission + relief - bearer.provider - taxBy("provider"));
  const customerSurcharge = bearer.customer + taxBy("customer");
  const promoCost = Math.max(0, Math.round(input.platformFundedDiscount ?? 0));
  const customerPays = Math.max(0, gross - promoCost + customerSurcharge);

  // Peebee's side: its commission, less the fees and taxes it bears, less any discount it funded.
  const platformNet = commission - bearer.platform - taxBy("platform") - promoCost;
  const maintBase = cfg.maintenance.of === "gross" ? gross : Math.max(0, platformNet);
  const maintenance = cfg.maintenance.enabled ? Math.min(Math.max(0, platformNet), Math.round((maintBase * cfg.maintenance.percent) / 100)) : 0;

  lines.push({ key: "customer", label: "Customer pays", amount: customerPays });
  if (promoCost > 0) lines.push({ key: "promo", label: "Discount funded by Peebee", amount: -promoCost });
  if (fee.fee > 0) lines.push({ key: "gateway", label: "Payment gateway fee", amount: fee.fee });
  for (const t of taxes) lines.push({ key: `tax_${t.id}`, label: t.name, amount: t.amount });
  lines.push({ key: "commission", label: "Peebee commission", amount: commission });
  if (maintenance > 0) lines.push({ key: "maintenance", label: "Platform maintenance reserve", amount: maintenance });
  lines.push({ key: "provider", label: "Rider / merchant receives", amount: providerShare });

  return {
    customerPays, gross, gatewayFee: fee.fee, gatewayFeeRule: fee.rule?.id ?? null, gatewayFeeSplit: bearer, taxes, taxTotal, commission, commissionRelief: relief,
    maintenance, providerShare, platformNet, platformAvailable: platformNet - maintenance, promoCost, lines,
  };
}

/**
 * Everything the customer pays is accounted for: it all ends up with the rider/merchant, Peebee, the gateway or the
 * government. (The maintenance reserve sits inside Peebee's net, it is not an extra line.) Used by the tests and by the
 * books before a split is recorded.
 */
export function waterfallBalances(w: Waterfall): boolean {
  return w.customerPays === w.providerShare + w.platformNet + w.gatewayFee + w.taxTotal;
}
