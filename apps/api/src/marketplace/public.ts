import { db } from "../db/client.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { hasColumn } from "../lib/schema.js";

type Row = Record<string, unknown>;

/**
 * Structural rail: anything an anonymous caller can read is an allow-list, never `SELECT *`.
 * A new `stores` column stays private until it is added here on purpose.
 */
const PUBLIC_STORE_FIELDS = [
  "id", "name", "slug", "category", "sub_category", "description", "announcement", "logo_url", "banner_url",
  "phone", "whatsapp_number", "address", "lat", "lng", "is_open", "delivery_enabled", "pickup_enabled",
  "min_order_amount", "pro_tier", "is_live", "live_channel_title", "live_stream_url", "live_started_at",
  "live_viewer_count", "elite_tier", "custom_domain", "theme_layout", "theme_accent", "hero_headline",
  "hero_subheadline", "hero_cta_text", "seo_title", "seo_description", "loyalty_enabled",
  "loyalty_cashback_percent", "b2b_wholesale_enabled", "b2b_min_order_amount",
  // computed by the route
  "distance_km", "subdomain_url", "marketplace_url",
] as const;

export function toPublicStore(row: Row): Row {
  const out: Row = {};
  for (const key of PUBLIC_STORE_FIELDS) if (key in row) out[key] = row[key];
  return out;
}

/** Public product fields: no cost price, no internal barcode. */
const PUBLIC_PRODUCT_FIELDS = [
  "id", "store_id", "title", "slug", "description", "price", "compare_at_price", "category_name", "badge",
  "image_url", "video_url", "has_variants", "inventory_quantity", "track_inventory", "sort_order", "status", "variants",
] as const;

export function toPublicProduct(row: Row): Row {
  const out: Row = {};
  for (const key of PUBLIC_PRODUCT_FIELDS) if (key in row) out[key] = row[key];
  return out;
}

/**
 * The one way a public route turns a URL segment into a store.
 * Only live stores in the platform's current environment resolve; an id or slug always beats a custom domain, so a
 * merchant cannot capture another store's address by choosing it as a domain.
 */
export async function findPublicStore(idOrSlug: string): Promise<Row | null> {
  const environment = await getPlatformEnvironment();
  const exact = await db.execute({
    sql: "SELECT * FROM stores WHERE (id = ? OR slug = ?) AND status = 'active' AND environment = ? ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END LIMIT 1",
    args: [idOrSlug, idOrSlug, environment, idOrSlug],
  });
  if (exact.rows[0]) return exact.rows[0] as Row;
  if (await hasColumn("stores", "custom_domain")) {
    const byDomain = await db.execute({
      sql: "SELECT * FROM stores WHERE LOWER(custom_domain) = LOWER(?) AND status = 'active' AND environment = ? LIMIT 1",
      args: [idOrSlug, environment],
    });
    if (byDomain.rows[0]) return byDomain.rows[0] as Row;
  }
  return null;
}
