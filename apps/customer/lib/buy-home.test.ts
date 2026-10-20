import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SHOPPING_UNIT_SETTINGS as S } from "@peebee/shared";
import { matchPrice, parseListPhrase, parseListText, unitLabel } from "./buy-home";

test("parses leading quantity with unit", () => {
  const it = parseListPhrase("2kg tomatoes", S)!;
  assert.equal(it.name, "Tomatoes"); assert.equal(it.quantity, "2"); assert.equal(it.unit, "kg");
});
test("parses unit-first phrase", () => {
  const it = parseListPhrase("tray of eggs", S)!;
  assert.equal(it.name, "Eggs"); assert.equal(it.unit, "other"); assert.equal(it.customUnit, "tray"); assert.equal(unitLabel(it), "1 tray");
});
test("parses trailing number", () => {
  const it = parseListPhrase("basmati 5", S)!;
  assert.equal(it.name, "Basmati"); assert.equal(it.quantity, "5");
});
test("parses plain names and counts", () => {
  assert.equal(parseListPhrase("sourdough", S)!.quantity, "1");
  const a = parseListPhrase("3 avocados", S)!; assert.equal(a.name, "Avocados"); assert.equal(a.quantity, "3");
  const m = parseListPhrase("1L fresh milk", S)!; assert.equal(m.name, "Fresh milk"); assert.equal(m.unit, "l"); assert.equal(unitLabel(m), "1 L");
});
test("splits lists on commas, newlines and 'and'", () => {
  const items = parseListText("2kg tomatoes, tray of eggs and 1L milk\nsugar", S);
  assert.deepEqual(items.map((i) => i.name), ["Tomatoes", "Eggs", "Milk", "Sugar"]);
  assert.deepEqual(parseListText(" , ,", S), []);
});
test("matches prices by name", () => {
  const p = [{ title: "Farm Fresh Eggs", price: 3200 }, { title: "Fresh Milk 1L", price: 3500 }];
  assert.equal(matchPrice("Eggs", p), 3200);
  assert.equal(matchPrice("Fresh milk", p), 3500);
  assert.equal(matchPrice("Tomatoes", p), null);
});
