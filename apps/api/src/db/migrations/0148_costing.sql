-- Migration 0148: the costing mechanism — how each fare was built, who got what from each payment, and customer withdrawals.
-- Additive only (new tables, new columns with defaults). Apply by hand to the live D1 database; the deploy does not run it.
-- The code works without it: fare breakdowns and payment splits are simply not recorded, and customer withdrawals answer
-- 503 migration_pending, until it is applied.

-- How the fare was built (distance bands, multipliers, fees), kept with the order so a later settings change cannot rewrite it.
ALTER TABLE orders ADD COLUMN fare_breakdown TEXT;

-- One row per settled order: where the customer's money went.
CREATE TABLE IF NOT EXISTS payment_splits (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  rail TEXT NOT NULL,
  provider TEXT,
  network TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  gross INTEGER NOT NULL DEFAULT 0,
  customer_pays INTEGER NOT NULL DEFAULT 0,
  collected INTEGER NOT NULL DEFAULT 0,
  gateway_fee INTEGER NOT NULL DEFAULT 0,
  gateway_fee_rule TEXT,
  tax_total INTEGER NOT NULL DEFAULT 0,
  taxes TEXT NOT NULL DEFAULT '[]',
  commission INTEGER NOT NULL DEFAULT 0,
  commission_relief INTEGER NOT NULL DEFAULT 0,
  extra_commission INTEGER NOT NULL DEFAULT 0,
  maintenance INTEGER NOT NULL DEFAULT 0,
  provider_share INTEGER NOT NULL DEFAULT 0,
  platform_net INTEGER NOT NULL DEFAULT 0,
  promo_cost INTEGER NOT NULL DEFAULT 0,
  service_fee INTEGER NOT NULL DEFAULT 0,
  processing_fee_customer INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_splits_created ON payment_splits (environment, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_splits_module ON payment_splits (module, created_at);

-- A wallet top-up: what the gateway took, what Peebee covered as credit, and the deposit bonus.
ALTER TABLE wallet_topups ADD COLUMN gateway_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wallet_topups ADD COLUMN tax_on_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wallet_topups ADD COLUMN fee_cover INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wallet_topups ADD COLUMN cash_credited INTEGER;

-- A customer cashing out their deposited cash (only when an admin turns withdrawals on).
CREATE TABLE IF NOT EXISTS customer_withdrawals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  provider_ref TEXT,
  msisdn TEXT NOT NULL,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('review', 'pending', 'successful', 'failed', 'rejected')),
  review_reason TEXT,
  reviewed_by TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_withdrawals_user ON customer_withdrawals (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_withdrawals_status ON customer_withdrawals (status, created_at);
