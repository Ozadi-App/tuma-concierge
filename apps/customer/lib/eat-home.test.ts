import assert from "node:assert/strict";
import { test } from "node:test";
import type { FoodNearbyItem } from "@peebee/shared";
import { dishHref, eatSections, kmLabel } from "./eat-home";

const mk = (id: string, isFeatured: boolean, distanceKm: number | null) => ({ id, restaurantId: "r", name: id, isFeatured, distanceKm }) as FoodNearbyItem;

test("featured dishes fill the slider; the rest are split nearest first", () => {
  const s = eatSections([mk("f1", true, 3), mk("a", false, 4), mk("b", false, 1), mk("c", false, 2), mk("d", false, 5), mk("e", false, 0.5)]);
  assert.deepEqual(s.slider.map((i) => i.id), ["f1"]);
  assert.deepEqual(s.best.map((i) => i.id), ["e", "b", "c", "a"]);
  assert.deepEqual(s.more.map((i) => i.id), ["d"]);
});

test("featured dishes with a photo lead the slider", () => {
  const s = eatSections([mk("a", true, 1), mk("b", true, 2)], (i) => i.id === "b");
  assert.deepEqual(s.slider.map((i) => i.id), ["b", "a"]);
});

test("without featured dishes the first few lead the slider", () => {
  assert.deepEqual(eatSections([mk("a", false, 1), mk("b", false, 2)]).slider.map((i) => i.id), ["a", "b"]);
  assert.deepEqual(eatSections([]), { slider: [], best: [], more: [] });
});

test("distance and links", () => {
  assert.equal(kmLabel(null), null);
  assert.equal(kmLabel(0), "< 0.1 km");
  assert.equal(kmLabel(2), "2.0 km");
  assert.equal(dishHref({ restaurantId: "a b", id: "x" }), "/restaurants/a%20b/items/x");
});
