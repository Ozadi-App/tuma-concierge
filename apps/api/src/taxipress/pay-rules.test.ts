import assert from "node:assert/strict";
import { test } from "node:test";
import { cashRule } from "./pay-rules.js";

test("cash is refused when TaxiPress cash is off", () => {
  const r = cashRule(false, 2, 0);
  assert.equal(r.cashAllowed, false);
  assert.match(r.cashReason ?? "", /isn't accepted/);
});
test("cash is refused at the cash-booking limit", () => {
  assert.equal(cashRule(true, 2, 2).cashAllowed, false);
  assert.match(cashRule(true, 1, 1).cashReason ?? "", /1 cash booking at a time/);
});
test("cash is allowed under the limit", () => {
  assert.deepEqual(cashRule(true, 2, 1), { cashAllowed: true, cashReason: null });
});
