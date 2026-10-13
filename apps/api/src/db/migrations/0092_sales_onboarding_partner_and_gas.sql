-- Migration 0092: Expand onboarding_accounts account_type check constraint to include 'partner' and 'gas'
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS onboarding_accounts_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  agent_id TEXT NOT NULL REFERENCES users(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('customer','rider','restaurant','merchant','agent','partner','gas')),
  request_id TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  preferred_channel TEXT NOT NULL DEFAULT 'auto',
  activated_at TEXT,
  last_invited_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, request_id)
);

INSERT OR IGNORE INTO onboarding_accounts_new SELECT * FROM onboarding_accounts;
DROP TABLE onboarding_accounts;
ALTER TABLE onboarding_accounts_new RENAME TO onboarding_accounts;
CREATE INDEX IF NOT EXISTS idx_onboarding_agent ON onboarding_accounts(agent_id, created_at);

PRAGMA foreign_keys=ON;
