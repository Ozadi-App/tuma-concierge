-- Self-drive photo walkaround inspections, deposit escrow tracking, and cargo vehicle categories.

CREATE TABLE IF NOT EXISTS rental_inspections (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL REFERENCES rentals(id),
  phase TEXT NOT NULL CHECK (phase IN ('pickup', 'return')),
  inspector_id TEXT NOT NULL REFERENCES users(id),
  inspector_role TEXT NOT NULL CHECK (inspector_role IN ('renter', 'owner', 'admin')),
  odometer_km INTEGER,
  fuel_level_percent INTEGER,
  notes TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(rental_id, phase, inspector_role)
);
CREATE INDEX IF NOT EXISTS idx_rental_inspections_rental ON rental_inspections(rental_id, phase);

CREATE TABLE IF NOT EXISTS rental_inspection_photos (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES rental_inspections(id),
  slot TEXT NOT NULL CHECK (slot IN ('front', 'rear', 'left', 'right', 'interior', 'odometer', 'fuel', 'damage_extra')),
  photo_key TEXT NOT NULL,
  note TEXT,
  device_timestamp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection ON rental_inspection_photos(inspection_id, slot);

ALTER TABLE rentals ADD COLUMN pickup_inspection_id TEXT REFERENCES rental_inspections(id);
ALTER TABLE rentals ADD COLUMN return_inspection_id TEXT REFERENCES rental_inspections(id);
ALTER TABLE rentals ADD COLUMN deposit_ledger_tx TEXT;
ALTER TABLE rentals ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'held' CHECK (deposit_status IN ('held', 'released', 'partly_forfeited', 'forfeited'));

-- Cargo vehicle categories for moving items, goods, and freight.
INSERT OR IGNORE INTO vehicle_categories (id, kind, name, seats, cargo_type, size_label, rate_per_km, minimum_fare, active, sort)
VALUES
  ('peebee-cargo-van', 'cargo', 'Cargo Van / Delivery Van', 2, 'van', 'Up to 800 kg', 2500, 15000, 1, 10),
  ('peebee-cargo-pickup', 'cargo', 'Pickup Truck (1 Ton)', 2, 'pickup', 'Up to 1 Ton', 3500, 25000, 1, 11),
  ('peebee-cargo-truck-3t', 'cargo', 'Box Truck (3 Ton)', 2, 'truck_3t', 'Up to 3 Ton', 5000, 45000, 1, 12),
  ('peebee-cargo-truck-7t', 'cargo', 'Heavy Truck (7 Ton)', 2, 'truck_7t', 'Up to 7 Ton', 8000, 80000, 1, 13);

-- Sandbox demo cargo vehicles for testing moving and cargo bookings.
INSERT OR IGNORE INTO vehicles (id, owner_id, category_id, plate, make, model, year, colour, status, notes)
VALUES
  ('demo-cargo-pickup-01', 'demo-rental-owner-1', 'peebee-cargo-pickup', 'DEMO TRK 001', 'Toyota', 'Hilux Pickup', 2021, 'White', 'approved', 'Sandbox demo cargo truck'),
  ('demo-cargo-van-01', 'demo-rental-owner-3', 'peebee-cargo-van', 'DEMO VAN 001', 'Toyota', 'Hiace Cargo', 2020, 'Silver', 'approved', 'Sandbox demo cargo van');
