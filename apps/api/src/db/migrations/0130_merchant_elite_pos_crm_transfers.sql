-- Merchant Elite Phase 3: Omnichannel POS Register, Branch-to-Branch Stock Transfers & VIP Customer CRM / Loyalty Ledger
-- Applied by hand to live D1. Code uses hasTable() to fall back gracefully until applied.

INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_pos_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_stock_transfers_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketplace_elite_crm_enabled', '1');

-- 1. Omnichannel In-Store POS Sales (auto-deducts branch & product stock)
CREATE TABLE IF NOT EXISTS store_pos_sales (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  outlet_id TEXT REFERENCES merchant_outlets(id) ON DELETE SET NULL,
  cashier_user_id TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  items_json TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  loyalty_redeemed_ugx INTEGER NOT NULL DEFAULT 0,
  loyalty_earned_ugx INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'peebee_code' CHECK (payment_method IN ('peebee_code', 'momo', 'cash')),
  receipt_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_pos_sales_store ON store_pos_sales(store_id, created_at DESC);

-- 2. Branch-to-Branch Stock Transfers
CREATE TABLE IF NOT EXISTS store_stock_transfers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  from_outlet_id TEXT NOT NULL REFERENCES merchant_outlets(id) ON DELETE CASCADE,
  to_outlet_id TEXT NOT NULL REFERENCES merchant_outlets(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_stock_transfers_store ON store_stock_transfers(store_id, created_at DESC);

-- 3. VIP Customer CRM & Store Loyalty Cashback Balances
CREATE TABLE IF NOT EXISTS store_customer_loyalty (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  points_balance_ugx INTEGER NOT NULL DEFAULT 0,
  total_earned_ugx INTEGER NOT NULL DEFAULT 0,
  total_redeemed_ugx INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 1,
  total_spent_ugx INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard', 'repeat', 'vip', 'b2b')),
  last_order_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_store_customer_loyalty_store ON store_customer_loyalty(store_id, total_spent_ugx DESC);
