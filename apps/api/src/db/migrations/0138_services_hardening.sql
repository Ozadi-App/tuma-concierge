-- Migration 0138: services bookings you can rely on — opening hours, real slots, payments, cancellations.
-- Apply by hand. Each statement is independent; "duplicate column name" means it was already applied.
-- Needs 0134. Code that uses these checks for them first, so bookings keep working (as requests) until this lands.

-- When a business takes bookings. A weekday has one or more open windows.
CREATE TABLE IF NOT EXISTS service_hours (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES service_businesses(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday, East Africa Time
  open_time TEXT NOT NULL,  -- HH:mm
  close_time TEXT NOT NULL, -- HH:mm
  UNIQUE (business_id, weekday, open_time)
);
CREATE INDEX IF NOT EXISTS idx_service_hours_business ON service_hours(business_id, weekday);

-- Days the business is closed (holidays, leave).
CREATE TABLE IF NOT EXISTS service_blackouts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES service_businesses(id) ON DELETE CASCADE,
  blackout_date TEXT NOT NULL, -- YYYY-MM-DD
  reason TEXT DEFAULT '',
  UNIQUE (business_id, blackout_date)
);

-- Every movement of money for a booking: a customer's deposit or full payment, the balance paid at the venue,
-- a refund, a waiver. Online payments carry the mobile-money reference; "paid" is only ever set from a row here.
CREATE TABLE IF NOT EXISTS service_payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES service_businesses(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'full', 'venue', 'refund', 'waiver')),
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx >= 0),
  rail TEXT NOT NULL,
  provider TEXT,
  provider_ref TEXT,
  msisdn TEXT,
  redirect_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  released INTEGER NOT NULL DEFAULT 0,
  refund_of TEXT, -- for a refund row: the payment it returns
  environment TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_payments_booking ON service_payments(booking_id, kind);

-- Bookings: a code the customer keeps, the exact time, the seat taken, and what happened when it ended.
ALTER TABLE service_bookings ADD COLUMN booking_code TEXT DEFAULT NULL;
ALTER TABLE service_bookings ADD COLUMN starts_at INTEGER DEFAULT NULL; -- epoch ms
ALTER TABLE service_bookings ADD COLUMN slot_seat INTEGER DEFAULT NULL;
ALTER TABLE service_bookings ADD COLUMN paid_ugx INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_bookings ADD COLUMN cancelled_at TEXT DEFAULT NULL;
ALTER TABLE service_bookings ADD COLUMN cancelled_by TEXT DEFAULT NULL; -- customer | provider
ALTER TABLE service_bookings ADD COLUMN refund_ugx INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_bookings ADD COLUMN refund_state TEXT DEFAULT NULL; -- none | review | refunded | kept
ALTER TABLE service_bookings ADD COLUMN customer_sms_status TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_bookings_code ON service_bookings(booking_code) WHERE booking_code IS NOT NULL;
-- One person per seat per time. A seat is a place in the schedule (one per team member, or one if there is no team).
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_bookings_seat ON service_bookings(business_id, starts_at, slot_seat)
  WHERE slot_seat IS NOT NULL AND status IN ('pending', 'confirmed', 'in_progress');

-- The business's own free-cancellation window, in hours (blank = the platform's).
ALTER TABLE service_businesses ADD COLUMN free_cancel_hours INTEGER DEFAULT NULL;
-- Offerings are archived, never deleted, and names are unique per business.
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_offering_slug_unique ON service_offerings(business_id, slug);
