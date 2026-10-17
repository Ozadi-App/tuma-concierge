import assert from "node:assert/strict";
import test from "node:test";
import {
  addToCart,
  clearCart,
  completeCheckout,
  loadCart,
  loadEarlierCartNotice,
  loadEarlierCarts,
  mergeEarlierCart,
  restoreEarlierCart,
  toggleItemSelection,
} from "./cart";
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

const line = (productId: string, price = 1000) => ({ productId, storeId: "store_a", title: productId, price });

test("a bag left longer than the expiry is set aside when a new item is added", () => {
  store.clear();
  addToCart(line("old"));
  const saved = JSON.parse(store.get("peebee_marketplace_cart:guest")!);
  saved.updatedAt = Date.now() - 13 * 3_600_000; // default expiry is 12 hours
  store.set("peebee_marketplace_cart:guest", JSON.stringify(saved));
  addToCart(line("new"));
  assert.deepEqual(loadCart().map((i) => i.productId), ["new"]);
  const earlier = loadEarlierCarts();
  assert.equal(earlier.length, 1);
  assert.equal(earlier[0].reason, "expired");
  assert.deepEqual(earlier[0].items.map((i) => i.productId), ["old"]);
  assert.ok(loadEarlierCartNotice());
});

test("checkout removes only the checked-out lines; the rest become an earlier cart", () => {
  store.clear();
  addToCart(line("a"));
  addToCart(line("b"));
  toggleItemSelection("b:default");
  completeCheckout(["a:default"]);
  assert.deepEqual(loadCart(), []);
  const earlier = loadEarlierCarts();
  assert.equal(earlier[0].reason, "left_after_checkout");
  assert.deepEqual(earlier[0].items.map((i) => i.id), ["b:default"]);
});

test("restore replaces the current bag (saving it first); add to bag merges", () => {
  store.clear();
  addToCart(line("a"));
  completeCheckout([]); // a -> earlier
  addToCart(line("b"));
  const [a] = loadEarlierCarts();
  restoreEarlierCart(a.id);
  assert.deepEqual(loadCart().map((i) => i.productId), ["a"]);
  assert.ok(loadCart().every((i) => i.selected));
  const [b] = loadEarlierCarts();
  assert.equal(b.reason, "replaced");
  mergeEarlierCart(b.id);
  assert.deepEqual(loadCart().map((i) => i.productId).sort(), ["a", "b"]);
  assert.equal(loadEarlierCarts().length, 0);
});

test("the legacy shared bag migrates once, as stale", () => {
  store.clear();
  store.set("peebee_marketplace_cart", JSON.stringify([{ ...line("legacy"), id: "legacy:default", quantity: 1, selected: true }]));
  assert.deepEqual(loadCart().map((i) => i.productId), ["legacy"]);
  assert.equal(store.has("peebee_marketplace_cart"), false);
  addToCart(line("fresh"));
  assert.deepEqual(loadCart().map((i) => i.productId), ["fresh"]);
  assert.equal(loadEarlierCarts()[0].items[0].productId, "legacy");
});

test("bags are per user: signing out does not show the account's bag", () => {
  store.clear();
  store.set("peebee_customer_user", JSON.stringify({ id: "user_1" }));
  addToCart(line("mine"));
  store.delete("peebee_customer_user");
  assert.deepEqual(loadCart(), []);
  store.set("peebee_customer_user", JSON.stringify({ id: "user_2" }));
  assert.deepEqual(loadCart(), []);
  store.set("peebee_customer_user", JSON.stringify({ id: "user_1" }));
  assert.deepEqual(loadCart().map((i) => i.productId), ["mine"]);
});

test("at most 10 earlier carts are kept, newest first", () => {
  store.clear();
  for (let n = 0; n < 12; n++) {
    addToCart(line(`p${n}`));
    completeCheckout([]);
  }
  const earlier = loadEarlierCarts();
  assert.equal(earlier.length, 10);
  assert.equal(earlier[0].items[0].productId, "p11");
});
