-- Migration 0146: indexes so the background sweeps and the admin Overview stop reading the whole orders table.
-- Additive only (indexes). Apply by hand to the live D1 database; the code works without it, just reads more rows.
-- Without these, every 2-minute sweep that filters orders by stage or environment scans every order.
CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders (stage);
CREATE INDEX IF NOT EXISTS idx_orders_environment_stage ON orders (environment, stage);
CREATE INDEX IF NOT EXISTS idx_orders_payment_rail ON orders (payment_rail);
