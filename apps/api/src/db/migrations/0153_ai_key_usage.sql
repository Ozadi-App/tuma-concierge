-- Migration 0153: which AI feature each Google AI key has actually served (Admin → Google AI keys shows it per key).
-- Additive only (one new table). Apply by hand to the live D1 database; the deploy does not run it. Needs 0074 first.
-- The code works without it: keys work exactly as before, and the per-feature usage lines simply stay empty.
CREATE TABLE IF NOT EXISTS ai_key_usage (
  key_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  fails INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  last_error TEXT,
  PRIMARY KEY (key_id, feature)
);
