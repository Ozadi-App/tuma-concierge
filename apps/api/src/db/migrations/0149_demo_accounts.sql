-- Test accounts that live only in the sandbox and practice worlds.
--
-- Demo people were told apart by an id prefix (practice/people.ts). An account created through normal sign-up
-- (for example a hand-made test rider) has a plain id, so the live matcher treated it as a real rider and could
-- assign real orders to it. `is_demo = 1` marks such an account as a demo person: it is left out of live matching
-- and live lists, and stays available in the sandbox and in practice.
--
-- Nothing here changes any existing row; every account defaults to 0 (a real person).
ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo) WHERE is_demo = 1;
