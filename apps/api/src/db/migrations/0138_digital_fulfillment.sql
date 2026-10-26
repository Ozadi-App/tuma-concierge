-- Migration 0136: digital product fulfilment.
-- Apply by hand. Each statement is independent; "duplicate column name" means it was already applied.
-- Code that needs these checks for them first, so nothing breaks before this lands: digital purchase stays off.

-- Licence keys, one row each: a key is issued to exactly one purchase and never handed out twice.
CREATE TABLE IF NOT EXISTS store_license_keys (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES store_digital_products(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'void')),
  fulfillment_id TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, license_key)
);
CREATE INDEX IF NOT EXISTS idx_store_license_keys_pool ON store_license_keys(product_id, status, created_at);

-- A file kept in private storage (the merchant's upload), as opposed to an address on their own site.
ALTER TABLE store_digital_products ADD COLUMN file_key TEXT DEFAULT NULL;

-- Who bought, what they paid, and the state of the sale. The access token itself is stored only as a hash.
ALTER TABLE store_digital_fulfillments ADD COLUMN buyer_user_id TEXT DEFAULT NULL;
ALTER TABLE store_digital_fulfillments ADD COLUMN price_paid_ugx INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_digital_fulfillments ADD COLUMN commission_ugx INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_digital_fulfillments ADD COLUMN token_hint TEXT DEFAULT NULL;
ALTER TABLE store_digital_fulfillments ADD COLUMN refunded_at TEXT DEFAULT NULL;
ALTER TABLE store_digital_fulfillments ADD COLUMN sms_status TEXT DEFAULT NULL;
ALTER TABLE store_digital_fulfillments ADD COLUMN needs_manual_fulfilment INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_store_digital_fulfillments_buyer ON store_digital_fulfillments(buyer_user_id, digital_product_id);
