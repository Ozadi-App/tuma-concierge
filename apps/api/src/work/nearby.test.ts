import assert from "node:assert/strict";
import test from "node:test";
import { CELL_DEG, summariseNearby } from "./nearby.js";

const origin = { lat: 0.3297, lng: 32.5925 };
const opts = { radiusKm: 5, types: ["clean", "laundry", "fix"], day: "2026-10-20" };

test("counts distinct providers per trade within the radius", () => {
  const r = summariseNearby([
    { providerId: "a", type: "clean", lat: 0.33, lng: 32.59 },
    { providerId: "a", type: "fix", lat: 0.33, lng: 32.59 },
    { providerId: "b", type: "clean", lat: 0.331, lng: 32.591 },
    { providerId: "far", type: "clean", lat: 0.6, lng: 32.9 },
  ], origin, opts);
  assert.deepEqual(r.counts, { clean: 2, laundry: 0, fix: 1 });
  assert.equal(r.total, 2);
});

test("pins are coarse: one per cell and trade, never the exact spot, no ids", () => {
  const exact = { lat: 0.33012, lng: 32.59034 };
  const r = summariseNearby([
    { providerId: "a", type: "clean", ...exact },
    { providerId: "b", type: "clean", lat: exact.lat + 0.0001, lng: exact.lng + 0.0001 },
  ], origin, opts);
  assert.equal(r.pins.length, 1);
  const pin = r.pins[0]!;
  assert.deepEqual(Object.keys(pin).sort(), ["lat", "lng", "type"]);
  assert.notEqual(pin.lat, exact.lat);
  assert.ok(Math.abs(pin.lat - exact.lat) < CELL_DEG * 1.5);
});

test("pins are stable within a day and move between days", () => {
  const rows = [{ providerId: "a", type: "laundry", lat: 0.332, lng: 32.594 }];
  const a = summariseNearby(rows, origin, opts).pins[0];
  const b = summariseNearby(rows, origin, opts).pins[0];
  const c = summariseNearby(rows, origin, { ...opts, day: "2026-10-21" }).pins[0];
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("skips trades that are turned off and bad rows", () => {
  const r = summariseNearby([
    { providerId: "a", type: "fix", lat: 0.33, lng: 32.59 },
    { providerId: "b", type: "clean", lat: Number.NaN, lng: 32.59 },
  ], origin, { ...opts, types: ["clean"] });
  assert.equal(r.total, 0);
  assert.equal(r.pins.length, 0);
});
