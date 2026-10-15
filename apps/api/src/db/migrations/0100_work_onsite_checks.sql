-- Migration 0100: Peebee Work on-site checks. Requires 0099. APPLY BY HAND.
--
-- Keeps a short trail of where a provider was while on a job, and a review queue for cancellations
-- that happened after the provider had been at the customer's address for a while.
--
-- Until this is applied (or while the "On-site checks" switch in Admin is off, which is the default)
-- nothing is recorded and nothing is flagged; the engine behaves exactly as before.

-- One row per accepted location update while the job is booked or in progress.
CREATE TABLE IF NOT EXISTS work_job_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  provider_id TEXT NOT NULL REFERENCES work_providers(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_locations_job ON work_job_locations(job_id, provider_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_work_locations_age ON work_job_locations(recorded_at);

-- A cancellation worth a second look. One per job, provider and kind; admin reviews it.
--   cancel_after_onsite: the provider spent at least the configured time at the address, then it was cancelled.
--   cancel_no_location:  the provider held the job for that long, never shared a location, then it was cancelled.
CREATE TABLE IF NOT EXISTS work_flags (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES work_jobs(id),
  provider_id TEXT NOT NULL REFERENCES work_providers(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('cancel_after_onsite', 'cancel_no_location')),
  cancelled_by TEXT NOT NULL,
  onsite_minutes INTEGER NOT NULL DEFAULT 0,
  closest_m INTEGER,
  points INTEGER NOT NULL DEFAULT 0,
  first_onsite_at TEXT,
  last_onsite_at TEXT,
  radius_m INTEGER NOT NULL,
  min_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'warned', 'suspended')),
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, provider_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_work_flags_status ON work_flags(status, created_at);
CREATE INDEX IF NOT EXISTS idx_work_flags_provider ON work_flags(provider_id, created_at);
