import assert from "node:assert/strict";
import test from "node:test";
import { cancelLaundry, checkoutTotal, commissionPlan, clampOffer, conditionalTipReleased, customerFee, goodsPrice, normaliseTip, offerBand, overageUgx, priceLines, settleLaundry, splitRides, type ItemPrices } from "./laundry-pricing.js";

const items = new Map<string, ItemPrices>([
  ["shirt", { washUgx: 3000, dryCleanUgx: 6000, ironUgx: 1500 }],
  ["suit", { washUgx: null, dryCleanUgx: 20000, ironUgx: 0 }],
]);

test("prices lines by type and count", () => {
  const r = priceLines([{ itemId: "shirt", treatment: "wash", count: 3 }, { itemId: "suit", treatment: "dry_clean", count: 1 }], items);
  assert.equal(r.ok && r.totalUgx, 29000);
});

test("rejects unpriced treatments, unknown items and bad counts", () => {
  assert.deepEqual(priceLines([{ itemId: "suit", treatment: "iron", count: 1 }], items), { ok: false, error: "treatment_unavailable", itemId: "suit" });
  assert.deepEqual(priceLines([{ itemId: "x", treatment: "wash", count: 1 }], items), { ok: false, error: "unknown_item", itemId: "x" });
  assert.deepEqual(priceLines([{ itemId: "shirt", treatment: "wash", count: 0 }], items), { ok: false, error: "invalid_count", itemId: "shirt" });
});

test("offer band sits on 500 steps around the catalogue total", () => {
  const b = offerBand(29000, 80, 130, 500);
  assert.deepEqual(b, { minUgx: 23000, averageUgx: 29000, maxUgx: 37500, stepUgx: 500 });
});

test("offers snap to the step and stay inside the band", () => {
  const b = offerBand(29000, 80, 130, 500);
  assert.equal(clampOffer(30240, b), 30000);
  assert.equal(clampOffer(1000, b), 23000);
  assert.equal(clampOffer(99999, b), 37500);
});

test("fixed prices override any offer; estimates use the offer", () => {
  const b = offerBand(29000, 80, 130, 500);
  assert.equal(goodsPrice("fixed", 29000, b, 25000), 29000);
  assert.equal(goodsPrice("estimate", 29000, b, 25000), 25000);
  assert.equal(goodsPrice("estimate", 29000, b, null), 29000);
});

test("ride legs always add up to the fee", () => {
  const r = splitRides({ pickupUgx: 7001, deliveryUgx: 5000 }, { pickup: "split", delivery: "provider" }, 50);
  assert.equal(r.pickup.customer + r.pickup.provider, 7001);
  assert.equal(r.customerUgx, 3501);
  assert.equal(r.providerUgx, 3500 + 5000);
  const both = splitRides({ pickupUgx: 6000, deliveryUgx: 6000 }, { pickup: "customer", delivery: "customer" }, 50);
  assert.equal(both.customerUgx, 12000);
});

test("tips obey admin's switches, cap and step", () => {
  const rules = { freeEnabled: true, conditionalEnabled: false, maxUgx: 10000, stepUgx: 500 };
  assert.deepEqual(normaliseTip("free", 2300, rules), { kind: "free", amountUgx: 2500 });
  assert.deepEqual(normaliseTip("free", 99999, rules), { kind: "free", amountUgx: 10000 });
  assert.deepEqual(normaliseTip("conditional", 2000, rules), { kind: "none", amountUgx: 0 });
  assert.deepEqual(normaliseTip("free", 0, rules), { kind: "none", amountUgx: 0 });
});

test("a conditional tip needs on-time delivery and no dispute", () => {
  const promisedBy = new Date("2026-10-26T12:00:00Z");
  assert.equal(conditionalTipReleased({ disputed: false, deliveredAt: new Date("2026-10-26T11:00:00Z"), promisedBy }), true);
  assert.equal(conditionalTipReleased({ disputed: false, deliveredAt: new Date("2026-10-26T13:00:00Z"), promisedBy }), false);
  assert.equal(conditionalTipReleased({ disputed: true, deliveredAt: new Date("2026-10-26T11:00:00Z"), promisedBy }), false);
});

test("overage is charged only above the limit", () => {
  assert.equal(overageUgx(12, 10, 1500), 3000);
  assert.equal(overageUgx(8, 10, 1500), 0);
});

const feeRule = { enabled: true, type: "percent" as const, value: 5, maxSharePercent: 50 };

test("the customer fee is automatic, off when disabled, and capped", () => {
  assert.equal(customerFee(40000, feeRule), 2000);
  assert.equal(customerFee(40000, { ...feeRule, enabled: false }), 0);
  assert.equal(customerFee(40000, { enabled: true, type: "flat", value: 1500, maxSharePercent: 50 }), 1500);
  assert.equal(customerFee(1000, { enabled: true, type: "flat", value: 5000, maxSharePercent: 50 }), 500);
});

test("checkout adds the fee, ride share and tip to the goods", () => {
  assert.equal(checkoutTotal({ goodsUgx: 40000, customerRideUgx: 4000, tipUgx: 2000, feeUgx: 2000 }), 48000);
});

test("rider gets the ride fee, commission comes off the goods only, tip goes to the provider", () => {
  const s = settleLaundry({ goodsUgx: 40000, commissionPercent: 15, customerRideUgx: 4000, providerRideUgx: 3000, tipUgx: 2000, tipReleased: true, feeUgx: 2000 });
  assert.deepEqual(s, { providerUgx: 40000 - 6000 - 3000 + 2000, riderUgx: 7000, platformUgx: 8000, commissionUgx: 6000, tipRefundUgx: 0 });
  assert.equal(s.providerUgx + s.riderUgx + s.platformUgx + s.tipRefundUgx, 40000 + 4000 + 2000 + 2000);
});

test("an unearned conditional tip goes back to the customer and everything still adds up", () => {
  const s = settleLaundry({ goodsUgx: 25000, commissionPercent: 10, customerRideUgx: 0, providerRideUgx: 6000, tipUgx: 3000, tipReleased: false, feeUgx: 0 });
  assert.equal(s.tipRefundUgx, 3000);
  assert.equal(s.providerUgx + s.riderUgx + s.platformUgx + s.tipRefundUgx, 25000 + 3000);
});

test("a provider ride share bigger than the goods can't make the payout negative", () => {
  const s = settleLaundry({ goodsUgx: 2000, commissionPercent: 10, customerRideUgx: 0, providerRideUgx: 9000, tipUgx: 0, tipReleased: false, feeUgx: 0 });
  assert.ok(s.providerUgx >= 0);
  assert.equal(s.providerUgx + s.riderUgx + s.platformUgx + s.tipRefundUgx, 2000);
});
test("the timing rule decides when commission is taken, never both", () => {
  assert.deepEqual(commissionPlan(40000, 15, "at_checkout"), { commissionUgx: 6000, takenAtCheckoutUgx: 6000, withheldAtPayoutUgx: 0 });
  assert.deepEqual(commissionPlan(40000, 15, "on_payout"), { commissionUgx: 6000, takenAtCheckoutUgx: 0, withheldAtPayoutUgx: 6000 });
  const s = settleLaundry({ goodsUgx: 40000, commissionPercent: 15, customerRideUgx: 0, providerRideUgx: 0, tipUgx: 0, tipReleased: false, feeUgx: 0, commissionTakenAtCheckout: true });
  assert.equal(s.platformUgx, 0);
  assert.equal(s.providerUgx, 34000);
});

test("cancelling: refund returns everything, keep lets Peebee retain what it took at checkout", () => {
  assert.deepEqual(cancelLaundry({ heldUgx: 48000, commissionTakenAtCheckoutUgx: 6000, feeUgx: 2000, rule: "refund" }), { customerRefundUgx: 48000, platformUgx: 0 });
  assert.deepEqual(cancelLaundry({ heldUgx: 48000, commissionTakenAtCheckoutUgx: 6000, feeUgx: 2000, rule: "keep" }), { customerRefundUgx: 40000, platformUgx: 8000 });
  assert.deepEqual(cancelLaundry({ heldUgx: 42000, commissionTakenAtCheckoutUgx: 0, feeUgx: 0, rule: "keep" }), { customerRefundUgx: 42000, platformUgx: 0 });
});
