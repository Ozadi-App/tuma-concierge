-- Migration 0112: Smart TV screens and live classroom sessions.
-- A TV pairs to an educator's account; the educator runs a live session and decides, cue by cue,
-- what goes to the screen and what goes to the students' phones.
-- Apply by hand after 0111. Until it is applied the classroom endpoints answer "upgrade pending".

CREATE TABLE IF NOT EXISTS tv_devices (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  name TEXT NOT NULL DEFAULT 'TV',
  pair_code TEXT,                              -- shown on the TV until an educator claims it
  pair_expires_at TEXT,
  secret_hash TEXT NOT NULL,                   -- sha-256 of the device secret; the secret itself is only ever on the TV
  status TEXT NOT NULL DEFAULT 'unpaired',     -- unpaired, paired
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paired_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tv_pair_code ON tv_devices(pair_code) WHERE pair_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tv_owner ON tv_devices(owner_id);

CREATE TABLE IF NOT EXISTS edu_live_sessions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES edu_schools(id),
  class_id TEXT REFERENCES edu_classes(id),
  course_id TEXT REFERENCES edu_courses(id),
  host_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  code TEXT NOT NULL,                          -- 6 digits students type or scan; unique among live sessions
  screen_device_id TEXT REFERENCES tv_devices(id),
  status TEXT NOT NULL DEFAULT 'live',         -- live, ended
  version INTEGER NOT NULL DEFAULT 1,          -- bumps on every change so phones can ask "anything new?" cheaply
  screen_cue_id TEXT,                          -- what the TV shows now
  phones_cue_id TEXT,                          -- what the phones show now
  playback_json TEXT NOT NULL DEFAULT '{"playing":true}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_code ON edu_live_sessions(code) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_live_host ON edu_live_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_live_screen ON edu_live_sessions(screen_device_id, status);

CREATE TABLE IF NOT EXISTS edu_live_cues (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES edu_live_sessions(id),
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,                          -- slide, lesson, announcement, timer, question, exam, attendance
  target TEXT NOT NULL DEFAULT 'screen',       -- screen, phones, both: where it goes when pushed
  payload_json TEXT NOT NULL,                  -- includes correct answers; never sent to a phone or the TV before reveal
  status TEXT NOT NULL DEFAULT 'queued',       -- queued, active, closed
  revealed INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  ends_at TEXT,                                -- set when a time limit applies
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cues_session ON edu_live_cues(session_id, position);

CREATE TABLE IF NOT EXISTS edu_live_members (
  session_id TEXT NOT NULL REFERENCES edu_live_sessions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  present_at TEXT,                             -- the moment they tapped "I'm here"
  hand_raised_at TEXT,
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS edu_live_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES edu_live_sessions(id),
  cue_id TEXT NOT NULL REFERENCES edu_live_cues(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  answers_json TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  out_of INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cue_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_resp_session ON edu_live_responses(session_id);
