-- Migration 0114: Peebee Learn Pro (for the TV classroom) and TV practice classes.
-- edu_educator_plans holds who has Learn Pro and until when (granted by staff or bought from the wallet).
-- tv_devices.trial_slot lets a TV, even one that is not paired yet, show one of the practice classes.
-- Apply by hand after 0113. Run it ONCE: SQLite cannot add the same column twice.
-- TV stays free for every educator until staff switch "TV is a Pro feature" on in the Learn settings.

CREATE TABLE IF NOT EXISTS edu_educator_plans (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'pro',
  source TEXT NOT NULL DEFAULT 'admin',        -- admin (granted by staff), purchase (paid from the wallet)
  price_paid_ugx INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,                              -- NULL means it does not expire
  granted_by TEXT,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE tv_devices ADD COLUMN trial_slot TEXT;
