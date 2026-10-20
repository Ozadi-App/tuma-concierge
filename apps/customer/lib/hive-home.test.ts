import assert from "node:assert/strict";
import { test } from "node:test";
import { activeHiveJob, bookingHref, clockLabel, nearbyHeadline, schedulePresets, tradePrice, tradePriceLabel } from "./hive-home";

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

const NOW = new Date(2026, 9, 20, 14, 2, 30);

test("schedulePresets offers 1 hour, 3 hours and tomorrow with its time", () => {
  const p = schedulePresets({ minLeadMinutes: 30, maxAdvanceDays: 30 }, NOW);
  assert.deepEqual(p.map((x) => x.label), ["In 1 hour", "In 3 hours", "Tomorrow 9:00 am"]);
  assert.deepEqual(p.map((x) => x.at), ["2026-10-20T15:05", "2026-10-20T17:05", "2026-10-21T09:00"]);
});

test("schedulePresets follows the admin's settings and the booking window", () => {
  const rules = { minLeadMinutes: 120, maxAdvanceDays: 30, scheduleQuickHours: [1, 3], scheduleTomorrowTime: "18:30" };
  assert.deepEqual(schedulePresets(rules, NOW).map((x) => x.label), ["In 3 hours", "Tomorrow 6:30 pm"]);
  assert.deepEqual(schedulePresets({ minLeadMinutes: 0, maxAdvanceDays: 30, scheduleQuickHours: [], scheduleTomorrowEnabled: false }, NOW), []);
  // Tomorrow is the following calendar day even late at night.
  const late = new Date(2026, 9, 20, 23, 30);
  assert.equal(schedulePresets({ minLeadMinutes: 30, maxAdvanceDays: 30, scheduleQuickHours: [] }, late)[0]!.at, "2026-10-21T09:00");
});

test("clockLabel and bookingHref carry the chosen time", () => {
  assert.equal(clockLabel("00:15"), "12:15 am");
  assert.equal(clockLabel("13:00"), "1:00 pm");
  assert.equal(bookingHref("/services/clean", { when: "later", at: "2026-10-21T09:00" }), "/services/clean?when=later&at=2026-10-21T09%3A00");
  assert.equal(bookingHref("/services/clean", { when: "now", at: "2026-10-21T09:00" }), "/services/clean");
});
