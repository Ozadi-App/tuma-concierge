-- Merchant plans (Merchant / Pro / Elite) become real.
-- plan_legacy: stores that existed before plans were enforced keep their current access (admin can end this).
-- Stores made from now on start as a plain merchant (plus the free Pro trial) and upgrade by paying.
ALTER TABLE stores ADD COLUMN plan_legacy INTEGER NOT NULL DEFAULT 0;
UPDATE stores SET plan_legacy = 1;
-- store_subscriptions.tier can only hold pro_store / pro_live, so the plan actually bought (including elite) is
-- recorded alongside it. The money is in the ledger under reference_id = the subscription id.
ALTER TABLE store_subscriptions ADD COLUMN plan TEXT;
