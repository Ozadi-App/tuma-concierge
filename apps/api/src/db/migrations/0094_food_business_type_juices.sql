-- Migration 0094: Expand restaurants business_type check constraint to include 'juices'
--
-- SQLite cannot alter a CHECK, so the table is rebuilt. Other tables (orders, menu_items,
-- menu_categories, calls, restaurant_chat_messages) reference restaurants(id), and D1 always
-- enforces foreign keys, so the usual "create _new, drop old, rename" fails there. Instead the
-- rows are parked in a plain copy, the table is recreated under its own name, and the rows are
-- put back, which satisfies the deferred foreign key checks at commit.
PRAGMA defer_foreign_keys = on;

CREATE TABLE restaurants_backup AS SELECT * FROM restaurants;

DROP TABLE restaurants;

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  cuisine TEXT,
  phone TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  logo_key TEXT,
  cover_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended')),
  is_open INTEGER NOT NULL DEFAULT 0,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  open_time TEXT,
  close_time TEXT,
  merchant_id TEXT REFERENCES merchants(id),
  outlet_id TEXT REFERENCES merchant_outlets(id),
  business_type TEXT NOT NULL DEFAULT 'restaurant' CHECK (business_type IN ('restaurant', 'kitchen', 'street_food', 'bakery', 'juices')),
  theme_scene TEXT CHECK (theme_scene IS NULL OR theme_scene IN ('cove','forest','viola','violet-dusk','luigi','sunset','blush','sicily','ocean-blue','marple')),
  theme_mode TEXT CHECK (theme_mode IS NULL OR theme_mode IN ('auto','light','dark'))
);

INSERT INTO restaurants (
  id, owner_id, name, description, cuisine, phone, address, lat, lng, logo_key, cover_key,
  status, is_open, environment, created_at, updated_at, open_time, close_time, merchant_id, outlet_id,
  business_type, theme_scene, theme_mode
)
SELECT
  id, owner_id, name, description, cuisine, phone, address, lat, lng, logo_key, cover_key,
  status, is_open, environment, created_at, updated_at, open_time, close_time, merchant_id, outlet_id,
  business_type, theme_scene, theme_mode
FROM restaurants_backup;

DROP TABLE restaurants_backup;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status, environment);
CREATE INDEX IF NOT EXISTS idx_restaurants_business_type ON restaurants(business_type, status, environment);
