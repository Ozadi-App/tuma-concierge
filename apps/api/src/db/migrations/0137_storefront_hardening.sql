-- Migration 0135: web storefront hardening.
-- Apply by hand (the deploy does not run migrations). Each statement is independent; if one reports "duplicate column
-- name" it was already applied and can be skipped. Code that uses these columns checks for them first (hasColumn), so
-- it keeps working until this lands: custom domains stay off, promo codes stay private, loyalty credits at order time.

-- Custom domains: a store only answers on a domain it has proven it controls (DNS TXT record).
ALTER TABLE stores ADD COLUMN domain_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN domain_verify_token TEXT DEFAULT NULL;
-- One store per domain. Before applying, make sure no two stores share a custom_domain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain) WHERE custom_domain IS NOT NULL AND custom_domain != '';

-- A promo code the merchant chooses to list publicly on the web store (automatic offers are always listed).
ALTER TABLE store_discounts ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

-- Loyalty cashback is recorded when the order is placed and credited when the admin-chosen event happens.
CREATE TABLE IF NOT EXISTS store_loyalty_events (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  earned_ugx INTEGER NOT NULL DEFAULT 0,
  spent_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  credited_at TEXT,
  UNIQUE(order_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_loyalty_events_pending ON store_loyalty_events(status, order_id);
