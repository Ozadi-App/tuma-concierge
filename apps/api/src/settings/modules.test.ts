import assert from "node:assert/strict";
import test from "node:test";
import { applyModuleAvailability, isModuleOn, resolveModuleAvailability, type ModuleFlags } from "@peebee/shared";
import { MODULES } from "@peebee/shared";

const allOn = (): ModuleFlags => Object.fromEntries(MODULES.map((m) => [m.key, { live: true, practice: true }]));

test("a module is available only while every module above it is", () => {
  const flags = allOn();
  flags["ride.car"] = { live: false, practice: true };
  const available = resolveModuleAvailability(flags);
  assert.deepEqual(available["ride.car.carpool"], { live: false, practice: true });
  assert.deepEqual(available["ride.boda"], { live: true, practice: true });
  flags.ride = { live: true, practice: false };
  const next = resolveModuleAvailability(flags);
  assert.equal(next["ride.car.carpool"]!.practice, false);
  assert.equal(next["ride.taxipress"]!.live, true);
});

test("an unknown module or an unloaded cache reads as on", () => {
  assert.equal(isModuleOn("nope", "live", {}), true);
  assert.equal(isModuleOn("ride.car", "practice", null), true);
});

test("Practice decides in Practice: a module off in Live can be on there", () => {
  const settings = { car: { enabled: false, carpool: { enabled: false } }, services: { ride: true, cargo: true } };
  const flags = allOn();
  const available = resolveModuleAvailability(flags);
  const practice = applyModuleAvailability(settings, available, "practice");
  assert.equal(practice.car.enabled, true);
  assert.equal(practice.car.carpool.enabled, true);
  const live = applyModuleAvailability(settings, available, "live");
  assert.equal(live.car.enabled, false, "Live keeps its own stored value");
});

test("Live only ever narrows, and Practice off turns the setting off", () => {
  const flags = allOn();
  flags.ride = { live: false, practice: false };
  const available = resolveModuleAvailability(flags);
  const settings = { services: { ride: true, cargo: true }, car: { enabled: true, carpool: { enabled: true } } };
  assert.equal(applyModuleAvailability(settings, available, "live").services.ride, false);
  assert.equal(applyModuleAvailability(settings, available, "live").car.enabled, false);
  assert.equal(applyModuleAvailability(settings, available, "practice").services.cargo, false);
});
