-- Migration 0123: Taxipress, scheduled shared-taxi seats on fixed routes (foundation).
-- Additive only. The code checks for this table and offers nothing until it exists.
--
-- A Taxipress route is a relay route (see 0102) run in one direction. The stages and their
-- names stay on the relay route, so a rename there changes tickets, the queue and parcels at once.
-- Later migrations add the taxis, the queue and the bookings.

CREATE TABLE IF NOT EXISTS taxipress_routes (
  id TEXT PRIMARY KEY,
  relay_route_id TEXT NOT NULL REFERENCES relay_routes(id),
  -- a_to_b runs from the relay route's stage A to stage B; b_to_a the other way.
  direction TEXT NOT NULL CHECK (direction IN ('a_to_b', 'b_to_a')),
  -- UGX per seat for the whole route.
  fare_per_seat INTEGER NOT NULL DEFAULT 0 CHECK (fare_per_seat >= 0),
  -- Off: one flat fare. On: stops along the route may carry their own fare.
  stop_pricing_enabled INTEGER NOT NULL DEFAULT 0,
  -- Off until staff switch the route on.
  active INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (relay_route_id, direction)
);
CREATE INDEX IF NOT EXISTS idx_taxipress_routes_active ON taxipress_routes (active, sort);
