import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MONEY_FLOW_CONFIG, DEFAULT_PRICING_CONFIG, commissionAmount, computeFare, computeWaterfall, distanceCharge, gatewayFee, multipliersFor, waterfallBalances,
  type MoneyFlowConfig, type PricingConfig,
} from "@peebee/shared";

const NOW = new Date("2026-10-29T09:30:00Z"); // Thursday 12:30 Kampala
const clone = <T,>(v: T): T => structuredClone(v);
const car = { ratePerKm: 5_000, minimumFare: 10_000 };

test("car fare: 5,000 per km with a 10,000 minimum", () => {
  const fare = (km: number) => computeFare(DEFAULT_PRICING_CONFIG, { service: "car_convenient", rates: car, distanceKm: km, now: NOW }).total;
  assert.equal(fare(1), 10_000, "below the minimum");
  assert.equal(fare(2), 10_000);
  assert.equal(fare(3), 15_000);
  assert.equal(fare(5), 25_000);
  assert.equal(computeFare(DEFAULT_PRICING_CONFIG, { service: "car_convenient", rates: car, distanceKm: 1, now: NOW }).minimumApplied, true);
});

test("the rate tapers beyond a distance: each km is charged at its own band", () => {
  const bands = DEFAULT_PRICING_CONFIG.profiles.car_convenient.bands; // 0-20 100%, 20-50 90%, 50+ 80%
  const d = distanceCharge(60, 5_000, bands);
  assert.equal(d.amount, 20 * 5_000 + 30 * 4_500 + 10 * 4_000);
  assert.equal(d.parts.length, 3);
  assert.equal(distanceCharge(10, 5_000, bands).amount, 50_000);
  assert.equal(distanceCharge(10, 5_000, []).amount, 50_000, "no bands = one flat rate");
  // The fare never goes down as the trip gets longer.
  let last = 0;
  for (let km = 1; km <= 80; km++) {
    const f = computeFare(DEFAULT_PRICING_CONFIG, { service: "car_convenient", rates: car, distanceKm: km, now: NOW }).total;
    assert.ok(f >= last, `fare at ${km} km`);
    last = f;
  }
});

test("a first band that does not start at zero is still charged from zero", () => {
  assert.equal(distanceCharge(10, 1_000, [{ fromKm: 5, ratePercent: 50 }]).amount, 5 * 1_000 + 5 * 500);
});

test("boda and delivery behave as before with the default profile", () => {
  const boda = computeFare(DEFAULT_PRICING_CONFIG, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 4, now: NOW });
  assert.equal(boda.total, 6_000);
  assert.equal(computeFare(DEFAULT_PRICING_CONFIG, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 0.5, now: NOW }).total, 2_500);
});

test("fuel adjustment raises every fare; it can differ for one vehicle", () => {
  const cfg = clone(DEFAULT_PRICING_CONFIG);
  cfg.multipliers.fuel.percent = 10;
  assert.equal(computeFare(cfg, { service: "car_convenient", rates: car, distanceKm: 5, now: NOW }).total, 27_500);
  cfg.multipliers.fuel.perService = { boda: 10 };
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 4, now: NOW }).total, 6_500, "6,000 + 10% = 6,600, rounds to 6,500");
  cfg.multipliers.fuel.perService = { boda: 5 };
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 4, now: NOW }).total, 6_000, "6,300 is only 300 into the step, so it rounds down (the app's usual rule)");
});

test("peak, night, traffic, weather, demand and holiday multipliers add up, in Kampala time, with an overall cap", () => {
  const cfg: PricingConfig = clone(DEFAULT_PRICING_CONFIG);
  const peak = new Date("2026-10-29T05:00:00Z"); // Thursday 08:00 local
  assert.equal(multipliersFor(cfg, { service: "boda", now: peak }).multiplier, 1, "peak is off by default");
  cfg.multipliers.peak.enabled = true;
  assert.equal(multipliersFor(cfg, { service: "boda", now: peak }).multiplier, 1.15);
  assert.equal(multipliersFor(cfg, { service: "boda", now: NOW }).multiplier, 1, "12:30 is not peak");
  cfg.multipliers.traffic = { enabled: true, active: true, percent: 15 };
  cfg.multipliers.weather = { enabled: true, active: true, percent: 15 };
  cfg.multipliers.demand = { enabled: true, levels: [{ ratio: 1.5, percent: 10 }, { ratio: 3, percent: 35 }] };
  const stacked = multipliersFor(cfg, { service: "boda", now: peak, demandRatio: 3.2 });
  assert.equal(Math.round(stacked.multiplier * 100) / 100, 1.8, "15 + 15 + 15 + 35 = +80%");
  cfg.multipliers.maxMultiplier = 1.5;
  assert.equal(multipliersFor(cfg, { service: "boda", now: peak, demandRatio: 3.2 }).multiplier, 1.5, "never above the cap");
  cfg.multipliers.combine = "multiply";
  cfg.multipliers.maxMultiplier = 10;
  assert.equal(Math.round(multipliersFor(cfg, { service: "boda", now: peak, demandRatio: 3.2 }).multiplier * 1000) / 1000, Math.round(1.15 * 1.15 * 1.15 * 1.35 * 1000) / 1000);
  cfg.multipliers.holiday.enabled = true;
  const xmas = new Date("2026-12-25T09:00:00Z");
  assert.ok(multipliersFor(cfg, { service: "boda", now: xmas }).parts.some((p) => p.kind === "holiday"));
  // A switch that is enabled but not switched on adds nothing.
  cfg.multipliers.traffic.active = false;
  assert.ok(!multipliersFor(cfg, { service: "boda", now: peak }).parts.some((p) => p.kind === "traffic"));
});

test("zone markups and area fees use the pickup or drop-off", () => {
  const cfg = clone(DEFAULT_PRICING_CONFIG);
  const airport = { lat: 0.0446, lng: 32.4435, radiusKm: 3, label: "Airport" };
  cfg.multipliers.zone = { enabled: true, zones: [{ ...airport, percent: 20, match: "either" }] };
  cfg.fees.zoneFees = { enabled: true, zones: [{ ...airport, amount: 5_000, match: "dropoff" }] };
  const near = { lat: 0.045, lng: 32.444 };
  const to = computeFare(cfg, { service: "car_convenient", rates: car, distanceKm: 10, now: NOW, pickup: { lat: 0.3, lng: 32.58 }, dropoff: near });
  assert.equal(to.lines.find((l) => l.key === "zone_fee")?.amount, 5_000);
  assert.equal(to.multiplier, 1.2);
  const from = computeFare(cfg, { service: "car_convenient", rates: car, distanceKm: 10, now: NOW, pickup: near, dropoff: { lat: 0.3, lng: 32.58 } });
  assert.equal(from.lines.find((l) => l.key === "zone_fee"), undefined, "the fee is for drop-off only");
});

test("fees: booking, scheduled, stops, pass-through and the return-trip discount", () => {
  const cfg = clone(DEFAULT_PRICING_CONFIG);
  cfg.fees.bookingFee = { enabled: true, amount: 500 };
  cfg.fees.scheduledFee = { enabled: true, amount: 1_000 };
  const f = computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 4, now: NOW, stops: 2, scheduled: true, passThrough: 2_000 });
  assert.equal(f.total, 6_000 + 500 + 1_000 + 2_000 + 2_000);
  cfg.fees.returnTripDiscountPercent = 10;
  const r = computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 4, now: NOW, returnTrip: true });
  assert.equal(r.total, 5_500, "6,500 less 10% = 5,850, which is only 350 into the step, so it rounds down");
});

test("the maximum fare caps long trips, and the minimum always wins over a tiny fare", () => {
  const cfg = clone(DEFAULT_PRICING_CONFIG);
  cfg.profiles.boda.maximumFare = 20_000;
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 100, now: NOW }).total, 20_000);
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_500, minimumFare: 2_500 }, distanceKm: 0, now: NOW }).total, 2_500);
});

test("base fare, per-minute charge and rounding steps", () => {
  const cfg = clone(DEFAULT_PRICING_CONFIG);
  cfg.profiles.boda = { ...cfg.profiles.boda, baseFare: 1_000, perMinute: 100, expectedSpeedKmh: 30 };
  const f = computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_000, minimumFare: 0 }, distanceKm: 6, now: NOW });
  // 1,000 base + 6,000 distance + 6 km at 30 km/h = 12 min x 100 = 1,200
  assert.equal(f.subtotal, 8_200);
  cfg.profiles.boda.rounding = 1000;
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_000, minimumFare: 0 }, distanceKm: 6, now: NOW }).total, 8_000);
  cfg.profiles.boda.rounding = 100;
  assert.equal(computeFare(cfg, { service: "boda", rates: { ratePerKm: 1_000, minimumFare: 0 }, distanceKm: 6, now: NOW }).total, 8_200);
});

// --- money flow -----------------------------------------------------------------------

const cfgFlow = (patch?: (c: MoneyFlowConfig) => void): MoneyFlowConfig => {
  const c = clone(DEFAULT_MONEY_FLOW_CONFIG);
  // The shipped gateway rates are switched off until an admin confirms them; these tests exercise them as if confirmed.
  for (const r of c.providerFees) r.enabled = true;
  patch?.(c);
  return c;
};

test("gateway fees ship switched off, so no fee is assumed until an admin confirms the rates", () => {
  assert.ok(DEFAULT_MONEY_FLOW_CONFIG.providerFees.every((r) => !r.enabled));
  assert.equal(computeWaterfall(DEFAULT_MONEY_FLOW_CONFIG, { gross: 10_000, module: "ride_car", rail: "mobile_money", provider: "yo" }).gatewayFee, 0);
});

test("commission rules: percent, flat, min/max and tiered", () => {
  const base = { type: "percent" as const, percent: 10, flat: 0, min: 0, max: 0, tiers: [], base: "gross" as const };
  assert.equal(commissionAmount(base, { gross: 10_000 }), 1_000);
  assert.equal(commissionAmount({ ...base, type: "flat", flat: 700 }, { gross: 10_000 }), 700);
  assert.equal(commissionAmount({ ...base, type: "flat", flat: 700 }, { gross: 500 }), 500, "never more than the amount");
  assert.equal(commissionAmount({ ...base, type: "percent_min_max", min: 1_500, max: 3_000 }, { gross: 10_000 }), 1_500);
  assert.equal(commissionAmount({ ...base, type: "percent_min_max", min: 1_500, max: 3_000 }, { gross: 100_000 }), 3_000);
  const tiered = { ...base, type: "tiered" as const, tiers: [{ fromAmount: 0, percent: 15 }, { fromAmount: 1_000_000, percent: 10 }] };
  assert.equal(commissionAmount(tiered, { gross: 10_000, monthlyVolume: 0 }), 1_500);
  assert.equal(commissionAmount(tiered, { gross: 10_000, monthlyVolume: 2_000_000 }), 1_000);
  assert.equal(commissionAmount({ ...base, base: "fare_only" }, { gross: 10_000, fareOnly: 8_000 }), 800);
  assert.equal(commissionAmount(base, { gross: 0 }), 0);
});

test("gateway fee: percent, flat, both, limits, per network and newest rule in force", () => {
  const rule = { id: "r", provider: "yo", direction: "collection" as const, network: "any" as const, type: "percent" as const, percent: 2.5, flat: 0, min: 0, max: 0, effectiveFrom: "2026-01-01", enabled: true };
  const on = new Date("2026-10-29T00:00:00Z");
  assert.equal(gatewayFee([rule], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 250);
  assert.equal(gatewayFee([{ ...rule, type: "percent_plus_flat", flat: 100 }], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 350);
  assert.equal(gatewayFee([{ ...rule, type: "flat", flat: 400 }], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 400);
  assert.equal(gatewayFee([{ ...rule, min: 300 }], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 300);
  assert.equal(gatewayFee([{ ...rule, max: 200 }], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 200);
  assert.equal(gatewayFee([rule], { provider: "mtn", direction: "collection", amount: 10_000, on }).fee, 0, "another provider's rates do not apply");
  assert.equal(gatewayFee([{ ...rule, enabled: false }], { provider: "yo", direction: "collection", amount: 10_000, on }).fee, 0);
  const newer = { ...rule, id: "new", percent: 1.5, effectiveFrom: "2026-09-01" };
  assert.equal(gatewayFee([rule, newer], { provider: "yo", direction: "collection", amount: 10_000, on }).rule?.id, "new");
  assert.equal(gatewayFee([rule, { ...newer, effectiveFrom: "2027-01-01" }], { provider: "yo", direction: "collection", amount: 10_000, on }).rule?.id, "r", "a future rule is not used yet");
  const net = { ...rule, id: "mtn-net", network: "mtn" as const, percent: 3 };
  assert.equal(gatewayFee([rule, net], { provider: "yo", direction: "collection", network: "mtn", amount: 10_000, on }).fee, 300, "a network rule beats the general one");
});

test("waterfall: a 10,000 ride, Peebee pays the gateway, 10% commission — every shilling accounted for", () => {
  const w = computeWaterfall(cfgFlow((c) => { c.modules.ride_car.commission = { ...c.modules.ride_car.commission, percent: 10 }; }), { gross: 10_000, module: "ride_car", rail: "mobile_money", provider: "yo" });
  assert.deepEqual([w.customerPays, w.gatewayFee, w.commission, w.providerShare, w.platformNet], [10_000, 250, 1_000, 9_000, 750]);
  assert.ok(waterfallBalances(w));
});

test("waterfall: who pays the gateway fee — customer, platform, provider or split", () => {
  const set = (bearer: "customer" | "platform" | "provider" | "split") => cfgFlow((c) => { c.modules.ride_car.commission.percent = 10; c.modules.ride_car.gatewayFeeBearer = bearer; c.modules.ride_car.gatewayFeeCustomerPercent = 40; });
  const base = { gross: 10_000, module: "ride_car" as const, rail: "mobile_money" as const, provider: "yo" };
  const cust = computeWaterfall(set("customer"), base);
  assert.deepEqual([cust.customerPays, cust.providerShare, cust.platformNet], [10_250, 9_000, 1_000]);
  const prov = computeWaterfall(set("provider"), base);
  assert.deepEqual([prov.customerPays, prov.providerShare, prov.platformNet], [10_000, 8_750, 1_000]);
  const split = computeWaterfall(set("split"), base);
  assert.equal(split.gatewayFeeSplit.customer, 100);
  assert.equal(split.gatewayFeeSplit.customer + split.gatewayFeeSplit.platform + split.gatewayFeeSplit.provider, 250);
  for (const w of [cust, prov, split]) assert.ok(waterfallBalances(w));
});

test("waterfall: wallet and cash payments pay no gateway fee", () => {
  const c = cfgFlow();
  assert.equal(computeWaterfall(c, { gross: 10_000, module: "ride_car", rail: "wallet", provider: "yo" }).gatewayFee, 0);
  assert.equal(computeWaterfall(c, { gross: 10_000, module: "ride_car", rail: "cash" }).gatewayFee, 0);
});

test("waterfall: taxes — inclusive on commission borne by Peebee, on top borne by the customer, and per-module scope", () => {
  const c = cfgFlow((x) => {
    x.modules.food.commission.percent = 10;
    x.taxes = [
      { id: "vat", name: "VAT on commission", enabled: true, percent: 18, appliesTo: "commission", mode: "inclusive", bearer: "platform", modules: [], effectiveFrom: "2026-01-01" },
      { id: "excise", name: "Excise on top", enabled: true, percent: 0.5, appliesTo: "gross", mode: "on_top", bearer: "platform", modules: ["food"], effectiveFrom: "2026-01-01" },
    ];
  });
  const w = computeWaterfall(c, { gross: 20_000, module: "food", rail: "mobile_money", provider: "yo", on: new Date("2026-10-29") });
  // commission 2,000; inclusive VAT: 2,000 - 2,000/1.18 = 305; excise 0.5% of 20,000 = 100 on top
  assert.equal(w.taxes.find((t) => t.id === "vat")?.amount, 305);
  assert.equal(w.taxes.find((t) => t.id === "excise")?.amount, 100);
  assert.equal(w.customerPays, 20_100, "the on-top tax is added for the customer");
  assert.equal(w.platformNet, 2_000 - 500 - 305);
  assert.ok(waterfallBalances(w));
  // The excise tax is limited to food.
  const ride = computeWaterfall(c, { gross: 20_000, module: "ride_boda", rail: "wallet", on: new Date("2026-10-29") });
  assert.equal(ride.taxes.find((t) => t.id === "excise"), undefined);
  // A tax that starts later is not charged yet.
  assert.equal(computeWaterfall(c, { gross: 20_000, module: "food", rail: "wallet", on: new Date("2025-06-01") }).taxTotal, 0);
});

test("waterfall: a discount funded by Peebee is Peebee's cost, never the rider's", () => {
  const c = cfgFlow((x) => { x.modules.ride_car.commission.percent = 10; });
  const w = computeWaterfall(c, { gross: 10_000, module: "ride_car", rail: "wallet", platformFundedDiscount: 3_000 });
  assert.equal(w.customerPays, 7_000);
  assert.equal(w.providerShare, 9_000);
  assert.equal(w.platformNet, 1_000 - 3_000);
  assert.ok(waterfallBalances(w));
});

test("waterfall: commission relief moves money from Peebee to the provider; maintenance is carved out of Peebee's net", () => {
  const c = cfgFlow((x) => { x.modules.ride_car.commission.percent = 10; x.maintenance = { enabled: true, percent: 20, of: "platform_net" }; });
  const w = computeWaterfall(c, { gross: 10_000, module: "ride_car", rail: "wallet", commissionRelief: 400 });
  assert.equal(w.commission, 600);
  assert.equal(w.providerShare, 9_400);
  assert.equal(w.maintenance, 120);
  assert.equal(w.platformAvailable, 480);
  assert.ok(waterfallBalances(w));
  const none = computeWaterfall(c, { gross: 10_000, module: "ride_car", rail: "wallet", commissionRelief: 5_000 });
  assert.equal(none.commission, 0, "relief can never exceed the commission");
  assert.equal(none.maintenance, 0, "nothing to reserve from");
});

test("waterfall holds for many amounts and settings (nothing created or lost)", () => {
  const bearers = ["customer", "platform", "provider", "split"] as const;
  for (const gross of [0, 500, 1_000, 2_500, 9_999, 10_000, 123_457, 5_000_000]) {
    for (const bearer of bearers) {
      for (const rail of ["wallet", "mobile_money", "card"] as const) {
        const c = cfgFlow((x) => {
          x.modules.food.commission = { ...x.modules.food.commission, percent: 12.5 };
          x.modules.food.gatewayFeeBearer = bearer;
          x.taxes = [{ id: "t", name: "T", enabled: true, percent: 18, appliesTo: "commission", mode: "inclusive", bearer: "provider", modules: [], effectiveFrom: "2026-01-01" }];
        });
        const w = computeWaterfall(c, { gross, module: "food", rail, provider: "flutterwave", on: new Date("2026-10-29") });
        assert.ok(waterfallBalances(w), `gross ${gross} ${bearer} ${rail}`);
      }
    }
  }
});

test("waterfall: the commission that was actually taken can be recorded instead of the module rule", () => {
  const w = computeWaterfall(cfgFlow(), { gross: 10_000, module: "ride_car", rail: "wallet", commissionOverride: 1_250 });
  assert.equal(w.commission, 1_250);
  assert.equal(w.providerShare, 8_750);
  assert.ok(waterfallBalances(w));
  assert.equal(computeWaterfall(cfgFlow(), { gross: 1_000, module: "ride_car", rail: "wallet", commissionOverride: 5_000 }).commission, 1_000, "never more than the price");
});
