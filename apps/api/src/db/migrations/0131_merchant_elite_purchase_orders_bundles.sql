-- Merchant Elite Phase 4: Supplier Purchase Orders & Stock Receiving, Product Bundles & Win-Back Automation
-- Applied by hand to live D1. Code uses hasTable() to fall back gracefully until applied.

INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_purchase_orders_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_bundles_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_winback_enabled', '1');

-- 1. Suppliers Directory
CREATE TABLE IF NOT EXISTS store_suppliers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_suppliers_store ON store_suppliers(store_id, name);

-- 2. Purchase Orders (POs) & Stock Receiving
CREATE TABLE IF NOT EXISTS store_purchase_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id TEXT REFERENCES store_suppliers(id) ON DELETE SET NULL,
  outlet_id TEXT REFERENCES merchant_outlets(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_cost_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  ordered_at TEXT,
  received_at TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_purchase_orders_store ON store_purchase_orders(store_id, created_at DESC);

-- 3. Product Bundles & Kits (auto-deducts component stock)
CREATE TABLE IF NOT EXISTS store_bundles (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  compare_at_price INTEGER,
  items_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_bundles_store ON store_bundles(store_id, created_at DESC);

-- 4. Customer Win-Back & Abandoned Cart Recovery Log
CREATE TABLE IF NOT EXISTS store_winback_campaigns (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  discount_code TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'push')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'converted')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_winback_campaigns_store ON store_winback_campaigns(store_id, sent_at DESC);
