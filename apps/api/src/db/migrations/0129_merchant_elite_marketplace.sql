-- Merchant Elite (Shopify / Shopify Plus level) — Phase 1: Tiers, Custom Storefront Themes, Smart Collections, Promo & Discount Engine, Multi-Outlet Inventory & B2B Draft Orders
-- Applied by hand to live D1. Code uses hasColumn() / hasTable() to fall back gracefully until applied.

INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_price_ugx', '150000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_commission_percent', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_max_products', '50');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_max_products', '5000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_max_collections', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_max_collections', '100');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_max_discounts', '2');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_max_discounts', '200');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_b2b_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_multi_outlet_inventory_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_custom_domain_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_loyalty_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_max_loyalty_cashback_percent', '15');

-- Extend stores with Elite tier & Shopify Online Store 2.0 customization columns
ALTER TABLE stores ADD COLUMN elite_tier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN elite_expires_at TEXT;
ALTER TABLE stores ADD COLUMN custom_domain TEXT;
ALTER TABLE stores ADD COLUMN theme_layout TEXT NOT NULL DEFAULT 'grid';
ALTER TABLE stores ADD COLUMN theme_accent TEXT NOT NULL DEFAULT 'gold';
ALTER TABLE stores ADD COLUMN hero_headline TEXT;
ALTER TABLE stores ADD COLUMN hero_subheadline TEXT;
ALTER TABLE stores ADD COLUMN hero_cta_text TEXT;
ALTER TABLE stores ADD COLUMN seo_title TEXT;
ALTER TABLE stores ADD COLUMN seo_description TEXT;
ALTER TABLE stores ADD COLUMN meta_pixel_id TEXT;
ALTER TABLE stores ADD COLUMN tiktok_pixel_id TEXT;
ALTER TABLE stores ADD COLUMN loyalty_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN loyalty_cashback_percent REAL NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN b2b_wholesale_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN b2b_min_order_amount INTEGER NOT NULL DEFAULT 100000;

-- Smart & Manual Collections (Shopify Online Store 2.0 Merchandising)
CREATE TABLE IF NOT EXISTS store_collections (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'smart')),
  rule_field TEXT CHECK (rule_field IS NULL OR rule_field IN ('category', 'price_lte', 'price_gte', 'badge', 'in_stock')),
  rule_value TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_collections_store ON store_collections(store_id, status, sort_order);

-- Promotions, Coupon Codes & Automatic Discounts Engine
CREATE TABLE IF NOT EXISTS store_discounts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent', 'fixed', 'free_delivery', 'bogo')),
  value INTEGER NOT NULL DEFAULT 0,
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_automatic INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_discounts_store ON store_discounts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_discounts_code ON store_discounts(store_id, code);

-- Multi-Outlet Inventory Matrix (Track stock per physical merchant_outlet branch)
CREATE TABLE IF NOT EXISTS store_outlet_inventory (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  outlet_id TEXT NOT NULL REFERENCES merchant_outlets(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_store_outlet_inventory_store ON store_outlet_inventory(store_id, outlet_id);

-- B2B Wholesale & Draft Orders / 1-Tap Payment Links
CREATE TABLE IF NOT EXISTS store_draft_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_company TEXT,
  items_json TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_terms TEXT NOT NULL DEFAULT 'immediate' CHECK (payment_terms IN ('immediate', 'net_7', 'net_14', 'net_30')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sent', 'paid', 'canceled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_draft_orders_store ON store_draft_orders(store_id, status);
