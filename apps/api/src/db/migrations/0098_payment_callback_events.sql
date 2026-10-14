-- Migration 0098: replay/idempotency protection for payment provider callbacks.
-- Each (provider, event_key) is processed at most once. Safe to apply before
-- the matching code; the code fails open (still reconciles) if it is missing.
CREATE TABLE IF NOT EXISTS payment_callback_events (
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  reference TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, event_key)
);
