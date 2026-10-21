-- Migration 0124: Taxipress taxis and the line (the driver queue).
-- Additive only. Needs 0123. The code checks for these tables and offers nothing until they exist.

-- A taxi (matatu, minibus) approved to run on a route. One approval, two switches:
-- passengers (it may join the line and take seats) and parcels (it may carry relay parcels).
CREATE TABLE IF NOT EXISTS taxipress_taxis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  relay_route_id TEXT NOT NULL REFERENCES relay_routes(id),
  plate TEXT NOT NULL,
  seat_layout TEXT NOT NULL CHECK (seat_layout IN ('14', '18')),
  seats INTEGER NOT NULL CHECK (seats > 0),
  passengers_enabled INTEGER NOT NULL DEFAULT 1,
  parcels_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxipress_taxis_route ON taxipress_taxis (relay_route_id, status);

-- One row each time a taxi joins the line. in_line -> boarding (head of the line, "Boarding Now") -> on_road -> arrived.
CREATE TABLE IF NOT EXISTS taxipress_queue (
  id TEXT PRIMARY KEY,
  taxipress_route_id TEXT NOT NULL REFERENCES taxipress_routes(id),
  taxi_id TEXT NOT NULL REFERENCES taxipress_taxis(id),
  driver_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_line' CHECK (status IN ('in_line', 'boarding', 'on_road', 'arrived', 'cancelled')),
  -- Seats on this trip (the taxi's seats when it joined).
  seats_total INTEGER NOT NULL,
  -- Seats sold in the app (kept by the booking code) and seats the driver sold at the stage.
  seats_booked INTEGER NOT NULL DEFAULT 0,
  walk_up_seats INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  boarding_at TEXT,
  departed_at TEXT,
  arrived_at TEXT,
  ended_reason TEXT,
  last_lat REAL,
  last_lng REAL,
  last_location_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- A taxi is in one line at a time, and a route has one taxi Boarding Now at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxipress_queue_taxi_active ON taxipress_queue (taxi_id) WHERE status IN ('in_line', 'boarding', 'on_road');
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxipress_queue_boarding ON taxipress_queue (taxipress_route_id) WHERE status = 'boarding';
CREATE INDEX IF NOT EXISTS idx_taxipress_queue_line ON taxipress_queue (taxipress_route_id, status, joined_at);
