-- Migration 0105: relay parcels dropped at a petrol station.
-- A matatu with passengers can't wait for a rider, so on a station route it
-- drops the parcel at the Peebee Gas station nearest the customer. The pump
-- attendant keeps it in the shop until the customer collects it or a rider
-- takes it to the door. Additive only; the code checks for these first.

-- How each route hands over at the far end: to a rider at a stage, or at a petrol station.
ALTER TABLE relay_routes ADD COLUMN drop_mode TEXT NOT NULL DEFAULT 'stage';

-- Staff choose which stations accept relay parcels.
ALTER TABLE fuel_station_outlets ADD COLUMN relay_drop INTEGER NOT NULL DEFAULT 0;

-- One row per relayed order: where it's dropped and how it reaches the customer.
CREATE TABLE IF NOT EXISTS order_relay (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  drop_mode TEXT NOT NULL DEFAULT 'stage' CHECK (drop_mode IN ('stage', 'station')),
  outlet_id TEXT REFERENCES fuel_station_outlets(id),
  -- door: a rider takes it on (paid). collect: the customer collects it. pending: they choose when it arrives.
  last_mile TEXT NOT NULL DEFAULT 'door' CHECK (last_mile IN ('door', 'collect', 'pending')),
  -- The customer shows this at the station to collect.
  collect_code TEXT,
  -- A rider enters this (shown in the station's app) to take the parcel to the door.
  release_code TEXT,
  held_at TEXT,
  held_by TEXT,
  released_at TEXT,
  released_to TEXT CHECK (released_to IN ('customer', 'rider')),
  released_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_relay_outlet ON order_relay (outlet_id, held_at, released_at);
