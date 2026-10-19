-- Migration 0099: Peebee Work extras — re-matching, job photos, job chat, live tracking, and the
-- starting Fix and Laundry catalogues. Requires 0098. APPLY BY HAND.
--
-- Until this is applied the new endpoints answer "work_upgrade_pending" and a provider who cancels
-- simply refunds the customer as before; nothing else changes.

-- A job that lost its provider goes back to being open. Count how many times so admin can cap it.
ALTER TABLE work_jobs ADD COLUMN rematch_count INTEGER NOT NULL DEFAULT 0;

-- Where the provider is, while they are on their way or on the job.
ALTER TABLE work_jobs ADD COLUMN provider_lat REAL;
ALTER TABLE work_jobs ADD COLUMN provider_lng REAL;
ALTER TABLE work_jobs ADD COLUMN provider_located_at TEXT;

-- Photos attached to a job: what needs doing, and before/after evidence.
CREATE TABLE IF NOT EXISTS work_job_photos (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  uploader_id TEXT NOT NULL REFERENCES users(id),
  uploader_kind TEXT NOT NULL CHECK (uploader_kind IN ('customer', 'provider')),
  phase TEXT NOT NULL DEFAULT 'request' CHECK (phase IN ('request', 'before', 'after')),
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  note TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_photos_job ON work_job_photos(job_id, created_at);

-- Messages between the customer and the provider (or their assigned worker) about one job.
CREATE TABLE IF NOT EXISTS work_messages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('customer', 'provider')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_messages_job ON work_messages(job_id, created_at);

-- Starting Fix catalogue (admin can change or switch off any of it, and turns the type on in Settings).
INSERT OR IGNORE INTO work_services (id, type, category, name, description, pricing_mode, unit_label, unit_price_ugx, callout_fee_ugx, min_quantity, max_quantity, sort_order) VALUES
  ('wsv_fix_plumbing', 'fix', 'plumbing', 'Plumbing repair', 'Leaking pipe, tap, clogged sink or toilet; priced after the pro sees it', 'quote', 'job', 0, 20000, 1, 1, 10),
  ('wsv_fix_electrical', 'fix', 'electrical', 'Electrical repair', 'Socket fault, breaker, lighting or short circuit; priced after inspection', 'quote', 'job', 0, 25000, 1, 1, 20),
  ('wsv_fix_appliance', 'fix', 'appliances', 'Appliance repair', 'Fridge, washing machine, microwave or stove; priced after diagnosis', 'quote', 'job', 0, 30000, 1, 1, 30),
  ('wsv_fix_carpentry', 'fix', 'carpentry', 'Carpentry and locks', 'Door locks, hinges, wardrobe or furniture repair; priced after inspection', 'quote', 'job', 0, 20000, 1, 1, 40),
  ('wsv_fix_painting', 'fix', 'painting', 'Painting and drywall touch-up', 'Water stains, wall cracks, door repaint; priced after inspection', 'quote', 'job', 0, 35000, 1, 1, 50),
  ('wsv_fix_tap_replace', 'fix', 'plumbing', 'Tap replacement (labour)', 'Fitting a tap you provide, per tap', 'fixed', 'tap', 25000, 0, 1, 6, 60),
  ('wsv_fix_socket_replace', 'fix', 'electrical', 'Socket or switch replacement (labour)', 'Fitting a socket or switch you provide, per point', 'fixed', 'point', 15000, 0, 1, 12, 70);

-- Starting Laundry catalogue.
INSERT OR IGNORE INTO work_services (id, type, category, name, description, pricing_mode, unit_label, unit_price_ugx, callout_fee_ugx, min_quantity, max_quantity, sort_order) VALUES
  ('wsv_laundry_wash_kg', 'laundry', 'wash_fold', 'Everyday clothes, wash and fold', 'Washed, tumble dried and folded, per kg', 'fixed', 'kg', 5000, 0, 1, 40, 10),
  ('wsv_laundry_wash_bag', 'laundry', 'wash_fold', 'Full laundry bag (about 6 kg)', 'Standard basket wash and fold', 'fixed', 'bag', 25000, 0, 1, 10, 20),
  ('wsv_laundry_suit', 'laundry', 'dry_clean', '2-piece suit', 'Solvent clean and steam press', 'fixed', 'suit', 18000, 0, 1, 10, 30),
  ('wsv_laundry_blazer', 'laundry', 'dry_clean', 'Blazer or jacket', 'Fabric-safe dry cleaning', 'fixed', 'piece', 12000, 0, 1, 20, 40),
  ('wsv_laundry_dress', 'laundry', 'dry_clean', 'Delicate or evening dress', 'Careful treatment for silk, lace or beads', 'fixed', 'dress', 15000, 0, 1, 10, 50),
  ('wsv_laundry_duvet_single', 'laundry', 'bulky', 'Single or medium duvet', 'Deep wash and high-heat dry', 'fixed', 'piece', 20000, 0, 1, 10, 60),
  ('wsv_laundry_duvet_king', 'laundry', 'bulky', 'King or double comforter', 'Thorough wash with anti-allergen rinse', 'fixed', 'piece', 28000, 0, 1, 10, 70),
  ('wsv_laundry_curtains', 'laundry', 'bulky', 'Curtains (pair)', 'Dust removal and deep wash', 'fixed', 'pair', 22000, 0, 1, 20, 80),
  ('wsv_laundry_iron_shirt', 'laundry', 'iron', 'Formal shirts, press only', 'Crisp collar and crease steam press', 'fixed', 'piece', 3000, 0, 1, 60, 90),
  ('wsv_laundry_iron_trousers', 'laundry', 'iron', 'Trousers, press only', 'Sharp tailored crease', 'fixed', 'piece', 3500, 0, 1, 60, 100);
