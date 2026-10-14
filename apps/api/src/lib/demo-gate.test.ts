import assert from "node:assert/strict";
import test from "node:test";
import { demoDisabledByEnv, getPaymentsDemoMode } from "./settings.js";

test("PEEBEE_DISABLE_DEMO=1 forces payments demo mode off without reading settings", async () => {
  const before = process.env.PEEBEE_DISABLE_DEMO;
  process.env.PEEBEE_DISABLE_DEMO = "1";
  try {
    assert.equal(demoDisabledByEnv(), true);
    assert.equal(await getPaymentsDemoMode(), false);
  } finally {
    if (before === undefined) delete process.env.PEEBEE_DISABLE_DEMO;
    else process.env.PEEBEE_DISABLE_DEMO = before;
  }
});

test("demo gate is off by default", () => {
  const before = process.env.PEEBEE_DISABLE_DEMO;
  delete process.env.PEEBEE_DISABLE_DEMO;
  assert.equal(demoDisabledByEnv(), false);
  if (before !== undefined) process.env.PEEBEE_DISABLE_DEMO = before;
});
