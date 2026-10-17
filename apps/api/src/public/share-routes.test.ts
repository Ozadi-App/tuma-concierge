import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client/node";
import app from "../app.js";
import { setD1Binding, type D1Database } from "../db/client.js";
import { splitSqlStatements } from "../db/split-sql.js";

function bindDatabase(client: Client) {
  const prepare = (sql: string) => ({
    sql, args: [] as unknown[],
    bind(...args: unknown[]) { this.args = args; return this; },
    async all() {
      const result = await client.execute({ sql: this.sql, args: this.args as InArgs });
      return { results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
    },
  });
  setD1Binding({
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      const results = await client.batch(statements.map(({ sql, args }) => ({ sql, args: args as InArgs })), "write");
      return results.map((result) => ({ results: result.rows, success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } }));
    },
  } as unknown as D1Database);
}

test("shared links: a live dish and the sitemap are readable without signing in; nothing else is", async () => {
  const client = createClient({ url: "file::memory:" });
  for (const file of readdirSync(join(process.cwd(), "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    for (const sql of splitSqlStatements(readFileSync(join(process.cwd(), "src/db/migrations", file), "utf8"))) await client.execute(sql);
  }
  bindDatabase(client);
  try {
    await client.execute("INSERT INTO users (id, phone, name, password_hash, role) VALUES ('owner', 'owner', 'Owner', 'hash', 'customer')");
    await client.execute(`INSERT INTO restaurants (id, owner_id, name, cuisine, address, status, is_open, environment) VALUES
      ('food', 'owner', 'Mama''s Kitchen', 'Ugandan', 'Kira Road', 'active', 1, 'live'),
      ('hidden', 'owner', 'Not approved', NULL, NULL, 'pending_approval', 1, 'live')`);
    await client.execute("INSERT INTO menu_categories (id, restaurant_id, name) VALUES ('mains', 'food', 'Mains')");
    await client.execute(`INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, photo_key, prep_time_minutes) VALUES
      ('luwombo', 'food', 'mains', 'Chicken luwombo', 'Slow-steamed in banana leaves', 25000, 'menu/luwombo.jpg', 30),
      ('secret', 'hidden', NULL, 'Secret dish', NULL, 9000, NULL, NULL)`);
    await client.execute("INSERT INTO menu_item_options (id, menu_item_id, name, required) VALUES ('side', 'luwombo', 'Side', 1)");
    await client.execute("INSERT INTO menu_item_option_choices (id, option_id, name, price_delta) VALUES ('matooke', 'side', 'Matooke', 0), ('rice', 'side', 'Rice', 2000)");

    const res = await app.request("/v1/public/food/food/items/luwombo");
    assert.equal(res.status, 200, "no sign-in needed");
    assert.match(res.headers.get("cache-control") ?? "", /public/);
    const dish = (await res.json()) as { restaurant: { name: string; cuisine: string }; item: { name: string; price: number; categoryName: string; photo: string; options: Array<{ name: string; choices: Array<{ name: string; priceDelta: number }> }> } };
    assert.equal(dish.restaurant.name, "Mama's Kitchen");
    assert.equal(dish.item.categoryName, "Mains");
    assert.equal(dish.item.price, 25000);
    assert.match(dish.item.photo, /\/v1\/public\/menu-items\/luwombo\/photo/, "an absolute, public photo URL for link previews");
    assert.deepEqual(dish.item.options[0].choices.map((c) => [c.name, c.priceDelta]), [["Matooke", 0], ["Rice", 2000]]);
    assert.equal(JSON.stringify(dish).includes("owner"), false, "never the owner's details");

    assert.equal((await app.request("/v1/public/food/hidden/items/secret")).status, 404, "a restaurant that isn't approved stays private");
    assert.equal((await app.request("/v1/public/food/food/items/secret")).status, 404, "the dish must belong to that restaurant");
    assert.equal((await app.request("/v1/public/menu-items/secret/photo")).status, 404);

    const sitemap = (await (await app.request("/v1/public/sitemap")).json()) as { dishes: Array<{ id: string; restaurantId: string }> };
    assert.deepEqual(sitemap.dishes.map((d) => [d.restaurantId, d.id]), [["food", "luwombo"]]);
  } finally {
    client.close();
  }
});
