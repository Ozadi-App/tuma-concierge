import { test } from "node:test";
import assert from "node:assert/strict";
import { collectDishes, cuisineTags, dishesUnder, featuredDishes, hoursLabel, matchesQuery, menuSections, quickDishes } from "./food-subhome";

const r = (id: string, extra: object = {}) => ({ id, name: id, is_open: 1, business_type: "restaurant", cuisine: "Pizza · Italian", ...extra }) as any;
const i = (id: string, extra: object = {}) => ({ id, name: id, price: 5000, available: 1, is_featured: 0, prep_time_minutes: 20, photo_key: null, options: [], ...extra }) as any;
const menus: any = {
  a: { categories: [{ name: "Mains", items: [i("a1", { is_featured: 1 }), i("a2", { available: 0 }), i("a3", { prep_time_minutes: 10, price: 12000 })] }], uncategorizedItems: [] },
  b: { categories: [{ name: "mains ", items: [i("b1", { photo_key: "k" })] }, { name: "Drinks", items: [i("b2")] }], uncategorizedItems: [i("b3")] },
};

test("collects available dishes, open businesses first", () => {
  const d = collectDishes([r("a", { is_open: 0 }), r("b")], menus);
  assert.deepEqual(d.map((x) => x.item.id), ["b1", "b2", "b3", "a1", "a3"]);
});
test("skips businesses whose menu failed", () => assert.equal(collectDishes([r("a"), r("z")], menus).length, 2));
test("featured, quick and price filters use real fields only", () => {
  const d = collectDishes([r("a")], menus);
  assert.deepEqual(featuredDishes(d).map((x) => x.item.id), ["a1"]);
  assert.deepEqual(quickDishes(d, 15).map((x) => x.item.id), ["a3"]);
  assert.deepEqual(dishesUnder(d, 10000).map((x) => x.item.id), ["a1"]);
  assert.equal(quickDishes([{ item: i("n", { prep_time_minutes: null }), restaurant: r("a") }], 15).length, 0);
});
test("cuisine tags come from the businesses' own text", () => {
  assert.deepEqual(cuisineTags([r("a"), r("b", { cuisine: "Burgers · Street food" }), r("c", { cuisine: null })]), ["Burgers", "Italian", "Pizza"]);
});
test("menu sections merge by name and pick a photographed dish", () => {
  const s = menuSections([r("a"), r("b")], menus);
  assert.equal(s[0].name, "Mains"); assert.equal(s[0].count, 3); assert.equal(s[1].name, "Drinks");
  assert.equal(menuSections([r("b")], menus)[0].item?.id, "b1");
});
test("hours only when published; query matching", () => {
  assert.equal(hoursLabel({ open_time: "08:00", close_time: "22:00" } as any), "08:00–22:00");
  assert.equal(hoursLabel({ open_time: null, close_time: "22:00" } as any), null);
  assert.ok(matchesQuery("Chicken Pilau", " pil")); assert.ok(!matchesQuery("Rolex", "pizza")); assert.ok(matchesQuery("x", ""));
});
