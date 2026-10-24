import assert from "node:assert/strict";
import test from "node:test";
import { clampOffer, conditionalTipReleased, goodsPrice, normaliseTip, offerBand, overageUgx, priceLines, splitRides, type ItemPrices } from "./laundry-pricing.js";

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
