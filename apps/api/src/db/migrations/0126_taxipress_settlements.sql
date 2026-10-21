-- Migration 0126: Taxipress boarding settlements.
-- Additive only. Needs 0125. The code checks for this table and offers no boarding confirmation until it exists.
--
-- One row per seat booking, written the moment the driver confirms the passenger's ticket at boarding.
-- It records what the fare was, Peebee's commission, and what the driver was paid or owes, so every
-- shilling is traceable and a retry can never pay twice (booking_id is unique).

CREATE TABLE IF NOT EXISTS taxipress_settlements (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES taxipress_bookings(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  queue_id TEXT NOT NULL REFERENCES taxipress_queue(id),
  driver_id TEXT NOT NULL REFERENCES users(id),
  passenger_id TEXT NOT NULL REFERENCES users(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('app', 'cash')),
  seats INTEGER NOT NULL,
  -- What the passenger's seats cost.
  fare INTEGER NOT NULL,
  -- Peebee's Taxipress commission on the fare, and the commission rule it came from.
  commission INTEGER NOT NULL DEFAULT 0,
  commission_rule TEXT NOT NULL DEFAULT 'percent',
  -- Fees the platform's general fee settings (Monetization) took on top, if any.
  platform_fees INTEGER NOT NULL DEFAULT 0,
  -- App payment: credited to the driver's wallet. Cash: what the driver keeps of the cash they collected.
  driver_amount INTEGER NOT NULL DEFAULT 0,
  -- Cash only: taken from the driver's wallet (it may go below zero).
  taken_from_driver INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxipress_settlements_driver ON taxipress_settlements (driver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_taxipress_settlements_created ON taxipress_settlements (created_at);
