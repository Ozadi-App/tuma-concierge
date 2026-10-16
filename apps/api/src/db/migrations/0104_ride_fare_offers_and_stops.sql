-- Name your fare + multi-stop boda rides. Additive only: new nullable/defaulted
-- columns and new tables; nothing existing is renamed, rebuilt or dropped.
--
-- Name your fare
--   orders.fare_offer             the customer's current offer (UGX); NULL = fixed app price
--   orders.fare_offer_quote       the app's own quote the offer band was measured against
--   orders.fare_offer_expires_at  after this, riders can no longer counter (the job stays open at the offer)
--   orders.fare_offer_raises      how many times the customer raised the offer
--   fee_proposals.kind            'adjust' (existing: assigned rider suggests a new total) or
--                                 'counter' (an unassigned rider's counter to a customer's offer)
--   fee_proposals.rider_id        who countered (NULL for 'adjust', where the assigned rider is implied)
--   fee_proposals.expires_at      a counter waits this long for the customer
--   fee_proposals.closed_reason   why a counter was closed without approval: declined / expired / superseded
--                                 (status itself keeps its existing pending/approved/rejected CHECK)
--   fare_offer_requests           Idempotency-Key replay store for the offer and counter endpoints
--
-- Multi-stop
--   order_stops                   ordered intermediate stops between pickup and destination,
--                                 with per-stop progress (pending → arrived → done)
--   orders.stop_count             number of stops (0 = an ordinary single-destination ride)

ALTER TABLE orders ADD COLUMN fare_offer INTEGER;
ALTER TABLE orders ADD COLUMN fare_offer_quote INTEGER;
ALTER TABLE orders ADD COLUMN fare_offer_expires_at TEXT;
ALTER TABLE orders ADD COLUMN fare_offer_raises INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN stop_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fee_proposals ADD COLUMN kind TEXT NOT NULL DEFAULT 'adjust';
ALTER TABLE fee_proposals ADD COLUMN rider_id TEXT;
ALTER TABLE fee_proposals ADD COLUMN expires_at TEXT;
ALTER TABLE fee_proposals ADD COLUMN closed_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_fee_proposals_counters ON fee_proposals(order_id, kind, status);

CREATE TABLE IF NOT EXISTS fare_offer_requests (
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status INTEGER NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_stops (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  position INTEGER NOT NULL,
  area TEXT,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'done')),
  arrived_at TEXT,
  departed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, position)
);
CREATE INDEX IF NOT EXISTS idx_order_stops_order ON order_stops(order_id, position);
