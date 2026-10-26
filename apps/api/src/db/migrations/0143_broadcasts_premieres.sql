-- Migration 0143: broadcasts and premieres.
-- Additive only. Needs 0136 (Channels) and 0142 (live streams). A broadcast is pre-recorded videos aired back to back
-- at a set time; a premiere is a video's first showing. Both reuse a live_sessions row as the "airing" so they get the
-- same live chat and viewer count. The code checks that these columns exist (hasColumn) and keeps both features off
-- until they do, so deploying before applying this is safe.

ALTER TABLE live_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'camera';
ALTER TABLE live_sessions ADD COLUMN starts_at TEXT;
ALTER TABLE live_sessions ADD COLUMN program_json TEXT;
CREATE INDEX IF NOT EXISTS idx_live_sessions_kind ON live_sessions (kind, status, starts_at);

-- People who asked to be reminded when an airing starts.
CREATE TABLE IF NOT EXISTS live_reminders (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_live_reminders_user ON live_reminders (user_id);
