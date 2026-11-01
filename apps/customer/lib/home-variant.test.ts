import assert from "node:assert/strict";
import test from "node:test";
import { parseHomeVariant } from "./home-variant";

test("home variant defaults to the brand hero", () => {
  assert.equal(parseHomeVariant(null), "a");
  assert.equal(parseHomeVariant(""), "a");
  assert.equal(parseHomeVariant("nope"), "a");
});

test("home variant accepts the launcher and today options", () => {
  assert.equal(parseHomeVariant("b"), "b");
  assert.equal(parseHomeVariant("c"), "c");
});
