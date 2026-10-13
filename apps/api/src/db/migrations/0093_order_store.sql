-- Link orders to marketplace stores & groceries so boda riders can deliver marketplace orders
ALTER TABLE orders ADD COLUMN store_id TEXT REFERENCES stores(id);

CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
