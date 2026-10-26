-- Migration 0134: Standalone Services Platform & Booking Infrastructure
-- Independent business rail separate from product commerce (stores/products).
-- Provides isolated payment rails (MoMo, Bank Wire, On-site cash) to protect card aggregators like Stripe from intangible service disputes.

CREATE TABLE IF NOT EXISTS service_businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'consultation', -- consultation | health_wellness | home_trades | tech_creative | beauty_salon | events_hospitality | education_coaching | automotive_repairs
  phone TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT 'Kampala',
  service_area TEXT DEFAULT 'Greater Kampala',
  logo_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours prior to appointment',
  allowed_payment_rails TEXT DEFAULT '["momo_mtn","momo_airtel","cash_at_venue"]',
  custom_domain TEXT DEFAULT NULL,
  is_open INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | pending_review
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_biz_owner ON service_businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_service_biz_slug ON service_businesses(slug);
CREATE INDEX IF NOT EXISTS idx_service_biz_status ON service_businesses(status);

CREATE TABLE IF NOT EXISTS service_offerings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES service_businesses(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'appointment',
  description TEXT DEFAULT '',
  pricing_type TEXT NOT NULL DEFAULT 'fixed', -- fixed | hourly | custom_quote | deposit
  price_ugx INTEGER NOT NULL DEFAULT 0,
  deposit_ugx INTEGER DEFAULT NULL,
  compare_at_price_ugx INTEGER DEFAULT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  location_type TEXT NOT NULL DEFAULT 'in_facility', -- in_facility | client_site | virtual
  virtual_meeting_url TEXT DEFAULT '',
  deliverables_json TEXT DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  bookings_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_offering_biz ON service_offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_service_offering_slug ON service_offerings(slug);

CREATE TABLE IF NOT EXISTS service_staff_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES service_businesses(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Specialist',
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_staff_biz ON service_staff_members(business_id);

CREATE TABLE IF NOT EXISTS service_bookings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES service_businesses(id),
  service_id TEXT NOT NULL REFERENCES service_offerings(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
  scheduled_time TEXT NOT NULL, -- HH:mm
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location_type TEXT NOT NULL DEFAULT 'in_facility', -- in_facility | client_site | virtual
  address TEXT DEFAULT '',
  virtual_meeting_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  pricing_type TEXT NOT NULL DEFAULT 'fixed',
  total_price_ugx INTEGER NOT NULL DEFAULT 0,
  deposit_ugx INTEGER NOT NULL DEFAULT 0,
  payment_rail TEXT NOT NULL DEFAULT 'momo_mtn', -- momo_mtn | momo_airtel | cash_at_venue | bank_wire
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | deposit_paid | paid_full | waived
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | in_progress | completed | cancelled
  staff_id TEXT DEFAULT NULL REFERENCES service_staff_members(id),
  staff_name TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_biz ON service_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_service ON service_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_date ON service_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);
