-- Guest checkout on shared marketplace product links.
-- A guest order is a normal order owned by a shadow customer account, plus one row here
-- holding the tracking code and the details the guest gave. New tables only: code that
-- reads them checks hasTable() first, so deploying before this is applied changes nothing.
CREATE TABLE IF NOT EXISTS guest_orders (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  tracking_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  wants_account INTEGER NOT NULL DEFAULT 0,
  -- 1 when this phone already belonged to a real account and the order was attached to it.
  existing_account INTEGER NOT NULL DEFAULT 0,
  account_activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guest_orders_user ON guest_orders(user_id);

-- One row per delivery message so a stage is never announced twice on the same channel.
CREATE TABLE IF NOT EXISTS guest_notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  event TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, event, channel)
);
