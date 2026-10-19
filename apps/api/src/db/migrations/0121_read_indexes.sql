-- Migration 0121: indexes for the queries that read the most D1 rows.
-- APPLY BY HAND, once. Safe to apply before or after the matching code (it only adds indexes, and re-running does nothing).
--
-- GET /lists/recent looks up the newest order of each list with "WHERE list_id = ?", and orders had no index on
-- list_id, so every lookup read the whole orders table (about 7,000 rows a call on production). The lists query
-- itself had no index on the customer either.

CREATE INDEX IF NOT EXISTS idx_orders_list ON orders(list_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_lists_customer ON lists(customer_id, environment, updated_at);
