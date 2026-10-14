-- Migration 0097: pharmacy prescriptions become real, private data.
-- APPLY BY HAND (after 0095) BEFORE DEPLOYING the matching code. Until the
-- columns and table below exist the pharmacy API answers "upgrade pending";
-- nothing else is affected.

-- Who reviewed a prescription and when, and which environment it belongs to
-- (practice-mode prescriptions never reach a live pharmacy's queue).
ALTER TABLE pharmacy_prescriptions ADD COLUMN reviewed_by TEXT;
ALTER TABLE pharmacy_prescriptions ADD COLUMN reviewed_at TEXT;
ALTER TABLE pharmacy_prescriptions ADD COLUMN environment TEXT NOT NULL DEFAULT 'live';

-- Who looked at or changed a prescription. Medical records need a trail.
CREATE TABLE IF NOT EXISTS pharmacy_prescription_events (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES pharmacy_prescriptions(id),
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'pharmacist')),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rx_events_prescription ON pharmacy_prescription_events(prescription_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prescriptions_queue ON pharmacy_prescriptions(pharmacy_id, environment, status, created_at);

-- A store only receives prescriptions once Peebee staff have approved it as a
-- pharmacy and recorded its licence. Calling a shop "pharmacy" is not enough.
-- (stores.category only allows 'groceries' and 'stores', so a pharmacy is a
-- 'stores' row with an approval here.)
CREATE TABLE IF NOT EXISTS pharmacy_approvals (
  store_id TEXT PRIMARY KEY REFERENCES stores(id),
  licence_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'revoked')),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
