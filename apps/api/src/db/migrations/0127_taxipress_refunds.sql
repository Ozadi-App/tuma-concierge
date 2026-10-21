-- Migration 0127: Taxipress cancellations, no-shows and refunds.
-- Additive only. Needs 0125. The code checks for this table and offers no cancellation until it exists.
--
-- One row per booking that ended without boarding, recording what the passenger got back and any fee kept.
-- booking_id is unique, so an outcome can never be paid twice.

CREATE TABLE IF NOT EXISTS taxipress_refunds (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES taxipress_bookings(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  passenger_id TEXT NOT NULL REFERENCES users(id),
  driver_id TEXT REFERENCES users(id),
  -- cancelled: the passenger cancelled. no_show: they did not board. taxi_removed: the taxi left the line and no other taxi had room.
  kind TEXT NOT NULL CHECK (kind IN ('cancelled', 'no_show', 'taxi_removed')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('app', 'cash')),
  -- What escrow held for the booking, what went back to the passenger's wallet, and the fee kept.
  collected INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  fee INTEGER NOT NULL DEFAULT 0,
  -- Who receives the fee: the driver (credited to their wallet) or Peebee.
  fee_to TEXT NOT NULL DEFAULT 'driver' CHECK (fee_to IN ('driver', 'peebee')),
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxipress_refunds_created ON taxipress_refunds (created_at);
CREATE INDEX IF NOT EXISTS idx_taxipress_refunds_passenger ON taxipress_refunds (passenger_id, created_at);
