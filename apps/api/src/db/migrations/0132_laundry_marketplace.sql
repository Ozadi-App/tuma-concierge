-- Migration 0132: Laundry marketplace — item catalogue, packages, and per-order laundry details.
-- Requires 0098. APPLY BY HAND.
--
-- All tables are new, so nothing changes until the code that uses them is deployed. Until this is applied
-- the laundry catalogue and quote endpoints answer "laundry_upgrade_pending" and the existing Work laundry
-- booking is unaffected.

-- Clothing types a customer can pick by count. A NULL or 0 price means that treatment isn't offered for the
-- item. Admin prices everything in UGX (steps of 500).
CREATE TABLE IF NOT EXISTS laundry_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'clothing',
  wash_price_ugx INTEGER CHECK (wash_price_ugx IS NULL OR wash_price_ugx >= 0),
  dry_clean_price_ugx INTEGER CHECK (dry_clean_price_ugx IS NULL OR dry_clean_price_ugx >= 0),
  iron_price_ugx INTEGER CHECK (iron_price_ugx IS NULL OR iron_price_ugx >= 0),
  max_count INTEGER NOT NULL DEFAULT 50 CHECK (max_count >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_laundry_items_active ON laundry_items(active, sort_order);

-- Wash and fold packages priced by load size.
CREATE TABLE IF NOT EXISTS laundry_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  min_lb INTEGER,
  max_lb INTEGER,
  price_ugx INTEGER NOT NULL DEFAULT 0 CHECK (price_ugx >= 0),
  max_count INTEGER NOT NULL DEFAULT 10 CHECK (max_count >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Laundry details of a Work job: how it was priced, the customer's offer, tip, ride legs and preferences.
CREATE TABLE IF NOT EXISTS laundry_orders (
  job_id TEXT PRIMARY KEY REFERENCES work_jobs(id),
  mode TEXT NOT NULL CHECK (mode IN ('package', 'custom')),
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('fixed', 'estimate')),
  catalogue_total_ugx INTEGER NOT NULL DEFAULT 0,
  offer_ugx INTEGER,
  goods_ugx INTEGER NOT NULL DEFAULT 0,
  tip_kind TEXT NOT NULL DEFAULT 'none' CHECK (tip_kind IN ('none', 'free', 'conditional')),
  tip_ugx INTEGER NOT NULL DEFAULT 0,
  tip_released INTEGER NOT NULL DEFAULT 0,
  pickup_ride_ugx INTEGER NOT NULL DEFAULT 0,
  delivery_ride_ugx INTEGER NOT NULL DEFAULT 0,
  pickup_payer TEXT NOT NULL DEFAULT 'customer' CHECK (pickup_payer IN ('customer', 'provider', 'split')),
  delivery_payer TEXT NOT NULL DEFAULT 'provider' CHECK (delivery_payer IN ('customer', 'provider', 'split')),
  customer_ride_ugx INTEGER NOT NULL DEFAULT 0,
  provider_ride_ugx INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time', 'weekly', 'biweekly')),
  detergent TEXT NOT NULL DEFAULT 'standard',
  contactless INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  weighed_lb REAL,
  -- Rules locked in at checkout, so a later admin change never alters an order already placed.
  commission_timing TEXT NOT NULL DEFAULT 'on_payout' CHECK (commission_timing IN ('on_payout', 'at_checkout')),
  cancel_rule TEXT NOT NULL DEFAULT 'refund' CHECK (cancel_rule IN ('refund', 'keep')),
  commission_taken_ugx INTEGER NOT NULL DEFAULT 0,
  fee_ugx INTEGER NOT NULL DEFAULT 0,
  tip_promised_by TEXT,
  -- Rider money: the rider share of both legs. Held until rider dispatch pays it out.
  rider_fee_ugx INTEGER NOT NULL DEFAULT 0,
  pickup_order_id TEXT REFERENCES orders(id),
  delivery_order_id TEXT REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- What was ordered: packages by count, or clothes by type, treatment and count. Prices are copied here so later
-- catalogue changes never alter an order already placed.
CREATE TABLE IF NOT EXISTS laundry_order_lines (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  kind TEXT NOT NULL CHECK (kind IN ('item', 'package')),
  ref_id TEXT NOT NULL,
  name TEXT NOT NULL,
  treatment TEXT CHECK (treatment IS NULL OR treatment IN ('wash', 'dry_clean', 'iron')),
  count INTEGER NOT NULL CHECK (count >= 1),
  unit_price_ugx INTEGER NOT NULL,
  line_total_ugx INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_laundry_lines_job ON laundry_order_lines(job_id);

-- The service every laundry order is booked under. Switched off so it never shows in the old Work catalogue; orders are priced by the laundry catalogue instead.
INSERT OR IGNORE INTO work_services (id, type, category, name, description, pricing_mode, unit_label, unit_price_ugx, callout_fee_ugx, min_quantity, max_quantity, sort_order, active) VALUES
  ('wsv_laundry_order', 'laundry', 'order', 'Laundry order', 'Packages and clothes by type and count', 'fixed', 'order', 1, 0, 1, 1, 0, 0);

-- Starting item list, UNPRICED and switched off: admin prices each item (UGX, steps of 500) and turns it on.
INSERT OR IGNORE INTO laundry_items (id, name, category, sort_order, active) VALUES
  ('li_dress_shirt', 'Dress shirt', 'tops', 10, 0),
  ('li_polo_shirt', 'Polo shirt', 'tops', 20, 0),
  ('li_sweater', 'Sweater', 'tops', 30, 0),
  ('li_blazer', 'Blazer', 'jackets', 40, 0),
  ('li_coat_short', 'Coat or jacket (short)', 'jackets', 50, 0),
  ('li_coat_long', 'Coat or jacket (long)', 'jackets', 60, 0),
  ('li_insulated_jacket', 'Insulated jacket', 'jackets', 70, 0),
  ('li_goose_jacket', 'Canada goose jacket', 'jackets', 80, 0),
  ('li_two_piece_suit', 'Two-piece suit', 'suits', 90, 0),
  ('li_three_piece_suit', 'Three-piece suit', 'suits', 100, 0),
  ('li_jeans_pants', 'Jeans or pants', 'bottoms', 110, 0),
  ('li_dress', 'Dress', 'dresses', 120, 0),
  ('li_bridal_dress', 'Bridal dress', 'dresses', 130, 0),
  ('li_casual', 'Casual clothing', 'other', 140, 0),
  ('li_custom_attire', 'Custom attire', 'other', 150, 0),
  ('li_tie', 'Tie', 'accessories', 160, 0),
  ('li_scarf', 'Scarf', 'accessories', 170, 0),
  ('li_pillow', 'Pillow', 'bedding', 180, 0),
  ('li_sleeping_bag', 'Sleeping bag', 'bedding', 190, 0);

INSERT OR IGNORE INTO laundry_packages (id, name, description, min_lb, max_lb, sort_order, active) VALUES
  ('lp_single', 'Single load', 'Half a laundry bag', 1, 10, 10, 0),
  ('lp_couple', 'Couple load', 'One full laundry bag', 10, 25, 20, 0),
  ('lp_family', 'Family load', 'Two full laundry bags', 25, 40, 30, 0),
  ('lp_duvet', 'Duvet or blanket', 'Each', NULL, NULL, 40, 0);
