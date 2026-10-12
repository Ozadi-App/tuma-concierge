-- Marketplace Engine: Stores, Products, Variants, Live Commerce, and Pro Subscriptions
-- Powers Groceries and Stores. All fees, thresholds, and prices are admin-controlled in `settings`.

INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_live_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_commission_percent', '10');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_store_price_ugx', '35000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_live_price_ugx', '75000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_pro_trial_days', '14');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_ad_min_budget_ugx', '10000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_ad_fee_percent', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_min_order_amount', '5000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_live_max_duration_mins', '180');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_delivery_base_fee', '3000');

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  outlet_id TEXT REFERENCES merchant_outlets(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('groceries', 'stores')),
  sub_category TEXT,
  description TEXT,
  announcement TEXT,
  logo_url TEXT,
  banner_url TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  is_open INTEGER NOT NULL DEFAULT 1,
  delivery_enabled INTEGER NOT NULL DEFAULT 1,
  pickup_enabled INTEGER NOT NULL DEFAULT 1,
  min_order_amount INTEGER NOT NULL DEFAULT 5000,
  pro_tier TEXT NOT NULL DEFAULT 'free' CHECK (pro_tier IN ('free', 'pro_store', 'pro_live')),
  pro_expires_at TEXT,
  is_live INTEGER NOT NULL DEFAULT 0,
  live_channel_title TEXT,
  live_stream_url TEXT,
  live_started_at TEXT,
  live_viewer_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'suspended')),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stores_category_status ON stores(category, status, environment);
CREATE INDEX IF NOT EXISTS idx_stores_merchant ON stores(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_is_live ON stores(is_live, status);

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  cost_price INTEGER,
  sku TEXT,
  barcode TEXT,
  track_inventory INTEGER NOT NULL DEFAULT 1,
  inventory_quantity INTEGER NOT NULL DEFAULT 100,
  category_name TEXT,
  badge TEXT,
  image_url TEXT,
  video_url TEXT,
  has_variants INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_products_store ON store_products(store_id, status);

CREATE TABLE IF NOT EXISTS store_product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  option1_name TEXT,
  option1_value TEXT,
  option2_name TEXT,
  option2_value TEXT,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  sku TEXT,
  inventory_quantity INTEGER NOT NULL DEFAULT 100,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_product_variants_product ON store_product_variants(product_id);

CREATE TABLE IF NOT EXISTS store_live_sessions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended', 'replay')),
  stream_url TEXT,
  replay_url TEXT,
  thumbnail_url TEXT,
  featured_product_ids TEXT,
  viewer_peak INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  is_restream INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_live_sessions_store ON store_live_sessions(store_id, status);

CREATE TABLE IF NOT EXISTS store_live_chats (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES store_live_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_merchant INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_live_chats_session ON store_live_chats(session_id, created_at);

CREATE TABLE IF NOT EXISTS store_ad_campaigns (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  product_id TEXT REFERENCES store_products(id),
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'meta', 'instagram', 'tiktok')),
  headline TEXT NOT NULL,
  budget_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
  target_audience TEXT,
  ad_link TEXT,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_ad_campaigns_store ON store_ad_campaigns(store_id, status);

CREATE TABLE IF NOT EXISTS store_subscriptions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  tier TEXT NOT NULL CHECK (tier IN ('pro_store', 'pro_live')),
  amount_paid INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'canceled')),
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_store ON store_subscriptions(store_id, status);
