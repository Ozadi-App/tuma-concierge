import assert from "node:assert/strict";
import test from "node:test";
import {
  foodCartPrefix,
  listFoodCarts,
  listFoodEarlierCarts,
  readFoodCart,
  setAsideFoodCart,
  writeFoodCart,
} from "./food-carts";
import {
  bagCheckoutHref,
  parseBagCheckoutStep,
  previousBagCheckoutStep,
  readBagDeliveryChoice,
  saveBagDeliveryChoice,
  clearBagDeliveryChoice,
} from "./bag-checkout";

// Minimal browser shims: sessionStorage (current restaurant carts), localStorage (earlier carts), window events.
function storageShim() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}
const session = storageShim();
const local = storageShim();
(globalThis as any).sessionStorage = session;
(globalThis as any).localStorage = local;
(globalThis as any).window = new EventTarget();

type Line = { key: string; menuItemId: string; name: string; quantity: number; unitPrice: number; choiceIds: string[] };
const isLine = (v: unknown): v is Line => !!v && typeof (v as Line).key === "string";
const rolex: Line = { key: "mi1:", menuItemId: "mi1", name: "Rolex", quantity: 2, unitPrice: 5000, choiceIds: [] };
const pilau: Line = { key: "mi2:", menuItemId: "mi2", name: "Pilau", quantity: 1, unitPrice: 12000, choiceIds: [] };

test("restaurant carts are listed (newest first) with their names, totals and nothing changed", () => {
  session.clear();
  local.clear();
  const prefix = foodCartPrefix("usr_a");
  writeFoodCart(`${prefix}rest1`, [rolex], 1_000, "Mama Rose Kitchen");
  writeFoodCart(`${prefix}rest2`, [pilau], 2_000, "Pilau Palace");
  // Another customer's cart on the same device is never listed.
  writeFoodCart(`${foodCartPrefix("usr_b")}rest3`, [pilau], 3_000, "Not mine");
  const before = JSON.stringify([...session.store.entries()]);

  const carts = listFoodCarts("usr_a");
  assert.deepEqual(
    carts.map((c) => [c.restaurantId, c.restaurantName, c.count, c.total]),
    [
      ["rest2", "Pilau Palace", 1, 12000],
      ["rest1", "Mama Rose Kitchen", 2, 10000],
    ],
  );
  // Listing is read-only: every cart is kept exactly as it was added.
  assert.equal(JSON.stringify([...session.store.entries()]), before);
});

test("writing a cart without a name keeps the restaurant name already stored", () => {
  session.clear();
  const key = `${foodCartPrefix("usr_a")}rest1`;
  writeFoodCart(key, [rolex], 1_000, "Mama Rose Kitchen");
  writeFoodCart(key, [rolex, pilau], 2_000);
  const saved = readFoodCart(key, isLine);
  assert.equal(saved.restaurantName, "Mama Rose Kitchen");
  assert.equal(saved.lines.length, 2);
  assert.equal(saved.updatedAt, 2_000);
});

test("earlier (set-aside) food carts are listed for the header, with their contents as they were", () => {
  session.clear();
  local.clear();
  setAsideFoodCart("usr_a", "rest1", "Mama Rose Kitchen", { lines: [rolex, pilau], updatedAt: 5_000 });
  const earlier = listFoodEarlierCarts("usr_a");
  assert.equal(earlier.length, 1);
  assert.equal(earlier[0].restaurantName, "Mama Rose Kitchen");
  assert.equal(earlier[0].count, 3);
  assert.equal(earlier[0].total, 22000);
  assert.equal(earlier[0].updatedAt, 5_000);
  assert.deepEqual(listFoodCarts("usr_a"), []);
});

test("the bag checkout's steps: Bag → Delivery → Review, each its own URL", () => {
  assert.equal(parseBagCheckoutStep(null), "bag");
  assert.equal(parseBagCheckoutStep("delivery"), "delivery");
  assert.equal(parseBagCheckoutStep("review"), "review");
  assert.equal(parseBagCheckoutStep("pay"), "bag");
  assert.equal(bagCheckoutHref("bag"), "/cart");
  assert.equal(bagCheckoutHref("delivery"), "/cart?step=delivery");
  assert.equal(bagCheckoutHref("review"), "/cart?step=review");
  assert.equal(previousBagCheckoutStep("review"), "delivery");
  assert.equal(previousBagCheckoutStep("delivery"), "bag");
  assert.equal(previousBagCheckoutStep("bag"), null);
});

test("the Delivery step's choice is kept for Review, per customer, and cleared after the order", () => {
  session.clear();
  assert.deepEqual(readBagDeliveryChoice("usr_a"), { relayLastMile: "door", relayMeetStageId: null });
  saveBagDeliveryChoice("usr_a", { deliveryMode: "rider", relayLastMile: "meet", relayMeetStageId: "stage1" });
  assert.deepEqual(readBagDeliveryChoice("usr_a"), { deliveryMode: "rider", relayLastMile: "meet", relayMeetStageId: "stage1" });
  assert.deepEqual(readBagDeliveryChoice("usr_b"), { relayLastMile: "door", relayMeetStageId: null });
  clearBagDeliveryChoice("usr_a");
  assert.deepEqual(readBagDeliveryChoice("usr_a"), { relayLastMile: "door", relayMeetStageId: null });
});
