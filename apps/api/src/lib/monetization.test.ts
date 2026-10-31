import assert from "node:assert/strict";
import test from "node:test";
import { computeCheckoutFees } from "./monetization.js";
import type { MonetizationSettings } from "./settings.js";

const settings = (over: Partial<MonetizationSettings>): MonetizationSettings => ({
  deliveryCommissionEnabled: false,
  deliveryCommissionParcelPercent: 0,
  deliveryCommissionShoppingPercent: 0,
  serviceFeeEnabled: true,
  serviceFeeType: "flat",
  serviceFeeValue: 0,
  serviceFeeMaxSharePercent: 50,
  processingFeeEnabled: false,
  processingFeePercent: 0,
  processingFeeMode: "customer",
  processingFeeSplitCustomerPercent: 50,
  cashFeeSource: "wallet",
  subscriptionEnabled: false,
  subscriptionMode: "recurring",
  subscriptionAmount: 0,
  subscriptionCadence: "weekly",
  ...over,
});
const ride = { baseAmount: 6500, deliveryFee: 6500, orderType: "parcel" as const, payingWithWallet: false };

test("a service fee is never as large as the fare", () => {
  // The reported case: UGX 6,500 ride, UGX 6,598 of fees (a 100% / 6,500 service fee + 1.5% processing).
  // The cap is 50% of 6,500 = 3,250, kept to whole UGX 500s without going over it: 3,000.
  assert.equal(computeCheckoutFees(settings({ serviceFeeType: "percent", serviceFeeValue: 100 }), ride).serviceFee, 3000);
  assert.equal(computeCheckoutFees(settings({ serviceFeeType: "flat", serviceFeeValue: 6500 }), ride).serviceFee, 3000);
  assert.equal(computeCheckoutFees(settings({ serviceFeeType: "flat", serviceFeeValue: 9999 }), ride).serviceFee, 3000);
});

test("sensible service fees are unchanged", () => {
  assert.equal(computeCheckoutFees(settings({ serviceFeeType: "flat", serviceFeeValue: 500 }), ride).serviceFee, 500);
  assert.equal(computeCheckoutFees(settings({ serviceFeeType: "percent", serviceFeeValue: 10 }), ride).serviceFee, 500, "650 is kept to a whole 500");
  assert.equal(computeCheckoutFees(settings({ serviceFeeEnabled: false, serviceFeeValue: 500 }), ride).serviceFee, 0);
});

test("the cap doesn't touch the processing fee, and total surcharge stays below the fare", () => {
  const fees = computeCheckoutFees(
    settings({ serviceFeeType: "percent", serviceFeeValue: 100, processingFeeEnabled: true, processingFeePercent: 1.5 }),
    ride,
  );
  assert.equal(fees.processingFeeCustomer, 0, "1.5% of 6,500 is under 250, so it rounds to nothing");
  assert.equal(fees.totalSurcharge, 3000);
  assert.ok(fees.totalSurcharge < ride.baseAmount);
});

test("tiny fares can't be eaten by a flat fee", () => {
  assert.equal(computeCheckoutFees(settings({ serviceFeeValue: 500 }), { ...ride, baseAmount: 600, deliveryFee: 600 }).serviceFee, 0, "half of 600 is under one whole 500, so no fee");
  assert.equal(computeCheckoutFees(settings({ serviceFeeValue: 500 }), { ...ride, baseAmount: 0, deliveryFee: 0 }).serviceFee, 0);
});

test("the cap is an admin setting, and can never reach the whole fare", () => {
  const fee = (maxSharePercent: number) =>
    computeCheckoutFees(settings({ serviceFeeType: "percent", serviceFeeValue: 100, serviceFeeMaxSharePercent: maxSharePercent }), ride).serviceFee;
  assert.equal(fee(20), 1000);
  assert.equal(fee(80), 5000);
  assert.equal(fee(99), 6000);
  assert.equal(fee(100), 6000, "a 100% cap is treated as 99% — never the whole fare");
  assert.equal(fee(0), 0, "0 is treated as 1%, which is under one whole 500");
});
