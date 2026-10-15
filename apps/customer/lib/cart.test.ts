import assert from "node:assert/strict";
import test from "node:test";
import { addToCart, clearCart, loadCart } from "./cart";
import { addSpotlightItemToCart, spotlightCartLine } from "./spotlight-cart";

// Minimal browser shims (read lazily by lib/cart.ts at call time): persists to localStorage and dispatches a window event.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const win = new EventTarget();
(globalThis as any).window = win;


const sneakerSpot = {
  store_id: "store_demo_sneaker_hub",
  store_name: "Kampala Sneaker Hub",
  store_slug: "kampala-sneaker-hub",
  store_category: "stores",
  product: { id: "prod_retro_high_top", title: "Air Retro High-Top", price: 185000, compare_at_price: 220000, image_url: "/x.jpg" },
};
const variants = [
  { id: "var_41", title: "EU 41 / UK 7", price: 185000 },
  { id: "var_42", title: "EU 42 / UK 8", price: 185000 },
];

test("Spotlight Buy writes to the shared cart (drawer and /cart read loadCart)", async () => {
  store.clear();
  let events = 0;
  win.addEventListener("peebee:cart_change", () => events++);
  await addSpotlightItemToCart(sneakerSpot, async () => ({ product: { variants } }));
  const cart = loadCart();
  assert.equal(cart.length, 1);
  assert.equal(cart[0].id, "prod_retro_high_top:var_41");
  assert.equal(cart[0].storeId, "store_demo_sneaker_hub");
  assert.equal(cart[0].storeName, "Kampala Sneaker Hub");
  assert.equal(cart[0].variantTitle, "EU 41 / UK 7");
  assert.equal(cart[0].quantity, 1);
  assert.equal(cart[0].selected, true);
  assert.ok(events >= 1, "cart change event dispatched so open drawers refresh");
});

test("repeat Buy increments quantity and merges with the store grid's default-variant line", async () => {
  store.clear();
  // Store grid card adds the first variant by default.
  addToCart({ productId: "prod_retro_high_top", storeId: "store_demo_sneaker_hub", title: "Air Retro High-Top", variantId: "var_41", variantTitle: "EU 41 / UK 7", price: 185000, quantity: 1 });
  await addSpotlightItemToCart(sneakerSpot, async () => ({ product: { variants } }));
  await addSpotlightItemToCart(sneakerSpot, async () => ({ product: { variants } }));
  const cart = loadCart();
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);
});

test("product lookup failure still adds the item (no variant)", async () => {
  store.clear();
  await addSpotlightItemToCart(sneakerSpot, async () => { throw new Error("offline"); });
  const cart = loadCart();
  assert.equal(cart.length, 1);
  assert.equal(cart[0].id, "prod_retro_high_top:default");
  assert.equal(cart[0].price, 185000);
  assert.equal(cart[0].compareAtPrice, 220000);
});

test("slow product lookup falls back after the timeout", async () => {
  store.clear();
  await addSpotlightItemToCart(sneakerSpot, () => new Promise(() => {}), 20);
  assert.equal(loadCart()[0].id, "prod_retro_high_top:default");
});

test("spotlightCartLine uses the variant price when present", () => {
  const line = spotlightCartLine(sneakerSpot, { id: "v", title: "Big", price: 199000 });
  assert.equal(line.price, 199000);
  assert.equal(line.variantId, "v");
  clearCart();
  assert.deepEqual(loadCart(), []);
});
