-- Migration 0142: going live from a phone camera.
-- Additive only. Needs 0135 and 0136 (Channels). The code checks for these tables (hasTable) and keeps
-- "Go live" switched off until they exist, so deploying before applying this is safe.

-- One row per live stream. publish_url is the private address the host's camera sends to; it is only
-- ever returned to the host, never to viewers.
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  publisher_type TEXT NOT NULL,
  publisher_id TEXT NOT NULL,
  title TEXT,
  provider TEXT NOT NULL,
  external_id TEXT,
  publish_url TEXT,
  hls_url TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'live', 'ended')),
  helper_code TEXT,
  helper_code_expires_at TEXT,
  viewer_peak INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  host_seen_at TEXT,
  started_at TEXT,
  max_ends_at TEXT,
  ended_at TEXT,
  environment TEXT NOT NULL DEFAULT 'live',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON live_sessions (host_id, status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_post ON live_sessions (post_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions (status, max_ends_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_code ON live_sessions (helper_code);

-- Live comments. The numeric id is the cursor viewers poll with.
CREATE TABLE IF NOT EXISTS live_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  by_host INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_comments_session ON live_comments (session_id, id);

-- Who is watching right now: a viewer counts while their last heartbeat is recent.
CREATE TABLE IF NOT EXISTS live_viewers (
  session_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (session_id, viewer_key)
);

-- People who joined a stream as helpers with its code.
CREATE TABLE IF NOT EXISTS live_helpers (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, user_id)
);
