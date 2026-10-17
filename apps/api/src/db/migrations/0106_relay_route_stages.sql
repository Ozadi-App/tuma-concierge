-- Migration 0106: defined stages on relay routes, meeting the matatu, arrival alerts.
-- Additive only; the code checks for these first.

-- The stages a route's matatus stop at, in order between stage A and stage B.
-- A stage can be a Peebee Gas station (outlet_id), where a customer can meet the matatu.
CREATE TABLE IF NOT EXISTS relay_route_stages (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES relay_routes(id),
  seq INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  outlet_id TEXT REFERENCES fuel_station_outlets(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_relay_route_stages_route ON relay_route_stages (route_id, active, seq);

-- A customer meeting the matatu at a stage, and what happened.
ALTER TABLE order_relay ADD COLUMN meet_stage_id TEXT;
ALTER TABLE order_relay ADD COLUMN meet_stage_name TEXT;
ALTER TABLE order_relay ADD COLUMN meet_lat REAL;
ALTER TABLE order_relay ADD COLUMN meet_lng REAL;
-- Set when the customer wasn't at the stage and the parcel went on to the petrol station.
ALTER TABLE order_relay ADD COLUMN missed_at TEXT;
-- "Arriving in about N minutes" is sent once.
ALTER TABLE order_relay ADD COLUMN soon_notified_at TEXT;
