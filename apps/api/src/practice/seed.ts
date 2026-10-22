import { DEMO_FOOD_RESTAURANTS, demoFoodMenu } from "@peebee/shared/demo-food";
import { PRACTICE_ENTEBBE, PRACTICE_ENTEBBE_PRODUCTS, PRACTICE_ENTEBBE_STORES, PRACTICE_FOOD_RESTAURANTS, PRACTICE_RIDERS } from "@peebee/shared/practice-entebbe";
import { db, executeBatch, type DbStatement } from "../db/client.js";
import { merchantBusinessStatements } from "../merchants/service.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/** Practice accounts cannot be signed into with a password: a session token is the only way in. */
const NO_PASSWORD = "practice-account-no-password";

export type PracticeCounts = { customers: number; riders: number; merchants: number; stores: number; products: number; restaurants: number; menuItems: number; orders: number };

async function count(table: string, where = "1=1"): Promise<number> {
  const res = await db.execute(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`);
  return Number(res.rows[0]?.n ?? 0);
}

export async function practiceCounts(): Promise<PracticeCounts> {
  const [customers, riders, merchants, stores, products, restaurants, menuItems, orders] = await Promise.all([
    count("users", "id LIKE 'prac_cust_%'"), count("riders"), count("merchants"), count("stores"), count("store_products"),
    count("restaurants"), count("menu_items"), count("orders"),
  ]);
  return { customers, riders, merchants, stores, products, restaurants, menuItems, orders };
}

export async function isPracticeSeeded(): Promise<boolean> {
  return (await count("users", "id = 'prac_cust_amina'")) > 0;
}

const user = (id: string, name: string, phone: string, role: "customer" | "rider", walletUgx: number): DbStatement => ({
  sql: `INSERT OR IGNORE INTO users (id, phone, name, password_hash, role, status, phone_verified_at, wallet_balance, wallet_balance_sandbox, account_code)
        VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), 0, ?, ?)`,
  args: [id, phone, name, NO_PASSWORD, role, walletUgx, `PB-${id.slice(-6).toUpperCase()}`],
});

/**
 * Lays the practice world down in the practice database: customers, riders, merchants with stores and products, and
 * restaurants with menus. Safe to run again: anything already there is left alone. Must be called inside runInPractice.
 */
export async function seedPracticeWorld(): Promise<PracticeCounts> {
  const statements: DbStatement[] = [];

  for (const c of PRACTICE_CUSTOMERS) statements.push(user(c.id, c.name, c.phone, "customer", c.walletUgx));

  PRACTICE_RIDERS.forEach((r, i) => {
    const id = `prac_rider_${i + 1}`;
    statements.push(user(id, r.name, r.phone.replace(/\s/g, ""), "rider", 60_000 + i * 15_000));
    const [first, ...rest] = r.name.split(" ");
    statements.push({
      sql: `INSERT OR IGNORE INTO riders (user_id, verified, is_online, area, vehicle_info, rating, momo_msisdn, first_name, last_name, stage_name, stage_address,
                                           stage_lat, stage_lng, profile_completed_at, wallet_balance_sandbox, rider_code)
            VALUES (?, 1, 1, 'Entebbe', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      args: [id, `Boda boda · ${r.plate}`, 4.6 + (i % 4) / 10, r.phone.replace(/\s/g, ""), first ?? r.name, rest.join(" "), r.stage, `${r.stage}, Entebbe`,
        PRACTICE_ENTEBBE.lat + (i - 3) * 0.004, PRACTICE_ENTEBBE.lng + ((i * 7) % 5 - 2) * 0.004, 60_000 + i * 15_000, `RDR-${String(1000 + i)}`],
    });
  });

  // One category for every practice business; the live categories belong to the live database.
  statements.push({ sql: "INSERT OR IGNORE INTO merchant_categories (id, slug, name) VALUES ('prac_cat_general', 'practice-general', 'Practice shops')", args: [] });

  PRACTICE_ENTEBBE_STORES.filter((s) => s.category !== "pharmacy").forEach((s, i) => {
    const ownerId = `prac_mu_${s.id}`;
    statements.push(user(ownerId, `${s.name} owner`, `07911${String(10000 + i)}`, "customer", 0));
    const business = merchantBusinessStatements({
      ownerId, legalName: `${s.name} Ltd`, displayName: s.name, businessKind: "business", categoryId: "prac_cat_general", outletName: s.name,
      phone: s.phone, address: s.address, lat: s.lat, lng: s.lng, environment: "sandbox", merchantId: `prac_m_${s.id}`, outletId: `prac_out_${i + 1}`,
    });
    // The helper inserts plainly; make each insert idempotent so the seed can run twice.
    for (const st of business.statements) statements.push({ ...st, sql: st.sql.replace(/^INSERT INTO/, "INSERT OR IGNORE INTO") });
    statements.push({ sql: "UPDATE merchants SET status='active', trust_tier='standard', approved_at=datetime('now'), merchant_code=? WHERE id=?", args: [`MER-PRAC${i + 1}`, `prac_m_${s.id}`] });
    statements.push({
      sql: `INSERT OR IGNORE INTO stores (id, merchant_id, outlet_id, name, slug, category, sub_category, description, announcement, logo_url, banner_url, phone, whatsapp_number,
                                          address, lat, lng, is_open, delivery_enabled, pickup_enabled, min_order_amount, pro_tier, is_live, live_channel_title, live_stream_url,
                                          live_viewer_count, status, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, 'active', 'sandbox')`,
      args: [s.id, `prac_m_${s.id}`, `prac_out_${i + 1}`, s.name, s.slug, s.category, s.sub_category ?? null, s.description, s.announcement ?? null, s.logo_url, s.banner_url, s.phone,
        s.whatsapp_number, s.address, s.lat ?? PRACTICE_ENTEBBE.lat, s.lng ?? PRACTICE_ENTEBBE.lng, s.is_open, s.min_order_amount, s.pro_tier, s.is_live, s.live_channel_title,
        s.live_stream_url, s.live_viewer_count],
    });
    (PRACTICE_ENTEBBE_PRODUCTS[s.id] ?? []).forEach((p, n) => statements.push({
      sql: `INSERT OR IGNORE INTO store_products (id, store_id, title, slug, description, price, compare_at_price, inventory_quantity, category_name, badge, image_url, status, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      args: [p.id, s.id, p.title, p.slug, p.description, p.price, p.compare_at_price ?? null, p.inventory_quantity, p.category_name, p.badge ?? null, p.image_url, n],
    }));
  });

  PRACTICE_FOOD_RESTAURANTS.forEach((r, i) => {
    const slug = r.id.replace("demo-food-", "");
    const id = `prac_rest_${slug}`;
    const ownerId = `prac_ro_${slug}`;
    statements.push(user(ownerId, `${r.name} owner`, `07912${String(10000 + i)}`, "customer", 0));
    const business = merchantBusinessStatements({
      ownerId, legalName: `${r.name} Ltd`, displayName: r.name, businessKind: "business", categoryId: "prac_cat_general", outletName: r.name,
      phone: r.phone ?? undefined, address: r.address ?? undefined, lat: r.lat ?? undefined, lng: r.lng ?? undefined, environment: "sandbox",
      merchantId: `prac_m_${slug}`, outletId: `prac_outr_${i + 1}`,
    });
    for (const st of business.statements) statements.push({ ...st, sql: st.sql.replace(/^INSERT INTO/, "INSERT OR IGNORE INTO") });
    statements.push({ sql: "UPDATE merchants SET status='active', trust_tier='standard', approved_at=datetime('now'), merchant_code=? WHERE id=?", args: [`MER-PRFD${i + 1}`, `prac_m_${slug}`] });
    statements.push({
      sql: `INSERT OR IGNORE INTO restaurants (id, owner_id, name, description, cuisine, phone, address, lat, lng, status, is_open, environment, merchant_id, outlet_id, business_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 'sandbox', ?, ?, ?)`,
      args: [id, ownerId, r.name, r.description, r.cuisine, r.phone, r.address, r.lat, r.lng, r.is_open, `prac_m_${slug}`, `prac_outr_${i + 1}`, r.business_type ?? "restaurant"],
    });
    const menu = demoFoodMenu(r.id);
    const rename = (value: string) => value.replace(/^demo-food-/, "prac_rest_");
    for (const category of menu?.categories ?? []) {
      statements.push({ sql: "INSERT OR IGNORE INTO menu_categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)", args: [rename(category.id), id, category.name, category.sort_order] });
      for (const item of category.items) {
        statements.push({
          sql: `INSERT OR IGNORE INTO menu_items (id, restaurant_id, category_id, name, description, price, photo_key, available, prep_time_minutes, sort_order, badge, is_featured)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          args: [rename(item.id), id, rename(category.id), item.name, item.description, item.price, item.photo_key, item.prep_time_minutes, item.sort_order, item.badge ?? null, item.is_featured ?? 0],
        });
        for (const option of item.options ?? []) {
          statements.push({ sql: "INSERT OR IGNORE INTO menu_item_options (id, menu_item_id, name, required, multi_select, sort_order) VALUES (?, ?, ?, ?, ?, ?)", args: [rename(option.id), rename(item.id), option.name, option.required, option.multi_select, option.sort_order] });
          for (const choice of option.choices) {
            statements.push({ sql: "INSERT OR IGNORE INTO menu_item_option_choices (id, option_id, name, price_delta, sort_order) VALUES (?, ?, ?, ?, ?)", args: [rename(choice.id), rename(option.id), choice.name, choice.price_delta, choice.sort_order] });
          }
        }
      }
    }
  });

  // D1 caps a batch; send it in slices so a seed of a few thousand statements never trips it.
  for (let i = 0; i < statements.length; i += 80) await executeBatch(statements.slice(i, i + 80));
  return practiceCounts();
}

/** Wipes the practice database back to empty (tables stay). Practice only: callers run it inside runInPractice. */
export async function resetPracticeWorld(): Promise<void> {
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'");
  const statements: DbStatement[] = [{ sql: "PRAGMA defer_foreign_keys = ON", args: [] }, ...tables.rows.map((t) => ({ sql: `DELETE FROM "${String(t.name)}"`, args: [] }))];
  // One batch, so the deferred foreign-key check covers the whole wipe.
  await executeBatch(statements);
}
