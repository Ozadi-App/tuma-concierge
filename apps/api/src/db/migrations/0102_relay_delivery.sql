-- Migration 0102: relay delivery for long parcel deliveries (boda -> matatu -> boda).
-- Additive only. The code checks for these tables and offers no relay until they exist.

-- Matatu routes that can carry a parcel, set up by staff. A route links two stages
-- and can be used in either direction; parcel_fare is what one parcel costs on it.
CREATE TABLE IF NOT EXISTS relay_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage_a_name TEXT NOT NULL,
  stage_a_lat REAL NOT NULL,
  stage_a_lng REAL NOT NULL,
  stage_b_name TEXT NOT NULL,
  stage_b_lat REAL NOT NULL,
  stage_b_lng REAL NOT NULL,
  parcel_fare INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Matatu operators who carry relay parcels; approved by staff.
CREATE TABLE IF NOT EXISTS relay_operators (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  route_id TEXT REFERENCES relay_routes(id),
  vehicle_plate TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The three legs of a relayed order. handoff_code is what the next holder enters
-- to take the parcel from this leg (leg 1 -> matatu operator, leg 2 -> last rider).
CREATE TABLE IF NOT EXISTS order_relay_legs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  leg INTEGER NOT NULL CHECK (leg IN (1, 2, 3)),
  kind TEXT NOT NULL CHECK (kind IN ('boda', 'matatu')),
  route_id TEXT REFERENCES relay_routes(id),
  from_name TEXT,
  from_lat REAL,
  from_lng REAL,
  to_name TEXT,
  to_lat REAL,
  to_lng REAL,
  distance_km REAL,
  fee INTEGER NOT NULL,
  provider_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'open', 'assigned', 'in_transit', 'arrived', 'done')),
  handoff_code TEXT,
  started_at TEXT,
  handed_over_at TEXT,
  handed_over_to TEXT,
  paid_amount INTEGER,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, leg)
);
CREATE INDEX IF NOT EXISTS idx_relay_legs_status ON order_relay_legs (leg, status);
CREATE INDEX IF NOT EXISTS idx_relay_legs_provider ON order_relay_legs (provider_id, status);
