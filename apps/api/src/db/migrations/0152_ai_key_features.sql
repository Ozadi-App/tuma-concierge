-- Migration 0152: Google AI keys can be reserved for one AI feature (Admin → AI features → separate the keys).
-- Apply by hand to the live D1 database; the deploy does not run it. Needs 0074 first.
-- The code works without it: every feature keeps sharing one pool, and "separate the keys" shows as unavailable.
ALTER TABLE ai_api_keys ADD COLUMN feature TEXT;

-- There is one master key per pool (the shared pool, and each feature's own pool), not one in total.
DROP INDEX IF EXISTS idx_ai_api_keys_master;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_api_keys_master ON ai_api_keys(provider, COALESCE(feature, '')) WHERE is_master = 1;
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_feature ON ai_api_keys(provider, feature);
