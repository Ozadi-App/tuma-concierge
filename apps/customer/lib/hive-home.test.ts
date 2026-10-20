import assert from "node:assert/strict";
import { test } from "node:test";
import { activeHiveJob, bookingHref, nearbyHeadline, tradePrice, tradePriceLabel } from "./hive-home";

const svc = (type: any, pricingMode: any, unitPriceUgx: number, calloutFeeUgx = 0, unitLabel = "job") => ({ type, pricingMode, unitPriceUgx, calloutFeeUgx, unitLabel });

test("tradePrice picks the cheapest fixed price, else the lowest call-out", () => {
  const list = [svc("clean", "fixed", 35000, 0, "bedroom"), svc("clean", "fixed", 15000, 0, "seat"), svc("fix", "quote", 0, 25000), svc("fix", "quote", 0, 20000)];
  assert.equal(tradePriceLabel(tradePrice(list, "clean")), "from 15k / seat");
  assert.equal(tradePriceLabel(tradePrice(list, "fix")), "Quote · 20k call-out");
  assert.equal(tradePrice(list, "laundry"), null);
  assert.equal(tradePriceLabel(null), "See prices");
});

test("activeHiveJob prefers the furthest-along active job", () => {
  const jobs = [
    { id: "a", status: "open", createdAt: "2026-10-01" },
    { id: "b", status: "booked", createdAt: "2026-09-01" },
    { id: "c", status: "settled", createdAt: "2026-10-05" },
  ];
  assert.equal(activeHiveJob(jobs)?.id, "b");
  assert.equal(activeHiveJob([{ id: "x", status: "cancelled", createdAt: "x" }]), null);
});

test("bookingHref carries matching and time over", () => {
  assert.equal(bookingHref("/services/clean", { when: "now" }), "/services/clean");
  assert.equal(bookingHref("/services/fix", { matching: "customer_picks", when: "later" }), "/services/fix?matching=customer_picks&when=later");
});

test("nearbyHeadline counts only enabled trades", () => {
  assert.equal(nearbyHeadline({ clean: 2, laundry: 1, fix: 4 }, ["clean", "laundry"]), "3 providers online near you");
  assert.equal(nearbyHeadline({ clean: 0, laundry: 0, fix: 0 }, ["clean"]), null);
  assert.equal(nearbyHeadline(null, ["clean"]), null);
});
