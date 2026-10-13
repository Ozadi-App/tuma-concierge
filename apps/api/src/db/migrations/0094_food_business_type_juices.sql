-- Migration 0094: Expand restaurants business_type check constraint to include 'juices'
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS restaurants_new (
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

INSERT INTO restaurants_new (
  id, owner_id, name, description, cuisine, phone, address, lat, lng, logo_key, cover_key,
  status, is_open, environment, created_at, updated_at, open_time, close_time, merchant_id, outlet_id,
  business_type, theme_scene, theme_mode
)
SELECT 
  id, owner_id, name, description, cuisine, phone, address, lat, lng, logo_key, cover_key,
  status, is_open, environment, created_at, updated_at, open_time, close_time, merchant_id, outlet_id,
  business_type, theme_scene, theme_mode
FROM restaurants;

DROP TABLE restaurants;
ALTER TABLE restaurants_new RENAME TO restaurants;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status, environment);
CREATE INDEX IF NOT EXISTS idx_restaurants_business_type ON restaurants(business_type, status, environment);

PRAGMA foreign_keys=ON;
