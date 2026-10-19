import assert from "node:assert/strict";
import test from "node:test";
import { directionFrom, directionLabel, fallbackCode, legDirectionFrom, routeCodeLabel, routeCodes } from "./direction.js";

const KAMPALA = { lat: 0.3136, lng: 32.5811 };
const ENTEBBE = { lat: 0.0512, lng: 32.4637 };
const KAJJANSI = { lat: 0.2163, lng: 32.5512 };
const route = {
  stage_a_name: "Kampala Old Taxi Park", stage_a_lat: KAMPALA.lat, stage_a_lng: KAMPALA.lng,
  stage_b_name: "Entebbe Kitoro", stage_b_lat: ENTEBBE.lat, stage_b_lng: ENTEBBE.lng,
};

test("stored codes are used; without them (or before migration 0107) the stage name gives one", () => {
  // A row from before the migration has no code columns at all.
  assert.deepEqual(routeCodes(route), { a: "KAM", b: "ENT" });
  assert.deepEqual(routeCodes({ ...route, stage_a_code: null, stage_b_code: "" }), { a: "KAM", b: "ENT" });
  assert.deepEqual(routeCodes({ ...route, stage_a_code: "KLA", stage_b_code: "ebb" }), { a: "KLA", b: "EBB" });
  // Anything that isn't 2-4 letters is ignored.
  assert.deepEqual(routeCodes({ ...route, stage_a_code: "K1", stage_b_code: "EBBEE" }), { a: "KAM", b: "ENT" });
  assert.equal(fallbackCode("(Old) Park", "a"), "OLD");
  assert.equal(fallbackCode("", "b"), "B");
});

test("labels: the route both ways, and each direction", () => {
  const coded = { ...route, stage_a_code: "KLA", stage_b_code: "EBB" };
  assert.equal(routeCodeLabel(coded), "KLA ⇄ EBB");
  assert.equal(directionLabel(coded, "a"), "KLA - EBB");
  assert.equal(directionLabel(coded, "b"), "EBB - KLA");
});

test("direction: stop order decides, otherwise the end nearer stage A starts", () => {
  assert.equal(directionFrom(KAMPALA, { ...KAJJANSI, index: 1 }, { ...ENTEBBE, index: 2 }), "a");
  assert.equal(directionFrom(KAMPALA, { ...KAJJANSI, index: 1 }, { ...KAMPALA, index: 0 }), "b");
  assert.equal(directionFrom(KAMPALA, { ...ENTEBBE, index: null }, KAJJANSI), "b");
  assert.equal(directionFrom(KAMPALA, KAMPALA, ENTEBBE), "a");

  const stops = [KAMPALA, KAJJANSI, ENTEBBE];
  const leg = (from: typeof KAMPALA, to: typeof KAMPALA) => ({ from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng });
  assert.equal(legDirectionFrom(route, stops, leg(KAJJANSI, ENTEBBE)), "a");
  assert.equal(legDirectionFrom(route, stops, leg(ENTEBBE, KAJJANSI)), "b");
  // A drop station beside a stop counts as that stop.
  assert.equal(legDirectionFrom(route, stops, leg(KAJJANSI, { lat: 0.3125, lng: 32.582 })), "b");
  assert.equal(legDirectionFrom(route, stops, { from_lat: null }), null);
});
