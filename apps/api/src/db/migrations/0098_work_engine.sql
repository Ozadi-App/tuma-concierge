-- Migration 0098: Peebee Work engine (clean first; fix and laundry plug into the same tables).
-- APPLY BY HAND. All tables are new, so nothing changes until the code that uses
-- them is deployed; until this is applied the Work API answers "upgrade pending".

-- What can be booked. Admin edits this catalogue; each service is priced either
-- as a fixed price per unit or as a quote after inspection (with a call-out fee).
CREATE TABLE IF NOT EXISTS work_services (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('clean', 'fix', 'laundry')),
  category TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('fixed', 'quote')),
  unit_label TEXT NOT NULL DEFAULT 'job',
  unit_price_ugx INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_ugx >= 0),
  callout_fee_ugx INTEGER NOT NULL DEFAULT 0 CHECK (callout_fee_ugx >= 0),
  min_quantity INTEGER NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  max_quantity INTEGER NOT NULL DEFAULT 20 CHECK (max_quantity >= 1),
  -- NULL = use the platform default commission.
  commission_percent REAL CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 60)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_services_type ON work_services(type, active, sort_order);

-- People and companies who do the work. The owner's user account receives payouts.
CREATE TABLE IF NOT EXISTS work_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('individual', 'company')),
  display_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  online INTEGER NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  location_at TEXT,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  status_note TEXT,
  approved_by TEXT,
  approved_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_providers_status ON work_providers(status, online);

-- Which catalogue services a provider does.
CREATE TABLE IF NOT EXISTS work_provider_services (
  provider_id TEXT NOT NULL REFERENCES work_providers(id),
  service_id TEXT NOT NULL REFERENCES work_services(id),
  PRIMARY KEY (provider_id, service_id)
);

-- Staff of a company. The owner is a member too; staff do jobs the owner assigns them.
CREATE TABLE IF NOT EXISTS work_provider_members (
  provider_id TEXT NOT NULL REFERENCES work_providers(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_work_members_user ON work_provider_members(user_id, status);

-- A booking. Prices and the commission are copied onto the job when it is made,
-- so later catalogue or settings changes never alter a job already in progress.
CREATE TABLE IF NOT EXISTS work_jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  service_id TEXT NOT NULL REFERENCES work_services(id),
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('fixed', 'quote')),
  matching_mode TEXT NOT NULL CHECK (matching_mode IN ('broadcast', 'customer_picks', 'admin_assigns')),
  -- pending_payment: created but the customer's money is not held yet; providers never see it.
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN
    ('pending_payment', 'open', 'assigned', 'quoted', 'booked', 'in_progress', 'completed', 'settled', 'cancelled', 'expired', 'disputed', 'refunded')),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  details TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  area TEXT,
  lat REAL,
  lng REAL,
  scheduled_for TEXT,
  unit_price_ugx INTEGER NOT NULL DEFAULT 0,
  callout_fee_ugx INTEGER NOT NULL DEFAULT 0,
  -- The agreed total. 0 until a quote-priced job has been quoted.
  price_ugx INTEGER NOT NULL DEFAULT 0,
  -- What is currently held from the customer's wallet for this job.
  held_ugx INTEGER NOT NULL DEFAULT 0,
  commission_percent REAL NOT NULL DEFAULT 0,
  commission_ugx INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT REFERENCES work_providers(id),
  -- The person doing the job (staff member for a company; otherwise the provider).
  worker_id TEXT REFERENCES users(id),
  idempotency_key TEXT,
  expires_at TEXT,
  quote_expires_at TEXT,
  confirm_by TEXT,
  assigned_at TEXT,
  quoted_at TEXT,
  booked_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  settled_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  cancel_reason TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  review TEXT,
  dispute_reason TEXT,
  resolution_note TEXT,
  resolved_by TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_jobs_customer ON work_jobs(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_work_jobs_provider ON work_jobs(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_work_jobs_worker ON work_jobs(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_work_jobs_open ON work_jobs(status, service_id, expires_at);
-- A retried or double-tapped booking returns the first job instead of charging twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_jobs_idempotency ON work_jobs(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Providers' offers on a job (used when the customer picks the provider).
CREATE TABLE IF NOT EXISTS work_offers (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  provider_id TEXT NOT NULL REFERENCES work_providers(id),
  price_ugx INTEGER NOT NULL DEFAULT 0,
  eta_minutes INTEGER,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'declined', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_work_offers_job ON work_offers(job_id, status);

-- Every movement of money. A row is written together with the status change that
-- causes it and applied exactly once, so a crash or retry can never pay twice.
-- Row ids are fixed per job and kind (e.g. payout:<job>), so a repeat is ignored.
CREATE TABLE IF NOT EXISTS work_money (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('hold', 'refund', 'payout')),
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  note TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_work_money_pending ON work_money(status, created_at);
CREATE INDEX IF NOT EXISTS idx_work_money_job ON work_money(job_id);

-- Who did what, for support and disputes.
CREATE TABLE IF NOT EXISTS work_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  actor_id TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'provider', 'worker', 'admin', 'system')),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_events_job ON work_events(job_id, created_at);

-- Starting Clean catalogue. Admin can change any price, switch items off, or add more.
INSERT OR IGNORE INTO work_services (id, type, category, name, description, pricing_mode, unit_label, unit_price_ugx, callout_fee_ugx, min_quantity, max_quantity, sort_order) VALUES
  ('wsv_clean_house_standard', 'clean', 'house', 'Standard home clean', 'Dusting, floors, kitchen and bathrooms, per bedroom', 'fixed', 'bedroom', 35000, 0, 1, 10, 10),
  ('wsv_clean_house_deep', 'clean', 'house', 'Deep home clean', 'Top-to-bottom clean including appliances and windows, per bedroom', 'fixed', 'bedroom', 60000, 0, 1, 10, 20),
  ('wsv_clean_house_move', 'clean', 'house', 'Move-in / move-out clean', 'Empty-home clean; priced after the provider sees the place', 'quote', 'job', 0, 10000, 1, 1, 30),
  ('wsv_clean_house_post_build', 'clean', 'house', 'Post-construction clean', 'Dust, paint and cement removal; priced after inspection', 'quote', 'job', 0, 15000, 1, 1, 40),
  ('wsv_clean_office_standard', 'clean', 'office', 'Office clean', 'Desks, floors, kitchenette and washrooms, per 50 m²', 'fixed', '50 m² block', 80000, 0, 1, 40, 50),
  ('wsv_clean_office_deep', 'clean', 'office', 'Office deep clean', 'Large or specialist office; priced after inspection', 'quote', 'job', 0, 20000, 1, 1, 60),
  ('wsv_clean_pet_dog', 'clean', 'pet', 'Dog bath & groom', 'Wash, dry, brush and nail trim, per dog', 'fixed', 'dog', 40000, 0, 1, 6, 70),
  ('wsv_clean_pet_cat', 'clean', 'pet', 'Cat grooming', 'Gentle wash and brush, per cat', 'fixed', 'cat', 30000, 0, 1, 6, 80),
  ('wsv_clean_pet_area', 'clean', 'pet', 'Kennel / pet area clean', 'Kennel, cage or litter area sanitising', 'fixed', 'job', 25000, 0, 1, 3, 90),
  ('wsv_clean_car_wash', 'clean', 'car', 'Car wash (inside and out)', 'Exterior wash, wheels and interior vacuum, per car', 'fixed', 'car', 25000, 0, 1, 10, 100),
  ('wsv_clean_car_suv', 'clean', 'car', 'SUV / van wash', 'Larger vehicle wash and interior vacuum', 'fixed', 'vehicle', 35000, 0, 1, 10, 110),
  ('wsv_clean_car_detail', 'clean', 'car', 'Full car detail', 'Deep interior and exterior detailing with polish, per car', 'fixed', 'car', 120000, 0, 1, 5, 120),
  ('wsv_clean_item_carpet', 'clean', 'household', 'Carpet cleaning', 'Deep shampoo and extraction, per square metre', 'fixed', 'm²', 6000, 0, 1, 100, 130),
  ('wsv_clean_item_sofa', 'clean', 'household', 'Sofa / upholstery cleaning', 'Fabric or leather, per seat', 'fixed', 'seat', 15000, 0, 1, 12, 140),
  ('wsv_clean_item_mattress', 'clean', 'household', 'Mattress deep clean', 'Stain removal and sanitising, per mattress', 'fixed', 'mattress', 40000, 0, 1, 8, 150),
  ('wsv_clean_item_curtain', 'clean', 'household', 'Curtain cleaning (at your home)', 'On-site clean, per pair', 'fixed', 'pair', 25000, 0, 1, 20, 160),
  ('wsv_clean_item_window', 'clean', 'household', 'Window cleaning', 'Inside and out; priced after the provider sees the windows', 'quote', 'job', 0, 10000, 1, 1, 170);
