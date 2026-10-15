-- Migration 0096: Peebee Gas security hardening.
-- APPLY BY HAND BEFORE DEPLOYING the matching code: fuel vouchers are now
-- backed by a wallet hold, and the API refuses to create or redeem vouchers
-- until these columns exist.

-- Vouchers: record whether the rider's wallet was charged, and in which
-- environment, so unused value can be refunded to the right wallet.
ALTER TABLE fuel_codes ADD COLUMN held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fuel_codes ADD COLUMN environment TEXT NOT NULL DEFAULT 'live';

-- Every voucher issued before this change was never paid for. Close them so
-- none can be redeemed for free fuel (or refunded money that was never held).
UPDATE fuel_codes SET status = 'cancelled' WHERE status = 'active';

-- One live voucher per rider at a time; stops a double tap holding funds twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_codes_one_active_per_rider
  ON fuel_codes(rider_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_fuel_codes_status_expiry ON fuel_codes(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_outlet_created ON fuel_dispenses(outlet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fuel_withdrawals_outlet_status ON fuel_station_withdrawals(outlet_id, status);

-- The old code seeded every manager/attendant with the PIN 1234. Those
-- accounts can no longer sign in until an admin or station manager sets a
-- real PIN (PINs are now stored hashed).
UPDATE fuel_station_managers SET pin = '' WHERE pin = '1234' OR pin NOT LIKE '$2%';
UPDATE fuel_pump_attendants SET pin = NULL WHERE pin IS NULL OR pin = '1234' OR pin NOT LIKE '$2%';

-- Withdrawals are requests an admin pays out, not instant transfers.
ALTER TABLE fuel_station_withdrawals ADD COLUMN processed_by TEXT;
ALTER TABLE fuel_station_withdrawals ADD COLUMN processed_at TEXT;
ALTER TABLE fuel_station_withdrawals ADD COLUMN provider_ref TEXT;
ALTER TABLE fuel_station_withdrawals ADD COLUMN failure_reason TEXT;
-- Withdrawals the old code marked 'completed' without paying anything out stay as
-- recorded; nothing is rewritten here.
