import assert from "node:assert/strict";
import test from "node:test";
import { arrivalLabel, bodaFare, predictUsual, rideProgress, toLocalInput, whenChoices, whenLabel, withinSchedule } from "./ride-home";

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

test("when chips respect the scheduling window", () => {
  const now = at(2026, 10, 16, 14, 2);
  const chips = whenChoices({ minLeadMinutes: 30, maxAdvanceHours: 72 }, true, now);
  assert.deepEqual(chips.map((c) => c.id), ["now", "in-30", "in-60", "tonight", "tomorrow"]);
  for (const c of chips.slice(1)) assert.ok(withinSchedule(c.at!, { minLeadMinutes: 30, maxAdvanceHours: 72 }, now));
  // A 12-hour window drops "tomorrow 07:00"; no scheduling → only Now.
  assert.ok(!whenChoices({ minLeadMinutes: 30, maxAdvanceHours: 12 }, true, now).some((c) => c.id === "tomorrow"));
  assert.deepEqual(whenChoices(null, true, now).map((c) => c.id), ["now"]);
  // Long lead time renames the first chip and skips "in 1 hour".
  const long = whenChoices({ minLeadMinutes: 90, maxAdvanceHours: null }, false, now);
  assert.equal(long[0].label, "In 90 min");
  assert.ok(!long.some((c) => c.id === "in-60" || c.id === "now"));
});

test("late evening drops tonight", () => {
  const chips = whenChoices({ minLeadMinutes: 30, maxAdvanceHours: 72 }, true, at(2026, 10, 16, 21, 0));
  assert.ok(!chips.some((c) => c.id === "tonight"));
});

test("when labels", () => {
  const now = at(2026, 10, 16, 14, 0);
  assert.equal(whenLabel(null, now), "Now");
  assert.equal(whenLabel(toLocalInput(at(2026, 10, 16, 19, 0)), now), "Today 19:00");
  assert.equal(whenLabel(toLocalInput(at(2026, 10, 17, 7, 0)), now), "Tomorrow 07:00");
});

test("usual destination by time of day", () => {
  const saved = [{ label: "Home" }, { label: "Work · Nakasero" }];
  assert.equal(predictUsual(saved, at(2026, 10, 16, 8))?.label, "Work · Nakasero"); // Friday morning
  assert.equal(predictUsual(saved, at(2026, 10, 16, 18))?.label, "Home");
  assert.equal(predictUsual(saved, at(2026, 10, 17, 8)), null); // Saturday morning
  assert.equal(predictUsual([], at(2026, 10, 16, 8)), null);
});

test("fares, arrival and progress", () => {
  assert.equal(bodaFare(4.2, 1000, 3000), 4000);
  assert.equal(bodaFare(1, 1000, 3000), 3000);
  assert.equal(bodaFare(null, 1000, 3000), null);
  assert.equal(arrivalLabel(12, null, at(2026, 10, 16, 18, 40)), "18:52");
  assert.equal(arrivalLabel(null, null), null);
  assert.ok(rideProgress("Deliver") > rideProgress("Match"));
});
