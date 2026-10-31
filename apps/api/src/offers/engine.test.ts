import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CREDIT_CONFIG, DEFAULT_DISCOUNT_WALLET_CONFIG, DEFAULT_INCENTIVE_CONFIG, DEFAULT_OFFERS_CONFIG,
  commissionOffset, commissionWaivePercent, creditAllowedAmount, depositBonus, discountCompensation, evaluateOffer, inWindows,
  leaderboardAwards, milestoneAwards, payoutDue, periodAwards, perRideAwards, pickOffers, splitWalletPayment, tieredCommissionPercent,
  withdrawableCash, type CustomerOfferProfile, type Offer, type OfferContext,
} from "@peebee/shared";

const profile = (over: Partial<CustomerOfferProfile> = {}): CustomerOfferProfile => ({
  rideCount: 3, lastRideAt: new Date("2026-10-20T08:00:00Z"), loyaltyTier: "silver", groups: [], birthday: null, referredBy: null, usedByOffer: {}, grants: {}, ...over,
});
const offer = (over: Partial<Offer> = {}): Offer => ({
  id: "o1", name: "Test", description: "", code: null, kind: "promo_code", discountType: "percent", value: 20, maxDiscount: 0, minFare: 0, services: [],
  funder: "platform", autoApply: true, stackable: false, status: "active", startsAt: null, endsAt: null, usageLimitTotal: 0, usageLimitPerUser: 0,
  budgetTotal: 0, budgetSpent: 0, redemptions: 0, priority: 0, conditions: {}, ...over,
});
const ctx = (over: Partial<OfferContext> = {}): OfferContext => ({
  service: "ride.car", fare: 10_000, now: new Date("2026-10-29T09:30:00Z"), code: null, customer: profile(), ...over,
});

test("a promo code needs the right code and rounds the discount to a whole 500", () => {
  const o = offer({ code: "WELCOME", value: 15 });
  assert.equal(evaluateOffer(o, ctx()).eligible, false);
  assert.equal(evaluateOffer(o, ctx({ code: " welcome " })).discount, 1_500);
  assert.equal(evaluateOffer(offer({ code: "X", value: 12.34 }), ctx({ code: "x", fare: 10_050 })).discount, 1_000);
});

test("maxDiscount caps a percent offer and a discount never exceeds the fare", () => {
  const o = offer({ code: "C", value: 50, maxDiscount: 2_000 });
  assert.equal(evaluateOffer(o, ctx({ code: "C" })).discount, 2_000);
  const flat = offer({ code: "C", discountType: "flat", value: 50_000 });
  assert.equal(evaluateOffer(flat, ctx({ code: "C" })).discount, 10_000);
});

test("expiry, status, services, minimum fare and usage limits block an offer", () => {
  const base = { code: "C" } as const;
  assert.equal(evaluateOffer(offer({ ...base, endsAt: "2026-10-01T00:00:00Z" }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, startsAt: "2026-12-01T00:00:00Z" }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, status: "paused" }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, services: ["ride.boda"] }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, minFare: 20_000 }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, usageLimitTotal: 5, redemptions: 5 }), ctx({ code: "C" })).eligible, false);
  assert.equal(evaluateOffer(offer({ ...base, usageLimitPerUser: 1 }), ctx({ code: "C", customer: profile({ usedByOffer: { o1: 1 } }) })).eligible, false);
});

test("the budget limits what an offer can still give", () => {
  const o = offer({ code: "C", value: 50, budgetTotal: 10_000, budgetSpent: 8_500 });
  assert.equal(evaluateOffer(o, ctx({ code: "C" })).discount, 1_500);
  assert.equal(evaluateOffer(offer({ code: "C", budgetTotal: 10_000, budgetSpent: 10_000 }), ctx({ code: "C" })).eligible, false);
});

test("first ride, nth ride, referral and winback follow the customer's history", () => {
  assert.equal(evaluateOffer(offer({ kind: "first_ride" }), ctx({ customer: profile({ rideCount: 0 }) })).eligible, true);
  assert.equal(evaluateOffer(offer({ kind: "first_ride" }), ctx()).eligible, false);
  const nth = offer({ kind: "nth_ride", conditions: { nth: 5 } });
  assert.equal(evaluateOffer(nth, ctx({ customer: profile({ rideCount: 4 }) })).eligible, true);
  assert.equal(evaluateOffer(nth, ctx({ customer: profile({ rideCount: 5 }) })).eligible, false);
  const ref = offer({ kind: "referral" });
  assert.equal(evaluateOffer(ref, ctx({ customer: profile({ rideCount: 0, referredBy: "u9" }) })).eligible, true);
  assert.equal(evaluateOffer(ref, ctx({ customer: profile({ rideCount: 0 }) })).eligible, false);
  const win = offer({ kind: "winback", conditions: { inactiveDays: 30 } });
  assert.equal(evaluateOffer(win, ctx({ customer: profile({ lastRideAt: new Date("2026-08-01T00:00:00Z") }) })).eligible, true);
  assert.equal(evaluateOffer(win, ctx()).eligible, false);
  assert.equal(evaluateOffer(win, ctx({ customer: profile({ lastRideAt: null }) })).eligible, false);
});

test("time windows use Kampala time and can wrap midnight", () => {
  // 09:30 UTC is 12:30 in Kampala.
  const lunch = [{ days: [], from: "12:00", to: "13:00" }];
  assert.equal(inWindows(new Date("2026-10-29T09:30:00Z"), lunch), true);
  assert.equal(inWindows(new Date("2026-10-29T11:30:00Z"), lunch), false);
  const night = [{ days: [], from: "22:00", to: "05:00" }];
  assert.equal(inWindows(new Date("2026-10-29T20:00:00Z"), night), true); // 23:00 local
  assert.equal(inWindows(new Date("2026-10-29T01:00:00Z"), night), true); // 04:00 local
  assert.equal(inWindows(new Date("2026-10-29T09:00:00Z"), night), false);
  // Thursday 29 Oct 2026 12:30 — a Monday-only window does not match.
  assert.equal(inWindows(new Date("2026-10-29T09:30:00Z"), [{ days: [1], from: "12:00", to: "13:00" }]), false);
});

test("zones match on pickup, drop-off or either", () => {
  const zone = { lat: 0.3136, lng: 32.5811, radiusKm: 2, label: "Kampala" };
  const o = offer({ kind: "route_zone", conditions: { zones: [zone], zoneMatch: "pickup" } });
  assert.equal(evaluateOffer(o, ctx({ pickup: { lat: 0.314, lng: 32.582 } })).eligible, true);
  assert.equal(evaluateOffer(o, ctx({ pickup: { lat: 1.0, lng: 33.0 }, dropoff: { lat: 0.314, lng: 32.582 } })).eligible, false);
  const either = offer({ kind: "route_zone", conditions: { zones: [zone], zoneMatch: "either" } });
  assert.equal(evaluateOffer(either, ctx({ pickup: { lat: 1.0, lng: 33.0 }, dropoff: { lat: 0.314, lng: 32.582 } })).eligible, true);
});

test("vehicle, loyalty, group, birthday and ride packs check what the customer holds", () => {
  assert.equal(evaluateOffer(offer({ kind: "vehicle_type", conditions: { carTiers: ["comfort"] } }), ctx({ carTier: "comfort" })).eligible, true);
  assert.equal(evaluateOffer(offer({ kind: "vehicle_type", conditions: { carTiers: ["comfort"] } }), ctx({ carTier: "convenient" })).eligible, false);
  assert.equal(evaluateOffer(offer({ kind: "loyalty_tier", conditions: { loyaltyTiers: ["gold"] } }), ctx()).eligible, false);
  assert.equal(evaluateOffer(offer({ kind: "loyalty_tier", conditions: { loyaltyTiers: ["silver"] } }), ctx()).eligible, true);
  assert.equal(evaluateOffer(offer({ kind: "group", conditions: { groups: ["student"] } }), ctx({ customer: profile({ groups: ["student"] }) })).eligible, true);
  assert.equal(evaluateOffer(offer({ kind: "birthday_event", conditions: { birthday: true } }), ctx({ customer: profile({ birthday: "10-29" }) })).eligible, true);
  assert.equal(evaluateOffer(offer({ kind: "birthday_event", conditions: { dates: ["12-25"] } }), ctx()).eligible, false);
  const pack = offer({ kind: "bundle", autoApply: false });
  assert.equal(evaluateOffer(pack, ctx()).eligible, false);
  const used = evaluateOffer(pack, ctx({ customer: profile({ grants: { o1: 2 } }) }));
  assert.equal(used.eligible, true);
  assert.equal(used.usesGrant, true);
});

test("cashback gives credit later, a free ride is capped by its maximum", () => {
  const cb = evaluateOffer(offer({ kind: "cashback", value: 10 }), ctx());
  assert.deepEqual([cb.discount, cb.cashback], [0, 1_000]);
  const free = evaluateOffer(offer({ kind: "free_ride", maxDiscount: 6_000 }), ctx());
  assert.equal(free.discount, 6_000);
  assert.equal(evaluateOffer(offer({ kind: "free_ride" }), ctx()).discount, 10_000);
});

test("best_one picks the best offer; stack adds stackable ones within the overall cap", () => {
  const tiered: Partial<Offer> = { kind: "loyalty_tier", conditions: { loyaltyTiers: ["silver"] } };
  const a = offer({ id: "a", value: 10, stackable: true, ...tiered });
  const b = offer({ id: "b", value: 30, stackable: true, ...tiered });
  const c = offer({ id: "c", value: 5, stackable: false, ...tiered });
  const best = pickOffers([a, b, c], ctx(), { mode: "best_one", maxDiscountPercent: 100 });
  assert.deepEqual(best.applied.map((r) => r.offerId), ["b"]);
  assert.equal(best.discount, 3_000);
  const stacked = pickOffers([a, b, c], ctx(), { mode: "stack", maxDiscountPercent: 100 });
  assert.deepEqual(stacked.applied.map((r) => r.offerId), ["b", "a"]);
  assert.equal(stacked.discount, 4_000);
  const capped = pickOffers([a, b], ctx(), { mode: "stack", maxDiscountPercent: 35 });
  assert.equal(capped.discount, 3_500);
});

test("offers that do not apply are reported with a reason", () => {
  const res = pickOffers([offer({ kind: "first_ride" })], ctx(), DEFAULT_OFFERS_CONFIG.stacking);
  assert.equal(res.applied.length, 0);
  assert.equal(res.considered[0].reason, "Only for a first ride.");
});

test("discount compensation: below_minimum only covers the part under the minimum fare", () => {
  const cfg = DEFAULT_DISCOUNT_WALLET_CONFIG;
  // 12,000 fare, 2,000 off → customer pays 10,000 = the minimum, rider loses nothing.
  assert.equal(discountCompensation(cfg, { vehicle: "car", fullFare: 12_000, paid: 10_000, minimumFare: 10_000, funder: "platform" }), 0);
  // 12,000 fare, 5,000 off → pays 7,000, 3,000 below the minimum.
  assert.equal(discountCompensation(cfg, { vehicle: "car", fullFare: 12_000, paid: 7_000, minimumFare: 10_000, funder: "platform" }), 3_000);
  // A fare already at the minimum, 2,000 off → compensate all 2,000.
  assert.equal(discountCompensation(cfg, { vehicle: "car", fullFare: 10_000, paid: 8_000, minimumFare: 10_000, funder: "platform" }), 2_000);
  // Free ride.
  assert.equal(discountCompensation(cfg, { vehicle: "car", fullFare: 10_000, paid: 0, minimumFare: 10_000, funder: "platform" }), 10_000);
});

test("discount compensation: full_discount, none, rider-funded and disabled vehicles", () => {
  const full = { ...DEFAULT_DISCOUNT_WALLET_CONFIG, accrual: "full_discount" as const };
  assert.equal(discountCompensation(full, { vehicle: "boda", fullFare: 4_000, paid: 3_000, minimumFare: 2_500, funder: "platform" }), 1_000);
  assert.equal(discountCompensation({ ...full, accrual: "none" }, { vehicle: "boda", fullFare: 4_000, paid: 3_000, minimumFare: 2_500, funder: "platform" }), 0);
  assert.equal(discountCompensation(full, { vehicle: "boda", fullFare: 4_000, paid: 3_000, minimumFare: 2_500, funder: "rider" }), 0);
  assert.equal(discountCompensation({ ...full, vehicles: { ...full.vehicles, boda: false } }, { vehicle: "boda", fullFare: 4_000, paid: 3_000, minimumFare: 2_500, funder: "platform" }), 0);
});

test("commission is settled from the discount wallet first, never beyond the balance or the share", () => {
  const cfg = DEFAULT_DISCOUNT_WALLET_CONFIG;
  assert.equal(commissionOffset(cfg, 5_000, 1_000), 1_000);
  assert.equal(commissionOffset(cfg, 400, 1_000), 400);
  assert.equal(commissionOffset({ ...cfg, offsetMaxPercent: 50 }, 5_000, 1_000), 500);
  assert.equal(commissionOffset({ ...cfg, offsetCommission: false }, 5_000, 1_000), 0);
  assert.equal(commissionOffset(cfg, 0, 1_000), 0);
});

test("payout triggers: threshold, after days, weekly, request, ceiling and minimum", () => {
  const now = new Date("2026-10-26T09:00:00Z"); // Monday
  const base = DEFAULT_DISCOUNT_WALLET_CONFIG;
  assert.equal(payoutDue({ ...base, payoutTrigger: "threshold", payoutThreshold: 20_000 }, { balance: 25_000, oldestAccrualAt: null, now }), true);
  assert.equal(payoutDue({ ...base, payoutTrigger: "threshold", payoutThreshold: 20_000 }, { balance: 5_000, oldestAccrualAt: null, now }), false);
  assert.equal(payoutDue({ ...base, payoutTrigger: "after_days", payoutAfterDays: 7 }, { balance: 5_000, oldestAccrualAt: new Date("2026-10-10T00:00:00Z"), now }), true);
  assert.equal(payoutDue({ ...base, payoutTrigger: "after_days", payoutAfterDays: 7 }, { balance: 5_000, oldestAccrualAt: new Date("2026-10-24T00:00:00Z"), now }), false);
  assert.equal(payoutDue({ ...base, payoutTrigger: "weekly", payoutWeekday: 1 }, { balance: 5_000, oldestAccrualAt: null, now }), true);
  assert.equal(payoutDue({ ...base, payoutTrigger: "weekly", payoutWeekday: 3 }, { balance: 5_000, oldestAccrualAt: null, now }), false);
  assert.equal(payoutDue({ ...base, payoutTrigger: "on_request" }, { balance: 5_000, oldestAccrualAt: null, now }), false);
  assert.equal(payoutDue({ ...base, payoutTrigger: "on_request" }, { balance: 5_000, oldestAccrualAt: null, now, requested: true }), true);
  assert.equal(payoutDue({ ...base, payoutTrigger: "daily", minPayout: 1_000 }, { balance: 500, oldestAccrualAt: null, now }), false);
  assert.equal(payoutDue({ ...base, payoutTrigger: "on_request", maxBalance: 50_000 }, { balance: 60_000, oldestAccrualAt: null, now }), true);
  assert.equal(payoutDue({ ...base, payoutMethod: "none", payoutTrigger: "daily" }, { balance: 5_000, oldestAccrualAt: null, now }), false);
});

test("per-ride rider awards: peak, night, zone and long pickup", () => {
  const cfg = structuredClone(DEFAULT_INCENTIVE_CONFIG);
  cfg.kinds.night_bonus.enabled = true;
  cfg.kinds.zone_boost.enabled = true;
  cfg.kinds.zone_boost.zones = [{ lat: 0.045, lng: 32.443, radiusKm: 3, label: "Airport" }];
  const rider = { createdAt: new Date("2026-01-01T00:00:00Z"), completedRides: 500, ridesThisMonth: 10 };
  // Thursday 09:30 UTC = 12:30 local: not peak.
  assert.deepEqual(perRideAwards(cfg, { vehicle: "boda", fare: 5_000, now: new Date("2026-10-29T09:30:00Z"), rider }), []);
  // Thursday 05:00 UTC = 08:00 local: peak.
  assert.equal(perRideAwards(cfg, { vehicle: "boda", fare: 5_000, now: new Date("2026-10-29T05:00:00Z"), rider })[0].kind, "peak_boost");
  const night = perRideAwards(cfg, { vehicle: "car", fare: 15_000, now: new Date("2026-10-29T20:00:00Z"), rider });
  assert.deepEqual(night.map((a) => a.kind), ["night_bonus"]);
  const zone = perRideAwards(cfg, { vehicle: "car", fare: 15_000, now: new Date("2026-10-29T09:30:00Z"), pickup: { lat: 0.046, lng: 32.444 }, rider });
  assert.deepEqual(zone.map((a) => a.kind), ["zone_boost"]);
  const far = perRideAwards(cfg, { vehicle: "boda", fare: 5_000, now: new Date("2026-10-29T09:30:00Z"), pickupDistanceKm: 4, rider });
  assert.equal(far[0].amount, 1_000);
  const farCapped = perRideAwards(cfg, { vehicle: "boda", fare: 5_000, now: new Date("2026-10-29T09:30:00Z"), pickupDistanceKm: 20, rider });
  assert.equal(farCapped[0].amount, 3_000);
  cfg.vehicles.boda = false;
  assert.deepEqual(perRideAwards(cfg, { vehicle: "boda", fare: 5_000, now: new Date("2026-10-29T05:00:00Z"), rider }), []);
  assert.deepEqual(perRideAwards({ ...cfg, enabled: false }, { vehicle: "car", fare: 5_000, now: new Date("2026-10-29T05:00:00Z"), rider }), []);
});

test("commission holiday and tiered commission", () => {
  const cfg = DEFAULT_INCENTIVE_CONFIG;
  const now = new Date("2026-10-29T00:00:00Z");
  assert.equal(commissionWaivePercent(cfg, { createdAt: new Date("2026-10-20T00:00:00Z"), completedRides: 5 }, now), 100);
  assert.equal(commissionWaivePercent(cfg, { createdAt: new Date("2026-06-01T00:00:00Z"), completedRides: 5 }, now), 0);
  const tiered = structuredClone(cfg);
  tiered.kinds.commission_tiers.enabled = true;
  assert.equal(tieredCommissionPercent(tiered, 10), 15);
  assert.equal(tieredCommissionPercent(tiered, 60), 12);
  assert.equal(tieredCommissionPercent(tiered, 150), 10);
  assert.equal(tieredCommissionPercent(cfg, 150), null);
});

test("period awards: streak, ladder (highest tier only), rating, reliability", () => {
  const cfg = DEFAULT_INCENTIVE_CONFIG;
  const stats = { ridesInPeriod: 55, cancelledInPeriod: 1, completedRides: 300, ratingAverage: 4.9, ratingCount: 20, onlineHours: 0, ridesToday: 8, cancelledToday: 0, daysSinceLastRide: 0 };
  assert.deepEqual(periodAwards(cfg, "day", stats).map((a) => a.amount), [5_000]);
  assert.deepEqual(periodAwards(cfg, "day", { ...stats, cancelledToday: 1 }), []);
  const week = periodAwards(cfg, "week", stats);
  assert.deepEqual(week.map((a) => [a.kind, a.amount]), [["weekly_ladder", 35_000], ["rating_bonus", 10_000]]);
  assert.deepEqual(periodAwards(cfg, "month", stats).map((a) => a.kind), ["reliability_bonus"]);
  assert.deepEqual(periodAwards(cfg, "month", { ...stats, cancelledInPeriod: 10 }), []);
});

test("milestones pay once when crossed; leaderboard pays the top riders who met the minimum", () => {
  assert.deepEqual(milestoneAwards(DEFAULT_INCENTIVE_CONFIG, 99, 100).map((a) => a.amount), [5_000]);
  assert.deepEqual(milestoneAwards(DEFAULT_INCENTIVE_CONFIG, 100, 101), []);
  const cfg = structuredClone(DEFAULT_INCENTIVE_CONFIG);
  cfg.kinds.leaderboard.enabled = true;
  const out = leaderboardAwards(cfg, [{ riderId: "a", rides: 90 }, { riderId: "b", rides: 60 }, { riderId: "c", rides: 10 }]);
  assert.deepEqual(out.map((o) => [o.riderId, o.award.amount]), [["a", 20_000], ["b", 10_000]]);
});

test("deposit bonus follows its rules", () => {
  const cfg = DEFAULT_CREDIT_CONFIG;
  const now = new Date("2026-10-29T00:00:00Z");
  assert.equal(depositBonus(cfg, { amount: 10_000, now, verified: true, isFirstDeposit: false }), 200);
  assert.equal(depositBonus(cfg, { amount: 500_000, now, verified: true, isFirstDeposit: false }), 2_000);
  assert.equal(depositBonus(cfg, { amount: 5_000, now, verified: true, isFirstDeposit: false }), 0);
  assert.equal(depositBonus(cfg, { amount: 10_000, now, verified: false, isFirstDeposit: false }), 0);
  const flat = structuredClone(cfg);
  flat.topup.bonus = { ...flat.topup.bonus, type: "flat", value: 100, firstDepositOnly: true };
  assert.equal(depositBonus(flat, { amount: 10_000, now, verified: true, isFirstDeposit: true }), 100);
  assert.equal(depositBonus(flat, { amount: 10_000, now, verified: true, isFirstDeposit: false }), 0);
  assert.equal(depositBonus({ ...cfg, enabled: false }, { amount: 10_000, now, verified: true, isFirstDeposit: false }), 0);
});

test("credit is spent only where allowed and split with cash by the chosen order", () => {
  const cfg = DEFAULT_CREDIT_CONFIG;
  assert.equal(creditAllowedAmount(cfg, { module: "ride_car", amount: 10_000 }), 10_000);
  assert.equal(creditAllowedAmount(cfg, { module: "food", amount: 10_000 }), 0);
  assert.equal(creditAllowedAmount(cfg, { module: "food", amount: 10_000, partnerId: "m1" }), 0);
  assert.equal(creditAllowedAmount({ ...cfg, partnerIds: ["m1"] }, { module: "food", amount: 10_000, partnerId: "m1" }), 10_000);
  assert.equal(creditAllowedAmount({ ...cfg, maxSharePercent: 50 }, { module: "ride_car", amount: 10_000 }), 5_000);
  assert.deepEqual(splitWalletPayment({ amount: 10_000, cash: 20_000, credit: 3_000, creditAllowedAmount: 10_000, order: "credit_first" }), { credit: 3_000, cash: 7_000, shortfall: 0 });
  assert.deepEqual(splitWalletPayment({ amount: 10_000, cash: 20_000, credit: 3_000, creditAllowedAmount: 10_000, order: "cash_first" }), { credit: 0, cash: 10_000, shortfall: 0 });
  assert.deepEqual(splitWalletPayment({ amount: 10_000, cash: 2_000, credit: 3_000, creditAllowedAmount: 0, order: "credit_first" }), { credit: 0, cash: 2_000, shortfall: 8_000 });
  assert.deepEqual(splitWalletPayment({ amount: 10_000, cash: 4_000, credit: 3_000, creditAllowedAmount: 10_000, order: "cash_first" }), { credit: 3_000, cash: 4_000, shortfall: 3_000 });
});

test("withdrawable cash respects the lock, per-request share, daily limit and minimum kept", () => {
  const on = structuredClone(DEFAULT_CREDIT_CONFIG);
  on.withdrawal.enabled = true;
  assert.equal(withdrawableCash(DEFAULT_CREDIT_CONFIG, { cashBalance: 50_000, lockedCash: 0, withdrawnToday: 0 }), 0);
  assert.equal(withdrawableCash(on, { cashBalance: 50_000, lockedCash: 0, withdrawnToday: 0 }), 40_000);
  assert.equal(withdrawableCash(on, { cashBalance: 50_000, lockedCash: 30_000, withdrawnToday: 0 }), 20_000);
  assert.equal(withdrawableCash(on, { cashBalance: 50_000, lockedCash: 50_000, withdrawnToday: 0 }), 0);
  assert.equal(withdrawableCash(on, { cashBalance: 900_000, lockedCash: 0, withdrawnToday: 480_000 }), 20_000);
});
