-- Migration 0125: Taxipress seat bookings.
-- Additive only. Needs 0123 and 0124. The code checks for this table and offers no booking until it exists.
--
-- Every booking carries one linked `orders` row (like a carpool seat), so payment, chat, calls,
-- tracking, ratings and refunds run through the existing order machinery. Seats are counted on the
-- queue entry (taxipress_queue.seats_booked); a booking whose order is cancelled gives them back.

CREATE TABLE IF NOT EXISTS taxipress_bookings (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  queue_id TEXT NOT NULL REFERENCES taxipress_queue(id),
  taxipress_route_id TEXT NOT NULL REFERENCES taxipress_routes(id),
  passenger_id TEXT NOT NULL REFERENCES users(id),
  driver_id TEXT NOT NULL REFERENCES users(id),
  seats INTEGER NOT NULL CHECK (seats > 0),
  fare_per_seat INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  -- app: wallet or mobile money, paid on the order's pay screen. cash: paid to the driver.
  payment_method TEXT NOT NULL CHECK (payment_method IN ('app', 'cash')),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'boarded', 'no_show', 'cancelled', 'completed')),
  -- What the driver checks at boarding (also shown as a QR code).
  ticket_code TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxipress_bookings_queue ON taxipress_bookings (queue_id, status);
CREATE INDEX IF NOT EXISTS idx_taxipress_bookings_passenger ON taxipress_bookings (passenger_id, status);
