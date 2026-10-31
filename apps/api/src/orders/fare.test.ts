import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ROUNDING_RULE, normaliseRoundingRule, roundFare, roundNearest, roundWith, setRoundingRule, snap500 } from "@peebee/shared";

test("fares go to whole UGX 500s and round up once more than UGX 100 into a step", () => {
  const examples = [
    [0, 500], [102, 500], [499, 500], [500, 500], [600, 500], [601, 1_000],
    [23_600, 23_500], [64_300, 64_500], [29_700, 30_000],
    [2_102, 2_500], [2_100, 2_000], [2_500, 2_500], [31_100, 31_000], [31_101, 31_500],
    [6_600.000000000001, 6_500],
  ];
  for (const [amount, expected] of examples) {
    assert.equal(roundFare(amount), expected, `fare for UGX ${amount}`);
  }
});

test("rounding preserves configured minimum fares and valid denominations", () => {
  assert.equal(roundFare(102, 2_000), 2_000);
  assert.equal(roundFare(2_102, 2_500), 2_500);
  assert.equal(roundFare(102, 2_100), 2_500);
  assert.equal(roundFare(102, 7_300), 7_500, "a minimum typed as 7,300 is kept to a whole 500");
  for (let amount = 0; amount <= 10_000; amount += 17) {
    const fare = roundFare(amount);
    assert.ok(fare >= 500);
    assert.equal(fare % 500, 0);
    assert.equal(roundFare(fare), fare);
  }
});

test("the admin's rounding rule changes how amounts are rounded, and can be switched off", () => {
  try {
    // A bigger step.
    setRoundingRule({ enabled: true, step: 1000, roundUpAfter: 200 });
    assert.equal(roundFare(23_600), 24_000);
    assert.equal(roundFare(23_200), 23_000);
    assert.equal(roundFare(23_201), 24_000);
    assert.equal(roundFare(300, 0), 1_000, "never below a whole step");
    // Plain nearest 500: 250 into the step is the halfway point.
    setRoundingRule({ enabled: true, step: 500, roundUpAfter: 249 });
    assert.equal(roundFare(29_700), 29_500);
    assert.equal(roundFare(23_760), 24_000);
    // Rounding off: exact shillings.
    setRoundingRule({ enabled: false, step: 500, roundUpAfter: 100 });
    assert.equal(roundFare(23_618), 23_618);
    assert.equal(roundNearest(23_618), 23_618);
    // Time fees are held to whole 500s whatever the rule, because the database insists on it.
    assert.equal(snap500(23_618), 23_618 - 23_618 % 500 + 500);
  } finally {
    setRoundingRule(DEFAULT_ROUNDING_RULE);
  }
});

test("shares such as commissions and discounts round to the nearest step, without leaning up", () => {
  assert.equal(roundNearest(1_200), 1_000, "a 12% cut of 10,000 stays near 12%, not 15%");
  assert.equal(roundNearest(1_300), 1_500);
  assert.equal(roundNearest(250), 500, "a tie goes up");
  assert.equal(roundNearest(249), 0);
  assert.equal(roundWith({ enabled: true, step: 500, roundUpAfter: 100 }, 1_200), 1_500, "the fare rule, by contrast, leans up");
});

test("a stored rounding rule is kept inside what makes sense", () => {
  assert.deepEqual(normaliseRoundingRule({ enabled: true, step: 100 as never, roundUpAfter: 9_999 }), { enabled: true, step: 500, roundUpAfter: 499 }, "nothing under 500 is allowed");
  assert.deepEqual(normaliseRoundingRule({ step: 1000, roundUpAfter: -5 }), { enabled: true, step: 1000, roundUpAfter: 0 });
  assert.deepEqual(normaliseRoundingRule(null), DEFAULT_ROUNDING_RULE);
});

import { roundedFromNote as _roundedFromNote } from "@peebee/shared";
import { test as _t } from "node:test";
import _assert from "node:assert/strict";
_t("roundedFromNote describes the direction and exact amount", () => {
  _assert.equal(_roundedFromNote(24600, 24500), "rounded down from 24,600");
  _assert.equal(_roundedFromNote(29700, 30000), "rounded up from 29,700");
  _assert.equal(_roundedFromNote(24500, 24500), null);
  _assert.equal(_roundedFromNote(null, 24500), null);
});
