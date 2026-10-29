-- Migration 0147: customer offers, rider incentives, the rider discount wallet and customer wallet credit.
-- Additive only (new tables, new columns with defaults). Apply by hand to the live D1 database; the deploy does not run it.
-- The code works without it: every feature checks for these tables and columns and stays off until they exist.

-- ---------------------------------------------------------------------------
-- Customer offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code TEXT,
  kind TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'flat')),
  value INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER NOT NULL DEFAULT 0,
  min_fare INTEGER NOT NULL DEFAULT 0,
  services TEXT NOT NULL DEFAULT '[]',
  funder TEXT NOT NULL DEFAULT 'platform' CHECK (funder IN ('platform', 'rider')),
  auto_apply INTEGER NOT NULL DEFAULT 1,
  stackable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),
  starts_at TEXT,
  ends_at TEXT,
  usage_limit_total INTEGER NOT NULL DEFAULT 0,
  usage_limit_per_user INTEGER NOT NULL DEFAULT 0,
  budget_total INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  conditions TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_code ON offers (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers (status);

-- One row per offer used on an order. "pending" until the order is paid, "applied" once it is, "settled" when the ride
-- completes, "void" if the order was cancelled or the payment failed. Usage counts and budget spent are derived from these.
CREATE TABLE IF NOT EXISTS offer_redemptions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  full_fare INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  cashback INTEGER NOT NULL DEFAULT 0,
  funder TEXT NOT NULL DEFAULT 'platform',
  rider_compensation INTEGER NOT NULL DEFAULT 0,
  used_grant INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'settled', 'void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, offer_id)
);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer ON offer_redemptions (offer_id, status);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_user ON offer_redemptions (user_id, offer_id);

-- Ride packs and vouchers a customer holds (bought, granted by admin, or earned through a referral).
CREATE TABLE IF NOT EXISTS offer_grants (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  user_id TEXT NOT NULL,
  uses_left INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'admin',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offer_grants_user ON offer_grants (user_id, offer_id);

-- What offers need to know about a customer beyond their ride history.
CREATE TABLE IF NOT EXISTS customer_offer_profiles (
  user_id TEXT PRIMARY KEY,
  groups TEXT NOT NULL DEFAULT '[]',
  loyalty_tier_override TEXT,
  birthday TEXT,
  referred_by TEXT,
  referral_code TEXT,
  referral_rewarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_offer_profiles_code ON customer_offer_profiles (referral_code) WHERE referral_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rider discount wallet
-- ---------------------------------------------------------------------------
ALTER TABLE riders ADD COLUMN discount_wallet_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE riders ADD COLUMN discount_wallet_balance_sandbox INTEGER NOT NULL DEFAULT 0;
-- Car drivers and owners keep their wallet on users, so their discount wallet lives there too.
ALTER TABLE users ADD COLUMN discount_wallet_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN discount_wallet_balance_sandbox INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rider_discount_ledger (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('accrual', 'commission_offset', 'payout', 'expiry', 'adjustment')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  order_id TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rider_discount_ledger_rider ON rider_discount_ledger (rider_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_discount_ledger_order ON rider_discount_ledger (rider_id, order_id, type) WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rider_discount_requests (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Rider incentives
-- ---------------------------------------------------------------------------
-- period_key makes an award idempotent: 'order:<id>', 'day:2026-10-29', 'week:2026-W44', 'month:2026-10', 'milestone:100', ...
CREATE TABLE IF NOT EXISTS rider_incentive_awards (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  period_key TEXT NOT NULL,
  order_id TEXT,
  note TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'void')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (rider_id, kind, period_key)
);
CREATE INDEX IF NOT EXISTS idx_rider_incentive_awards_month ON rider_incentive_awards (environment, created_at);

-- Time a rider or driver spends online, for the online-hours bonus.
CREATE TABLE IF NOT EXISTS rider_online_sessions (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rider_online_sessions_rider ON rider_online_sessions (rider_id, started_at);

-- How far the rider travelled to reach the pickup, recorded from their first location ping (long-pickup compensation).
ALTER TABLE orders ADD COLUMN pickup_distance_km REAL;

-- ---------------------------------------------------------------------------
-- Customer wallet credit (bonus money that stays on the platform)
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN credit_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN credit_balance_sandbox INTEGER NOT NULL DEFAULT 0;

-- Each grant of credit is a lot, so spending can take the soonest-to-expire first and an expiry sweep knows what is left.
CREATE TABLE IF NOT EXISTS credit_lots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  source TEXT NOT NULL,
  partner_id TEXT,
  campaign TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_lots_user ON credit_lots (user_id, environment, expires_at);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bonus', 'fee_cover', 'cashback', 'offer', 'admin', 'spend', 'refund', 'expiry', 'clawback')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  lot_id TEXT,
  order_id TEXT,
  topup_id TEXT,
  note TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger (user_id, created_at);
