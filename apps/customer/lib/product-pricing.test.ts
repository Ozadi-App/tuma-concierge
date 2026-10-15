import assert from "node:assert/strict";
import test from "node:test";
import { defaultVariant, productPricing } from "./product-pricing";

const milk = {
  price: 3500,
  compare_at_price: 4000,
  variants: [
    { id: "v1", title: "500ml Pouch", price: 2000 },
    { id: "v2", title: "1 Litre Bottle", price: 3500 },
    { id: "v3", title: "2 Litre Family Jug", price: 6500, compare_at_price: 7000 },
  ],
};

test("varying option prices show 'from' the lowest option and drop an unrelated strike price", () => {
  assert.deepEqual(productPricing(milk), { price: 2000, from: true, compareAt: null, discount: 0 });
  assert.equal(defaultVariant(milk)?.price, 2000);
});

test("strike price kept when it belongs to the cheapest option", () => {
  const p = { price: 10, variants: [{ id: "a", title: "A", price: 8, compare_at_price: 10 }, { id: "b", title: "B", price: 12 }] };
  assert.deepEqual(productPricing(p), { price: 8, from: true, compareAt: 10, discount: 20 });
});

test("same-priced options keep the plain price and product strike price", () => {
  const shoe = { price: 185000, compare_at_price: 220000, variants: [{ id: "a", title: "41", price: 185000 }, { id: "b", title: "42", price: 185000 }] };
  assert.deepEqual(productPricing(shoe), { price: 185000, from: false, compareAt: 220000, discount: 16 });
});

test("default option priced differently from the listing triggers 'from'", () => {
  const p = { price: 5000, variants: [{ id: "a", title: "Small", price: 4000 }] };
  assert.equal(productPricing(p).from, true);
  assert.equal(productPricing(p).price, 4000);
});

test("no options: plain price; strike only when higher", () => {
  assert.deepEqual(productPricing({ price: 28000, compare_at_price: 32000 }), { price: 28000, from: false, compareAt: 32000, discount: 13 });
  assert.equal(productPricing({ price: 5000, compare_at_price: 5000 }).compareAt, null);
});
