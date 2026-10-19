/**
 * Public, read-only pages' data: what a shared link to one dish or product
 * shows to someone who isn't signed in, and what link previews (WhatsApp,
 * Facebook, X…) and search engines read. Only what a customer would see on the
 * menu anyway — never an owner's details — and only for businesses that are
 * live (active, in the platform's current environment).
 */
import { Hono } from "hono";
import { demoFoodMenu, demoFoodPhotoPath, demoFoodRestaurant } from "@peebee/shared/demo-food";
import { db } from "../db/client.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";

type Row = Record<string, unknown>;

export const publicShareRoutes = new Hono();

type PublicDish = {
  restaurant: { id: string; name: string; cuisine: string | null; address: string | null; businessType: string | null; isOpen: boolean };
  item: {
    id: string; name: string; description: string | null; price: number; available: boolean;
    prepTimeMinutes: number | null; badge: string | null; categoryName: string | null;
    /** An absolute image URL, or a path on the customer site for demo dishes. */
    photo: string | null;
    options: Array<{ name: string; required: boolean; choices: Array<{ name: string; priceDelta: number }> }>;
  };
};

/** One dish of a live food business, as its shared link shows it. */
publicShareRoutes.get("/public/food/:restaurantId/items/:itemId", async (c) => {
  const { restaurantId, itemId } = c.req.param();
  const environment = await getPlatformEnvironment();
  const origin = new URL(c.req.url).origin;
  c.header("Cache-Control", "public, max-age=300");

  if (environment === "sandbox" && restaurantId.startsWith("demo-food-")) {
    const restaurant = demoFoodRestaurant(restaurantId);
    const menu = demoFoodMenu(restaurantId);
    const category = menu?.categories.find((cat) => cat.items.some((it) => it.id === itemId));
    const item = [...(menu?.categories.flatMap((cat) => cat.items) ?? []), ...(menu?.uncategorizedItems ?? [])].find((it) => it.id === itemId);
    if (!restaurant || !item) return c.json({ error: "not_found" }, 404);
    const dish: PublicDish = {
      restaurant: { id: restaurant.id, name: restaurant.name, cuisine: restaurant.cuisine ?? null, address: restaurant.address ?? null, businessType: restaurant.business_type ?? null, isOpen: !!restaurant.is_open },
      item: {
        id: item.id, name: item.name, description: item.description ?? null, price: Number(item.price), available: !!item.available,
        prepTimeMinutes: item.prep_time_minutes ?? null, badge: item.badge ?? null, categoryName: category?.name ?? null,
        photo: demoFoodPhotoPath(item.id) ?? null,
        options: (item.options ?? []).map((option) => ({
          name: option.name, required: !!option.required,
          choices: (option.choices ?? []).map((choice) => ({ name: choice.name, priceDelta: Number(choice.price_delta) })),
        })),
      },
    };
    return c.json(dish);
  }

  const row = (await db.execute({
    sql: `SELECT i.*, mc.name AS category_name, r.name AS restaurant_name, r.cuisine, r.address, r.business_type, r.is_open
          FROM menu_items i JOIN restaurants r ON r.id = i.restaurant_id LEFT JOIN menu_categories mc ON mc.id = i.category_id
          WHERE i.id = ? AND i.restaurant_id = ? AND r.status = 'active' AND r.environment = ?`,
    args: [itemId, restaurantId, environment],
  })).rows[0] as Row | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  const options = (await db.execute({ sql: "SELECT * FROM menu_item_options WHERE menu_item_id = ? ORDER BY sort_order", args: [itemId] })).rows as Row[];
  const choices = options.length
    ? (await db.execute({
        sql: `SELECT * FROM menu_item_option_choices WHERE option_id IN (${options.map(() => "?").join(",")}) ORDER BY sort_order`,
        args: options.map((option) => String(option.id)),
      })).rows as Row[]
    : [];
  const dish: PublicDish = {
    restaurant: {
      id: restaurantId, name: String(row.restaurant_name), cuisine: (row.cuisine as string | null) ?? null, address: (row.address as string | null) ?? null,
      businessType: (row.business_type as string | null) ?? null, isOpen: !!row.is_open,
    },
    item: {
      id: itemId, name: String(row.name), description: (row.description as string | null) ?? null, price: Number(row.price), available: !!row.available,
      prepTimeMinutes: row.prep_time_minutes == null ? null : Number(row.prep_time_minutes), badge: (row.badge as string | null) ?? null,
      categoryName: (row.category_name as string | null) ?? null,
      photo: row.photo_key ? `${origin}/v1/public/menu-items/${encodeURIComponent(itemId)}/photo?v=${encodeURIComponent(String(row.updated_at ?? ""))}` : null,
      options: options.map((option) => ({
        name: String(option.name), required: !!option.required,
        choices: choices.filter((choice) => choice.option_id === option.id).map((choice) => ({ name: String(choice.name), priceDelta: Number(choice.price_delta) })),
      })),
    },
  };
  return c.json(dish);
});

/** A live dish's photo, for link previews and the public page (cacheable, no sign-in). */
publicShareRoutes.get("/public/menu-items/:id/photo", async (c) => {
  const id = c.req.param("id");
  const row = (await db.execute({
    sql: `SELECT i.photo_key FROM menu_items i JOIN restaurants r ON r.id = i.restaurant_id
          WHERE i.id = ? AND r.status = 'active' AND r.environment = ?`,
    args: [id, await getPlatformEnvironment()],
  })).rows[0] as Row | undefined;
  if (!row?.photo_key) return c.json({ error: "not_found" }, 404);
  const object = await getR2Bucket().get(String(row.photo_key));
  if (!object) return c.json({ error: "not_found" }, 404);
  return new Response(object.body, {
    headers: { ...uploadResponseHeaders(object.httpMetadata?.contentType, "image/jpeg"), "Cache-Control": "public, max-age=86400" },
  });
});

/** Every live product and dish with its own page, for the customer site's sitemap. */
publicShareRoutes.get("/public/sitemap", async (c) => {
  const environment = await getPlatformEnvironment();
  c.header("Cache-Control", "public, max-age=3600");
  const products = (await db.execute({
    sql: `SELECT p.id, p.updated_at FROM store_products p JOIN stores s ON s.id = p.store_id
          WHERE p.status = 'active' AND s.status = 'active' AND s.environment = ? ORDER BY p.updated_at DESC LIMIT 5000`,
    args: [environment],
  })).rows as Row[];
  const dishes = (await db.execute({
    sql: `SELECT i.id, i.restaurant_id, i.updated_at FROM menu_items i JOIN restaurants r ON r.id = i.restaurant_id
          WHERE i.available = 1 AND r.status = 'active' AND r.environment = ? ORDER BY i.updated_at DESC LIMIT 5000`,
    args: [environment],
  })).rows as Row[];
  return c.json({
    products: products.map((p) => ({ id: String(p.id), updatedAt: (p.updated_at as string | null) ?? null })),
    dishes: dishes.map((d) => ({ id: String(d.id), restaurantId: String(d.restaurant_id), updatedAt: (d.updated_at as string | null) ?? null })),
  });
});
