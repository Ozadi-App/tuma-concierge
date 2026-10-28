import assert from "node:assert/strict";
import test from "node:test";
import { filterByModule } from "./modules";

test("a card whose module is off is left out, and cards with no module always stay", () => {
  const items = [{ id: "boda", module: "ride.boda" }, { id: "car", module: "ride.car" }, { id: "orders" }];
  const on = (key: string) => key !== "ride.car";
  assert.deepEqual(filterByModule(items, on).map((i) => i.id), ["boda", "orders"]);
  assert.deepEqual(filterByModule(items, () => true).map((i) => i.id), ["boda", "car", "orders"]);
});
